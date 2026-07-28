import bcrypt from "bcryptjs";
import { switchingRepository } from "../repositories/SwitchingRepository.js";

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
}

export const switchingService =
  new SwitchingService();