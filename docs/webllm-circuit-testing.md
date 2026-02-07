# WebLLM for Circuit Testing

This document details the implementation of [WebLLM](https://github.com/mlc-ai/web-llm) as a local, browser-based testing backend for **Circuit**. This allows developers to test the Circuit UI and "learning" flows without requiring a deployed real backend or API connection, using a real LLM running entirely in the browser.

## Overview

WebLLM (powered by MLC LLM) brings high-performance LLM inference to web browsers using **WebGPU**. By integrating this, we can simulate the Circuit agent's conversational capabilities locally.

### Use Case
- **Dummy Customer Chats**: Simulate the user (Retailer) talking to Circuit.
- **Circuit Persona Simulation**: Run a local model (specifically **Llama-3.2-1B-Instruct**) with a system prompt that mimics Circuit's "Munna Bhai" style efficiency and objective-learning behavior.
- **Offline Development**: Build and refine the UI/UX even when offline or before the backend services are ready.

## Prerequisites & Compatiblity

Since WebLLM runs on the client side using WebGPU, the development and testing environment must meet the following requirements:

### Hardware
- **GPU**: A GPU with support for WebGPU is required.
  - **Memory (VRAM)**: ~1.5GB of VRAM is sufficient for the recommended **Llama-3.2-1B** model.
  - **Storage**: ~800MB for model weights cache.
  - **Performance**: Fast inference on most modern hardware, including Apple Silicon (M1/M2/M3) and discrete NVIDIA/AMD GPUs.

### Software (Browser)
- **Google Chrome**: Version 113 or later (stable).
- **Microsoft Edge**: Version 113 or later.
- **Safari**: macOS Sonoma (14.0+) has WebGPU support, but Chrome is generally the most stable target for dev.
- **Firefox**: Nightly builds (with specific flags enabled), generally not recommended for stable dev.

**Verification**: Visit [webgpureport.org](https://webgpureport.org/) to verify WebGPU support in your current browser.

## Implementation Details

### 1. Installation

Install the WebLLM SDK:

```bash
npm install @mlc-ai/web-llm
```

### 2. Service Wrapper (CircuitSimulator)

Create a service or store module (e.g., `services/CircuitLLMService.ts`) to manage the model lifecycle. This prevents reloading the model on every page navigation.

#### Core Responsibilities:
1.  **Initialization**: Load the model engine on app start or first Circuit access.
2.  **Chat State Management**: Maintain the history of the conversation context.
3.  **Prompt Engineering**: Inject the specific system prompts defined in `docs/ciruit.md`.

### 3. Basic Code Structure

```typescript
import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";

// Select a model that balances speed and quality. 
// Llama-3.2-1B is lightweight (~800MB), fast, and requires only ~1.5GB VRAM.
const SELECTED_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

let engine: MLCEngine | null = null;

export const initCircuitBackend = async (progressCallback?: (p: any) => void) => {
  if (engine) return engine;

  engine = await CreateMLCEngine(
    SELECTED_MODEL,
    { initProgressCallback: progressCallback } // Callback to show loading bar in UI
  );
  return engine;
};

export const generateCircuitResponse = async (
  messages: { role: "system" | "user" | "assistant"; content: string }[]
) => {
  if (!engine) throw new Error("Circuit Backend not initialized");

  const reply = await engine.chat.completions.create({
    messages,
    temperature: 0.7, // Adjust for creativity vs deterministic behavior
    stream: true, // Use streaming for a better real-time chat experience
  });

  return reply;
};
```

### 4. Circuit System Prompting

To properly test the "Learning" phase as described in `docs/ciruit.md`, the system prompt should set the behavior:

```javascript
const CIRCUIT_SYSTEM_PROMPT = `
You are Circuit, an intelligent Order Routing assistant. 
Your goal is to learn the retailer's omnichannel routing objectives (e.g., minimizing split shipments, fastest delivery, inventory optimization).
Ask one question at a time. Be concise and efficient. 
Do not be chatty. Act like a "Munna Bhai" character - get things done reliably without unnecessary questions.
Once you have enough information, confirm your understanding.
`;
```

## Considerations

- **Initial Load Time**: The first time the app runs, it will download the model weights (several GBs). Code must handle this "Loading Model..." state gracefully with a progress bar.
- **Caching**: WebLLM caches model weights in the browser cache. Subsequent loads are much faster.
- **Token Limits**: Be mindful of the context window (usually 4k or 8k tokens) when passing long chat histories.
- **Performance**: Running LLMs consumes battery and heats up the device. It is a **testing** solution, not necessarily for production deployment on low-end end-user devices.
