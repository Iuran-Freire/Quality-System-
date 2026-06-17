import express from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";

const router = express.Router();

function normalizeAccessLevel(role, accessLevel) {
  if (accessLevel) return Number(accessLevel);

  const r = String(role || "").toLowerCase();

  if (r === "admin") return 1;
  if (["lider", "líder", "supervisor", "analista"].includes(r)) return 2;

  return 3;
}

// listar usuários
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
        active,
        created_at,
        updated_at
      FROM users
      ORDER BY access_level ASC, name ASC
    `);

    res.json({
      ok: true,
      users: result.rows.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        matricula: u.matricula || "",
        cargo: u.cargo || "",
        role: u.role || "",
        accessLevel: normalizeAccessLevel(u.role, u.access_level),
        active: Boolean(u.active),
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      })),
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

// criar usuário
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
      active,
    } = req.body;

    if (!String(name || "").trim()) {
      return res.status(400).json({ ok: false, message: "Informe o nome." });
    }

    if (!String(username || "").trim()) {
      return res.status(400).json({ ok: false, message: "Informe o usuário." });
    }

    if (!String(password || "").trim()) {
      return res.status(400).json({ ok: false, message: "Informe a senha." });
    }

    const cleanUsername = String(username).trim().toLowerCase();

    const existing = await db.query(
      "SELECT id FROM users WHERE username = $1",
      [cleanUsername]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        ok: false,
        message: "Já existe um usuário com este login.",
      });
    }

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
        active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING
        id,
        name,
        username,
        matricula,
        cargo,
        role,
        access_level,
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
        String(role || "inspetor").trim().toLowerCase(),
        Number(accessLevel || 3),
        active !== false,
      ]
    );

    const u = result.rows[0];

    res.status(201).json({
      ok: true,
      message: "Usuário criado com sucesso.",
      user: {
        id: u.id,
        name: u.name,
        username: u.username,
        matricula: u.matricula || "",
        cargo: u.cargo || "",
        role: u.role || "",
        accessLevel: Number(u.access_level || 3),
        active: Boolean(u.active),
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      },
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

export default router;