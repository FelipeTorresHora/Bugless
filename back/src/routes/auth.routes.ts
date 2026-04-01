import { Router } from "express";
import authController from "../controllers/auth.controller";
import authSessionRouter from "./auth-session.routes";

const authRouter = Router();

authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.post("/cli-login", authController.cliLogin);
authRouter.get("/cli-status", authController.cliStatus);
authRouter.use("/session", authSessionRouter);

export default authRouter;

