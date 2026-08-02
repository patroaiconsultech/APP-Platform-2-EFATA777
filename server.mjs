import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSecurityHeaders,
  parseConnectSources,
} from "./src/security/csp.mjs";


const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};


function isProduction(env) {
  return String(
    env.PLATFORM_ENVIRONMENT ??
    env.NODE_ENV ??
    "",
  ).toLowerCase() === "production";
}


function originFromAbsoluteUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.startsWith("/")) return "";
  try {
    return new URL(raw).origin;
  } catch {
    throw new Error("CSP_RUNTIME_URL_INVALID");
  }
}


function configuredConnectSources(env) {
  const explicit = String(
    env.ORKIO_CSP_CONNECT_SRC ?? "",
  );
  const inferred = [
    originFromAbsoluteUrl(env.VITE_API_BASE_URL),
    originFromAbsoluteUrl(env.VITE_API_URL),
  ].filter(Boolean);
  return parseConnectSources(
    [explicit, ...inferred].join(" "),
  );
}


function resolveStaticPath(distDir, pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = normalize(decoded)
    .replace(/^([/\\])+/, "");
  const candidate = resolve(distDir, relative);
  const root = resolve(distDir);
  if (
    candidate !== root &&
    !candidate.startsWith(`${root}/`)
  ) {
    return null;
  }
  return candidate;
}


function sendFile(req, res, filePath, headers) {
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value);
  }

  const extension = extname(filePath).toLowerCase();
  res.setHeader(
    "Content-Type",
    MIME[extension] ?? "application/octet-stream",
  );
  if (
    extension === ".html" ||
    filePath.endsWith("index.html")
  ) {
    res.setHeader(
      "Cache-Control",
      "no-cache, max-age=0, must-revalidate",
    );
  } else if (filePath.includes("/assets/")) {
    res.setHeader(
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
  } else {
    res.setHeader(
      "Cache-Control",
      "public, max-age=3600, must-revalidate",
    );
  }

  res.statusCode = 200;
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}


export function createStaticServer({
  distDir = fileURLToPath(
    new URL("./dist", import.meta.url),
  ),
  env = process.env,
} = {}) {
  const production = isProduction(env);
  const connectSources = configuredConnectSources(env);
  const headers = buildSecurityHeaders({
    connectSources,
    production,
  });

  return createServer((req, res) => {
    const url = new URL(
      req.url ?? "/",
      "http://localhost",
    );

    if (url.pathname === "/healthz") {
      for (const [name, value] of Object.entries(headers)) {
        res.setHeader(name, value);
      }
      res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8",
      );
      res.setHeader("Cache-Control", "no-store");
      res.statusCode = 200;
      res.end(JSON.stringify({
        ok: true,
        security_headers: true,
      }));
      return;
    }

    if (!["GET", "HEAD"].includes(req.method ?? "")) {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, HEAD");
      res.end("Method not allowed");
      return;
    }

    let candidate;
    try {
      candidate = resolveStaticPath(
        distDir,
        url.pathname,
      );
    } catch {
      res.statusCode = 400;
      res.end("Invalid path");
      return;
    }

    if (
      candidate &&
      existsSync(candidate) &&
      statSync(candidate).isFile()
    ) {
      sendFile(req, res, candidate, headers);
      return;
    }

    const acceptsHtml = String(
      req.headers.accept ?? "",
    ).includes("text/html");
    const indexPath = join(distDir, "index.html");
    if (acceptsHtml && existsSync(indexPath)) {
      sendFile(req, res, indexPath, headers);
      return;
    }

    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
    res.statusCode = 404;
    res.end("Not found");
  });
}


function isEntryPoint() {
  return (
    process.argv[1] &&
    resolve(process.argv[1]) ===
      resolve(fileURLToPath(import.meta.url))
  );
}


if (isEntryPoint()) {
  const port = Number(process.env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT_INVALID");
  }
  const server = createStaticServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(
      `ORKIO Premium frontend listening on ${port}`,
    );
  });
}
