import { inspectionRepository } from "../repositories/InspectionRepository.js";

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeInspectionArea(value) {
  const area = String(value || "")
    .trim()
    .toUpperCase();

  return ["IQC", "OQC", "ALL"].includes(area)
    ? area
    : null;
}

function getLoggedUserArea(user) {
  return normalizeInspectionArea(
    user?.inspectionArea ??
      user?.inspection_area ??
      user?.area ??
      ""
  );
}

function userCanAccessArea(user, inspectionArea) {
  const userArea = getLoggedUserArea(user);

  const targetArea =
    normalizeInspectionArea(inspectionArea);

  if (!userArea || !targetArea) {
    return false;
  }

  return (
    userArea === "ALL" ||
    userArea === targetArea
  );
}

export function mapInspection(row) {
  return {
    id: String(row.id),

    planId: row.plan_id,
    planName: row.plan_name,

    planRevisionNumber: Number(
      row.plan_revision_number || 1
    ),

    plan_revision_number: Number(
      row.plan_revision_number || 1
    ),

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

    inspection_regime_snapshot:
      row.inspection_regime_snapshot,

    sample_n_snapshot:
      row.sample_n_snapshot,

    inspectionRegimeSnapshot:
      row.inspection_regime_snapshot,

    sampleNSnapshot:
      row.sample_n_snapshot,

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

    parentInspectionId:
      row.parent_inspection_id,

    isReinspection:
      row.is_reinspection ?? false,

    inspectionCycle:
      row.inspection_cycle ?? 1,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class InspectionService {
  async list(user) {
    const userArea =
      getLoggedUserArea(user);

    if (!userArea) {
      throw createServiceError(
        "Seu usuário não possui uma área de inspeção válida. Verifique o cadastro do usuário.",
        403
      );
    }

    const rows =
      await inspectionRepository.findAllByArea(
        userArea
      );

    return rows.map(mapInspection);
  }

  async getById(user, id) {
    const userArea =
      getLoggedUserArea(user);

    if (!userArea) {
      throw createServiceError(
        "Seu usuário não possui uma área de inspeção válida. Verifique o cadastro do usuário.",
        403
      );
    }

    const inspection =
      await inspectionRepository.findById(id);

    if (!inspection) {
      throw createServiceError(
        "Inspeção não encontrada.",
        404
      );
    }

    if (
      !userCanAccessArea(
        user,
        inspection.type
      )
    ) {
      throw createServiceError(
        "Você não possui autorização para acessar inspeções desta área.",
        403
      );
    }

    return mapInspection(inspection);
  }
}

export const inspectionService =
  new InspectionService();