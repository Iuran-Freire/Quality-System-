import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { testConnection } from "./db.js";

import setupRoutes from "./routes/setup.routes.js";
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import switchingRoutes from "./routes/switching.routes.js";
import plansRoutes from "./routes/plans.routes.js";
import inspectionsRoutes from "./routes/inspections.routes.js";
import alertsRoutes from "./Routes/alerts.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

function normalizeInspectionArea(value) {
  const area = String(value || "").trim().toUpperCase();

  if (["IQC", "OQC", "ALL"].includes(area)) {
    return area;
  }

  return null;
}

function requireAuth(req, res, next) {
  const authorization = String(req.headers.authorization || "").trim();

  if (!authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      message: "Acesso não autorizado. Faça login novamente.",
    });
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      ok: false,
      message: "Token de acesso não informado.",
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const inspectionArea = normalizeInspectionArea(
      payload?.inspectionArea
    );

    if (!inspectionArea) {
      return res.status(403).json({
        ok: false,
        message:
          "Usuário sem área de inspeção válida. Solicite classificação como IQC, OQC ou Ambos.",
      });
    }

    req.user = {
      ...payload,
      inspectionArea,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: "Sessão expirada ou inválida. Faça login novamente.",
    });
  }
}

function requireSystemManager(req, res, next) {
  const level = Number(req.user?.accessLevel || 3);

  if (level > 2) {
    return res.status(403).json({
      ok: false,
      message:
        "Você não possui permissão para administrar usuários do sistema.",
    });
  }

  next();
}

// Rotas sem login
app.use("/setup", setupRoutes);
app.use("/auth", authRoutes);

// Rotas protegidas por login
app.use("/api/users", requireAuth, requireSystemManager, usersRoutes);
app.use("/plans", requireAuth, plansRoutes);
app.use("/inspections", requireAuth, inspectionsRoutes);
app.use("/api/switching", requireAuth, switchingRoutes);
app.use("/api/alerts", requireAuth, alertsRoutes);

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Quality System API",
    health: "/health",
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    message: "Quality System API online",
  });
});

app.get("/db-test", async (req, res) => {
  try {
    const result = await testConnection();

    res.json({
      ok: true,
      message: "Banco conectado com sucesso",
      databaseTime: result.now,
    });
  } catch (error) {
    console.error("Erro ao conectar no banco:", error);

    res.status(500).json({
      ok: false,
      message: "Erro ao conectar no banco",
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});