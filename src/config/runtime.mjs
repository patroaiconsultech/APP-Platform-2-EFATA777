export function getRuntimeConfig(env = {}) {
  const raw = env.VITE_API_BASE_URL ?? "http://localhost:8000";
  const apiBaseUrl = String(raw).trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(apiBaseUrl)) throw new Error("API_BASE_URL_INVALID");
  return {
    apiBaseUrl,
    streamTimeoutMs: Number(env.VITE_STREAM_TIMEOUT_MS ?? 60000),
  };
}
