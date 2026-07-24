import express from "express";
import { authController } from "../controllers/AuthController.js";

const router = express.Router();

router.post(
  "/login",
  authController.login.bind(authController)
);

router.post(
  "/seed-admin",
  authController.seedAdmin.bind(authController)
);

router.post(
  "/seed-inspector",
  authController.seedInspector.bind(
    authController
  )
);

export default router;