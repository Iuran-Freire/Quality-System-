import { db } from "../db.js";

export class AlertRepository {
  async getSummary(area) {
    const params = [];
    let areaFilter = "";

    if (area !== "ALL") {
      params.push(area);
      areaFilter = `AND inspection_area IN ('ALL', $${params.length})`;
    }

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

    return result.rows;
  }

  async list({ area, status }) {
    const params = [];
    const filters = ["1 = 1"];

    if (area !== "ALL") {
      params.push(area);
      filters.push(`inspection_area IN ('ALL', $${params.length})`);
    }

    if (status) {
      params.push(status);
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
        created_at DESC
      LIMIT 100
      `,
      params
    );

    return result.rows;
  }

  async markAsViewed({ id, userName, area }) {
    const params = [userName, id];
    let areaFilter = "";

    if (area !== "ALL") {
      params.push(area);
      areaFilter = `AND inspection_area IN ('ALL', $${params.length})`;
    }

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

    return result.rows[0] || null;
  }

  async resolve({ id, userName, resolutionNote, area }) {
    const params = [
      userName,
      resolutionNote || null,
      id,
    ];

    let areaFilter = "";

    if (area !== "ALL") {
      params.push(area);
      areaFilter = `AND inspection_area IN ('ALL', $${params.length})`;
    }

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

    return result.rows[0] || null;
  }
}

export const alertRepository = new AlertRepository();