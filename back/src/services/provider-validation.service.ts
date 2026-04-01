import { AiProvider } from "../generated/prisma/enums";
import aiProvider from "../providers/ai.provider";

export type ProviderValidationResult = {
  provider: AiProvider;
  isValid: boolean;
  validationCode: "VALID" | "INVALID";
  message: string;
};

export class ProviderValidationError extends Error {
  constructor(
    public code:
      | "INVALID_KEY"
      | "PROVIDER_VALIDATION_FAILED",
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ProviderValidationError";
  }
}

interface ProviderValidator {
  provider: AiProvider;
  validate(apiKey: string): Promise<ProviderValidationResult>;
}

class BaseProviderValidator implements ProviderValidator {
  constructor(public provider: AiProvider) {}

  private getErrorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== "object") {
      return undefined;
    }

    const anyError = error as any;
    return anyError.statusCode ?? anyError.status ?? anyError.response?.status;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return "Unknown error";
  }

  async validate(apiKey: string): Promise<ProviderValidationResult> {
    try {
      await aiProvider.generateContent(
        this.provider,
        "Respond with a single word: pong",
        { apiKey }
      );

      return {
        provider: this.provider,
        isValid: true,
        validationCode: "VALID",
        message: `${this.provider} API key validated successfully`,
      };
    } catch (error) {
      const status = this.getErrorStatus(error);
      const message = this.getErrorMessage(error);

      if (status === 401 || status === 403) {
        throw new ProviderValidationError(
          "INVALID_KEY",
          `Invalid ${this.provider} API key: ${message}`,
          400
        );
      }

      throw new ProviderValidationError(
        "PROVIDER_VALIDATION_FAILED",
        `Failed to validate ${this.provider} API key: ${message}`,
        502
      );
    }
  }
}

class ProviderValidationService {
  private validators: Record<AiProvider, ProviderValidator> = {
    [AiProvider.GEMINI]: new BaseProviderValidator(AiProvider.GEMINI),
    [AiProvider.OPENAI]: new BaseProviderValidator(AiProvider.OPENAI),
    [AiProvider.CLAUDE]: new BaseProviderValidator(AiProvider.CLAUDE),
  };

  async validateApiKey(
    provider: AiProvider,
    apiKey: string
  ): Promise<ProviderValidationResult> {
    const validator = this.validators[provider];

    if (!validator) {
      throw new ProviderValidationError(
        "PROVIDER_VALIDATION_FAILED",
        `Provider ${provider} is not supported`,
        400
      );
    }

    return validator.validate(apiKey);
  }
}

export default new ProviderValidationService();
