import express from "express";
import { db } from "../db.js";

const router = express.Router();

function normalizeInspectionArea(value) {
  const area = String(value || "").trim().toUpperCase();

  return ["IQC", "OQC", "ALL"].includes(area) ? area : null;
}

function normalizePlanType(value) {
  const type = String(value || "").trim().toUpperCase();

  return ["IQC", "OQC"].includes(type) ? type : null;
}

function getUserArea(req) {
  return normalizeInspectionArea(req.user?.inspectionArea);
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

    revisionNumber: Number(row.revision_number || 1),
    revision_number: Number(row.revision_number || 1),

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

// Lista somente os planos permitidos para a área do usuário.
router.get("/", async (req, res) => {
  try {
    const userArea = getUserArea(req);

    if (!userArea) {
      return res.status(403).json({
        ok: false,
        message: "Usuário sem área de inspeção válida.",
      });
    }

    const result =
      userArea === "ALL"
        ? await db.query(`
            SELECT *
            FROM plans
            ORDER BY created_at DESC, id DESC
          `)
        : await db.query(
            `
            SELECT *
            FROM plans
            WHERE UPPER(TRIM(type)) = $1
            ORDER BY created_at DESC, id DESC
            `,
            [userArea]
          );

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

// Protege acesso direto a um plano pelo ID.
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userArea = getUserArea(req);

    if (!userArea) {
      return res.status(403).json({
        ok: false,
        message: "Usuário sem área de inspeção válida.",
      });
    }

    const result = await db.query(
      `
      SELECT *
      FROM plans
      WHERE id = $1
      `,
      [id]
    );

    const plan = result.rows[0];

    if (!plan) {
      return res.status(404).json({
        ok: false,
        message: "Plano não encontrado.",
      });
    }

    const planType = normalizePlanType(plan.type);

    if (userArea !== "ALL" && planType !== userArea) {
      return res.status(403).json({
        ok: false,
        message: "Você não possui acesso a este plano.",
      });
    }

    res.json({
      ok: true,
      item: mapPlan(plan),
    });
  } catch (error) {
    console.error("Erro ao buscar plano:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao buscar plano.",
      error: error.message,
    });
  }
});

// Lista o histórico de revisões de um plano.
router.get("/:id/revisions", async (req, res) => {
  try {
    const { id } = req.params;
    const userArea = getUserArea(req);

    if (!userArea) {
      return res.status(403).json({
        ok: false,
        message: "Usuário sem área de inspeção válida.",
      });
    }

    const planResult = await db.query(
      `
      SELECT id, type, revision_number
      FROM plans
      WHERE id = $1
      `,
      [id]
    );

    const plan = planResult.rows[0];

    if (!plan) {
      return res.status(404).json({
        ok: false,
        message: "Plano não encontrado.",
      });
    }

    const planType = normalizePlanType(plan.type);

    if (userArea !== "ALL" && planType !== userArea) {
      return res.status(403).json({
        ok: false,
        message: "Você não possui acesso a este histórico.",
      });
    }

    const revisionsResult = await db.query(
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
      [id]
    );

    res.json({
      ok: true,
      currentRevisionNumber: Number(plan.revision_number || 1),
      items: revisionsResult.rows.map((row) => ({
        id: String(row.id),
        planId: String(row.plan_id),
        revisionNumber: Number(row.revision_number || 1),
        changeReason: row.change_reason || "",
        changeNote: row.change_note || "",
        changedByUserId: row.changed_by_user_id
          ? String(row.changed_by_user_id)
          : null,
        changedByName: row.changed_by_name || "",
        changedByRole: row.changed_by_role || "",
        changedAt: row.changed_at,
        snapshot: row.snapshot || {},
      })),
    });
  } catch (error) {
    console.error("Erro ao listar histórico de revisões:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao listar histórico de revisões.",
      error: error.message,
    });
  }
});

