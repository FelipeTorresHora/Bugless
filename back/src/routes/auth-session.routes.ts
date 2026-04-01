import { Router } from "express";
import authSessionController from "../controllers/auth-session.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const authSessionRouter = Router();

authSessionRouter.post("/login", authSessionController.login);
authSessionRouter.post("/register", authSessionController.register);
authSessionRouter.post("/refresh", authSessionController.refresh);
authSessionRouter.get("/me", authMiddleware, authSessionController.me);
authSessionRouter.post("/logout", authSessionController.logout);
authSessionRouter.post("/logout-all", authMiddleware, authSessionController.logoutAll);

export default authSessionRouter;
