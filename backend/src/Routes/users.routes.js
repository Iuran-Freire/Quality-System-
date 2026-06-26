import express from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";

const router = express.Router();

function normalizeAccessLevel(role, accessLevel) {
  const level = Number(accessLevel);

  if ([1, 2, 3].includes(level)) {
    return level;
  }

  const normalizedRole = String(role || "").trim().toLowerCase();

  if (normalizedRole === "admin") return 1;

  if (
    ["lider", "líder", "supervisor", "analista"].includes(normalizedRole)
  ) {
    return 2;
  }

  return 3;
}

function roleFromAccessLevel(accessLevel) {
  const level = Number(accessLevel);

  if (level === 1) return "admin";
  if (level === 2) return "lider";

  return "inspetor";
}

function normalizeInspectionArea(value) {
  const area = String(value || "").trim().toUpperCase();

  if (["IQC", "OQC", "ALL"].includes(area)) {
    return area;
  }

  return null;
}

function normalizeActive(value, fallback = true) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (value === false) return false;

  const normalized = String(value).trim().toLowerCase();

  if (["false", "0", "no", "não"].includes(normalized)) {
    return false;
  }

  return true;
}

function mapUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    matricula: user.matricula || "",
    cargo: user.cargo || "",
    role: user.role || "",
    accessLevel: normalizeAccessLevel(user.role, user.access_level),

    // IQC | OQC | ALL
    inspectionArea: normalizeInspectionArea(user.inspection_area),

    active: Boolean(user.active),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

// Listar usuários
router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
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
      FROM users
      ORDER BY access_level ASC, name ASC
    `);

    res.json({
      ok: true,
      users: result.rows.map(mapUser),
    });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao listar usuários.",
      error: error.message,
    });
  }
});

// Criar usuário
router.post("/", async (req, res) => {
  try {
    const {
      name,
      username,
      password,
      matricula,
      cargo,
      role,
      accessLevel,
      inspectionArea,
      inspection_area,
      active,
    } = req.body || {};

    if (!String(name || "").trim()) {
      return res.status(400).json({
        ok: false,
        message: "Informe o nome.",
      });
    }

    if (!String(username || "").trim()) {
      return res.status(400).json({
        ok: false,
        message: "Informe o usuário.",
      });
    }

    if (!String(password || "").trim()) {
      return res.status(400).json({
        ok: false,
        message: "Informe a senha.",
      });
    }

    const requestedArea =
      inspectionArea !== undefined ? inspectionArea : inspection_area;

    const normalizedInspectionArea =
      normalizeInspectionArea(requestedArea);

    if (!normalizedInspectionArea) {
      return res.status(400).json({
        ok: false,
        message: "Selecione a área do usuário: IQC, OQC ou Ambos.",
      });
    }

    const cleanUsername = String(username).trim().toLowerCase();

    const existing = await db.query(
      `
      SELECT id
      FROM users
      WHERE username = $1
      `,
      [cleanUsername]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        ok: false,
        message: "Já existe um usuário com este login.",
      });
    }

    const level = normalizeAccessLevel(role, accessLevel);
    const finalRole = roleFromAccessLevel(level);

    const passwordHash = await bcrypt.hash(String(password), 10);

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
      `,
      [
        String(name).trim(),
        cleanUsername,
        passwordHash,
        String(matricula || "").trim(),
        String(cargo || "").trim(),
        finalRole,
        level,
        normalizedInspectionArea,
        normalizeActive(active),
      ]
    );

    res.status(201).json({
      ok: true,
      message: "Usuário criado com sucesso.",
      user: mapUser(result.rows[0]),
    });
  } catch (error) {
    console.error("Erro ao criar usuário:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao criar usuário.",
      error: error.message,
    });
  }
});

// Ativar / inativar usuário
router.patch("/:id/active", async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body || {};

    const activeValue = normalizeActive(active);

    const result = await db.query(
      `
      UPDATE users
      SET
        active = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
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
      `,
      [activeValue, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        message: "Usuário não encontrado.",
      });
    }

    res.json({
      ok: true,
      message: activeValue
        ? "Usuário ativado com sucesso."
        : "Usuário inativado com sucesso.",
      user: mapUser(result.rows[0]),
    });
  } catch (error) {
    console.error("Erro ao alterar status do usuário:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao alterar status do usuário.",
      error: error.message,
    });
  }
});

// Editar usuário
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      username,
      password,
      matricula,
      cargo,
      role,
      accessLevel,
      inspectionArea,
      inspection_area,
      active,
    } = req.body || {};

    if (!String(name || "").trim()) {
      return res.status(400).json({
        ok: false,
        message: "Informe o nome.",
      });
    }

    if (!String(username || "").trim()) {
      return res.status(400).json({
        ok: false,
        message: "Informe o usuário.",
      });
    }

    if (!String(matricula || "").trim()) {
      return res.status(400).json({
        ok: false,
        message: "Informe a matrícula.",
      });
    }

    if (!String(cargo || "").trim()) {
      return res.status(400).json({
        ok: false,
        message: "Informe o cargo.",
      });
    }

    const requestedArea =
      inspectionArea !== undefined ? inspectionArea : inspection_area;

    const normalizedInspectionArea =
      normalizeInspectionArea(requestedArea);

    if (!normalizedInspectionArea) {
      return res.status(400).json({
        ok: false,
        message: "Selecione a área do usuário: IQC, OQC ou Ambos.",
      });
    }

    const cleanUsername = String(username).trim().toLowerCase();

    const existing = await db.query(
      `
      SELECT id
      FROM users
      WHERE username = $1
        AND id <> $2
      `,
      [cleanUsername, id]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        ok: false,
        message: "Já existe outro usuário com este login.",
      });
    }

    const level = normalizeAccessLevel(role, accessLevel);
    const finalRole = roleFromAccessLevel(level);
    const activeValue = normalizeActive(active);

    let result;

    if (String(password || "").trim()) {
      const passwordHash = await bcrypt.hash(String(password), 10);

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
        `,
        [
          String(name).trim(),
          cleanUsername,
          passwordHash,
          String(matricula).trim(),
          String(cargo).trim(),
          finalRole,
          level,
          normalizedInspectionArea,
          activeValue,
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
        `,
        [
          String(name).trim(),
          cleanUsername,
          String(matricula).trim(),
          String(cargo).trim(),
          finalRole,
          level,
          normalizedInspectionArea,
          activeValue,
          id,
        ]
      );
    }

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        message: "Usuário não encontrado.",
      });
    }

    res.json({
      ok: true,
      message: "Usuário atualizado com sucesso.",
      user: mapUser(result.rows[0]),
    });
  } catch (error) {
    console.error("Erro ao editar usuário:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao editar usuário.",
      error: error.message,
    });
  }
});

export default router;