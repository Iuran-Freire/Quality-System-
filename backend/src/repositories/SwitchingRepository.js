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
}

export const switchingRepository =
  new SwitchingRepository();