import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function requireSetupKey(req, res, next) {
  const configuredKey = String(
    process.env.SETUP_KEY || ""
  ).trim();

  const receivedKey = String(
    req.headers["x-setup-key"] || ""
  ).trim();

  if (!configuredKey) {
    return res.status(503).json({
      ok: false,
      message:
        "Inicialização do banco está desabilitada. Configure SETUP_KEY no servidor.",
    });
  }

  if (!receivedKey || receivedKey !== configuredKey) {
    return res.status(401).json({
      ok: false,
      message:
        "Chave de configuração inválida.",
    });
  }

  next();
}

router.post(
  "/init-db",
  requireSetupKey,
  async (req, res) => {
    try {
      const sqlPath = path.join(
        __dirname,
        "../sql/001_init.sql"
      );

      const sql = fs.readFileSync(
        sqlPath,
        "utf8"
      );

      await db.query(sql);

      return res.json({
        ok: true,
        message:
          "Banco inicializado com sucesso.",
      });
    } catch (error) {
      console.error(
        "Erro ao inicializar banco:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Erro ao inicializar banco.",
        error: error.message,
      });
    }
  }
);

export default router;