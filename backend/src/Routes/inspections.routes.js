import express from "express";
import { inspectionController } from "../controllers/InspectionController.js";

const router = express.Router();

router.get(
  "/",
  inspectionController.list.bind(
    inspectionController
  )
);

router.get(
  "/:id",
  inspectionController.getById.bind(
    inspectionController
  )
);

router.post(
  "/",
  inspectionController.create.bind(
    inspectionController
  )
);

router.put(
  "/:id",
  inspectionController.update.bind(
    inspectionController
  )
);

router.patch(
  "/:id/conditional-approval",
  inspectionController.approveConditionally.bind(
    inspectionController
  )
);

router.delete(
  "/:id",
  inspectionController.delete.bind(
    inspectionController
  )
);

export default router;