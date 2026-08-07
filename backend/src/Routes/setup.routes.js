import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db.js";
import { requireSetupKey } from "../middlewares/setup-key.middleware.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.post(
  "/init-db",
  requireSetupKey,
  async (req, res) => {
    try {
      const sqlDirectory = path.join(
        __dirname,
        "../sql"
      );

      const migrationFiles = fs
        .readdirSync(sqlDirectory)
        .filter((file) => /^\d+.*\.sql$/i.test(file))
        .sort();

      for (const file of migrationFiles) {
        const sql = fs.readFileSync(
          path.join(sqlDirectory, file),
          "utf8"
        );

        await db.query(sql);
      }

      return res.json({
        ok: true,
        message:
          "Banco inicializado e atualizado com sucesso.",
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
