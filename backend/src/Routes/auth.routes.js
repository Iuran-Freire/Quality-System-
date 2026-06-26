import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db.js";

const router = express.Router();

function normalizeInspectionArea(value) {
  const area = String(value || "").trim().toUpperCase();

  if (["IQC", "OQC", "ALL"].includes(area)) {
    return area;
  }

  return null;
}

router.post("/seed-admin", async (req, res) => {
  try {
    const name = "Iuran";
    const username = "iuran";
    const password = "1234";
    const role = "admin";
    const matricula = "8919";
    const cargo = "Admin";
    const accessLevel = 1;
    const inspectionArea = "ALL";

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
      INSERT INTO users (
        name,
        username,
        password_hash,
        matricula,
        cargo,
        role,
        access_level,
        inspection_area,
        active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
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
      ]
    );

    res.json({
      ok: true,
      message: "Usuário admin criado com sucesso.",
      user: {
        name,
        username,
        matricula,
        cargo,
        role,
        accessLevel,
        inspectionArea,
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
      SELECT
        id,
        name,
        username,
        password_hash,
        matricula,
        cargo,
        role,
        access_level,
        inspection_area,
        active
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

    const inspectionArea = normalizeInspectionArea(user.inspection_area);

    if (!inspectionArea) {
      return res.status(403).json({
        ok: false,
        message:
          "Usuário sem área de inspeção definida. Solicite a classificação como IQC, OQC ou Ambos.",
      });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      matricula: user.matricula || "",
      cargo: user.cargo || "",
      role: user.role,
      accessLevel: Number(user.access_level || 3),
      inspectionArea,
      active: Boolean(user.active),
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

router.post("/seed-inspector", async (req, res) => {
  try {
    const name = "Inspetor Teste";
    const username = "inspetor";
    const password = "1234";
    const role = "inspetor";
    const matricula = "0003";
    const cargo = "Inspetor IQC";
    const accessLevel = 3;
    const inspectionArea = "IQC";

    const existing = await db.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );

    if (existing.rows.length) {
      return res.json({
        ok: true,
        message: "Usuário inspetor já existe.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(
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
        active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
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
      ]
    );

    res.json({
      ok: true,
      message: "Usuário inspetor criado com sucesso.",
      user: {
        name,
        username,
        matricula,
        cargo,
        role,
        accessLevel,
        inspectionArea,
      },
    });
  } catch (error) {
    console.error("Erro ao criar inspetor:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao criar inspetor.",
      error: error.message,
    });
  }
});

export default router;