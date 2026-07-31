import test from "node:test";
import assert from "node:assert/strict";
import { getRuntimeConfig } from "../src/config/runtime.mjs";
test("normalizes URL",()=>assert.equal(getRuntimeConfig({VITE_API_BASE_URL:"https://api.test/"}).apiBaseUrl,"https://api.test"));
test("rejects unsafe scheme",()=>assert.throws(()=>getRuntimeConfig({VITE_API_BASE_URL:"javascript:alert(1)"}),/API_BASE_URL_INVALID/));
