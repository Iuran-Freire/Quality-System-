import express from "express";
import { db } from "../db.js";
import { switchingController } from "../controllers/SwitchingController.js";

const router = express.Router();

const SWITCHING_PASSWORD_KEY = "switching_password_hash"; 

function canManageSwitching(user) {
  return Number(user?.accessLevel || user?.access_level || 3) <= 2;
}

// verificar se existe senha de comutação cadastrada
router.get(
  "/password-status",
  switchingController.getPasswordStatus.bind(
    switchingController
  )
);
// cadastrar ou alterar senha de comutação
router.post(
  "/passoword",
  switchingController.savePassword.bind(
    switchingController
  )
);
// validar senha de comutação
router.post(
  "/passoword/check",
  switchingController.checkPassword.bind(
    switchingController
  )
);

function normalizeResult(value) {
  const result = String(value || "").trim().toUpperCase();

  if (["PASS", "APROVADO", "OK"].includes(result)) return "PASS";
  if (["FAIL", "REPROVADO", "NG"].includes(result)) return "FAIL";

  return result;
}

function normalizeRegime(value) {
  const regime = String(value || "normal").trim().toLowerCase();

  if (regime === "atenuada") return "atenuada";
  if (regime === "severa") return "severa";

  return "normal";
}

function safeJson(value, fallback = {}) {
  if (!value) return fallback;

  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getCharKind(char) {
  return char?.kind || char?.type || "visual_produto";
}

function getSpecialMode(char) {
  const mode = String(char?.resultMode ?? char?.mode ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return ["numerico", "numeric", "number", "numero"].includes(mode)
    ? "numerico"
    : "visual";
}

function isXrfChar(char) {
  return getCharKind(char) === "xrf_rohs";
}

function isNumericCharForSwitching(char) {
  const kind = getCharKind(char);

  return (
    kind === "variavel" ||
    (kind === "teste_especial" && getSpecialMode(char) === "numerico")
  );
}

function normVisual(value) {
  const text = String(value ?? "").trim().toUpperCase();

  if (text === "OK" || text === "PASS") return "OK";
  if (text === "NG" || text === "NOK" || text === "FAIL") return "NG";

  return "";
}

function toNumber(value) {
  if (value === null || value === undefined) return null;

  const number = Number(String(value).trim().replace(",", "."));

  return Number.isFinite(number) ? number : null;
}

function xrfCharHasFailure(char, rawSamples = []) {
  const elements = Array.isArray(char?.elements) ? char.elements : [];

  if (!elements.length) return false;

  return (rawSamples || []).some((sample) => {
    if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
      return false;
    }

    return elements.some((element) => {
      const measured = toNumber(sample?.[element.id]);
      const max = toNumber(element?.max);

      return measured != null && max != null && measured > max;
    });
  });
}

function nonXrfCharCausesFailure(char, rawSamples = [], sampling = {}) {
  const kind = getCharKind(char);

  // Scanner não influencia resultado.
  if (kind === "scanner" || kind === "xrf_rohs") {
    return false;
  }

  // Variável ou teste especial numérico.
  if (isNumericCharForSwitching(char)) {
    const lsl = toNumber(char?.lsl ?? char?.min);
    const usl = toNumber(char?.usl ?? char?.max);

    return (rawSamples || []).some((rawValue) => {
      const measured = toNumber(rawValue);

      if (measured == null) return false;

      return (
        (lsl != null && measured < lsl) ||
        (usl != null && measured > usl)
      );
    });
  }

  const isVisual =
    kind === "visual_produto" ||
    kind === "visual_caixa" ||
    kind === "teste_especial";

  if (!isVisual) return false;

  const ngCount = (rawSamples || [])
    .map(normVisual)
    .filter((value) => value === "NG").length;

  // Visual Caixa e Teste Especial OK/NG:
  // qualquer NG reprova.
  if (kind === "visual_caixa" || kind === "teste_especial") {
    return ngCount > 0;
  }

  // Visual Produto segue Ac/Re.
  const ac = toNumber(sampling?.ac);
  const re = toNumber(sampling?.re);

  if (re == null) {
    return ngCount > 0;
  }

  if (ngCount >= re) {
    return true;
  }

  // Faixa Delta: acima de Ac e abaixo de Re.
  // Com Delta ativo, o lote é aceito e retorna à Normal.
  if (ac != null && ngCount > ac && ngCount < re) {
    return !Boolean(sampling?.returnToNormalOnDelta);
  }

  return false;
}

function getSwitchingOutcome(insp) {
  const actualResult = normalizeResult(insp?.result);

  if (actualResult !== "FAIL") {
    return {
      actualResult,
      switchingResult: actualResult,
      xrfOnlyFailure: false,
    };
  }

  const chars = safeJson(insp?.chars, []);
  const samples = safeJson(insp?.samples, {});
  const sampling = safeJson(insp?.sampling, {});

  const hasXrfFailure = (chars || []).some((char) => {
    if (!isXrfChar(char)) return false;

    return xrfCharHasFailure(char, samples?.[char.id] || []);
  });

  const hasNonXrfFailure = (chars || []).some((char) => {
    if (isXrfChar(char)) return false;

    return nonXrfCharCausesFailure(
      char,
      samples?.[char.id] || [],
      sampling
    );
  });

  const xrfOnlyFailure = hasXrfFailure && !hasNonXrfFailure;

  return {
    actualResult,
    switchingResult: xrfOnlyFailure ? "PASS" : actualResult,
    xrfOnlyFailure,
  };
}

function getSampleNByRegime(plan, regime) {
  const sampling = safeJson(plan?.sampling, {});
  const targetRegime = normalizeRegime(regime);

  const normalN =
    Number(sampling.fixedNormalN || sampling.normalN || plan?.n || 0) || null;

  const reducedN =
    Number(
      sampling.fixedReducedN ||
        sampling.reducedN ||
        sampling.atenuadaN ||
        normalN ||
        plan?.n ||
        0
    ) || null;

  const tightenedN =
    Number(
      sampling.fixedTightenedN ||
        sampling.tightenedN ||
        sampling.severaN ||
        normalN ||
        plan?.n ||
        0
    ) || null;

  if (targetRegime === "atenuada") return reducedN;
  if (targetRegime === "severa") return tightenedN;

  return normalN;
}

function analyzeSwitchingRule(currentRegime, inspections) {
  const regime = normalizeRegime(currentRegime);

const history = inspections.map((insp) => {
  const sampling = safeJson(insp.sampling, {});
  const switchingOutcome = getSwitchingOutcome(insp);

  return {
    id: insp.id,
    lot: insp.lot,
    invoice: insp.invoice,

    // Resultado real da inspeção, continua aparecendo como FAIL no histórico.
    result: switchingOutcome.actualResult,

    // Resultado usado somente nas regras de comutação.
    switchingResult: switchingOutcome.switchingResult,

    // TRUE quando apenas XRF/RoHS causou o FAIL.
    xrfOnlyFailure: switchingOutcome.xrfOnlyFailure,

    finishedAt: insp.finished_at,
    deltaTriggered: Boolean(sampling?.deltaTriggered),
    deltaDetails: Array.isArray(sampling?.deltaDetails)
      ? sampling.deltaDetails
      : [],
    inspectionRegimeSnapshot: String(
      insp.inspection_regime_snapshot || ""
    )
      .trim()
      .toLowerCase(),
  };
});

 // Considera somente lotes consecutivos executados
// no mesmo regime atual do plano.
const consecutiveHistory = [];

for (const item of history) {
  if (item.inspectionRegimeSnapshot !== regime) break;
  consecutiveHistory.push(item);
}

const last10 = consecutiveHistory.slice(0, 10);
const last5 = consecutiveHistory.slice(0, 5);
const last1 = consecutiveHistory.slice(0, 1);
  if (regime === "normal") {
    const has10Pass =
      last10.length >= 10 && last10.every((i) => i.switchingResult === "PASS");

    if (has10Pass) {
      return {
        hasSuggestion: true,
        currentRegime: "normal",
        suggestedRegime: "atenuada",
        reason: "10 lotes consecutivos aprovados.",
        rule: "NORMAL_TO_ATENUADA",
        history,
      };
    }

    const failCountLast5 = last5.filter((i) => i.switchingResult === "FAIL").length;

    if (last5.length >= 5 && failCountLast5 >= 2) {
      return {
        hasSuggestion: true,
        currentRegime: "normal",
        suggestedRegime: "severa",
        reason: "2 lotes reprovados dentro dos últimos 5 lotes consecutivos.",
        rule: "NORMAL_TO_SEVERA",
        history,
      };
    }
  }

  if (regime === "atenuada") {
  const lastInspection = last1[0] || null;

  if (lastInspection?.deltaTriggered) {
    return {
      hasSuggestion: true,
      currentRegime: "atenuada",
      suggestedRegime: "normal",
      reason:
        "Condição Δ: lote aceito com defeitos acima de Ac e abaixo de Re. Retorno para inspeção Normal obrigatório nos lotes seguintes.",
      rule: "ATENUADA_TO_NORMAL_DELTA",
      history,
    };
  }

  const has1Fail = lastInspection?.switchingResult === "FAIL";

  if (has1Fail) {
    return {
      hasSuggestion: true,
      currentRegime: "atenuada",
      suggestedRegime: "normal",
      reason: "1 lote reprovado em inspeção atenuada.",
      rule: "ATENUADA_TO_NORMAL",
      history,
    };
  }
}

  if (regime === "severa") {
    const has5Pass =
      last5.length >= 5 && last5.every((i) => i.switchingResult === "PASS");

    if (has5Pass) {
      return {
        hasSuggestion: true,
        currentRegime: "severa",
        suggestedRegime: "normal",
        reason: "5 lotes consecutivos aprovados em inspeção severa.",
        rule: "SEVERA_TO_NORMAL",
        history,
      };
    }
  }

  return {
    hasSuggestion: false,
    currentRegime: regime,
    suggestedRegime: null,
    reason: "Histórico ainda não atende critério para comutação.",
    rule: null,
    history,
  };
}

// analisar histórico de um plano e retornar sugestão
router.get(
  "/plans/:planId/analyze",
  switchingController.analyzePlan.bind(
    switchingController
  )
);

// gravar sugestão de comutação no plano
router.post(
  "/plans/:planId/suggest",
  switchingController.suggestPlan.bind(
    switchingController
  )
);

// aprovar comutação pendente
router.post(
  "/plans/:planId/approve",
  switchingController.approvePlan.bind(
    switchingController
  )
);

// listar histórico de comutação
router.get("/history", async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT
        h.id,
        h.plan_id,
        p.name AS plan_name,
        p.pn,
        p.model,
        p.client,

        h.previous_regime,
        h.new_regime,
        h.previous_sample_n,
        h.new_sample_n,
        h.switching_type,
        h.switching_status,
        h.reason,
        h.approved_by_name,
        h.approved_by_username,
        h.approved_by_role,
        h.approved_by_level,
        h.approved_at,
        h.created_at
      FROM public.plan_switching_history h
      LEFT JOIN public.plans p
        ON p.id = h.plan_id
      ORDER BY h.approved_at DESC, h.id DESC
      LIMIT 100
      `
    );

    res.json({
      ok: true,
      items: result.rows.map((r) => ({
        id: r.id,
        planId: r.plan_id,
        planName: r.plan_name || "",
        pn: r.pn || "",
        model: r.model || "",
        client: r.client || "",

        previousRegime: r.previous_regime,
        newRegime: r.new_regime,
        previousSampleN: r.previous_sample_n,
        newSampleN: r.new_sample_n,
        switchingType: r.switching_type,
        switchingStatus: r.switching_status,
        reason: r.reason || "",

        approvedByName: r.approved_by_name || "",
        approvedByUsername: r.approved_by_username || "",
        approvedByRole: r.approved_by_role || "",
        approvedByLevel: r.approved_by_level,
        approvedAt: r.approved_at,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error("Erro ao listar histórico de comutação:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao listar histórico de comutação.",
      error: error.message,
    });
  }
});
export default router;