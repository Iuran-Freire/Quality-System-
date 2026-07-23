import { alertRepository } from "../repositories/AlertRepository.js";

const VALID_STATUSES = ["new", "viewed", "resolved"];

function normalizeInspectionArea(value) {
  const area = String(value || "")
    .trim()
    .toUpperCase();

  return ["IQC", "OQC", "ALL"].includes(area)
    ? area
    : "ALL";
}

function getUserArea(user) {
  return normalizeInspectionArea(
    user?.inspectionArea ??
      user?.inspection_area
  );
}

function canManageAlerts(user) {
  const level = Number(
    user?.accessLevel ??
      user?.access_level ??
      3
  );

  return level <= 2;
}

function getUserName(user) {
  return (
    user?.name ||
    user?.username ||
    user?.userName ||
    "Não informado"
  );
}

function mapAlert(row) {
  return {
    id: row.id,
    alertType: row.alert_type,
    severity: row.severity,
    status: row.status,

    title: row.title,
    message: row.message,

    inspectionId: row.inspection_id,
    planId: row.plan_id,
    inspectionArea: row.inspection_area,

    sourceKey: row.source_key,
    context: row.context || {},

    viewedAt: row.viewed_at,
    viewedBy: row.viewed_by,

    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    resolutionNote: row.resolution_note,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AlertService {
  async getSummary(user) {
    const area = getUserArea(user);

    const rows =
      await alertRepository.getSummary(area);

    const counts = {
      new: 0,
      viewed: 0,
      resolved: 0,
    };

    for (const row of rows) {
      counts[row.status] = Number(row.total || 0);
    }

    return {
      newCount: counts.new,
      viewedCount: counts.viewed,
      resolvedCount: counts.resolved,
      openCount: counts.new + counts.viewed,
      counts,
    };
  }

  async list(user, requestedStatus) {
    const area = getUserArea(user);

    const normalizedStatus = String(
      requestedStatus || ""
    )
      .trim()
      .toLowerCase();

    const status =
      VALID_STATUSES.includes(normalizedStatus)
        ? normalizedStatus
        : "";

    const rows = await alertRepository.list({
      area,
      status,
    });

    return rows.map(mapAlert);
  }

  async markAsViewed(user, id) {
    const area = getUserArea(user);
    const userName = getUserName(user);

    const row =
      await alertRepository.markAsViewed({
        id,
        userName,
        area,
      });

    if (!row) {
      const error = new Error(
        "Alerta não encontrado ou sem permissão de acesso."
      );

      error.statusCode = 404;
      throw error;
    }

    return mapAlert(row);
  }

  async resolve(user, id, resolutionNote) {
    if (!canManageAlerts(user)) {
      const error = new Error(
        "Você não possui permissão para resolver alertas."
      );

      error.statusCode = 403;
      throw error;
    }

    const area = getUserArea(user);
    const userName = getUserName(user);

    const row = await alertRepository.resolve({
      id,
      userName,
      resolutionNote: String(
        resolutionNote || ""
      ).trim(),
      area,
    });

    if (!row) {
      const error = new Error(
        "Alerta não encontrado ou sem permissão de acesso."
      );

      error.statusCode = 404;
      throw error;
    }

    return mapAlert(row);
  }
}

export const alertService = new AlertService();