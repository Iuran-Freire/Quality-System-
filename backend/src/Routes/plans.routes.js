import express from "express";
import { planController } from "../controllers/PlanController.js";

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
  planController.create.bind(
    planController
  )
);

router.put(
  "/:id",
  planController.update.bind(
    planController
  )
);

router.delete(
  "/:id",
  planController.delete.bind(
    planController
  )
);

export default router;