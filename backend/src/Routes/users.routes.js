import express from "express";
import { userController } from "../controllers/UserController.js";

const router = express.Router();

router.get(
  "/",
  userController.list.bind(userController)
);

router.post(
  "/",
  userController.create.bind(userController)
);

router.patch(
  "/:id/active",
  userController.updateActive.bind(
    userController
  )
);

router.put(
  "/:id",
  userController.update.bind(userController)
);

export default router;