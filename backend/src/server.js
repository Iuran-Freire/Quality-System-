import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { requireAuth } from "./middlewares/auth.middleware.js";
import {
  requireSystemManager,
} from "./middlewares/permissions.middleware.js";


import { testConnection } from "./db.js";

import setupRoutes from "./Routes/setup.routes.js";
import authRoutes from "./Routes/auth.routes.js";
import usersRoutes from "./Routes/users.routes.js";
import switchingRoutes from "./Routes/switching.routes.js";
import plansRoutes from "./Routes/plans.routes.js";
import inspectionsRoutes from "./Routes/inspections.routes.js";
import alertsRoutes from "./Routes/alerts.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());


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