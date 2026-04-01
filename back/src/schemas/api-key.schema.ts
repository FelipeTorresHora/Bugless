import { z } from "zod";

export const providerEnumSchema = z.enum(["GEMINI", "OPENAI", "CLAUDE"]);

const normalizeProvider = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(providerEnumSchema);

export const createApiKeySchema = z.object({
  provider: normalizeProvider,
  key: z.string().trim().min(1, "API key is required"),
  keyName: z.string().trim().max(80).optional(),
});

export const apiKeyProviderParamsSchema = z.object({
  provider: normalizeProvider,
});

export type CreateApiKeySchema = z.infer<typeof createApiKeySchema>;
export type ApiKeyProviderParamsSchema = z.infer<
  typeof apiKeyProviderParamsSchema
>;
