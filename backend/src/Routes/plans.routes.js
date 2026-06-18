import express from "express";
import { db } from "../db.js";

const router = express.Router();

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

    n: row.n,
    boxQty: row.box_qty,

    sampling: row.sampling || {},
    chars: row.chars || [],

    inspection_regime: row.inspection_regime || "normal",
    switching_status: row.switching_status || "sem_pendencia",
    suggested_regime: row.suggested_regime || null,
    switching_reason: row.switching_reason || null,
    current_sample_n: row.current_sample_n,
    suggested_sample_n: row.suggested_sample_n,
    switching_suggested_at: row.switching_suggested_at,
    switching_suggested_by: row.switching_suggested_by,
    switching_updated_at: row.switching_updated_at,

    inspectionRegime: row.inspection_regime || "normal",
    switchingStatus: row.switching_status || "sem_pendencia",
    suggestedRegime: row.suggested_regime || null,
    switchingReason: row.switching_reason || null,
    currentSampleN: row.current_sample_n,
    suggestedSampleN: row.suggested_sample_n,
    switchingSuggestedAt: row.switching_suggested_at,
    switchingSuggestedBy: row.switching_suggested_by,
    switchingUpdatedAt: row.switching_updated_at,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM plans
      ORDER BY created_at DESC, id DESC
    `);

    res.json({
      ok: true,
      items: result.rows.map(mapPlan),
    });
  } catch (error) {
    console.error("Erro ao listar planos:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao listar planos.",
      error: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const p = req.body || {};

    const result = await db.query(
      `
      INSERT INTO plans (
        name, type, pn, model, client, supplier, resp,
        active, n, box_qty, sampling, chars
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11::jsonb, $12::jsonb
      )
      RETURNING *
      `,
      [
        p.name || "",
        p.type || "IQC",
        p.pn || "",
        p.model || "",
        p.client || "",
        p.supplier || "",
        p.resp || "",
        p.active !== false,
        Number(p.n ?? 5),
        Number(p.boxQty ?? p.box_qty ?? 2),
        JSON.stringify(p.sampling || {}),
        JSON.stringify(p.chars || []),
      ]
    );

    res.status(201).json({
      ok: true,
      item: mapPlan(result.rows[0]),
    });
  } catch (error) {
    console.error("Erro ao criar plano:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao criar plano.",
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
      UPDATE plans
      SET
        name = $1,
        type = $2,
        pn = $3,
        model = $4,
        client = $5,
        supplier = $6,
        resp = $7,
        active = $8,
        n = $9,
        box_qty = $10,
        sampling = $11::jsonb,
        chars = $12::jsonb,
        updated_at = NOW()
      WHERE id = $13
      RETURNING *
      `,
      [
        p.name || "",
        p.type || "IQC",
        p.pn || "",
        p.model || "",
        p.client || "",
        p.supplier || "",
        p.resp || "",
        p.active !== false,
        Number(p.n ?? 5),
        Number(p.boxQty ?? p.box_qty ?? 2),
        JSON.stringify(p.sampling || {}),
        JSON.stringify(p.chars || []),
        id,
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        ok: false,
        message: "Plano não encontrado.",
      });
    }

    res.json({
      ok: true,
      item: mapPlan(result.rows[0]),
    });
  } catch (error) {
    console.error("Erro ao atualizar plano:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao atualizar plano.",
      error: error.message,
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `
      DELETE FROM plans
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        ok: false,
        message: "Plano não encontrado.",
      });
    }

    res.json({
      ok: true,
      message: "Plano excluído com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao excluir plano:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao excluir plano.",
      error: error.message,
    });
  }
});

export default router;