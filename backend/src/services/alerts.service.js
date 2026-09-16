import { db } from "../db.js";

function normalizeInspectionArea(value) {
  const area = String(value || "").trim().toUpperCase();

  return ["IQC", "OQC", "ALL"].includes(area) ? area : "ALL";
}

export async function upsertQualityAlert({
  alertType,
  severity = "warning",
  title,
  message,
  inspectionId = null,
  planId = null,
  inspectionArea = "ALL",
  sourceKey,
  context = {},
}) {
  if (!String(sourceKey || "").trim()) {
    throw new Error("sourceKey é obrigatório para criar alerta.");
  }

  const result = await db.query(
    `
    INSERT INTO public.quality_alerts (
      alert_type,
      severity,
      status,
      title,
      message,
      inspection_id,
      plan_id,
      inspection_area,
      source_key,
      context,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      'new',
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (source_key)
    DO UPDATE SET
      severity = EXCLUDED.severity,
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      inspection_id = EXCLUDED.inspection_id,
      plan_id = EXCLUDED.plan_id,
      inspection_area = EXCLUDED.inspection_area,
      context = EXCLUDED.context,
      updated_at = NOW()
    RETURNING *
    `,
    [
      alertType,
      severity,
      title,
      message,
      inspectionId,
      planId,
      normalizeInspectionArea(inspectionArea),
      sourceKey,
      JSON.stringify(context || {}),
    ]
  );

  return result.rows[0];
}

export async function createInspectionFailAlert({
  inspectionId,
  planId,
  inspectionArea,
  planName,
  pn,
  lot,
  invoice,
  result,
  xrfOnlyFailure = false,
}) {
  const isXrfOnly = Boolean(xrfOnlyFailure);

  const alertType = isXrfOnly
    ? "XRF_ONLY_FAIL"
    : "INSPECTION_FAIL";

  const title = isXrfOnly
    ? "Falha exclusiva XRF / RoHS"
    : "Inspeção reprovada";

  const message = isXrfOnly
    ? `Plano: ${planName || "-"} | PN: ${pn || "-"} | Lote: ${
        lot || "-"
      }. A inspeção foi reprovada somente por XRF/RoHS e não influencia a comutação NBR.`
    : `Plano: ${planName || "-"} | PN: ${pn || "-"} | Lote: ${
        lot || "-"
      }${invoice ? ` | NF: ${invoice}` : ""}. A inspeção foi finalizada como FAIL.`;

  return upsertQualityAlert({
    alertType,
    severity: isXrfOnly ? "warning" : "critical",
    title,
    message,
    inspectionId,
    planId,
    inspectionArea,
    sourceKey: `${alertType}:INSPECTION:${inspectionId}`,
    context: {
      planName: planName || "",
      pn: pn || "",
      lot: lot || "",
      invoice: invoice || "",
      result: result || "FAIL",
      xrfOnlyFailure: isXrfOnly,
    },
  });
}

export async function resolveQualityAlertBySourceKey({
  sourceKey,
  resolvedBy = "Sistema",
  resolutionNote = "",
}) {
  const key = String(sourceKey || "").trim();

  if (!key) return null;

  const result = await db.query(
    `
    UPDATE public.quality_alerts
    SET
      status = 'resolved',
      resolved_at = NOW(),
      resolved_by = $1,
      resolution_note = $2,
      updated_at = NOW()
    WHERE source_key = $3
      AND status <> 'resolved'
    RETURNING *
    `,
    [resolvedBy, resolutionNote || null, key]
  );

  return result.rows[0] || null;
}

export async function createDeltaReturnAlert({
  inspectionId,
  planId,
  inspectionArea,
  planName,
  pn,
  lot,
  invoice,
  regimeApplied = "atenuada",
  deltaDetails = [],
}) {
  const details = Array.isArray(deltaDetails) ? deltaDetails : [];

  const detailsText = details.length
    ? ` Detalhes da condição Δ registrados na inspeção.`
    : "";

  return upsertQualityAlert({
    alertType: "DELTA_RETURN",
    severity: "warning",
    title: "Condição Δ — retorno à Normal obrigatório",
    message:
      `Plano: ${planName || "-"} | PN: ${pn || "-"} | Lote: ${
        lot || "-"
      }${invoice ? ` | NF: ${invoice}` : ""}. ` +
      `O lote foi aceito pela condição Δ no regime ${regimeApplied}. ` +
      `O próximo lote deve retornar obrigatoriamente para inspeção Normal.` +
      detailsText,
    inspectionId,
    planId,
    inspectionArea,
    sourceKey: `DELTA_RETURN:INSPECTION:${inspectionId}`,
    context: {
      planName: planName || "",
      pn: pn || "",
      lot: lot || "",
      invoice: invoice || "",
      regimeApplied,
      deltaDetails: details,
    },
  });
}
