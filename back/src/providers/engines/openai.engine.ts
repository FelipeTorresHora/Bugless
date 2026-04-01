import envLoader from '../../services/env-loader.service';
import { AIEngineConfig, AIEngineInterface, GenerateOptions } from './ai-engine.interface';

export class OpenAIEngine implements AIEngineInterface {
  readonly name = 'OpenAI';

  private resolveApiKey(config: AIEngineConfig): string {
    const key = config.apiKey || envLoader.getEnv('OPENAI_API_KEY');
    if (!key) {
      throw new Error('OPENAI_API_KEY is required when no user API key is provided');
    }
    return key;
  }

  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: this.resolveApiKey(this.config) });

    const response = await client.chat.completions.create({
      model: options?.model || envLoader.getEnv('OPENAI_MODEL') || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    return response.choices[0]?.message?.content ?? '';
  }

  constructor(private config: AIEngineConfig = {}) {}

  async generateStream(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: GenerateOptions
  ): Promise<string> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: this.resolveApiKey(this.config) });

    const stream = await client.chat.completions.create({
      model: options?.model || envLoader.getEnv('OPENAI_MODEL') || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      stream: true,
    });

    let fullText = '';
    for await (const chunk of stream) {
      const chunkText = chunk.choices[0]?.delta?.content ?? '';
      if (chunkText) {
        fullText += chunkText;
        onChunk(chunkText);
      }
    }

    return fullText;
  }
}

export default OpenAIEngine;
