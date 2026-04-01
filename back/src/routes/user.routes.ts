import { Router } from "express";
import userController from "../controllers/user.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const userRouter = Router();

userRouter.get("/me", authMiddleware, userController.getProfile);

export default userRouter;
