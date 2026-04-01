import { Request, Response } from "express";
import { flattenError, ZodError } from "zod";
import {
  apiKeyProviderParamsSchema,
  createApiKeySchema,
} from "../schemas/api-key.schema";
import apiKeyService from "../services/api-key.service";
import HttpHelper from "../utils/http-helper";
import { AiProvider } from "../generated/prisma/enums";
import { ProviderValidationError } from "../services/provider-validation.service";

class ApiKeyController {
  async createOrUpdate(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return HttpHelper.unauthorized(res, "Unauthorized");
      }

      const data = createApiKeySchema.parse(req.body);
      const provider = data.provider as AiProvider;

      const result = await apiKeyService.createOrUpdateApiKey({
        userId,
        provider,
        plainKey: data.key,
        keyName: data.keyName,
      });

      const message = result.created
        ? "API key created successfully"
        : "API key updated successfully";

      return result.created
        ? HttpHelper.created(res, result.apiKey, message)
        : HttpHelper.success(res, result.apiKey, message);
    } catch (error) {
      if (error instanceof ZodError) {
        return HttpHelper.badRequest(res, "Validation error", flattenError(error));
      }

      if (error instanceof ProviderValidationError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }

      if (error instanceof Error && error.message.includes("Invalid API key format")) {
        return HttpHelper.badRequest(res, error.message, {
          key: ["Please provide a key compatible with the selected provider."],
        });
      }

      console.error("Error creating/updating API key:", error);
      return HttpHelper.serverError(res);
    }
  }

  async validate(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return HttpHelper.unauthorized(res, "Unauthorized");
      }

      const data = createApiKeySchema.parse(req.body);
      const provider = data.provider as AiProvider;

      const validation = await apiKeyService.validateApiKey(provider, data.key);

      return HttpHelper.success(res, validation, "API key validated successfully");
    } catch (error) {
      if (error instanceof ZodError) {
        return HttpHelper.badRequest(res, "Validation error", flattenError(error));
      }

      if (error instanceof ProviderValidationError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }

      if (error instanceof Error && error.message.includes("Invalid API key format")) {
        return HttpHelper.badRequest(res, error.message, {
          key: ["Please provide a key compatible with the selected provider."],
        });
      }

      console.error("Error validating API key:", error);
      return HttpHelper.serverError(res);
    }
  }

  async list(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return HttpHelper.unauthorized(res, "Unauthorized");
      }

      const apiKeys = await apiKeyService.listApiKeys(userId);
      return HttpHelper.success(res, apiKeys, "API keys fetched successfully");
    } catch (error) {
      console.error("Error listing API keys:", error);
      return HttpHelper.serverError(res);
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return HttpHelper.unauthorized(res, "Unauthorized");
      }

      const params = apiKeyProviderParamsSchema.parse(req.params);
      const deleted = await apiKeyService.deleteApiKey(
        userId,
        params.provider as AiProvider
      );

      if (!deleted) {
        return HttpHelper.notFound(res, "API key not found");
      }

      return HttpHelper.success(res, deleted, "API key deleted successfully");
    } catch (error) {
      if (error instanceof ZodError) {
        return HttpHelper.badRequest(res, "Validation error", flattenError(error));
      }

      console.error("Error deleting API key:", error);
      return HttpHelper.serverError(res);
    }
  }

  async setActive(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return HttpHelper.unauthorized(res, "Unauthorized");
      }

      const params = apiKeyProviderParamsSchema.parse(req.params);
      const active = await apiKeyService.setActiveProvider(
        userId,
        params.provider as AiProvider
      );

      if (!active) {
        return HttpHelper.notFound(res, "API key not found");
      }

      return HttpHelper.success(
        res,
        active,
        "Active provider updated successfully"
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return HttpHelper.badRequest(res, "Validation error", flattenError(error));
      }

      console.error("Error updating active API key provider:", error);
      return HttpHelper.serverError(res);
    }
  }

  async revalidate(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return HttpHelper.unauthorized(res, "Unauthorized");
      }

      const params = apiKeyProviderParamsSchema.parse(req.params);
      const apiKey = await apiKeyService.revalidateStoredApiKey(
        userId,
        params.provider as AiProvider
      );

      if (!apiKey) {
        return HttpHelper.notFound(res, "API key not found");
      }

      return HttpHelper.success(res, apiKey, "API key revalidated successfully");
    } catch (error) {
      if (error instanceof ZodError) {
        return HttpHelper.badRequest(res, "Validation error", flattenError(error));
      }

      if (error instanceof ProviderValidationError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }

      console.error("Error revalidating API key:", error);
      return HttpHelper.serverError(res);
    }
  }
}

export default new ApiKeyController();
