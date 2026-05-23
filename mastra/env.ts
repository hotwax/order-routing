// Returns a process-or-vite env var. mastra dev runs the entry in plain Node,
// where `import.meta.env` is undefined; reading `.X` off undefined throws at
// startup. This helper prefers process.env first and then falls back to Vite's
// injected `import.meta.env` when the entry is bundled by Vite instead.
export function readEnv(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }

  const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return viteEnv?.[key];
}
