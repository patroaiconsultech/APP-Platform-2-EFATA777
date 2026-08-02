const TRANSACTION_KEY = "orkio.oidc.pkce.transaction";


function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}


function randomBytes(length, cryptoImpl) {
  const bytes = new Uint8Array(length);
  cryptoImpl.getRandomValues(bytes);
  return bytes;
}


async function sha256(value, cryptoImpl) {
  const data = new TextEncoder().encode(value);
  return new Uint8Array(
    await cryptoImpl.subtle.digest("SHA-256", data),
  );
}


export function hasOidcCallback(
  locationLike = globalThis.location,
) {
  const params = new URLSearchParams(
    locationLike?.search ?? "",
  );
  return (
    params.has("code") ||
    params.has("error")
  );
}


export async function createAuthorizationRequest({
  config,
  storage = globalThis.sessionStorage,
  cryptoImpl = globalThis.crypto,
  now = Date.now(),
}) {
  if (!cryptoImpl?.subtle || !cryptoImpl?.getRandomValues) {
    throw new Error("OIDC_WEB_CRYPTO_REQUIRED");
  }

  const verifier = base64Url(
    randomBytes(64, cryptoImpl),
  );
  const challenge = base64Url(
    await sha256(verifier, cryptoImpl),
  );
  const state = base64Url(
    randomBytes(32, cryptoImpl),
  );

  const transaction = {
    state,
    verifier,
    createdAt: now,
  };
  storage?.setItem(
    TRANSACTION_KEY,
    JSON.stringify(transaction),
  );

  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set(
    "redirect_uri",
    config.redirectUri,
  );
  url.searchParams.set(
    "scope",
    config.scopes.join(" "),
  );
  url.searchParams.set("state", state);
  url.searchParams.set(
    "code_challenge",
    challenge,
  );
  url.searchParams.set(
    "code_challenge_method",
    "S256",
  );
  return url.toString();
}


export async function beginOidcLogin({
  config,
  storage = globalThis.sessionStorage,
  cryptoImpl = globalThis.crypto,
  locationLike = globalThis.location,
}) {
  const url = await createAuthorizationRequest({
    config,
    storage,
    cryptoImpl,
  });
  locationLike.assign(url);
}


export async function exchangeOidcCallback({
  config,
  storage = globalThis.sessionStorage,
  locationLike = globalThis.location,
  historyLike = globalThis.history,
  fetchImpl = globalThis.fetch,
  now = Date.now(),
}) {
  const params = new URLSearchParams(
    locationLike.search ?? "",
  );
  const providerError = params.get("error");
  if (providerError) {
    storage?.removeItem(TRANSACTION_KEY);
    throw new Error(
      `OIDC_PROVIDER_ERROR:${providerError}`,
    );
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return null;
  }

  let transaction;
  try {
    transaction = JSON.parse(
      storage?.getItem(TRANSACTION_KEY) ?? "null",
    );
  } catch {
    transaction = null;
  }
  storage?.removeItem(TRANSACTION_KEY);

  if (
    !transaction?.state ||
    transaction.state !== state ||
    !transaction?.verifier
  ) {
    throw new Error("OIDC_STATE_INVALID");
  }
  if (
    Number(transaction.createdAt) + 10 * 60_000
    < now
  ) {
    throw new Error("OIDC_TRANSACTION_EXPIRED");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code,
    code_verifier: transaction.verifier,
  });

  const response = await fetchImpl(
    config.tokenEndpoint,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    },
  );

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    throw new Error("OIDC_TOKEN_RESPONSE_INVALID");
  }
  if (!response.ok) {
    throw new Error(
      payload.error ??
        "OIDC_TOKEN_EXCHANGE_FAILED",
    );
  }

  const accessToken = String(
    payload.access_token ?? "",
  ).trim();
  const tokenType = String(
    payload.token_type ?? "",
  ).toLowerCase();
  const expiresIn = Number(payload.expires_in);

  if (
    !accessToken ||
    tokenType !== "bearer" ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new Error("OIDC_TOKEN_RESPONSE_INVALID");
  }

  const callbackUrl = new URL(
    locationLike.href,
  );
  callbackUrl.searchParams.delete("code");
  callbackUrl.searchParams.delete("state");
  callbackUrl.searchParams.delete("session_state");
  callbackUrl.searchParams.delete("iss");
  historyLike?.replaceState(
    {},
    "",
    `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`,
  );

  return {
    mode: "oidc_introspection",
    accessToken,
    expiresAt: now + expiresIn * 1_000,
  };
}
