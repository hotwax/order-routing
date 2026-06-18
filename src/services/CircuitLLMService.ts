/// <reference types="@webgpu/types" />
import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";

// Select a model that balances speed and quality. 
// Hermes-3-Llama-3.1-8B is allow-listed for function calling in WebLLM.
export const SELECTED_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

let engine: MLCEngine | null = null;

const CircuitLLMService = {
  async isWebGPUSupported(): Promise<{ supported: boolean; error?: string }> {
    if (typeof navigator === "undefined" || !navigator.gpu) {
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
      size: "~0.5GB",
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

  async generateResponse(messages: { role: "system" | "user" | "assistant"; content: string }[], onChunk?: (chunk: string) => void) {
    if (!engine) throw new Error("Circuit Backend not initialized");

    try {
      console.log('Generating LLM response with messages:', messages);
      const reply = await engine.chat.completions.create({
        messages,
        temperature: 0.7,
        stream: true
      });

      let fullResponse = "";

      try {
        for await (const chunk of reply) {
          const content = chunk.choices[0]?.delta?.content || "";
          
          if (content) {
            fullResponse += content;
            if (onChunk) {
              onChunk(content);
            }
          }
        }
      } catch (streamError: any) {
        console.warn("Stream processing error:", streamError);
      }

      return {
        content: fullResponse,
        toolCalls: null
      };
    } catch (e: any) {
      console.error("Error in generateResponse with tools:", e);
      throw e;
    }
  },

  async unloadEngine() {
    if (engine) {
      await engine.unload();
      engine = null;
    }
  },

  async getGPUInfo() {
    let vendor = "Unknown";
    let bytes = 0;

    if (typeof navigator !== "undefined" && navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        bytes = adapter.limits.maxStorageBufferBindingSize;
      }
    }

    if (engine) {
      try {
        vendor = await engine.getGPUVendor();
      } catch (e) {
        console.error("Failed to get GPU vendor from engine", e);
      }
    }

    return {
      vendor,
      maxStorageBufferBindingSize: (bytes / (1024 * 1024)).toFixed(0) + " MB"
    };
  }
};

export default CircuitLLMService;
