import bcrypt from "bcryptjs";
import { switchingRepository } from "../repositories/SwitchingRepository.js";
import { upsertQualityAlert , resolveQualityAlertBySourceKey } from "./alerts.service.js";

const SWITCHING_PASSWORD_KEY =
  "switching_password_hash";

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeResult(value) {
  const result = String(value || "")
    .trim()
    .toUpperCase();

  if (["PASS", "APROVADO", "OK"].includes(result)) {
    return "PASS";
  }

  if (["FAIL", "REPROVADO", "NG"].includes(result)) {
    return "FAIL";
  }

  return result;
}

function normalizeRegime(value) {
  const regime = String(value || "normal")
    .trim()
    .toLowerCase();

  if (regime === "atenuada") return "atenuada";
  if (regime === "severa") return "severa";

  return "normal";
}

function safeJson(value, fallback = {}) {
  if (!value) return fallback;

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getCharKind(char) {
  return (
    char?.kind ||
    char?.type ||
    "visual_produto"
  );
}

function getSpecialMode(char) {
  const mode = String(
    char?.resultMode ??
    char?.mode ??
    ""
  )
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return [
    "numerico",
    "numeric",
    "number",
    "numero",
  ].includes(mode)
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
    (
      kind === "teste_especial" &&
      getSpecialMode(char) === "numerico"
    )
  );
}

function normVisual(value) {
  const text = String(value ?? "")
    .trim()
    .toUpperCase();

  if (text === "OK" || text === "PASS") {
    return "OK";
  }

  if (
    text === "NG" ||
    text === "NOK" ||
    text === "FAIL"
  ) {
    return "NG";
  }

  return "";
}

function toNumber(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number = Number(
    String(value)
      .trim()
      .replace(",", ".")
  );

  return Number.isFinite(number)
    ? number
    : null;
}

function xrfCharHasFailure(
  char,
  rawSamples = []
) {
  const elements =
    Array.isArray(char?.elements)
      ? char.elements
      : [];

  if (!elements.length) {
    return false;
  }

  return (rawSamples || []).some(
    (sample) => {
      if (
        !sample ||
        typeof sample !== "object" ||
        Array.isArray(sample)
      ) {
        return false;
      }

      return elements.some(
        (element) => {
          const measured =
            toNumber(
              sample?.[element.id]
            );

          const max =
            toNumber(element?.max);

          return (
            measured != null &&
            max != null &&
            measured > max
          );
        }
      );
    }
  );
}

function nonXrfCharCausesFailure(
  char,
  rawSamples = [],
  sampling = {}
) {
  const kind = getCharKind(char);

  if (
    kind === "scanner" ||
    kind === "xrf_rohs"
  ) {
    return false;
  }

  if (
    isNumericCharForSwitching(char)
  ) {
    const lsl = toNumber(
      char?.lsl ?? char?.min
    );

    const usl = toNumber(
      char?.usl ?? char?.max
    );

    return (rawSamples || []).some(
      (rawValue) => {
        const measured =
          toNumber(rawValue);

        if (measured == null) {
          return false;
        }

        return (
          (
            lsl != null &&
            measured < lsl
          ) ||
          (
            usl != null &&
            measured > usl
          )
        );
      }
    );
  }

  const isVisual =
    kind === "visual_produto" ||
    kind === "visual_caixa" ||
    kind === "teste_especial";

  if (!isVisual) {
    return false;
  }

  const ngCount =
    (rawSamples || [])
      .map(normVisual)
      .filter(
        (value) => value === "NG"
      ).length;

  if (
    kind === "visual_caixa" ||
    kind === "teste_especial"
  ) {
    return ngCount > 0;
  }

  const ac = toNumber(
    sampling?.ac
  );

  const re = toNumber(
    sampling?.re
  );

  if (re == null) {
    return ngCount > 0;
  }

  if (ngCount >= re) {
    return true;
  }

  if (
    ac != null &&
    ngCount > ac &&
    ngCount < re
  ) {
    return !Boolean(
      sampling?.returnToNormalOnDelta
    );
  }

  return false;
}

function getSwitchingOutcome(insp) {
  const actualResult =
    normalizeResult(insp?.result);

  if (actualResult !== "FAIL") {
    return {
      actualResult,
      switchingResult:
        actualResult,
      xrfOnlyFailure: false,
    };
  }

  const chars =
    safeJson(insp?.chars, []);

  const samples =
    safeJson(insp?.samples, {});

  const sampling =
    safeJson(insp?.sampling, {});

  const hasXrfFailure =
    (chars || []).some((char) => {
      if (!isXrfChar(char)) {
        return false;
      }

      return xrfCharHasFailure(
        char,
        samples?.[char.id] || []
      );
    });

  const hasNonXrfFailure =
    (chars || []).some((char) => {
      if (isXrfChar(char)) {
        return false;
      }

      return nonXrfCharCausesFailure(
        char,
        samples?.[char.id] || [],
        sampling
      );
    });

  const xrfOnlyFailure =
    hasXrfFailure &&
    !hasNonXrfFailure;

  return {
    actualResult,

    switchingResult:
      xrfOnlyFailure
        ? "PASS"
        : actualResult,

    xrfOnlyFailure,
  };
}

