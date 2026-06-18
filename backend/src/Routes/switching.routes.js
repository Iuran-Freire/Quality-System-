import express from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";

const router = express.Router();

const SWITCHING_PASSWORD_KEY = "switching_password_hash";

function canManageSwitching(user) {
  return Number(user?.accessLevel || user?.access_level || 3) <= 2;
}

// verificar se existe senha de comutação cadastrada
router.get("/password-status", async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = $1
      `,
      [SWITCHING_PASSWORD_KEY]
    );

    const row = result.rows[0];

    res.json({
      ok: true,
      hasPassword: Boolean(row?.setting_value),
    });
  } catch (error) {
    console.error("Erro ao verificar senha de comutação:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao verificar senha de comutação.",
      error: error.message,
    });
  }
});

// cadastrar ou alterar senha de comutação
router.post("/password", async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (!String(password || "").trim()) {
      return res.status(400).json({
        ok: false,
        message: "Informe a senha de comutação.",
      });
    }

    if (String(password) !== String(confirmPassword)) {
      return res.status(400).json({
        ok: false,
        message: "A confirmação da senha não confere.",
      });
    }

    if (String(password).length < 4) {
      return res.status(400).json({
        ok: false,
        message: "A senha de comutação deve ter pelo menos 4 caracteres.",
      });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    await db.query(
      `
      INSERT INTO system_settings (
        setting_key,
        setting_value,
        description,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        'Senha criptografada para confirmação de comutação de regime de inspeção',
        NOW(),
        NOW()
      )
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        updated_at = NOW()
      `,
      [SWITCHING_PASSWORD_KEY, passwordHash]
    );

    res.json({
      ok: true,
      message: "Senha de comutação salva com sucesso.",
      hasPassword: true,
    });
  } catch (error) {
    console.error("Erro ao salvar senha de comutação:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao salvar senha de comutação.",
      error: error.message,
    });
  }
});

// validar senha de comutação
router.post("/password/check", async (req, res) => {
  try {
    const { password } = req.body;

    if (!String(password || "").trim()) {
      return res.status(400).json({
        ok: false,
        message: "Informe a senha de comutação.",
      });
    }

    const result = await db.query(
      `
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = $1
      `,
      [SWITCHING_PASSWORD_KEY]
    );

    const passwordHash = result.rows[0]?.setting_value;

    if (!passwordHash) {
      return res.status(400).json({
        ok: false,
        message: "Senha de comutação ainda não cadastrada.",
      });
    }

    const valid = await bcrypt.compare(String(password), passwordHash);

    if (!valid) {
      return res.status(401).json({
        ok: false,
        message: "Senha de comutação inválida.",
      });
    }

    res.json({
      ok: true,
      message: "Senha validada com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao validar senha de comutação:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao validar senha de comutação.",
      error: error.message,
    });
  }
});

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

function analyzeSwitchingRule(currentRegime, inspections) {
  const regime = normalizeRegime(currentRegime);

  const history = inspections.map((insp) => ({
    id: insp.id,
    lot: insp.lot,
    invoice: insp.invoice,
    result: normalizeResult(insp.result),
    finishedAt: insp.finished_at,
  }));

  const last10 = history.slice(0, 10);
  const last5 = history.slice(0, 5);
  const last1 = history.slice(0, 1);

  if (regime === "normal") {
    const has10Pass =
      last10.length >= 10 && last10.every((i) => i.result === "PASS");

    if (has10Pass) {
      return {
        hasSuggestion: true,
        currentRegime: "normal",
        suggestedRegime: "atenuada",
        reason: "10 lotes consecutivos aprovados.",
        rule: "NORMAL_TO_ATENUADA",
        history,
      };
    }

    const failCountLast5 = last5.filter((i) => i.result === "FAIL").length;

    if (last5.length >= 5 && failCountLast5 >= 2) {
      return {
        hasSuggestion: true,
        currentRegime: "normal",
        suggestedRegime: "severa",
        reason: "2 lotes reprovados dentro dos últimos 5 lotes consecutivos.",
        rule: "NORMAL_TO_SEVERA",
        history,
      };
    }
  }

  if (regime === "atenuada") {
    const has1Fail = last1.length >= 1 && last1[0].result === "FAIL";

    if (has1Fail) {
      return {
        hasSuggestion: true,
        currentRegime: "atenuada",
        suggestedRegime: "normal",
        reason: "1 lote reprovado em inspeção atenuada.",
        rule: "ATENUADA_TO_NORMAL",
        history,
      };
    }
  }

  if (regime === "severa") {
    const has5Pass =
      last5.length >= 5 && last5.every((i) => i.result === "PASS");

    if (has5Pass) {
      return {
        hasSuggestion: true,
        currentRegime: "severa",
        suggestedRegime: "normal",
        reason: "5 lotes consecutivos aprovados em inspeção severa.",
        rule: "SEVERA_TO_NORMAL",
        history,
      };
    }
  }

  return {
    hasSuggestion: false,
    currentRegime: regime,
    suggestedRegime: null,
    reason: "Histórico ainda não atende critério para comutação.",
    rule: null,
    history,
  };
}

// analisar histórico de um plano e retornar sugestão
router.get("/plans/:planId/analyze", async (req, res) => {
  try {
    const { planId } = req.params;

    const planResult = await db.query(
      `
      SELECT
        id,
        name,
        pn,
        model,
        client,
        inspection_regime,
        switching_status,
        suggested_regime,
        switching_reason,
        current_sample_n,
        suggested_sample_n
      FROM plans
      WHERE id = $1
      `,
      [planId]
    );

    const plan = planResult.rows[0];

    if (!plan) {
      return res.status(404).json({
        ok: false,
        message: "Plano não encontrado.",
      });
    }

    const inspectionsResult = await db.query(
      `
      SELECT
        id,
        plan_id,
        lot,
        invoice,
        result,
        finished_at,
        created_at
      FROM inspections
      WHERE plan_id = $1
        AND finished_at IS NOT NULL
        AND result IS NOT NULL
      ORDER BY finished_at DESC, created_at DESC
      LIMIT 10
      `,
      [planId]
    );

    const analysis = analyzeSwitchingRule(
      plan.inspection_regime,
      inspectionsResult.rows
    );

    res.json({
      ok: true,
      plan: {
        id: plan.id,
        name: plan.name,
        pn: plan.pn,
        model: plan.model,
        client: plan.client,
        currentRegime: normalizeRegime(plan.inspection_regime),
        switchingStatus: plan.switching_status || "sem_pendencia",
        suggestedRegime: plan.suggested_regime,
        switchingReason: plan.switching_reason,
        currentSampleN: plan.current_sample_n,
        suggestedSampleN: plan.suggested_sample_n,
      },
      analysis,
    });
  } catch (error) {
    console.error("Erro ao analisar comutação:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao analisar comutação.",
      error: error.message,
    });
  }
});

// gravar sugestão de comutação no plano
router.post("/plans/:planId/suggest", async (req, res) => {
  try {
    const { planId } = req.params;

    const planResult = await db.query(
      `
      SELECT
        id,
        name,
        pn,
        model,
        client,
        inspection_regime,
        switching_status,
        suggested_regime,
        switching_reason,
        current_sample_n,
        suggested_sample_n
      FROM plans
      WHERE id = $1
      `,
      [planId]
    );

    const plan = planResult.rows[0];

    if (!plan) {
      return res.status(404).json({
        ok: false,
        message: "Plano não encontrado.",
      });
    }

    const inspectionsResult = await db.query(
      `
      SELECT
        id,
        plan_id,
        lot,
        invoice,
        result,
        finished_at,
        created_at
      FROM inspections
      WHERE plan_id = $1
        AND finished_at IS NOT NULL
        AND result IS NOT NULL
      ORDER BY finished_at DESC, created_at DESC
      LIMIT 10
      `,
      [planId]
    );

    const analysis = analyzeSwitchingRule(
      plan.inspection_regime,
      inspectionsResult.rows
    );

    if (!analysis.hasSuggestion) {
      return res.status(400).json({
        ok: false,
        message: "O histórico ainda não atende critério para comutação.",
        analysis,
      });
    }

    const updateResult = await db.query(
      `
      UPDATE plans
      SET
        switching_status = 'pendente',
        suggested_regime = $1,
        switching_reason = $2,
        switching_suggested_at = NOW(),
        switching_suggested_by = 'Sistema',
        switching_updated_at = NOW()
      WHERE id = $3
      RETURNING
        id,
        name,
        pn,
        model,
        client,
        inspection_regime,
        switching_status,
        suggested_regime,
        switching_reason,
        current_sample_n,
        suggested_sample_n,
        switching_suggested_at,
        switching_suggested_by,
        switching_updated_at
      `,
      [analysis.suggestedRegime, analysis.reason, planId]
    );

    res.json({
      ok: true,
      message: "Sugestão de comutação registrada com sucesso.",
      plan: {
        id: updateResult.rows[0].id,
        name: updateResult.rows[0].name,
        pn: updateResult.rows[0].pn,
        model: updateResult.rows[0].model,
        client: updateResult.rows[0].client,
        currentRegime: normalizeRegime(updateResult.rows[0].inspection_regime),
        switchingStatus: updateResult.rows[0].switching_status,
        suggestedRegime: updateResult.rows[0].suggested_regime,
        switchingReason: updateResult.rows[0].switching_reason,
        currentSampleN: updateResult.rows[0].current_sample_n,
        suggestedSampleN: updateResult.rows[0].suggested_sample_n,
        switchingSuggestedAt: updateResult.rows[0].switching_suggested_at,
        switchingSuggestedBy: updateResult.rows[0].switching_suggested_by,
        switchingUpdatedAt: updateResult.rows[0].switching_updated_at,
      },
      analysis,
    });
  } catch (error) {
    console.error("Erro ao registrar sugestão de comutação:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao registrar sugestão de comutação.",
      error: error.message,
    });
  }
});
export default router;