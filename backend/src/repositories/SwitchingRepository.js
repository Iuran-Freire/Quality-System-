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
}

export const switchingRepository =
  new SwitchingRepository();