function getSampleNByRegime(plan, regime) {
  const sampling = safeJson(
    plan?.sampling,
    {}
  );

  const targetRegime =
    normalizeRegime(regime);

  const normalN =
    Number(
      sampling.fixedNormalN ||
      sampling.normalN ||
      plan?.n ||
      0
    ) || null;

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

  if (targetRegime === "atenuada") {
    return reducedN;
  }

  if (targetRegime === "severa") {
    return tightenedN;
  }

  return normalN;
}

function analyzeSwitchingRule(
  currentRegime,
  inspections
) {
  const regime =
    normalizeRegime(
      currentRegime
    );

  const history =
    inspections.map((insp) => {
      const sampling =
        safeJson(
          insp.sampling,
          {}
        );

      const switchingOutcome =
        getSwitchingOutcome(insp);

      return {
        id: insp.id,
        lot: insp.lot,
        invoice: insp.invoice,

        result:
          switchingOutcome.actualResult,

        switchingResult:
          switchingOutcome.switchingResult,

        xrfOnlyFailure:
          switchingOutcome.xrfOnlyFailure,

        finishedAt:
          insp.finished_at,

        deltaTriggered:
          Boolean(
            sampling?.deltaTriggered
          ),

        deltaDetails:
          Array.isArray(
            sampling?.deltaDetails
          )
            ? sampling.deltaDetails
            : [],

        inspectionRegimeSnapshot:
          String(
            insp.inspection_regime_snapshot ||
            ""
          )
            .trim()
            .toLowerCase(),
      };
    });

  const consecutiveHistory = [];

  for (const item of history) {
    if (
      item.inspectionRegimeSnapshot !==
      regime
    ) {
      break;
    }

    consecutiveHistory.push(item);
  }

  const last10 =
    consecutiveHistory.slice(0, 10);

  const last5 =
    consecutiveHistory.slice(0, 5);

  const last1 =
    consecutiveHistory.slice(0, 1);

  if (regime === "normal") {
    const has10Pass =
      last10.length >= 10 &&
      last10.every(
        (i) =>
          i.switchingResult === "PASS"
      );

    if (has10Pass) {
      return {
        hasSuggestion: true,
        currentRegime: "normal",
        suggestedRegime: "atenuada",
        reason:
          "10 lotes consecutivos aprovados.",
        rule:
          "NORMAL_TO_ATENUADA",
        history,
      };
    }

    const failCountLast5 =
      last5.filter(
        (i) =>
          i.switchingResult === "FAIL"
      ).length;

    if (
      last5.length >= 5 &&
      failCountLast5 >= 2
    ) {
      return {
        hasSuggestion: true,
        currentRegime: "normal",
        suggestedRegime: "severa",
        reason:
          "2 lotes reprovados dentro dos últimos 5 lotes consecutivos.",
        rule:
          "NORMAL_TO_SEVERA",
        history,
      };
    }
  }

  if (regime === "atenuada") {
    const lastInspection =
      last1[0] || null;

    if (
      lastInspection?.deltaTriggered
    ) {
      return {
        hasSuggestion: true,
        currentRegime:
          "atenuada",
        suggestedRegime:
          "normal",

        reason:
          "Condição Δ: lote aceito com defeitos acima de Ac e abaixo de Re. Retorno para inspeção Normal obrigatório nos lotes seguintes.",

        rule:
          "ATENUADA_TO_NORMAL_DELTA",

        history,
      };
    }

    const has1Fail =
      lastInspection
        ?.switchingResult ===
      "FAIL";

    if (has1Fail) {
      return {
        hasSuggestion: true,
        currentRegime:
          "atenuada",
        suggestedRegime:
          "normal",

        reason:
          "1 lote reprovado em inspeção atenuada.",

        rule:
          "ATENUADA_TO_NORMAL",

        history,
      };
    }
  }

  if (regime === "severa") {
    const has5Pass =
      last5.length >= 5 &&
      last5.every(
        (i) =>
          i.switchingResult === "PASS"
      );

    if (has5Pass) {
      return {
        hasSuggestion: true,
        currentRegime:
          "severa",
        suggestedRegime:
          "normal",

        reason:
          "5 lotes consecutivos aprovados em inspeção severa.",

        rule:
          "SEVERA_TO_NORMAL",

        history,
      };
    }
  }

  return {
    hasSuggestion: false,
    currentRegime: regime,
    suggestedRegime: null,

    reason:
      "Histórico ainda não atende critério para comutação.",

    rule: null,
    history,
  };
}

