import express from "express";
import { alertController } from "../controllers/AlertController.js";

const router = express.Router();

router.get(
  "/summary",
  alertController.summary.bind(alertController)
);

router.get(
  "/",
  alertController.list.bind(alertController)
);

router.patch(
  "/:id/view",
  alertController.view.bind(alertController)
);

router.patch(
  "/:id/resolve",
  alertController.resolve.bind(alertController)
);

export default router;