# ORKIO Frontend R0.6.1 — Premium Experience

## Scope

This release aligns the frontend with the R0.6.1 backend contract and restores
a visible multi-agent experience.

Implemented:

- interaction modes: Individual, Team Synthesis and Roundtable;
- realtime textual toggle;
- visible specialist contribution cards;
- canonical owner streaming;
- explicit cancellation control;
- demo member and allowlisted demo admin entry;
- administrative runtime overview;
- assisted-evolution proposal panel for administrators;
- premium ORKIO visual system.

## Voice

The voice control is intentionally disabled and labeled as a future gate.
This release does not claim WebRTC voice-to-voice.

## Build limitation

The source and Node tests are validated, but no production Vite build is
included because the current environment could not install the pinned Vite
dependencies from its configured registry. Generate `package-lock.json`, run
`npm ci`, and run `npm run build` in the approved build environment before
Railway deployment.

## Required runtime variables

- `VITE_API_BASE_URL`
- `VITE_STREAM_TIMEOUT_MS`
- `PLATFORM_ENVIRONMENT`
- `PORT`
- `ORKIO_CSP_CONNECT_SRC`

No secret belongs in the frontend.