export class SwitchingService {
  async getPasswordStatus() {
    const passwordHash =
      await switchingRepository.getSetting(
        SWITCHING_PASSWORD_KEY
      );

    return {
      hasPassword: Boolean(passwordHash),
    };
  }

  async savePassword({
    password,
    confirmPassword,
  } = {}) {
    if (!String(password || "").trim()) {
      throw createServiceError(
        "Informe a senha de comutação.",
        400
      );
    }

    if (
      String(password) !==
      String(confirmPassword)
    ) {
      throw createServiceError(
        "A confirmação da senha não confere.",
        400
      );
    }

    if (String(password).length < 4) {
      throw createServiceError(
        "A senha de comutação deve ter pelo menos 4 caracteres.",
        400
      );
    }

    const passwordHash =
      await bcrypt.hash(
        String(password),
        10
      );

    await switchingRepository.saveSetting(
      SWITCHING_PASSWORD_KEY,
      passwordHash,
      "Senha criptografada para confirmação de comutação de regime de inspeção"
    );

    return {
      hasPassword: true,
    };
  }

  async checkPassword(password) {
    if (!String(password || "").trim()) {
      throw createServiceError(
        "Informe a senha de comutação.",
        400
      );
    }

    const passwordHash =
      await switchingRepository.getSetting(
        SWITCHING_PASSWORD_KEY
      );

    if (!passwordHash) {
      throw createServiceError(
        "Senha de comutação ainda não cadastrada.",
        400
      );
    }

    const valid = await bcrypt.compare(
      String(password),
      passwordHash
    );

    if (!valid) {
      throw createServiceError(
        "Senha de comutação inválida.",
        401
      );
    }

    return true;
  }

  async analyzePlan(planId) {
  const plan =
    await switchingRepository.findPlanForAnalysis(
      planId
    );

  if (!plan) {
    throw createServiceError(
      "Plano não encontrado.",
      404
    );
  }

  const inspections =
    await switchingRepository.findInspectionHistory(
      planId
    );

  const analysis =
    analyzeSwitchingRule(
      plan.inspection_regime,
      inspections
    );

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      pn: plan.pn,
      model: plan.model,
      client: plan.client,

      currentRegime:
        normalizeRegime(
          plan.inspection_regime
        ),

      switchingStatus:
        plan.switching_status ||
        "sem_pendencia",

      suggestedRegime:
        plan.suggested_regime,

      switchingReason:
        plan.switching_reason,

      currentSampleN:
        plan.current_sample_n,

      suggestedSampleN:
        plan.suggested_sample_n,
    },

    analysis,
  };
}

async suggestPlan(planId) {
  const plan =
    await switchingRepository.findPlanForAnalysis(
      planId
    );

  if (!plan) {
    throw createServiceError(
      "Plano não encontrado.",
      404
    );
  }

  const inspections =
    await switchingRepository.findInspectionHistory(
      planId
    );

  const analysis =
    analyzeSwitchingRule(
      plan.inspection_regime,
      inspections
    );

  if (!analysis.hasSuggestion) {
    const error = createServiceError(
      "O histórico ainda não atende critério para comutação.",
      400
    );

    error.analysis = analysis;

    throw error;
  }

  const currentSampleN =
    getSampleNByRegime(
      plan,
      analysis.currentRegime
    );

  const suggestedSampleN =
    getSampleNByRegime(
      plan,
      analysis.suggestedRegime
    );

  const updatedPlan =
    await switchingRepository.saveSuggestion({
      planId,

      suggestedRegime:
        analysis.suggestedRegime,

      reason:
        analysis.reason,

      currentSampleN,
      suggestedSampleN,
    });

  try {
    await upsertQualityAlert({
      alertType:
        "SWITCHING_PENDING",

      severity:
        "warning",

      title:
        "Comutação NBR pendente",

      message:
        `Plano: ${plan.name || "-"} | ` +
        `PN: ${plan.pn || "-"} | ` +
        `Regime atual: ${analysis.currentRegime} | ` +
        `Regime sugerido: ${analysis.suggestedRegime}. ` +
        `Motivo: ${analysis.reason}`,

      planId:
        plan.id,

      inspectionArea:
        plan.type || "ALL",

      sourceKey:
        `SWITCHING_PENDING:PLAN:${plan.id}`,

      context: {
        planName:
          plan.name || "",

        pn:
          plan.pn || "",

        model:
          plan.model || "",

        currentRegime:
          analysis.currentRegime,

        suggestedRegime:
          analysis.suggestedRegime,

        reason:
          analysis.reason,
      },
    });
  } catch (alertError) {
    console.error(
      "Sugestão registrada, mas não foi possível criar o alerta de comutação:",
      alertError
    );
  }

  return {
    plan: {
      id:
        updatedPlan.id,

      name:
        updatedPlan.name,

      pn:
        updatedPlan.pn,

      model:
        updatedPlan.model,

      client:
        updatedPlan.client,

      currentRegime:
        normalizeRegime(
          updatedPlan.inspection_regime
        ),

      switchingStatus:
        updatedPlan.switching_status,

      suggestedRegime:
        updatedPlan.suggested_regime,

      switchingReason:
        updatedPlan.switching_reason,

      currentSampleN:
        updatedPlan.current_sample_n,

      suggestedSampleN:
        updatedPlan.suggested_sample_n,

      switchingSuggestedAt:
        updatedPlan.switching_suggested_at,

      switchingSuggestedBy:
        updatedPlan.switching_suggested_by,

      switchingUpdatedAt:
        updatedPlan.switching_updated_at,
    },

    analysis,
  };
}

