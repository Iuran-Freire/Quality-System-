import { planRepository } from "../repositories/PlanRepository.js";

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

function normalizePlanType(value) {
  const type = String(value || "")
    .trim()
    .toUpperCase();

  return ["IQC", "OQC"].includes(type)
    ? type
    : null;
}

function getUserArea(user) {
  return normalizeInspectionArea(
    user?.inspectionArea
  );
}

function mapPlan(row) {
  return {
    id: String(row.id),
    name: row.name,
    type: row.type,
    pn: row.pn,
    model: row.model,
    client: row.client,
    supplier: row.supplier,
    resp: row.resp,
    active: row.active,

    revisionNumber: Number(
      row.revision_number || 1
    ),

    revision_number: Number(
      row.revision_number || 1
    ),

    n: row.n,
    boxQty: row.box_qty,

    sampling: row.sampling || {},
    chars: row.chars || [],

    inspection_regime:
      row.inspection_regime || "normal",

    switching_status:
      row.switching_status || "sem_pendencia",

    suggested_regime:
      row.suggested_regime || null,

    switching_reason:
      row.switching_reason || null,

    current_sample_n:
      row.current_sample_n,

    suggested_sample_n:
      row.suggested_sample_n,

    switching_suggested_at:
      row.switching_suggested_at,

    switching_suggested_by:
      row.switching_suggested_by,

    switching_updated_at:
      row.switching_updated_at,

    inspectionRegime:
      row.inspection_regime || "normal",

    switchingStatus:
      row.switching_status || "sem_pendencia",

    suggestedRegime:
      row.suggested_regime || null,

    switchingReason:
      row.switching_reason || null,

    currentSampleN:
      row.current_sample_n,

    suggestedSampleN:
      row.suggested_sample_n,

    switchingSuggestedAt:
      row.switching_suggested_at,

    switchingSuggestedBy:
      row.switching_suggested_by,

    switchingUpdatedAt:
      row.switching_updated_at,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRevision(row) {
  return {
    id: String(row.id),

    planId: String(row.plan_id),

    revisionNumber: Number(
      row.revision_number || 1
    ),

    changeReason:
      row.change_reason || "",

    changeNote:
      row.change_note || "",

    changedByUserId:
      row.changed_by_user_id
        ? String(row.changed_by_user_id)
        : null,

    changedByName:
      row.changed_by_name || "",

    changedByRole:
      row.changed_by_role || "",

    changedAt:
      row.changed_at,

    snapshot:
      row.snapshot || {},
  };
}

function validateUserArea(user) {
  const area = getUserArea(user);

  if (!area) {
    throw createServiceError(
      "Usuário sem área de inspeção válida.",
      403
    );
  }

  return area;
}

function validatePlanAccess(
  userArea,
  planType,
  message
) {
  const normalizedType =
    normalizePlanType(planType);

  if (
    userArea !== "ALL" &&
    normalizedType !== userArea
  ) {
    throw createServiceError(
      message,
      403
    );
  }

  return normalizedType;
}

export class PlanService {
  async list(user) {
    const userArea = validateUserArea(user);

    const rows =
      await planRepository.findAllByArea(
        userArea
      );

    return rows.map(mapPlan);
  }

  async getById(user, id) {
    const userArea = validateUserArea(user);

    const plan =
      await planRepository.findById(id);

    if (!plan) {
      throw createServiceError(
        "Plano não encontrado.",
        404
      );
    }

    validatePlanAccess(
      userArea,
      plan.type,
      "Você não possui acesso a este plano."
    );

    return mapPlan(plan);
  }

  async getRevisions(user, id) {
    const userArea = validateUserArea(user);

    const plan =
      await planRepository.findBasicById(id);

    if (!plan) {
      throw createServiceError(
        "Plano não encontrado.",
        404
      );
    }

    validatePlanAccess(
      userArea,
      plan.type,
      "Você não possui acesso a este histórico."
    );

    const revisions =
      await planRepository.findRevisionsByPlanId(
        id
      );

    return {
      currentRevisionNumber: Number(
        plan.revision_number || 1
      ),

      items: revisions.map(mapRevision),
    };
  }

  async create(user, data = {}) {
    const userArea = validateUserArea(user);

    const p = data;

    const rawRequestedType =
      String(p.type || "").trim();

    const requestedType =
      normalizePlanType(p.type);

    if (
      rawRequestedType &&
      !requestedType
    ) {
      throw createServiceError(
        "Tipo de plano inválido. Use IQC ou OQC.",
        400
      );
    }

    if (
      userArea === "ALL" &&
      !requestedType
    ) {
      throw createServiceError(
        "Selecione o tipo do plano: IQC ou OQC.",
        400
      );
    }

    if (
      userArea !== "ALL" &&
      requestedType &&
      requestedType !== userArea
    ) {
      throw createServiceError(
        `Seu usuário pertence à área ${userArea} e não pode criar plano ${requestedType}.`,
        403
      );
    }

    const planType =
      userArea === "ALL"
        ? requestedType
        : userArea;

    const plan =
      await planRepository.create({
        name: p.name || "",
        type: planType,
        pn: p.pn || "",
        model: p.model || "",
        client: p.client || "",
        supplier: p.supplier || "",
        resp: p.resp || "",

        active:
          p.active !== false,

        n:
          Number(p.n ?? 5),

        boxQty:
          Number(
            p.boxQty ??
            p.box_qty ??
            2
          ),

        sampling:
          p.sampling || {},

        chars:
          p.chars || [],
      });

    return mapPlan(plan);
  }

  async update(user, id, data = {}) {
    const userArea = validateUserArea(user);

    const p = data;

    const existingPlan =
      await planRepository.findById(id);

    if (!existingPlan) {
      throw createServiceError(
        "Plano não encontrado.",
        404
      );
    }

    const existingType =
      validatePlanAccess(
        userArea,
        existingPlan.type,
        "Você não possui acesso para editar este plano."
      );

    const rawRequestedType =
      String(p.type || "").trim();

    const requestedType =
      normalizePlanType(p.type);

    if (
      rawRequestedType &&
      !requestedType
    ) {
      throw createServiceError(
        "Tipo de plano inválido. Use IQC ou OQC.",
        400
      );
    }

    const planType =
      requestedType ||
      existingType;

    if (!planType) {
      throw createServiceError(
        "Tipo de plano inválido. Use IQC ou OQC.",
        400
      );
    }

    if (
      userArea !== "ALL" &&
      planType !== userArea
    ) {
      throw createServiceError(
        `Seu usuário pertence à área ${userArea} e não pode alterar este plano para ${planType}.`,
        403
      );
    }

    const changeReason =
      String(
        p.changeReason || ""
      ).trim();

    const changeNote =
      String(
        p.changeNote || ""
      ).trim();

    if (!changeReason) {
      throw createServiceError(
        "Informe o motivo da alteração para gerar uma nova revisão do plano.",
        400
      );
    }

    const revisionNumber =
      Number(
        existingPlan.revision_number || 1
      );

    const snapshot = {
      id:
        String(existingPlan.id),

      name:
        existingPlan.name,

      type:
        existingPlan.type,

      pn:
        existingPlan.pn,

      model:
        existingPlan.model,

      client:
        existingPlan.client,

      supplier:
        existingPlan.supplier,

      resp:
        existingPlan.resp,

      active:
        existingPlan.active,

      n:
        existingPlan.n,

      boxQty:
        existingPlan.box_qty,

      sampling:
        existingPlan.sampling || {},

      chars:
        existingPlan.chars || {},

      inspectionRegime:
        existingPlan.inspection_regime ||
        "normal",

      switchingStatus:
        existingPlan.switching_status ||
        "sem_pendencia",

      suggestedRegime:
        existingPlan.suggested_regime ||
        null,

      switchingReason:
        existingPlan.switching_reason ||
        "",

      currentSampleN:
        existingPlan.current_sample_n ??
        null,

      suggestedSampleN:
        existingPlan.suggested_sample_n ??
        null,

      revisionNumber,

      createdAt:
        existingPlan.created_at,

      updatedAt:
        existingPlan.updated_at,
    };

    const changedByUserId =
      user?.id ?? null;

    const changedByName =
      user?.name ||
      user?.username ||
      user?.matricula ||
      "Usuário não identificado";

    const changedByRole =
      user?.cargo ||
      user?.role ||
      null;

    const updatedPlan =
      await planRepository.updateWithRevision({
        id,
        revisionNumber,

        changeReason,
        changeNote,

        changedByUserId,
        changedByName,
        changedByRole,

        snapshot,

        name:
          p.name || "",

        type:
          planType,

        pn:
          p.pn || "",

        model:
          p.model || "",

        client:
          p.client || "",

        supplier:
          p.supplier || "",

        resp:
          p.resp || "",

        active:
          p.active !== false,

        n:
          Number(p.n ?? 5),

        boxQty:
          Number(
            p.boxQty ??
            p.box_qty ??
            2
          ),

        sampling:
          p.sampling || {},

        chars:
          p.chars || [],
      });

    return mapPlan(updatedPlan);
  }

  async delete(user, id) {
    const userArea = validateUserArea(user);

    const existingPlan =
      await planRepository.findIdAndType(id);

    if (!existingPlan) {
      throw createServiceError(
        "Plano não encontrado.",
        404
      );
    }

    validatePlanAccess(
      userArea,
      existingPlan.type,
      "Você não possui acesso para excluir este plano."
    );

    await planRepository.deleteById(id);
  }
}

export const planService =
  new PlanService();