const SELF = "'self'";


export function normalizeTrustedOrigin(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === SELF) return raw;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("CSP_CONNECT_ORIGIN_INVALID");
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("CSP_CONNECT_PROTOCOL_INVALID");
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("CSP_CONNECT_ORIGIN_ONLY_REQUIRED");
  }
  return parsed.origin;
}


export function parseConnectSources(raw) {
  const values = String(raw ?? "")
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const sources = new Set([SELF]);
  for (const value of values) {
    const normalized = normalizeTrustedOrigin(value);
    if (normalized) sources.add(normalized);
  }
  return [...sources];
}


export function buildContentSecurityPolicy({
  connectSources = [SELF],
  production = false,
} = {}) {
  const connect = [...new Set(
    connectSources.map(normalizeTrustedOrigin),
  )].filter(Boolean);

  if (
    production &&
    connect.some((source) =>
      source.startsWith("http://") &&
      !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(source)
    )
  ) {
    throw new Error("CSP_CONNECT_HTTPS_REQUIRED");
  }

  const directives = [
    `default-src ${SELF}`,
    `base-uri ${SELF}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    `form-action ${SELF}`,
    `script-src ${SELF}`,
    `style-src ${SELF}`,
    `img-src ${SELF} data: blob:`,
    `font-src ${SELF} data:`,
    `connect-src ${connect.join(" ") || SELF}`,
    `media-src ${SELF} blob:`,
    `worker-src ${SELF} blob:`,
    `manifest-src ${SELF}`,
    "frame-src 'none'",
  ];
  if (production) {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}


export function buildSecurityHeaders({
  connectSources,
  production = false,
} = {}) {
  return {
    "Content-Security-Policy":
      buildContentSecurityPolicy({
        connectSources,
        production,
      }),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy":
      "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Frame-Options": "DENY",
  };
}
