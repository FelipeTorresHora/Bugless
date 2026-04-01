import prisma from "../database/prisma";
import { AiProvider } from "../generated/prisma/enums";
import encryptionService from "./encryption.service";
import providerValidationService from "./provider-validation.service";

type CreateOrUpdateApiKeyInput = {
  userId: string;
  provider: AiProvider;
  plainKey: string;
  keyName?: string;
};

type ActiveApiKey = {
  id: string;
  provider: AiProvider;
  plainKey: string;
  isValid: boolean;
  keyName: string | null;
};

class ApiKeyService {
  private validateProviderKeyFormat(provider: AiProvider, plainKey: string) {
    const key = plainKey.trim();

    const validators: Record<AiProvider, RegExp> = {
      GEMINI: /^AIza[0-9A-Za-z_-]{20,}$/,
      OPENAI: /^sk-[A-Za-z0-9_-]{20,}$/,
      CLAUDE: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    };

    const providerRegex = validators[provider];
    if (!providerRegex.test(key)) {
      throw new Error(`Invalid API key format for provider ${provider}`);
    }
  }

  private maskSecret(secret: string): string {
    if (secret.length <= 8) {
      return `${secret.slice(0, 1)}***${secret.slice(-1)}`;
    }

    return `${secret.slice(0, 4)}****${secret.slice(-4)}`;
  }

  private async toSafeApiKey(apiKey: {
    id: string;
    provider: AiProvider;
    keyName: string | null;
    isActive: boolean;
    isValid: boolean;
    lastValidatedAt: Date | null;
    lastUsedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    encryptedKey: string;
  }) {
    let maskedKey = "****";

    try {
      const plainKey = encryptionService.decrypt(apiKey.encryptedKey);
      maskedKey = this.maskSecret(plainKey);
    } catch {
      maskedKey = "****";
    }

    return {
      id: apiKey.id,
      provider: apiKey.provider,
      keyName: apiKey.keyName,
      isActive: apiKey.isActive,
      isValid: apiKey.isValid,
      lastValidatedAt: apiKey.lastValidatedAt,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
      maskedKey,
    };
  }

  async createOrUpdateApiKey(data: CreateOrUpdateApiKeyInput) {
    this.validateProviderKeyFormat(data.provider, data.plainKey);
    await providerValidationService.validateApiKey(data.provider, data.plainKey);

    const encryptedKey = encryptionService.encrypt(data.plainKey);

    const existing = await prisma.apiKey.findUnique({
      where: {
        userId_provider: {
          userId: data.userId,
          provider: data.provider,
        },
      },
    });

    const apiKey = await prisma.$transaction(async (tx) => {
      await tx.apiKey.updateMany({
        where: { userId: data.userId },
        data: { isActive: false },
      });

      return tx.apiKey.upsert({
        where: {
          userId_provider: {
            userId: data.userId,
            provider: data.provider,
          },
        },
        create: {
          userId: data.userId,
          provider: data.provider,
          encryptedKey,
          keyName: data.keyName,
          isActive: true,
          isValid: true,
          lastValidatedAt: new Date(),
        },
        update: {
          encryptedKey,
          keyName: data.keyName,
          isActive: true,
          isValid: true,
          lastValidatedAt: new Date(),
        },
      });
    });

    return {
      apiKey: await this.toSafeApiKey(apiKey),
      created: !existing,
    };
  }

  async listApiKeys(userId: string) {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    return Promise.all(apiKeys.map((apiKey) => this.toSafeApiKey(apiKey)));
  }

  async deleteApiKey(userId: string, provider: AiProvider) {
    const target = await prisma.apiKey.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!target) {
      return null;
    }

    await prisma.apiKey.delete({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    return {
      provider: target.provider,
      keyName: target.keyName,
    };
  }

  async setActiveProvider(userId: string, provider: AiProvider) {
    const target = await prisma.apiKey.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!target) {
      return null;
    }

    await prisma.$transaction(async (tx) => {
      await tx.apiKey.updateMany({
        where: { userId },
        data: { isActive: false },
      });

      await tx.apiKey.update({
        where: { id: target.id },
        data: { isActive: true },
      });
    });

    return {
      provider,
      isActive: true,
    };
  }

  async validateApiKey(provider: AiProvider, plainKey: string) {
    this.validateProviderKeyFormat(provider, plainKey);
    return providerValidationService.validateApiKey(provider, plainKey);
  }

  async getActiveApiKeyForUser(userId: string): Promise<ActiveApiKey | null> {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        userId,
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!apiKey) {
      return null;
    }

    const plainKey = encryptionService.decrypt(apiKey.encryptedKey);

    return {
      id: apiKey.id,
      provider: apiKey.provider,
      plainKey,
      isValid: apiKey.isValid,
      keyName: apiKey.keyName,
    };
  }

  async markApiKeyAsUsed(apiKeyId: string) {
    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { lastUsedAt: new Date() },
    });
  }

  async markApiKeyAsInvalid(apiKeyId: string) {
    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { isValid: false, lastValidatedAt: new Date() },
    });
  }

  async revalidateStoredApiKey(userId: string, provider: AiProvider) {
    const apiKey = await prisma.apiKey.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!apiKey) {
      return null;
    }

    const plainKey = encryptionService.decrypt(apiKey.encryptedKey);
    const validation = await providerValidationService.validateApiKey(
      provider,
      plainKey
    );

    const updated = await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: {
        isValid: validation.isValid,
        lastValidatedAt: new Date(),
      },
    });

    return this.toSafeApiKey(updated);
  }
}

export default new ApiKeyService();
