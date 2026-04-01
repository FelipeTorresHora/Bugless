import envLoader from '../../services/env-loader.service';
import { AIEngineConfig, AIEngineInterface, GenerateOptions } from './ai-engine.interface';

export class ClaudeEngine implements AIEngineInterface {
  readonly name = 'Claude';

  constructor(private config: AIEngineConfig = {}) {}

  private resolveApiKey(): string {
    const key = this.config.apiKey || envLoader.getEnv('ANTHROPIC_API_KEY');
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is required when no user API key is provided');
    }
    return key;
  }

  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: this.resolveApiKey() });

    const response = await client.messages.create({
      model: options?.model || envLoader.getEnv('ANTHROPIC_MODEL') || 'claude-sonnet-4-6',
      max_tokens: options?.maxTokens || 2048,
      temperature: options?.temperature,
      messages: [{ role: 'user', content: prompt }],
    });

    const firstBlock = response.content.find((block: any) => block.type === 'text');
    return (firstBlock as any)?.text ?? '';
  }

  async generateStream(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: GenerateOptions
  ): Promise<string> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: this.resolveApiKey() });

    const stream = await client.messages.create({
      model: options?.model || envLoader.getEnv('ANTHROPIC_MODEL') || 'claude-sonnet-4-6',
      max_tokens: options?.maxTokens || 2048,
      temperature: options?.temperature,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    } as any);

    let fullText = '';
    for await (const event of stream as any) {
      const chunkText =
        event?.delta?.text ||
        event?.text ||
        (event?.type === 'content_block_delta' ? event?.delta?.text : '');

      if (chunkText) {
        fullText += chunkText;
        onChunk(chunkText);
      }
    }

    return fullText;
  }
}

export default ClaudeEngine;
