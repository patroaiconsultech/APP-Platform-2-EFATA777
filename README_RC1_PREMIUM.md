# ORKIO Frontend — RC1 Premium Hardening R0.3

## Local validation

```bash
npm install
npm test
npm run check:contracts
npm run build
```

Set `VITE_API_BASE_URL` to the isolated RC1 backend.

The package supports incremental SSE, terminal `cancelled + done`, request
correlation, server reconciliation and an operator cancellation action.

A reviewed `package-lock.json` is still required before deterministic CI with
`npm ci`.
