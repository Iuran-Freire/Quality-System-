import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db.js";

const router = express.Router();

router.post("/seed-admin", async (req, res) => {
  try {
    const name = "Iuran";
    const username = "iuran";
    const password = "1234";
    const role = "admin";

    const existing = await db.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );

    if (existing.rows.length) {
      return res.json({
        ok: true,
        message: "Usuário admin já existe.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(
      `
      INSERT INTO users (name, username, password_hash, role, active)
      VALUES ($1, $2, $3, $4, true)
      `,
      [name, username, passwordHash, role]
    );

    res.json({
      ok: true,
      message: "Usuário admin criado com sucesso.",
      user: {
        name,
        username,
        role,
      },
    });
  } catch (error) {
    console.error("Erro ao criar admin:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao criar admin.",
      error: error.message,
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await db.query(
      `
      SELECT id, name, username, password_hash, role, active
      FROM users
      WHERE username = $1
      `,
      [String(username || "").trim().toLowerCase()]
    );

    const user = result.rows[0];

    if (!user || !user.active) {
      return res.status(401).json({
        ok: false,
        message: "Usuário ou senha inválidos.",
      });
    }

    const passwordOk = await bcrypt.compare(
      String(password || ""),
      user.password_hash
    );

    if (!passwordOk) {
      return res.status(401).json({
        ok: false,
        message: "Usuário ou senha inválidos.",
      });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(safeUser, process.env.JWT_SECRET, {
      expiresIn: "8h",
    });

    res.json({
      ok: true,
      message: "Login realizado com sucesso.",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Erro no login:", error);

    res.status(500).json({
      ok: false,
      message: "Erro no login.",
      error: error.message,
    });
  }
});

export default router;