import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { testConnection } from "./db.js";
import setupRoutes from "./routes/setup.routes.js";
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import switchingRoutes from "./routes/switching.routes.js";
import plansRoutes from "./routes/plans.routes.js";
import inspectionsRoutes from "./routes/inspections.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/setup", setupRoutes);
app.use("/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/plans", plansRoutes);
app.use("/inspections", inspectionsRoutes);
app.use("/api/switching", switchingRoutes);

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