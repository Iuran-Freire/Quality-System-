import express from "express";
import { switchingController } from "../controllers/SwitchingController.js";

const router = express.Router();

router.get(
  "/password-status",
  switchingController.getPasswordStatus.bind(
    switchingController
  )
);

router.post(
  "/password",
  switchingController.savePassword.bind(
    switchingController
  )
);

router.post(
  "/password/check",
  switchingController.checkPassword.bind(
    switchingController
  )
);

router.get(
  "/plans/:planId/analyze",
  switchingController.analyzePlan.bind(
    switchingController
  )
);

router.post(
  "/plans/:planId/suggest",
  switchingController.suggestPlan.bind(
    switchingController
  )
);

router.post(
  "/plans/:planId/approve",
  switchingController.approvePlan.bind(
    switchingController
  )
);

router.get(
  "/history",
  switchingController.getHistory.bind(
    switchingController
  )
);

export default router;