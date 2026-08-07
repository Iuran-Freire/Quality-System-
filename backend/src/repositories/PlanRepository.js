import { db } from "../db.js";

export class PlanRepository {
  async findAllByArea(area) {
    if (area === "ALL") {
      const result = await db.query(`
        SELECT *
        FROM plans
        ORDER BY created_at DESC, id DESC
      `);

      return result.rows;
    }

    const result = await db.query(
      `
      SELECT *
      FROM plans
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
      FROM plans
      WHERE id = $1
      `,
      [id]
    );

    return result.rows[0] || null;
  }

  async findBasicById(id) {
    const result = await db.query(
      `
      SELECT
        id,
        type,
        revision_number
      FROM plans
      WHERE id = $1
      `,
      [id]
    );

    return result.rows[0] || null;
  }

  async findIdAndType(id) {
    const result = await db.query(
      `
      SELECT
        id,
        type
      FROM plans
      WHERE id = $1
      `,
      [id]
    );

    return result.rows[0] || null;
  }

  async findRevisionsByPlanId(planId) {
    const result = await db.query(
      `
      SELECT
        id,
        plan_id,
        revision_number,
        change_reason,
        change_note,
        changed_by_user_id,
        changed_by_name,
        changed_by_role,
        changed_at,
        snapshot
      FROM public.plan_revisions
      WHERE plan_id = $1
      ORDER BY revision_number DESC, changed_at DESC
      `,
      [planId]
    );

    return result.rows;
  }

  async create({
    name,
    type,
    pn,
    model,
    client,
    supplier,
    process,
    resp,
    active,
    n,
    boxQty,
    sampling,
    chars,
  }) {
    const result = await db.query(
      `
      INSERT INTO plans (
        name,
        type,
        pn,
        model,
        client,
        supplier,
        process,
        resp,
        active,
        n,
        box_qty,
        sampling,
        chars
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12::jsonb, $13::jsonb
      )
      RETURNING *
      `,
      [
        name,
        type,
        pn,
        model,
        client,
        supplier,
        process,
        resp,
        active,
        n,
        boxQty,
        JSON.stringify(sampling),
        JSON.stringify(chars),
      ]
    );

    return result.rows[0];
  }

  async updateWithRevision({
    id,
    revisionNumber,
    changeReason,
    changeNote,
    changedByUserId,
    changedByName,
    changedByRole,
    snapshot,
    name,
    type,
    pn,
    model,
    client,
    supplier,
    process,
    resp,
    active,
    n,
    boxQty,
    sampling,
    chars,
  }) {
    const clientDb = await db.connect();

    try {
      await clientDb.query("BEGIN");

      await clientDb.query(
        `
        INSERT INTO plan_revisions (
          plan_id,
          revision_number,
          change_reason,
          change_note,
          changed_by_user_id,
          changed_by_name,
          changed_by_role,
          snapshot
        )
        VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8::jsonb
        )
        `,
        [
          id,
          revisionNumber,
          changeReason,
          changeNote || null,
          changedByUserId,
          changedByName,
          changedByRole,
          JSON.stringify(snapshot),
        ]
      );

      const updateResult = await clientDb.query(
        `
        UPDATE plans
        SET
          name = $1,
          type = $2,
          pn = $3,
          model = $4,
          client = $5,
          supplier = $6,
          process = $7,
          resp = $8,
          active = $9,
          n = $10,
          box_qty = $11,
          sampling = $12::jsonb,
          chars = $13::jsonb,
          revision_number = $14,
          updated_at = NOW()
        WHERE id = $15
        RETURNING *
        `,
        [
          name,
          type,
          pn,
          model,
          client,
          supplier,
          process,
          resp,
          active,
          n,
          boxQty,
          JSON.stringify(sampling),
          JSON.stringify(chars),
          revisionNumber + 1,
          id,
        ]
      );

      await clientDb.query("COMMIT");

      return updateResult.rows[0] || null;
    } catch (error) {
      await clientDb.query("ROLLBACK");
      throw error;
    } finally {
      clientDb.release();
    }
  }

  async deleteById(id) {
    await db.query(
      `
      DELETE FROM plans
      WHERE id = $1
      `,
      [id]
    );
  }
}

export const planRepository = new PlanRepository();
