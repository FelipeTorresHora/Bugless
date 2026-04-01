export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIEngineConfig {
  apiKey?: string;
}

// Interface for the AI engine (Gemini, OpenAI, Claude, etc)
export interface AIEngineInterface {
  readonly name: string;
  generateText(prompt: string, options?: GenerateOptions): Promise<string>;
  generateStream(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: GenerateOptions
  ): Promise<string>;
}
