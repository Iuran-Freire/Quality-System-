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
}

export const inspectionRepository =
  new InspectionRepository();