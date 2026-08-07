import express from "express";
import { planController } from "../controllers/PlanController.js";
import { requireSystemManager } from "../middlewares/permissions.middleware.js";

const router = express.Router();

router.get(
  "/",
  planController.list.bind(planController)
);

router.get(
  "/:id/revisions",
  planController.getRevisions.bind(
    planController
  )
);

router.get(
  "/:id",
  planController.getById.bind(
    planController
  )
);

router.post(
  "/",
  requireSystemManager,
  planController.create.bind(
    planController
  )
);

router.put(
  "/:id",
  requireSystemManager,
  planController.update.bind(
    planController
  )
);

router.delete(
  "/:id",
  requireSystemManager,
  planController.delete.bind(
    planController
  )
);

export default router;