// Cria plano somente na área permitida.
router.post("/", async (req, res) => {
  try {
    const p = req.body || {};
    const userArea = getUserArea(req);

    if (!userArea) {
      return res.status(403).json({
        ok: false,
        message: "Usuário sem área de inspeção válida.",
      });
    }

    const rawRequestedType = String(p.type || "").trim();
    const requestedType = normalizePlanType(p.type);

    if (rawRequestedType && !requestedType) {
      return res.status(400).json({
        ok: false,
        message: "Tipo de plano inválido. Use IQC ou OQC.",
      });
    }

    if (userArea === "ALL" && !requestedType) {
      return res.status(400).json({
        ok: false,
        message: "Selecione o tipo do plano: IQC ou OQC.",
      });
    }

    if (
      userArea !== "ALL" &&
      requestedType &&
      requestedType !== userArea
    ) {
      return res.status(403).json({
        ok: false,
        message: `Seu usuário pertence à área ${userArea} e não pode criar plano ${requestedType}.`,
      });
    }

    const planType = userArea === "ALL" ? requestedType : userArea;

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
        planType,
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

// Edita plano somente dentro da área permitida.
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const p = req.body || {};
    const userArea = getUserArea(req);

    if (!userArea) {
      return res.status(403).json({
        ok: false,
        message: "Usuário sem área de inspeção válida.",
      });
    }

    const existingResult = await db.query(
      `
      SELECT *
      FROM plans
      WHERE id = $1
      `,
      [id]
    );

    const existingPlan = existingResult.rows[0];

    if (!existingPlan) {
      return res.status(404).json({
        ok: false,
        message: "Plano não encontrado.",
      });
    }

    const existingType = normalizePlanType(existingPlan.type);

    if (userArea !== "ALL" && existingType !== userArea) {
      return res.status(403).json({
        ok: false,
        message: "Você não possui acesso para editar este plano.",
      });
    }

    const rawRequestedType = String(p.type || "").trim();
    const requestedType = normalizePlanType(p.type);

    if (rawRequestedType && !requestedType) {
      return res.status(400).json({
        ok: false,
        message: "Tipo de plano inválido. Use IQC ou OQC.",
      });
    }

    const planType = requestedType || existingType;

    if (!planType) {
      return res.status(400).json({
        ok: false,
        message: "Tipo de plano inválido. Use IQC ou OQC.",
      });
    }

    if (userArea !== "ALL" && planType !== userArea) {
      return res.status(403).json({
        ok: false,
        message: `Seu usuário pertence à área ${userArea} e não pode alterar este plano para ${planType}.`,
      });
    }

const revisionNumber = Number(existingPlan.revision_number || 1);

const snapshot = {
  id: String(existingPlan.id),
  name: existingPlan.name,
  type: existingPlan.type,
  pn: existingPlan.pn,
  model: existingPlan.model,
  client: existingPlan.client,
  supplier: existingPlan.supplier,
  resp: existingPlan.resp,
  active: existingPlan.active,
  n: existingPlan.n,
  boxQty: existingPlan.box_qty,
  sampling: existingPlan.sampling || {},
  chars: existingPlan.chars || {},

  inspectionRegime: existingPlan.inspection_regime || "normal",
  switchingStatus: existingPlan.switching_status || "sem_pendencia",
  suggestedRegime: existingPlan.suggested_regime || null,
  switchingReason: existingPlan.switching_reason || "",
  currentSampleN: existingPlan.current_sample_n ?? null,
  suggestedSampleN: existingPlan.suggested_sample_n ?? null,

  revisionNumber,
  createdAt: existingPlan.created_at,
  updatedAt: existingPlan.updated_at,
};

const changedByUserId = req.user?.id ?? null;
const changedByName =
  req.user?.name ||
  req.user?.username ||
  req.user?.matricula ||
  "Usuário não identificado";

const changedByRole =
  req.user?.cargo ||
  req.user?.role ||
  null;

const changeReason = String(p.changeReason || "").trim();
const changeNote = String(p.changeNote || "").trim();

if (!changeReason) {
  return res.status(400).json({
    ok: false,
    message: "Informe o motivo da alteração para gerar uma nova revisão do plano.",
  });
}

const client = await db.connect();

try {
  await client.query("BEGIN");

  await client.query(
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
      $1, $2, $3, $4, $5, $6, $7, $8::jsonb
    )
    `,
    [
      existingPlan.id,
      revisionNumber,
      changeReason,
      changeNote || null,
      changedByUserId,
      changedByName,
      changedByRole,
      JSON.stringify(snapshot),
    ]
  );

  const result = await client.query(
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
      revision_number = $13,
      updated_at = NOW()
    WHERE id = $14
    RETURNING *
    `,
    [
      p.name || "",
      planType,
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
      revisionNumber + 1,
      id,
    ]
  );

  await client.query("COMMIT");

  res.json({
    ok: true,
    item: mapPlan(result.rows[0]),
  });
} catch (transactionError) {
  await client.query("ROLLBACK");
  throw transactionError;
} finally {
  client.release();
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

// Exclui plano somente dentro da área permitida.
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userArea = getUserArea(req);

    if (!userArea) {
      return res.status(403).json({
        ok: false,
        message: "Usuário sem área de inspeção válida.",
      });
    }

    const existingResult = await db.query(
      `
      SELECT id, type
      FROM plans
      WHERE id = $1
      `,
      [id]
    );

    const existingPlan = existingResult.rows[0];

    if (!existingPlan) {
      return res.status(404).json({
        ok: false,
        message: "Plano não encontrado.",
      });
    }

    const planType = normalizePlanType(existingPlan.type);

    if (userArea !== "ALL" && planType !== userArea) {
      return res.status(403).json({
        ok: false,
        message: "Você não possui acesso para excluir este plano.",
      });
    }

    await db.query(
      `
      DELETE FROM plans
      WHERE id = $1
      `,
      [id]
    );

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