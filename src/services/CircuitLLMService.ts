/// <reference types="@webgpu/types" />
import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";

// Select a model that balances speed and quality. 
// Llama-3.2-1B is lightweight (~800MB), fast, and requires only ~1.5GB VRAM.
export const SELECTED_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

let engine: MLCEngine | null = null;

const CircuitLLMService = {
  async isWebGPUSupported(): Promise<{ supported: boolean; error?: string }> {
    if (!navigator.gpu) {
      return { supported: false, error: "WebGPU is not supported in this browser." };
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        return { supported: false, error: "WebGPU is supported but no compatible GPU adapter was found." };
      }
      return { supported: true };
    } catch (e: any) {
      return { supported: false, error: `WebGPU initialization failed: ${e.message}` };
    }
  },

  getModelInfo() {
    return {
      name: SELECTED_MODEL,
      size: "~800MB",
      description: "Llama 3.2 1B Instruct (Quantized)"
    };
  },

  async initEngine(progressCallback?: (p: any) => void) {
    if (engine) return engine;

    engine = await CreateMLCEngine(
      SELECTED_MODEL,
      { initProgressCallback: progressCallback }
    );
    return engine;
  },

  async generateResponse(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    onChunk?: (chunk: string) => void
  ) {
    if (!engine) throw new Error("Circuit Backend not initialized");

    const reply = await engine.chat.completions.create({
      messages,
      temperature: 0.7,
      stream: true,
    });

    let fullResponse = "";
    for await (const chunk of reply) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullResponse += content;
      if (onChunk) {
        onChunk(content);
      }
    }

    if (!fullResponse) {
      throw new Error("No response generated");
    }

    return fullResponse;
  }
};

export default CircuitLLMService;
