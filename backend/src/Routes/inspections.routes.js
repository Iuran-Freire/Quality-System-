import express from "express";
import { db } from "../db.js";
import { createInspectionFailAlert, createDeltaReturnAlert } from "../services/alerts.service.js";

const router = express.Router();

function normalizeResult(value) {
  const result = String(value || "").trim().toUpperCase();

  if (["PASS", "APROVADO", "OK"].includes(result)) return "PASS";
  if (["FAIL", "REPROVADO", "NG"].includes(result)) return "FAIL";

  return result;
}

function normalizeRegime(value) {
  const regime = String(value || "normal").trim().toLowerCase();

  if (regime === "atenuada") return "atenuada";
  if (regime === "severa") return "severa";

  return "normal";
}

function safeJson(value, fallback = {}) {
  if (!value) return fallback;

  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getCharKind(char) {
  return char?.kind || char?.type || "visual_produto";
}

function getSpecialMode(char) {
  const mode = String(char?.resultMode ?? char?.mode ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return ["numerico", "numeric", "number", "numero"].includes(mode)
    ? "numerico"
    : "visual";
}

function isXrfChar(char) {
  return getCharKind(char) === "xrf_rohs";
}

function isNumericCharForSwitching(char) {
  const kind = getCharKind(char);

  return (
    kind === "variavel" ||
    (kind === "teste_especial" && getSpecialMode(char) === "numerico")
  );
}

function normVisual(value) {
  const text = String(value ?? "").trim().toUpperCase();

  if (text === "OK" || text === "PASS") return "OK";
  if (text === "NG" || text === "NOK" || text === "FAIL") return "NG";

  return "";
}

function toNumber(value) {
  if (value === null || value === undefined) return null;

  const number = Number(String(value).trim().replace(",", "."));

  return Number.isFinite(number) ? number : null;
}

function xrfCharHasFailure(char, rawSamples = []) {
  const elements = Array.isArray(char?.elements) ? char.elements : [];

  if (!elements.length) return false;

  return (rawSamples || []).some((sample) => {
    if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
      return false;
    }

    return elements.some((element) => {
      const measured = toNumber(sample?.[element.id]);
      const max = toNumber(element?.max);

      return measured != null && max != null && measured > max;
    });
  });
}

function nonXrfCharCausesFailure(char, rawSamples = [], sampling = {}) {
  const kind = getCharKind(char);

  // Scanner e XRF não são critérios diretos de comutação.
  if (kind === "scanner" || kind === "xrf_rohs") {
    return false;
  }

  // Variável ou teste especial numérico.
  if (isNumericCharForSwitching(char)) {
    const lsl = toNumber(char?.lsl ?? char?.min);
    const usl = toNumber(char?.usl ?? char?.max);

    return (rawSamples || []).some((rawValue) => {
      const measured = toNumber(rawValue);

      if (measured == null) return false;

      return (
        (lsl != null && measured < lsl) ||
        (usl != null && measured > usl)
      );
    });
  }

  const isVisual =
    kind === "visual_produto" ||
    kind === "visual_caixa" ||
    kind === "teste_especial";

  if (!isVisual) return false;

  const ngCount = (rawSamples || [])
    .map(normVisual)
    .filter((value) => value === "NG").length;

  // Visual Caixa e Teste Especial OK/NG:
  // qualquer NG é falha.
  if (kind === "visual_caixa" || kind === "teste_especial") {
    return ngCount > 0;
  }

  // Visual Produto: usa Ac/Re.
  const ac = toNumber(sampling?.ac);
  const re = toNumber(sampling?.re);

  if (re == null) {
    return ngCount > 0;
  }

  if (ngCount >= re) {
    return true;
  }

  // Condição Delta aceita o lote, mas força retorno ao Normal.
  if (ac != null && ngCount > ac && ngCount < re) {
    return !Boolean(sampling?.returnToNormalOnDelta);
  }

  return false;
}

function getSwitchingOutcome(inspection) {
  const actualResult = normalizeResult(inspection?.result);

  // Apenas inspeções FAIL precisam ser investigadas.
  if (actualResult !== "FAIL") {
    return {
      actualResult,
      switchingResult: actualResult,
      xrfOnlyFailure: false,
    };
  }

  const chars = safeJson(inspection?.chars, []);
  const samples = safeJson(inspection?.samples, {});
  const sampling = safeJson(inspection?.sampling, {});

  const hasXrfFailure = (chars || []).some((char) => {
    if (!isXrfChar(char)) return false;

    return xrfCharHasFailure(char, samples?.[char.id] || []);
  });

  const hasNonXrfFailure = (chars || []).some((char) => {
    if (isXrfChar(char)) return false;

    return nonXrfCharCausesFailure(
      char,
      samples?.[char.id] || [],
      sampling
    );
  });

  const xrfOnlyFailure = hasXrfFailure && !hasNonXrfFailure;

  return {
    actualResult,
    switchingResult: xrfOnlyFailure ? "PASS" : actualResult,
    xrfOnlyFailure,
  };
}

function needsSwitching(currentRegime, inspections = []) {
  const regime = normalizeRegime(currentRegime);

  const history = inspections.map((item) => {
    const sampling = safeJson(item.sampling, {});
    const switchingOutcome = getSwitchingOutcome(item);

    return {
      result: switchingOutcome.actualResult,
      switchingResult: switchingOutcome.switchingResult,
      xrfOnlyFailure: switchingOutcome.xrfOnlyFailure,

      deltaTriggered: Boolean(sampling?.deltaTriggered),

      inspectionRegimeSnapshot: String(
        item.inspection_regime_snapshot || ""
      )
        .trim()
        .toLowerCase(),
    };
  });

  // Só considera lotes consecutivos feitos no regime atual.
  const consecutiveHistory = [];

  for (const item of history) {
    if (item.inspectionRegimeSnapshot !== regime) break;
    consecutiveHistory.push(item);
  }

  const last10 = consecutiveHistory.slice(0, 10);
  const last5 = consecutiveHistory.slice(0, 5);
  const last1 = consecutiveHistory.slice(0, 1);

  if (
    regime === "normal" &&
    last10.length >= 10 &&
    last10.every((item) => item.switchingResult === "PASS")
  ) {
    return {
      blocked: true,
      suggestedRegime: "atenuada",
      reason: "10 lotes consecutivos aprovados.",
    };
  }

  if (regime === "normal") {
    const failCount = last5.filter(
      (item) => item.switchingResult === "FAIL"
    ).length;

    if (last5.length >= 5 && failCount >= 2) {
      return {
        blocked: true,
        suggestedRegime: "severa",
        reason: "2 lotes reprovados dentro dos últimos 5 lotes consecutivos.",
      };
    }
  }

  if (regime === "atenuada" && last1.length >= 1) {
    if (last1[0].deltaTriggered) {
      return {
        blocked: true,
        suggestedRegime: "normal",
        reason:
          "Condição Δ identificada: retorno para inspeção Normal obrigatório nos lotes seguintes.",
      };
    }

    if (last1[0].switchingResult === "FAIL") {
      return {
        blocked: true,
        suggestedRegime: "normal",
        reason: "1 lote reprovado em inspeção atenuada.",
      };
    }
  }

  if (
    regime === "severa" &&
    last5.length >= 5 &&
    last5.every((item) => item.switchingResult === "PASS")
  ) {
    return {
      blocked: true,
      suggestedRegime: "normal",
      reason: "5 lotes consecutivos aprovados em inspeção severa.",
    };
  }

  return {
    blocked: false,
    suggestedRegime: null,
    reason: "",
  };
}

function mapInspection(row) {
  return {
    id: String(row.id),

    planId: row.plan_id,
    planName: row.plan_name,

    planRevisionNumber: Number(row.plan_revision_number || 1),
    plan_revision_number: Number(row.plan_revision_number || 1),

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
          switching_status,
          suggested_regime,
          switching_reason,
          revision_number,
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

    const planRevisionNumber =
      Number(
        planSnapshot?.revision_number ||
          p.planRevisionNumber ||
          p.plan_revision_number ||
          1
      ) || 1;

    if (planSnapshot?.switching_status === "pendente") {
      return res.status(409).json({
        ok: false,
        message:
          "Inspeção bloqueada. Este plano possui comutação pendente de aprovação da liderança.",
        switching: {
          suggestedRegime: planSnapshot.suggested_regime || null,
          reason: planSnapshot.switching_reason || "",
        },
      });
    }

    if (planSnapshot?.id) {
      const historyResult = await db.query(
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
        [planSnapshot.id]
      );

      const switchingCheck = needsSwitching(
        planSnapshot.inspection_regime,
        historyResult.rows
      );

      if (switchingCheck.blocked) {
        return res.status(409).json({
          ok: false,
          message:
            "Inspeção bloqueada. Este plano atende critério para comutação e precisa de confirmação da liderança.",
          switching: switchingCheck,
        });
      }
    }

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
        planRevisionNumber,
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

    const currentInspectionResult = await db.query(
      `
      SELECT
        i.id,
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

    const currentInspection = currentInspectionResult.rows[0];

    if (!currentInspection) {
      return res.status(404).json({
        ok: false,
        message: "Inspeção não encontrada.",
      });
    }

    const dbRevision = Number(currentInspection.plan_revision_number || 0);
    const bodyRevision = Number(p.planRevisionNumber || p.plan_revision_number || 0);
    const currentPlanRevision = Number(
      currentInspection.current_plan_revision_number || 0
    );

    const planRevisionNumber =
      dbRevision > 1
        ? dbRevision
        : bodyRevision > 1
          ? bodyRevision
          : currentPlanRevision > 0
            ? currentPlanRevision
            : 1;

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
        p.planId || p.plan_id || null,
        p.planName || p.plan_name || "",

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

        p.startedAt || p.started_at || null,
        p.finishedAt || p.finished_at || null,

        p.updatedBy || p.updated_by || "",
        p.updatedByUser || p.updated_by_user || "",
        p.updatedByRole || p.updated_by_role || "",

        p.finishedBy || p.finished_by || "",
        p.finishedByUser || p.finished_by_user || "",
        p.finishedByRole || p.finished_by_role || "",

        Number(p.planSamples ?? p.plan_samples ?? 5),
        Number(p.planBoxQty ?? p.plan_box_qty ?? 2),
        Number(p.boxQty ?? p.box_qty ?? p.planBoxQty ?? p.plan_box_qty ?? 2),

        JSON.stringify(p.sampling || null),
        JSON.stringify(p.chars || []),
        JSON.stringify(p.samples || {}),

        p.parentInspectionId || p.parent_inspection_id || null,
        Boolean(p.isReinspection ?? p.is_reinspection),
        Number(p.inspectionCycle ?? p.inspection_cycle ?? 1),

        p.createdAt || p.created_at || new Date().toISOString(),
        planRevisionNumber,
        String(id),
      ]
    );

    const updatedInspection = mapInspection(result.rows[0]);

    if (
      updatedInspection.status === "done" &&
      normalizeResult(updatedInspection.result) === "FAIL"
    ) {
      try {
        const switchingOutcome = getSwitchingOutcome({
          result: updatedInspection.result,
          chars: updatedInspection.chars,
          samples: updatedInspection.samples,
          sampling: updatedInspection.sampling,
        });

        await createInspectionFailAlert({
          inspectionId: updatedInspection.id,
          planId: updatedInspection.planId,
          inspectionArea: updatedInspection.type,
          planName: updatedInspection.planName,
          pn: updatedInspection.pn,
          lot: updatedInspection.lot,
          invoice: updatedInspection.invoice,
          result: updatedInspection.result,
          xrfOnlyFailure: switchingOutcome.xrfOnlyFailure,
        });
      } catch (alertError) {
        console.error(
          "Inspeção finalizada, mas não foi possível criar o alerta:",
          alertError
        );
      }
    }

    if (
      updatedInspection.status === "done" &&
      Boolean(updatedInspection.sampling?.deltaTriggered)
    ) {
      try {
        await createDeltaReturnAlert({
          inspectionId: updatedInspection.id,
          planId: updatedInspection.planId,
          inspectionArea: updatedInspection.type,
          planName: updatedInspection.planName,
          pn: updatedInspection.pn,
          lot: updatedInspection.lot,
          invoice: updatedInspection.invoice,
          regimeApplied:
            updatedInspection.inspectionRegimeSnapshot ||
            updatedInspection.sampling?.inspectionRegime ||
            "atenuada",
          deltaDetails: updatedInspection.sampling?.deltaDetails || [],
        });
      } catch (alertError) {
        console.error(
          "Inspeção finalizada, mas não foi possível criar o alerta de condição Δ:",
          alertError
        );
      }
    }

    res.json({
      ok: true,
      item: updatedInspection,
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
router.patch("/:id/conditional-approval", async (req, res) => {
  try {
    const { id } = req.params;

    const accessLevel = Number(
      req.user?.accessLevel ?? req.user?.access_level ?? 3
    );

    if (accessLevel > 2) {
      return res.status(403).json({
        ok: false,
        message:
          "Somente usuários Nível 1 ou Nível 2 podem aprovar condicionalmente um lote.",
      });
    }

    const reason = String(req.body?.reason || "").trim();
    const note = String(req.body?.note || "").trim();

    if (!reason) {
      return res.status(400).json({
        ok: false,
        message: "Informe o motivo da aprovação condicional.",
      });
    }

    const currentResult = await db.query(
      `
      SELECT
        id,
        type,
        status,
        result,
        conditional_approval_status
      FROM public.inspections
      WHERE id = $1
      `,
      [id]
    );

    const current = currentResult.rows[0];

    if (!current) {
      return res.status(404).json({
        ok: false,
        message: "Inspeção não encontrada.",
      });
    }

    if (String(current.type || "").trim().toUpperCase() !== "IQC") {
      return res.status(409).json({
        ok: false,
        message:
          "Aprovação condicional está disponível somente para inspeções IQC.",
      });
    }

    if (String(current.status || "").trim().toLowerCase() !== "done") {
      return res.status(409).json({
        ok: false,
        message:
          "A inspeção precisa estar finalizada antes da aprovação condicional.",
      });
    }

    if (normalizeResult(current.result) !== "FAIL") {
      return res.status(409).json({
        ok: false,
        message:
          "Aprovação condicional só pode ser usada em inspeções com resultado oficial FAIL.",
      });
    }

    if (
      String(current.conditional_approval_status || "none").toLowerCase() !==
      "none"
    ) {
      return res.status(409).json({
        ok: false,
        message:
          "Esta inspeção já possui uma aprovação condicional registrada.",
      });
    }

    const approvedBy =
      req.user?.name ||
      req.user?.username ||
      "Não informado";

    const approvedByUser =
      req.user?.username ||
      "";

    const approvedByRole =
      req.user?.cargo ||
      req.user?.role ||
      "";

    const updateResult = await db.query(
      `
      UPDATE public.inspections
      SET
        conditional_approval_status = 'approved_conditional',
        conditional_approval_reason = $1,
        conditional_approval_note = $2,
        conditional_approval_by = $3,
        conditional_approval_by_user = $4,
        conditional_approval_by_role = $5,
        conditional_approval_at = NOW(),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
      `,
      [
        reason,
        note || null,
        approvedBy,
        approvedByUser,
        approvedByRole,
        id,
      ]
    );

    res.json({
      ok: true,
      message:
        "Lote aprovado condicionalmente. O resultado oficial permanece FAIL.",
      item: mapInspection(updateResult.rows[0]),
    });
  } catch (error) {
    console.error("Erro ao registrar aprovação condicional:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao registrar aprovação condicional.",
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