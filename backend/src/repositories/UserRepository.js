import { db } from "../db.js";

const USER_RETURN_FIELDS = `
  id,
  name,
  username,
  matricula,
  cargo,
  role,
  access_level,
  inspection_area,
  active,
  created_at,
  updated_at
`;

export class UserRepository {
  async findAll() {
    const result = await db.query(`
      SELECT
        ${USER_RETURN_FIELDS}
      FROM users
      ORDER BY access_level ASC, name ASC
    `);

    return result.rows;
  }

  async findById(id) {
    const result = await db.query(
      `
      SELECT
        ${USER_RETURN_FIELDS}
      FROM users
      WHERE id = $1
      `,
      [id]
    );

    return result.rows[0] || null;
  }

  async findByUsername(username) {
    const result = await db.query(
      `
      SELECT
        ${USER_RETURN_FIELDS}
      FROM users
      WHERE username = $1
      `,
      [username]
    );

    return result.rows[0] || null;
  }

  async findByUsernameExcludingId(username, id) {
    const result = await db.query(
      `
      SELECT id
      FROM users
      WHERE username = $1
        AND id <> $2
      `,
      [username, id]
    );

    return result.rows[0] || null;
  }

  async create({
    name,
    username,
    passwordHash,
    matricula,
    cargo,
    role,
    accessLevel,
    inspectionArea,
    active,
  }) {
    const result = await db.query(
      `
      INSERT INTO users (
        name,
        username,
        password_hash,
        matricula,
        cargo,
        role,
        access_level,
        inspection_area,
        active,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        NOW(), NOW()
      )
      RETURNING
        ${USER_RETURN_FIELDS}
      `,
      [
        name,
        username,
        passwordHash,
        matricula,
        cargo,
        role,
        accessLevel,
        inspectionArea,
        active,
      ]
    );

    return result.rows[0];
  }

  async updateActive(id, active) {
    const result = await db.query(
      `
      UPDATE users
      SET
        active = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
        ${USER_RETURN_FIELDS}
      `,
      [active, id]
    );

    return result.rows[0] || null;
  }

  async update({
    id,
    name,
    username,
    passwordHash,
    matricula,
    cargo,
    role,
    accessLevel,
    inspectionArea,
    active,
  }) {
    let result;

    if (passwordHash) {
      result = await db.query(
        `
        UPDATE users
        SET
          name = $1,
          username = $2,
          password_hash = $3,
          matricula = $4,
          cargo = $5,
          role = $6,
          access_level = $7,
          inspection_area = $8,
          active = $9,
          updated_at = NOW()
        WHERE id = $10
        RETURNING
          ${USER_RETURN_FIELDS}
        `,
        [
          name,
          username,
          passwordHash,
          matricula,
          cargo,
          role,
          accessLevel,
          inspectionArea,
          active,
          id,
        ]
      );
    } else {
      result = await db.query(
        `
        UPDATE users
        SET
          name = $1,
          username = $2,
          matricula = $3,
          cargo = $4,
          role = $5,
          access_level = $6,
          inspection_area = $7,
          active = $8,
          updated_at = NOW()
        WHERE id = $9
        RETURNING
          ${USER_RETURN_FIELDS}
        `,
        [
          name,
          username,
          matricula,
          cargo,
          role,
          accessLevel,
          inspectionArea,
          active,
          id,
        ]
      );
    }

    return result.rows[0] || null;
  }
}

export const userRepository = new UserRepository();