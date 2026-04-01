import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import apiKeyController from "../controllers/api-key.controller";

const apiKeyRouter = Router();

apiKeyRouter.post("/", authMiddleware, apiKeyController.createOrUpdate);
apiKeyRouter.post("/validate", authMiddleware, apiKeyController.validate);
apiKeyRouter.get("/", authMiddleware, apiKeyController.list);
apiKeyRouter.delete("/:provider", authMiddleware, apiKeyController.delete);
apiKeyRouter.patch("/:provider/active", authMiddleware, apiKeyController.setActive);
apiKeyRouter.post("/:provider/revalidate", authMiddleware, apiKeyController.revalidate);

export default apiKeyRouter;
