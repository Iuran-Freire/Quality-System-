import express from "express";
import { db } from "../db.js";
import { createInspectionFailAlert, createDeltaReturnAlert } from "../services/alerts.service.js";
import { inspectionController } from "../controllers/InspectionController.js";

const router = express.Router();

function normalizeInspectionArea(value) {
  const area = String(value || "")
    .trim()
    .toUpperCase();

  return ["IQC", "OQC", "ALL"].includes(area) ? area : null;
}

function getLoggedUserArea(req) {
  return normalizeInspectionArea(
    req.user?.inspectionArea ??
      req.user?.inspection_area ??
      req.user?.area ??
      ""
  );
}

function userCanAccessArea(req, inspectionArea) {
  const userArea = getLoggedUserArea(req);
  const targetArea = normalizeInspectionArea(inspectionArea);

  if (!userArea || !targetArea) {
    return false;
  }

  return userArea === "ALL" || userArea === targetArea;
}

function sendInvalidUserArea(res) {
  return res.status(403).json({
    ok: false,
    message:
      "Seu usuário não possui uma área de inspeção válida. Verifique o cadastro do usuário.",
  });
}

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

  // Scanner e XRF não são critérios diretos de comutação.
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
  // qualquer NG é falha.
  if (kind === "visual_caixa" || kind === "teste_especial") {
    return ngCount > 0;
  }

  // Visual Produto: usa Ac/Re.
  const ac = toNumber(sampling?.ac);
  const re = toNumber(sampling?.re);

  if (re == null) {
    return ngCount > 0;
  }

  if (ngCount >= re) {
    return true;
  }

  // Condição Delta aceita o lote, mas força retorno ao Normal.
  if (ac != null && ngCount > ac && ngCount < re) {
    return !Boolean(sampling?.returnToNormalOnDelta);
  }

  return false;
}

function getSwitchingOutcome(inspection) {
  const actualResult = normalizeResult(inspection?.result);

  // Apenas inspeções FAIL precisam ser investigadas.
  if (actualResult !== "FAIL") {
    return {
      actualResult,
      switchingResult: actualResult,
      xrfOnlyFailure: false,
    };
  }

  const chars = safeJson(inspection?.chars, []);
  const samples = safeJson(inspection?.samples, {});
  const sampling = safeJson(inspection?.sampling, {});

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

function needsSwitching(currentRegime, inspections = []) {
  const regime = normalizeRegime(currentRegime);

  const history = inspections.map((item) => {
    const sampling = safeJson(item.sampling, {});
    const switchingOutcome = getSwitchingOutcome(item);

    return {
      result: switchingOutcome.actualResult,
      switchingResult: switchingOutcome.switchingResult,
      xrfOnlyFailure: switchingOutcome.xrfOnlyFailure,

      deltaTriggered: Boolean(sampling?.deltaTriggered),

      inspectionRegimeSnapshot: String(
        item.inspection_regime_snapshot || ""
      )
        .trim()
        .toLowerCase(),
    };
  });

  // Só considera lotes consecutivos feitos no regime atual.
  const consecutiveHistory = [];

  for (const item of history) {
    if (item.inspectionRegimeSnapshot !== regime) break;
    consecutiveHistory.push(item);
  }

  const last10 = consecutiveHistory.slice(0, 10);
  const last5 = consecutiveHistory.slice(0, 5);
  const last1 = consecutiveHistory.slice(0, 1);

  if (
    regime === "normal" &&
    last10.length >= 10 &&
    last10.every((item) => item.switchingResult === "PASS")
  ) {
    return {
      blocked: true,
      suggestedRegime: "atenuada",
      reason: "10 lotes consecutivos aprovados.",
    };
  }

  if (regime === "normal") {
    const failCount = last5.filter(
      (item) => item.switchingResult === "FAIL"
    ).length;

    if (last5.length >= 5 && failCount >= 2) {
      return {
        blocked: true,
        suggestedRegime: "severa",
        reason: "2 lotes reprovados dentro dos últimos 5 lotes consecutivos.",
      };
    }
  }

  if (regime === "atenuada" && last1.length >= 1) {
    if (last1[0].deltaTriggered) {
      return {
        blocked: true,
        suggestedRegime: "normal",
        reason:
          "Condição Δ identificada: retorno para inspeção Normal obrigatório nos lotes seguintes.",
      };
    }

    if (last1[0].switchingResult === "FAIL") {
      return {
        blocked: true,
        suggestedRegime: "normal",
        reason: "1 lote reprovado em inspeção atenuada.",
      };
    }
  }

  if (
    regime === "severa" &&
    last5.length >= 5 &&
    last5.every((item) => item.switchingResult === "PASS")
  ) {
    return {
      blocked: true,
      suggestedRegime: "normal",
      reason: "5 lotes consecutivos aprovados em inspeção severa.",
    };
  }

  return {
    blocked: false,
    suggestedRegime: null,
    reason: "",
  };
}

function mapInspection(row) {
  return {
    id: String(row.id),

    planId: row.plan_id,
    planName: row.plan_name,

    planRevisionNumber: Number(row.plan_revision_number || 1),
    plan_revision_number: Number(row.plan_revision_number || 1),

    type: row.type,
    pn: row.pn,
    model: row.model,
    client: row.client,
    supplier: row.supplier,

    lot: row.lot,
    invoice: row.invoice,
    lotSize: row.lot_size,
    shift: row.shift,
    resp: row.resp,
    inspection_regime_snapshot: row.inspection_regime_snapshot,
    sample_n_snapshot: row.sample_n_snapshot,

    inspectionRegimeSnapshot: row.inspection_regime_snapshot,
    sampleNSnapshot: row.sample_n_snapshot,
    obs: row.obs,

    status: row.status,
result: row.result,

conditionalApprovalStatus:
  row.conditional_approval_status || "none",
conditionalApprovalReason:
  row.conditional_approval_reason || "",
conditionalApprovalBy:
  row.conditional_approval_by || "",
conditionalApprovalByUser:
  row.conditional_approval_by_user || "",
conditionalApprovalByRole:
  row.conditional_approval_by_role || "",
conditionalApprovalAt:
  row.conditional_approval_at || null,
conditionalApprovalNote:
  row.conditional_approval_note || "",

    startedAt: row.started_at,
    finishedAt: row.finished_at,

    createdBy: row.created_by,
    createdByUser: row.created_by_user,
    createdByRole: row.created_by_role,

    updatedBy: row.updated_by,
    updatedByUser: row.updated_by_user,
    updatedByRole: row.updated_by_role,

    finishedBy: row.finished_by,
    finishedByUser: row.finished_by_user,
    finishedByRole: row.finished_by_role,

    planSamples: row.plan_samples,
    planBoxQty: row.plan_box_qty,
    boxQty: row.box_qty,

    sampling: row.sampling || null,
    chars: row.chars || [],
    samples: row.samples || {},

    parentInspectionId: row.parent_inspection_id,
    isReinspection: row.is_reinspection ?? false,
    inspectionCycle: row.inspection_cycle ?? 1,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get(
  "/",
  inspectionController.list.bind(
    inspectionController
  )
);

router.get(
  "/:id",
  inspectionController.getById.bind(
    inspectionController
  )
);

router.post(
  "/",
  inspectionController.create.bind(
    inspectionController
  )
);

router.put(
  "/:id",
  inspectionController.update.bind(
    inspectionController
  )
);
router.patch(
  "/:id/conditional-approval",
  inspectionController.approveConditionally.bind(
    inspectionController
  )
);

router.delete(
  "/:id",
  inspectionController.delete.bind(
    inspectionController
  )
);

export default router;