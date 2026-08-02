import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

import {
  createAuthorizationRequest,
  exchangeOidcCallback,
} from "../src/auth/oidc.mjs";


function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}


const config = {
  authorizationEndpoint:
    "https://issuer.example/authorize",
  tokenEndpoint:
    "https://issuer.example/token",
  clientId: "orkio-spa",
  redirectUri:
    "https://app.example/auth/callback",
  scopes: ["openid", "profile"],
};


test("authorization request uses PKCE S256 and no secret", async () => {
  const storage = memoryStorage();
  const url = new URL(
    await createAuthorizationRequest({
      config,
      storage,
      cryptoImpl: webcrypto,
      now: 10,
    }),
  );

  assert.equal(
    url.searchParams.get("code_challenge_method"),
    "S256",
  );
  assert.equal(
    url.searchParams.get("response_type"),
    "code",
  );
  assert.equal(url.searchParams.has("client_secret"), false);
  assert.ok(url.searchParams.get("state"));
  assert.ok(url.searchParams.get("code_challenge"));
});


test("callback exchanges code and ignores refresh token", async () => {
  const storage = memoryStorage();
  const authorizationUrl = new URL(
    await createAuthorizationRequest({
      config,
      storage,
      cryptoImpl: webcrypto,
      now: 1_000,
    }),
  );
  const state = authorizationUrl.searchParams.get("state");
  const historyCalls = [];
  let requestBody = null;

  const session = await exchangeOidcCallback({
    config,
    storage,
    locationLike: {
      search: `?code=abc&state=${state}`,
      href:
        `https://app.example/auth/callback?code=abc&state=${state}`,
    },
    historyLike: {
      replaceState(...args) {
        historyCalls.push(args);
      },
    },
    fetchImpl: async (_url, options) => {
      requestBody = new URLSearchParams(options.body);
      return {
        ok: true,
        json: async () => ({
          access_token: "access-token",
          refresh_token: "must-not-be-stored",
          token_type: "Bearer",
          expires_in: 300,
        }),
      };
    },
    now: 2_000,
  });

  assert.equal(
    requestBody.get("grant_type"),
    "authorization_code",
  );
  assert.ok(requestBody.get("code_verifier"));
  assert.equal(session.accessToken, "access-token");
  assert.equal(session.refreshToken, undefined);
  assert.equal(session.expiresAt, 302_000);
  assert.equal(historyCalls.length, 1);
});


test("callback rejects state mismatch", async () => {
  const storage = memoryStorage();
  await createAuthorizationRequest({
    config,
    storage,
    cryptoImpl: webcrypto,
    now: 1_000,
  });

  await assert.rejects(
    () =>
      exchangeOidcCallback({
        config,
        storage,
        locationLike: {
          search: "?code=abc&state=wrong",
          href:
            "https://app.example/auth/callback?code=abc&state=wrong",
        },
        fetchImpl: async () => {
          throw new Error("must not be called");
        },
        now: 2_000,
      }),
    /OIDC_STATE_INVALID/,
  );
});
