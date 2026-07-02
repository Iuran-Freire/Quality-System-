import express from "express";
import { db } from "../db.js";

const router = express.Router();

const VALID_STATUSES = ["new", "viewed", "resolved"];

function normalizeInspectionArea(value) {
  const area = String(value || "").trim().toUpperCase();

  return ["IQC", "OQC", "ALL"].includes(area) ? area : "ALL";
}

function getUserArea(req) {
  return normalizeInspectionArea(req.user?.inspectionArea);
}

function canManageAlerts(req) {
  const level = Number(
    req.user?.accessLevel || req.user?.access_level || 3
  );

  return level <= 2;
}

function getUserName(req) {
  return (
    req.user?.name ||
    req.user?.username ||
    req.user?.userName ||
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

function buildAreaFilter(req, params) {
  const userArea = getUserArea(req);

  if (userArea === "ALL") {
    return "";
  }

  params.push(userArea);

  return `AND inspection_area IN ('ALL', $${params.length})`;
}

// Resumo para o contador do sino.
router.get("/summary", async (req, res) => {
  try {
    const params = [];
    const areaFilter = buildAreaFilter(req, params);

    const result = await db.query(
      `
      SELECT
        status,
        COUNT(*)::int AS total
      FROM public.quality_alerts
      WHERE 1 = 1
      ${areaFilter}
      GROUP BY status
      `,
      params
    );

    const counts = {
      new: 0,
      viewed: 0,
      resolved: 0,
    };

    for (const row of result.rows) {
      counts[row.status] = Number(row.total || 0);
    }

    res.json({
      ok: true,
      newCount: counts.new,
      viewedCount: counts.viewed,
      resolvedCount: counts.resolved,
      openCount: counts.new + counts.viewed,
      counts,
    });
  } catch (error) {
    console.error("Erro ao consultar resumo de alertas:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao consultar resumo de alertas.",
      error: error.message,
    });
  }
});

// Lista de alertas permitidos para a área do usuário.
router.get("/", async (req, res) => {
  try {
    const requestedStatus = String(req.query.status || "")
      .trim()
      .toLowerCase();

    const params = [];
    const filters = ["1 = 1"];

    const areaFilter = buildAreaFilter(req, params);

    if (areaFilter) {
      filters.push(areaFilter.replace(/^AND\s+/i, ""));
    }

    if (requestedStatus && VALID_STATUSES.includes(requestedStatus)) {
      params.push(requestedStatus);
      filters.push(`status = $${params.length}`);
    }

    const result = await db.query(
      `
      SELECT *
      FROM public.quality_alerts
      WHERE ${filters.join(" AND ")}
      ORDER BY
        CASE status
          WHEN 'new' THEN 1
          WHEN 'viewed' THEN 2
          ELSE 3
        END,
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'warning' THEN 2
          ELSE 3
        END,
        created_at DESC
      LIMIT 100
      `,
      params
    );

    res.json({
      ok: true,
      items: result.rows.map(mapAlert),
    });
  } catch (error) {
    console.error("Erro ao listar alertas:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao listar alertas.",
      error: error.message,
    });
  }
});

// Marca alerta como visualizado.
router.patch("/:id/view", async (req, res) => {
  try {
    const { id } = req.params;
    const params = [getUserName(req), id];

    const areaFilter = buildAreaFilter(req, params);

    const result = await db.query(
      `
      UPDATE public.quality_alerts
      SET
        status = CASE WHEN status = 'new' THEN 'viewed' ELSE status END,
        viewed_at = COALESCE(viewed_at, NOW()),
        viewed_by = COALESCE(viewed_by, $1),
        updated_at = NOW()
      WHERE id = $2
      ${areaFilter}
      RETURNING *
      `,
      params
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        ok: false,
        message: "Alerta não encontrado ou sem permissão de acesso.",
      });
    }

    res.json({
      ok: true,
      item: mapAlert(result.rows[0]),
    });
  } catch (error) {
    console.error("Erro ao visualizar alerta:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao atualizar alerta.",
      error: error.message,
    });
  }
});

// Apenas nível 1 ou 2 resolve alertas.
router.patch("/:id/resolve", async (req, res) => {
  try {
    if (!canManageAlerts(req)) {
      return res.status(403).json({
        ok: false,
        message: "Você não possui permissão para resolver alertas.",
      });
    }

    const { id } = req.params;
    const resolutionNote = String(req.body?.resolutionNote || "").trim();

    const params = [getUserName(req), resolutionNote || null, id];

    const areaFilter = buildAreaFilter(req, params);

    const result = await db.query(
      `
      UPDATE public.quality_alerts
      SET
        status = 'resolved',
        resolved_at = NOW(),
        resolved_by = $1,
        resolution_note = $2,
        updated_at = NOW()
      WHERE id = $3
      ${areaFilter}
      RETURNING *
      `,
      params
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        ok: false,
        message: "Alerta não encontrado ou sem permissão de acesso.",
      });
    }

    res.json({
      ok: true,
      message: "Alerta resolvido com sucesso.",
      item: mapAlert(result.rows[0]),
    });
  } catch (error) {
    console.error("Erro ao resolver alerta:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao resolver alerta.",
      error: error.message,
    });
  }
});

export default router;