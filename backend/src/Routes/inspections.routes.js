import express from "express";
import { db } from "../db.js";

const router = express.Router();

function mapInspection(row) {
  return {
    id: String(row.id),

    planId: row.plan_id,
    planName: row.plan_name,

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

router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM inspections
      ORDER BY created_at DESC, id DESC
    `);

    res.json({
      ok: true,
      items: result.rows.map(mapInspection),
    });
  } catch (error) {
    console.error("Erro ao listar inspeções:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao listar inspeções.",
      error: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `
      SELECT *
      FROM inspections
      WHERE id = $1
      `,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        ok: false,
        message: "Inspeção não encontrada.",
      });
    }

    res.json({
      ok: true,
      item: mapInspection(result.rows[0]),
    });
  } catch (error) {
    console.error("Erro ao buscar inspeção:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao buscar inspeção.",
      error: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const p = req.body || {};

    let planSnapshot = null;

    if (p.plan_id || p.planId) {
      const planResult = await db.query(
        `
        SELECT
          id,
          inspection_regime,
          n
        FROM public.plans
        WHERE id = $1
        `,
        [p.plan_id || p.planId]
      );

      planSnapshot = planResult.rows[0] || null;
    }

    const inspectionRegimeSnapshot =
      p.inspection_regime_snapshot ||
      p.inspectionRegimeSnapshot ||
      planSnapshot?.inspection_regime ||
      "normal";

    const sampleNSnapshot =
      Number(
        p.sample_n_snapshot ||
          p.sampleNSnapshot ||
          planSnapshot?.n ||
          p.n ||
          p.planSamples ||
          0
      ) || null;

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
        sample_n_snapshot
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24,
        $25, $26, $27, $28, $29, $30,
        $31::jsonb, $32::jsonb, $33::jsonb,
        $34, $35, $36,
        $37, $38, $39, $40
      )
      RETURNING *
      `,
      [
        p.id || crypto.randomUUID(),

        p.planId || p.plan_id || null,
        p.planName || "",

        p.type || "IQC",
        p.pn || "",
        p.model || "",
        p.client || "",
        p.supplier || "",

        p.lot || "",
        p.invoice || "",
        p.lotSize == null || p.lotSize === "" ? null : Number(p.lotSize),
        p.shift || "",
        p.resp || "",
        p.obs || "",

        p.status || "draft",
        p.result || null,

        p.startedAt || new Date().toISOString(),
        p.finishedAt || null,

        p.createdBy || "",
        p.createdByUser || "",
        p.createdByRole || "",

        p.updatedBy || "",
        p.updatedByUser || "",
        p.updatedByRole || "",

        p.finishedBy || "",
        p.finishedByUser || "",
        p.finishedByRole || "",

        Number(p.planSamples ?? sampleNSnapshot ?? 5),
        Number(p.planBoxQty ?? 2),
        Number(p.boxQty ?? p.planBoxQty ?? 2),

        JSON.stringify(p.sampling || null),
        JSON.stringify(p.chars || []),
        JSON.stringify(p.samples || {}),

        p.parentInspectionId || null,
        Boolean(p.isReinspection),
        Number(p.inspectionCycle ?? 1),

        p.createdAt || new Date().toISOString(),
        p.updatedAt || new Date().toISOString(),

        inspectionRegimeSnapshot,
        sampleNSnapshot,
      ]
    );

    res.status(201).json({
      ok: true,
      item: mapInspection(result.rows[0]),
    });
  } catch (error) {
    console.error("Erro ao criar inspeção:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao criar inspeção.",
      error: error.message,
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const p = req.body || {};

    const result = await db.query(
      `
      UPDATE inspections
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
        updated_at = NOW()
        WHERE id = $34
      RETURNING *
      `,
      [
        p.planId || null,
        p.planName || "",

        p.type || "IQC",
        p.pn || "",
        p.model || "",
        p.client || "",
        p.supplier || "",

        p.lot || "",
        p.invoice || "",
        p.lotSize == null || p.lotSize === "" ? null : Number(p.lotSize),
        p.shift || "",
        p.resp || "",
        p.obs || "",

        p.status || "draft",
        p.result || null,

        p.startedAt || null,
        p.finishedAt || null,

        p.updatedBy || "",
        p.updatedByUser || "",
        p.updatedByRole || "",

        p.finishedBy || "",
        p.finishedByUser || "",
        p.finishedByRole || "",

        Number(p.planSamples ?? 5),
        Number(p.planBoxQty ?? 2),
        Number(p.boxQty ?? p.planBoxQty ?? 2),

        JSON.stringify(p.sampling || null),
        JSON.stringify(p.chars || []),
        JSON.stringify(p.samples || {}),

        p.parentInspectionId || null,
        Boolean(p.isReinspection),
        Number(p.inspectionCycle ?? 1),

        p.createdAt || new Date().toISOString(),
        id,
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        ok: false,
        message: "Inspeção não encontrada.",
      });
    }

    res.json({
      ok: true,
      item: mapInspection(result.rows[0]),
    });
  } catch (error) {
    console.error("Erro ao atualizar inspeção:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao atualizar inspeção.",
      error: error.message,
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `
      DELETE FROM inspections
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        ok: false,
        message: "Inspeção não encontrada.",
      });
    }

    res.json({
      ok: true,
      message: "Inspeção excluída com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao excluir inspeção:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao excluir inspeção.",
      error: error.message,
    });
  }
});

export default router;