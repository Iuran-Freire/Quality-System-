import { db } from "../db.js";

export class InspectionRepository {
  async findAllByArea(area) {
    if (area === "ALL") {
      const result = await db.query(`
        SELECT *
        FROM public.inspections
        ORDER BY created_at DESC, id DESC
      `);

      return result.rows;
    }

    const result = await db.query(
      `
      SELECT *
      FROM public.inspections
      WHERE UPPER(TRIM(type)) = $1
      ORDER BY created_at DESC, id DESC
      `,
      [area]
    );

    return result.rows;
  }

  async findById(id) {
    const result = await db.query(
      `
      SELECT *
      FROM public.inspections
      WHERE id::text = $1::text
      `,
      [String(id)]
    );

    return result.rows[0] || null;
  }
  async findPlanForInspection(planId) {
  const result = await db.query(
    `
    SELECT
      id,
      type,
      inspection_regime,
      switching_status,
      suggested_regime,
      switching_reason,
      revision_number,
      n
    FROM public.plans
    WHERE id = $1
    `,
    [planId]
  );

  return result.rows[0] || null;
}

async findSwitchingHistory(planId) {
  const result = await db.query(
    `
    SELECT
      result,
      sampling,
      chars,
      samples,
      inspection_regime_snapshot,
      finished_at,
      created_at
    FROM public.inspections
    WHERE plan_id = $1
      AND finished_at IS NOT NULL
      AND result IS NOT NULL
    ORDER BY finished_at DESC, created_at DESC
    LIMIT 10
    `,
    [planId]
  );

  return result.rows;
}

async create(data) {
  const result = await db.query(
    `
    INSERT INTO inspections (
      id,
      plan_id,
      plan_name,
      type,
      pn,
      model,
      client,
      supplier,
      lot,
      invoice,
      lot_size,
      shift,
      resp,
      obs,
      status,
      result,
      started_at,
      finished_at,
      created_by,
      created_by_user,
      created_by_role,
      updated_by,
      updated_by_user,
      updated_by_role,
      finished_by,
      finished_by_user,
      finished_by_role,
      plan_samples,
      plan_box_qty,
      box_qty,
      sampling,
      chars,
      samples,
      parent_inspection_id,
      is_reinspection,
      inspection_cycle,
      created_at,
      updated_at,
      inspection_regime_snapshot,
      sample_n_snapshot,
      plan_revision_number
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22, $23, $24,
      $25, $26, $27, $28, $29, $30,
      $31::jsonb, $32::jsonb, $33::jsonb,
      $34, $35, $36,
      $37, $38, $39, $40, $41
    )
    RETURNING *
    `,
    [
      data.id,

      data.planId,
      data.planName,

      data.type,
      data.pn,
      data.model,
      data.client,
      data.supplier,

      data.lot,
      data.invoice,
      data.lotSize,
      data.shift,
      data.resp,
      data.obs,

      data.status,
      data.result,

      data.startedAt,
      data.finishedAt,

      data.createdBy,
      data.createdByUser,
      data.createdByRole,

      data.updatedBy,
      data.updatedByUser,
      data.updatedByRole,

      data.finishedBy,
      data.finishedByUser,
      data.finishedByRole,

      data.planSamples,
      data.planBoxQty,
      data.boxQty,

      JSON.stringify(data.sampling),
      JSON.stringify(data.chars),
      JSON.stringify(data.samples),

      data.parentInspectionId,
      data.isReinspection,
      data.inspectionCycle,

      data.createdAt,
      data.updatedAt,

      data.inspectionRegimeSnapshot,
      data.sampleNSnapshot,
      data.planRevisionNumber,
    ]
  );

  return result.rows[0];
}

async findForUpdate(id) {
  const result = await db.query(
    `
    SELECT
      i.id,
      i.type,
      i.plan_id,
      i.plan_revision_number,
      p.revision_number AS current_plan_revision_number
    FROM public.inspections i
    LEFT JOIN public.plans p
      ON p.id::text = i.plan_id::text
    WHERE i.id::text = $1::text
    `,
    [String(id)]
  );

  return result.rows[0] || null;
}

async update(id, data) {
  const result = await db.query(
    `
    UPDATE public.inspections
    SET
      plan_id = $1,
      plan_name = $2,
      type = $3,
      pn = $4,
      model = $5,
      client = $6,
      supplier = $7,
      lot = $8,
      invoice = $9,
      lot_size = $10,
      shift = $11,
      resp = $12,
      obs = $13,
      status = $14,
      result = $15,
      started_at = $16,
      finished_at = $17,
      updated_by = $18,
      updated_by_user = $19,
      updated_by_role = $20,
      finished_by = $21,
      finished_by_user = $22,
      finished_by_role = $23,
      plan_samples = $24,
      plan_box_qty = $25,
      box_qty = $26,
      sampling = $27::jsonb,
      chars = $28::jsonb,
      samples = $29::jsonb,
      parent_inspection_id = $30,
      is_reinspection = $31,
      inspection_cycle = $32,
      created_at = $33,
      plan_revision_number = $34,
      updated_at = NOW()
    WHERE id::text = $35::text
    RETURNING *
    `,
    [
      data.planId,
      data.planName,

      data.type,
      data.pn,
      data.model,
      data.client,
      data.supplier,

      data.lot,
      data.invoice,
      data.lotSize,
      data.shift,
      data.resp,
      data.obs,

      data.status,
      data.result,

      data.startedAt,
      data.finishedAt,

      data.updatedBy,
      data.updatedByUser,
      data.updatedByRole,

      data.finishedBy,
      data.finishedByUser,
      data.finishedByRole,

      data.planSamples,
      data.planBoxQty,
      data.boxQty,

      JSON.stringify(data.sampling),
      JSON.stringify(data.chars),
      JSON.stringify(data.samples),

      data.parentInspectionId,
      data.isReinspection,
      data.inspectionCycle,

      data.createdAt,
      data.planRevisionNumber,

      String(id),
    ]
  );

  return result.rows[0] || null;
}


}

export const inspectionRepository =
  new InspectionRepository();