async approvePlan(
  user,
  planId,
  { password } = {}
) {
  if (!String(password || "").trim()) {
    throw createServiceError(
      "Informe a senha de comutação.",
      400
    );
  }

  const userLevel = Number(
    user?.accessLevel ||
    user?.access_level ||
    3
  );

  if (userLevel > 2) {
    throw createServiceError(
      "Usuário sem permissão para aprovar comutação.",
      403
    );
  }

  // Reaproveita a validação de senha
  // que já criamos anteriormente.
  await this.checkPassword(password);

  const plan =
    await switchingRepository.findPlanForAnalysis(
      planId
    );

  if (!plan) {
    throw createServiceError(
      "Plano não encontrado.",
      404
    );
  }

  if (
    plan.switching_status !== "pendente" ||
    !plan.suggested_regime
  ) {
    throw createServiceError(
      "Este plano não possui comutação pendente.",
      400
    );
  }

  const previousRegime =
    normalizeRegime(
      plan.inspection_regime
    );

  const newRegime =
    normalizeRegime(
      plan.suggested_regime
    );

  const previousSampleN =
    Number(
      plan.current_sample_n ||
      plan.n ||
      0
    ) || null;

  const newSampleN =
    Number(
      plan.suggested_sample_n ||
      getSampleNByRegime(
        plan,
        newRegime
      ) ||
      previousSampleN ||
      0
    ) || null;

  const approvedBy = {
    id:
      user?.id || null,

    name:
      user?.name ||
      user?.username ||
      "Não informado",

    username:
      user?.username || "",

    role:
      user?.role ||
      user?.cargo ||
      "",

    accessLevel:
      userLevel,
  };

  const updated =
    await switchingRepository.approveSwitchingWithHistory({
      plan,
      previousRegime,
      newRegime,
      previousSampleN,
      newSampleN,
      approvedBy,
    });

  try {
    await resolveQualityAlertBySourceKey({
      sourceKey:
        `SWITCHING_PENDING:PLAN:${plan.id}`,

      resolvedBy:
        approvedBy.name ||
        approvedBy.username ||
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

  return {
    id: updated.id,
    name: updated.name,
    pn: updated.pn,
    model: updated.model,
    client: updated.client,

    currentRegime:
      normalizeRegime(
        updated.inspection_regime
      ),

    switchingStatus:
      updated.switching_status,

    suggestedRegime:
      updated.suggested_regime,

    switchingReason:
      updated.switching_reason,

    currentSampleN:
      updated.current_sample_n,

    suggestedSampleN:
      updated.suggested_sample_n,

    switchingUpdatedAt:
      updated.switching_updated_at,
  };
}

async getHistory() {
  const rows =
    await switchingRepository.findSwitchingHistory();

  return rows.map((row) => ({
    id: row.id,

    planId: row.plan_id,

    planName:
      row.plan_name || "",

    pn:
      row.pn || "",

    model:
      row.model || "",

    client:
      row.client || "",

    previousRegime:
      row.previous_regime,

    newRegime:
      row.new_regime,

    previousSampleN:
      row.previous_sample_n,

    newSampleN:
      row.new_sample_n,

    switchingType:
      row.switching_type,

    switchingStatus:
      row.switching_status,

    reason:
      row.reason || "",

    approvedByName:
      row.approved_by_name || "",

    approvedByUsername:
      row.approved_by_username || "",

    approvedByRole:
      row.approved_by_role || "",

    approvedByLevel:
      row.approved_by_level,

    approvedAt:
      row.approved_at,

    createdAt:
      row.created_at,
  }));
}

}

export const switchingService =
  new SwitchingService();