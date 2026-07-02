import express from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import {
  upsertQualityAlert,
  resolveQualityAlertBySourceKey,
} from "../services/alerts.service.js";

const router = express.Router();

const SWITCHING_PASSWORD_KEY = "switching_password_hash"; 

function canManageSwitching(user) {
  return Number(user?.accessLevel || user?.access_level || 3) <= 2;
}

// verificar se existe senha de comutação cadastrada
router.get("/password-status", async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = $1
      `,
      [SWITCHING_PASSWORD_KEY]
    );

    const row = result.rows[0];

    res.json({
      ok: true,
      hasPassword: Boolean(row?.setting_value),
    });
  } catch (error) {
    console.error("Erro ao verificar senha de comutação:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao verificar senha de comutação.",
      error: error.message,
    });
  }
});

// cadastrar ou alterar senha de comutação
router.post("/password", async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (!String(password || "").trim()) {
      return res.status(400).json({
        ok: false,
        message: "Informe a senha de comutação.",
      });
    }

    if (String(password) !== String(confirmPassword)) {
      return res.status(400).json({
        ok: false,
        message: "A confirmação da senha não confere.",
      });
    }

    if (String(password).length < 4) {
      return res.status(400).json({
        ok: false,
        message: "A senha de comutação deve ter pelo menos 4 caracteres.",
      });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    await db.query(
      `
      INSERT INTO system_settings (
        setting_key,
        setting_value,
        description,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        'Senha criptografada para confirmação de comutação de regime de inspeção',
        NOW(),
        NOW()
      )
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        updated_at = NOW()
      `,
      [SWITCHING_PASSWORD_KEY, passwordHash]
    );

    res.json({
      ok: true,
      message: "Senha de comutação salva com sucesso.",
      hasPassword: true,
    });
  } catch (error) {
    console.error("Erro ao salvar senha de comutação:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao salvar senha de comutação.",
      error: error.message,
    });
  }
});

// validar senha de comutação
router.post("/password/check", async (req, res) => {
  try {
    const { password } = req.body;

    if (!String(password || "").trim()) {
      return res.status(400).json({
        ok: false,
        message: "Informe a senha de comutação.",
      });
    }

    const result = await db.query(
      `
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = $1
      `,
      [SWITCHING_PASSWORD_KEY]
    );

    const passwordHash = result.rows[0]?.setting_value;

    if (!passwordHash) {
      return res.status(400).json({
        ok: false,
        message: "Senha de comutação ainda não cadastrada.",
      });
    }

    const valid = await bcrypt.compare(String(password), passwordHash);

    if (!valid) {
      return res.status(401).json({
        ok: false,
        message: "Senha de comutação inválida.",
      });
    }

    res.json({
      ok: true,
      message: "Senha validada com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao validar senha de comutação:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao validar senha de comutação.",
      error: error.message,
    });
  }
});

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
router.get("/plans/:planId/analyze", async (req, res) => {
  try {
    const { planId } = req.params;

    const planResult = await db.query(
      `
      SELECT
  id,
  name,
  pn,
  model,
  client,
  n,
  sampling,
  inspection_regime,
  switching_status,
  suggested_regime,
  switching_reason,
  current_sample_n,
  suggested_sample_n
FROM plans
WHERE id = $1
      `,
      [planId]
    );

    const plan = planResult.rows[0];

    if (!plan) {
      return res.status(404).json({
        ok: false,
        message: "Plano não encontrado.",
      });
    }

    const inspectionsResult = await db.query(
      `
      SELECT
        id,
        plan_id,
        lot,
        invoice,
        result,
        sampling,
        chars,
        samples,
        inspection_regime_snapshot,
        finished_at,
        created_at
      FROM inspections
      WHERE plan_id = $1
        AND finished_at IS NOT NULL
        AND result IS NOT NULL
      ORDER BY finished_at DESC, created_at DESC
      LIMIT 10
      `,
      [planId]
    );

    const analysis = analyzeSwitchingRule(
      plan.inspection_regime,
      inspectionsResult.rows
    );

    res.json({
      ok: true,
      plan: {
        id: plan.id,
        name: plan.name,
        pn: plan.pn,
        model: plan.model,
        client: plan.client,
        currentRegime: normalizeRegime(plan.inspection_regime),
        switchingStatus: plan.switching_status || "sem_pendencia",
        suggestedRegime: plan.suggested_regime,
        switchingReason: plan.switching_reason,
        currentSampleN: plan.current_sample_n,
        suggestedSampleN: plan.suggested_sample_n,
      },
      analysis,
    });
  } catch (error) {
    console.error("Erro ao analisar comutação:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao analisar comutação.",
      error: error.message,
    });
  }
});

// gravar sugestão de comutação no plano
router.post("/plans/:planId/suggest", async (req, res) => {
  try {
    const { planId } = req.params;

    const planResult = await db.query(
      `
      SELECT
        id,
        name,
        pn,
        model,
        client,
        type,
        inspection_regime,
        switching_status,
        suggested_regime,
        switching_reason,
        current_sample_n,
        suggested_sample_n
      FROM plans
      WHERE id = $1
      `,
      [planId]
    );

    const plan = planResult.rows[0];

    if (!plan) {
      return res.status(404).json({
        ok: false,
        message: "Plano não encontrado.",
      });
    }

    const inspectionsResult = await db.query(
      `
      SELECT
        id,
        plan_id,
        lot,
        invoice,
        result,
        chars,
        samples,
        sampling,
        inspection_regime_snapshot,
        finished_at,
        created_at
      FROM inspections
      WHERE plan_id = $1
        AND finished_at IS NOT NULL
        AND result IS NOT NULL
      ORDER BY finished_at DESC, created_at DESC
      LIMIT 10
      `,
      [planId]
    );

    const analysis = analyzeSwitchingRule(
      plan.inspection_regime,
      inspectionsResult.rows
    );

    if (!analysis.hasSuggestion) {
      return res.status(400).json({
        ok: false,
        message: "O histórico ainda não atende critério para comutação.",
        analysis,
      });
    }

    const currentSampleN = getSampleNByRegime(plan, analysis.currentRegime);
    const suggestedSampleN = getSampleNByRegime(plan, analysis.suggestedRegime);

    const updateResult = await db.query(
      `
      UPDATE plans
SET
  switching_status = 'pendente',
  suggested_regime = $1,
  switching_reason = $2,
  current_sample_n = $3,
  suggested_sample_n = $4,
  switching_suggested_at = NOW(),
  switching_suggested_by = 'Sistema',
  switching_updated_at = NOW()
WHERE id = $5
      RETURNING
        id,
        name,
        pn,
        model,
        client,
        inspection_regime,
        switching_status,
        suggested_regime,
        switching_reason,
        current_sample_n,
        suggested_sample_n,
        switching_suggested_at,
        switching_suggested_by,
        switching_updated_at
      `,
      [
  analysis.suggestedRegime,
  analysis.reason,
  currentSampleN,
  suggestedSampleN,
  planId,
]
    );

    try {
  await upsertQualityAlert({
    alertType: "SWITCHING_PENDING",
    severity: "warning",
    title: "Comutação NBR pendente",
    message:
      `Plano: ${plan.name || "-"} | PN: ${plan.pn || "-"} | ` +
      `Regime atual: ${analysis.currentRegime} | ` +
      `Regime sugerido: ${analysis.suggestedRegime}. ` +
      `Motivo: ${analysis.reason}`,
    planId: plan.id,
    inspectionArea: plan.type || "ALL",
    sourceKey: `SWITCHING_PENDING:PLAN:${plan.id}`,
    context: {
      planName: plan.name || "",
      pn: plan.pn || "",
      model: plan.model || "",
      currentRegime: analysis.currentRegime,
      suggestedRegime: analysis.suggestedRegime,
      reason: analysis.reason,
    },
  });
} catch (alertError) {
  console.error(
    "Sugestão registrada, mas não foi possível criar o alerta de comutação:",
    alertError
  );
}

    res.json({
      ok: true,
      message: "Sugestão de comutação registrada com sucesso.",
      plan: {
        id: updateResult.rows[0].id,
        name: updateResult.rows[0].name,
        pn: updateResult.rows[0].pn,
        model: updateResult.rows[0].model,
        client: updateResult.rows[0].client,
        currentRegime: normalizeRegime(updateResult.rows[0].inspection_regime),
        switchingStatus: updateResult.rows[0].switching_status,
        suggestedRegime: updateResult.rows[0].suggested_regime,
        switchingReason: updateResult.rows[0].switching_reason,
        currentSampleN: updateResult.rows[0].current_sample_n,
        suggestedSampleN: updateResult.rows[0].suggested_sample_n,
        switchingSuggestedAt: updateResult.rows[0].switching_suggested_at,
        switchingSuggestedBy: updateResult.rows[0].switching_suggested_by,
        switchingUpdatedAt: updateResult.rows[0].switching_updated_at,
      },
      analysis,
    });
  } catch (error) {
    console.error("Erro ao registrar sugestão de comutação:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao registrar sugestão de comutação.",
      error: error.message,
    });
  }
});

// aprovar comutação pendente
router.post("/plans/:planId/approve", async (req, res) => {
  try {
    const { planId } = req.params;
    const { password, approvedBy } = req.body;

    if (!String(password || "").trim()) {
      return res.status(400).json({
        ok: false,
        message: "Informe a senha de comutação.",
      });
    }

    const userLevel = Number(approvedBy?.accessLevel || approvedBy?.access_level || 3);

    if (userLevel > 2) {
      return res.status(403).json({
        ok: false,
        message: "Usuário sem permissão para aprovar comutação.",
      });
    }

    const passwordResult = await db.query(
      `
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = $1
      `,
      [SWITCHING_PASSWORD_KEY]
    );

    const passwordHash = passwordResult.rows[0]?.setting_value;

    if (!passwordHash) {
      return res.status(400).json({
        ok: false,
        message: "Senha de comutação ainda não cadastrada.",
      });
    }

    const passwordOk = await bcrypt.compare(String(password), passwordHash);

    if (!passwordOk) {
      return res.status(401).json({
        ok: false,
        message: "Senha de comutação inválida.",
      });
    }

    const planResult = await db.query(
      `
      SELECT
  id,
  name,
  pn,
  model,
  client,
  n,
  sampling,
  inspection_regime,
  switching_status,
  suggested_regime,
  switching_reason,
  current_sample_n,
  suggested_sample_n
FROM plans
WHERE id = $1
      `,
      [planId]
    );

    const plan = planResult.rows[0];

    if (!plan) {
      return res.status(404).json({
        ok: false,
        message: "Plano não encontrado.",
      });
    }

    if (plan.switching_status !== "pendente" || !plan.suggested_regime) {
      return res.status(400).json({
        ok: false,
        message: "Este plano não possui comutação pendente.",
      });
    }

    const previousRegime = normalizeRegime(plan.inspection_regime);
    const newRegime = normalizeRegime(plan.suggested_regime);

    const previousSampleN =
  Number(plan.current_sample_n || plan.n || 0) || null;

const newSampleN =
  Number(plan.suggested_sample_n || getSampleNByRegime(plan, newRegime) || previousSampleN || 0) ||
  null;

    await db.query("BEGIN");

    const updateResult = await db.query(
      `
      UPDATE plans
SET
  inspection_regime = $1,
  n = $2,
  switching_status = 'aprovado',
  suggested_regime = NULL,
  switching_reason = NULL,
  current_sample_n = $2,
  suggested_sample_n = NULL,
  switching_updated_at = NOW()
WHERE id = $3
      RETURNING
        id,
        name,
        pn,
        model,
        client,
        inspection_regime,
        switching_status,
        suggested_regime,
        switching_reason,
        current_sample_n,
        suggested_sample_n,
        switching_updated_at
      `,
      [newRegime, newSampleN, planId]
    );

    await db.query(
      `
      INSERT INTO plan_switching_history (
        plan_id,
        previous_regime,
        new_regime,
        previous_sample_n,
        new_sample_n,
        switching_type,
        switching_status,
        reason,
        history_snapshot,
        approved_by_id,
        approved_by_name,
        approved_by_username,
        approved_by_role,
        approved_by_level,
        approved_at,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        'sugerida',
        'aprovado',
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        NOW(),
        NOW()
      )
      `,
      [
        plan.id,
        previousRegime,
        newRegime,
        previousSampleN,
        newSampleN,
        plan.switching_reason,
        JSON.stringify({
          planId: plan.id,
          pn: plan.pn,
          model: plan.model,
          client: plan.client,
          previousRegime,
          newRegime,
          reason: plan.switching_reason,
        }),
        approvedBy?.id || null,
        approvedBy?.name || "Não informado",
        approvedBy?.username || "",
        approvedBy?.role || "",
        userLevel,
      ]
    );

    await db.query("COMMIT");

try {
  await resolveQualityAlertBySourceKey({
    sourceKey: `SWITCHING_PENDING:PLAN:${plan.id}`,
    resolvedBy:
      req.user?.name ||
      req.user?.username ||
      approvedBy?.name ||
      approvedBy?.username ||
      "Sistema",
    resolutionNote:
      `Comutação aprovada: ${previousRegime} → ${newRegime}.`,
  });
} catch (alertError) {
  console.error(
    "Comutação aprovada, mas não foi possível resolver o alerta:",
    alertError
  );
}

const updated = updateResult.rows[0];

    res.json({
      ok: true,
      message: "Comutação aprovada com sucesso.",
      plan: {
        id: updated.id,
        name: updated.name,
        pn: updated.pn,
        model: updated.model,
        client: updated.client,
        currentRegime: normalizeRegime(updated.inspection_regime),
        switchingStatus: updated.switching_status,
        suggestedRegime: updated.suggested_regime,
        switchingReason: updated.switching_reason,
        currentSampleN: updated.current_sample_n,
        suggestedSampleN: updated.suggested_sample_n,
        switchingUpdatedAt: updated.switching_updated_at,
      },
    });
  } catch (error) {
    await db.query("ROLLBACK");

    console.error("Erro ao aprovar comutação:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao aprovar comutação.",
      error: error.message,
    });
  }
});

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