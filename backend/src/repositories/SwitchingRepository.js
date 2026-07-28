import { db } from "../db.js";

export class SwitchingRepository {
  async getSetting(settingKey) {
    const result = await db.query(
      `
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = $1
      `,
      [settingKey]
    );

    return result.rows[0]?.setting_value || null;
  }

  async saveSetting(
    settingKey,
    settingValue,
    description
  ) {
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
        $3,
        NOW(),
        NOW()
      )
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        updated_at = NOW()
      `,
      [
        settingKey,
        settingValue,
        description,
      ]
    );
  }

  async findPlanForAnalysis(planId) {
  const result = await db.query(
    `
    SELECT
      id,
      name,
      pn,
      model,
      client,
      type,
      n,
      sampling,
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

  return result.rows[0] || null;
}

async findInspectionHistory(planId) {
  const result = await db.query(
    `
    SELECT
      id,
      plan_id,
      lot,
      invoice,
      result,
      sampling,
      chars,
      samples,
      inspection_regime_snapshot,
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

  return result.rows;
}
async saveSuggestion({
  planId,
  suggestedRegime,
  reason,
  currentSampleN,
  suggestedSampleN,
}) {
  const result = await db.query(
    `
    UPDATE plans
    SET
      switching_status = 'pendente',
      suggested_regime = $1,
      switching_reason = $2,
      current_sample_n = $3,
      suggested_sample_n = $4,
      switching_suggested_at = NOW(),
      switching_suggested_by = 'Sistema',
      switching_updated_at = NOW()
    WHERE id = $5
    RETURNING
      id,
      name,
      pn,
      model,
      client,
      type,
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
    [
      suggestedRegime,
      reason,
      currentSampleN,
      suggestedSampleN,
      planId,
    ]
  );

  return result.rows[0] || null;
}
async approveSwitchingWithHistory({
  plan,
  previousRegime,
  newRegime,
  previousSampleN,
  newSampleN,
  approvedBy,
}) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const updateResult = await client.query(
      `
      UPDATE plans
      SET
        inspection_regime = $1,
        n = $2,
        switching_status = 'aprovado',
        suggested_regime = NULL,
        switching_reason = NULL,
        current_sample_n = $2,
        suggested_sample_n = NULL,
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
        switching_updated_at
      `,
      [
        newRegime,
        newSampleN,
        plan.id,
      ]
    );

    await client.query(
      `
      INSERT INTO plan_switching_history (
        plan_id,
        previous_regime,
        new_regime,
        previous_sample_n,
        new_sample_n,
        switching_type,
        switching_status,
        reason,
        history_snapshot,
        approved_by_id,
        approved_by_name,
        approved_by_username,
        approved_by_role,
        approved_by_level,
        approved_at,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        'sugerida',
        'aprovado',
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        NOW(),
        NOW()
      )
      `,
      [
        plan.id,
        previousRegime,
        newRegime,
        previousSampleN,
        newSampleN,
        plan.switching_reason,

        JSON.stringify({
          planId: plan.id,
          pn: plan.pn,
          model: plan.model,
          client: plan.client,
          previousRegime,
          newRegime,
          reason: plan.switching_reason,
        }),

        approvedBy.id || null,
        approvedBy.name || "Não informado",
        approvedBy.username || "",
        approvedBy.role || "",
        approvedBy.accessLevel,
      ]
    );

    await client.query("COMMIT");

    return updateResult.rows[0] || null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async findSwitchingHistory() {
  const result = await db.query(
    `
    SELECT
      h.id,
      h.plan_id,
      p.name AS plan_name,
      p.pn,
      p.model,
      p.client,

      h.previous_regime,
      h.new_regime,
      h.previous_sample_n,
      h.new_sample_n,
      h.switching_type,
      h.switching_status,
      h.reason,
      h.approved_by_name,
      h.approved_by_username,
      h.approved_by_role,
      h.approved_by_level,
      h.approved_at,
      h.created_at

    FROM public.plan_switching_history h

    LEFT JOIN public.plans p
      ON p.id = h.plan_id

    ORDER BY
      h.approved_at DESC,
      h.id DESC

    LIMIT 100
    `
  );

  return result.rows;
}

}

export const switchingRepository =
  new SwitchingRepository();