import express from "express";
import { authController } from "../controllers/AuthController.js";
import { requireSetupKey } from "../middlewares/setup-key.middleware.js";

const router = express.Router();

router.post(
  "/login",
  authController.login.bind(
    authController
  )
);

router.post(
  "/seed-admin",
  requireSetupKey,
  authController.seedAdmin.bind(
    authController
  )
);

router.post(
  "/seed-inspector",
  requireSetupKey,
  authController.seedInspector.bind(
    authController
  )
);

export default router;