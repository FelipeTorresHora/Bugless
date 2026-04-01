import { AiProvider } from "../generated/prisma/enums";
import { AIEngineConfig, AIEngineInterface, GenerateOptions } from "./engines/ai-engine.interface";
import ClaudeEngine from "./engines/claude.engine";
import GeminiEngine from "./engines/gemini.engine";
import OpenAIEngine from "./engines/openai.engine";

type EngineBuilder = (config?: AIEngineConfig) => AIEngineInterface;

const ENGINE_BUILDERS: Record<AiProvider, EngineBuilder> = {
  [AiProvider.GEMINI]: (config) => new GeminiEngine(config),
  [AiProvider.OPENAI]: (config) => new OpenAIEngine(config),
  [AiProvider.CLAUDE]: (config) => new ClaudeEngine(config),
};

class AIProviderFactory {
  private createEngine(provider: AiProvider, config: AIEngineConfig = {}) {
    const builder = ENGINE_BUILDERS[provider];
    if (!builder) {
      throw new Error(`Provider "${provider}" not configured`);
    }
    return builder(config);
  }

  async generateContent(
    provider: AiProvider,
    prompt: string,
    config: AIEngineConfig = {},
    options?: GenerateOptions
  ): Promise<string> {
    const engine = this.createEngine(provider, config);
    return engine.generateText(prompt, options);
  }

  async generateStream(
    provider: AiProvider,
    prompt: string,
    onChunk: (chunk: string) => void,
    config: AIEngineConfig = {},
    options?: GenerateOptions
  ): Promise<string> {
    const engine = this.createEngine(provider, config);
    return engine.generateStream(prompt, onChunk, options);
  }
}

export default new AIProviderFactory();
