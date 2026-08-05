
# ORKIO Frontend R0.7.0 — Premium Realtime Voice Core

## Experience

The chat contains a feature-gated voice panel for an Orkio-only realtime audio
call.

The browser:

1. requests microphone permission;
2. creates a WebRTC peer connection;
3. sends the SDP offer to the ORKIO backend;
4. displays partial and final user transcripts;
5. submits only the final transcript to the canonical backend turn endpoint;
6. receives the persisted Orkio response;
7. requests audio for that exact canonical text;
8. displays the assistant audio transcript;
9. supports mute, interruption, reconnect and terminal close;
10. stops microphone tracks before reporting session closure.

## Security boundary

The frontend contains no OpenAI API key and does not call OpenAI REST endpoints
directly. The SDP exchange and provider authorization are handled by the
backend.

## Gate behavior

The button is usable only when:

```text
governance.realtime_voice_enabled=true
selected_agent=Orkio
interaction_mode=single
active_thread exists
```

Textual SSE remains a separate capability.

## Proof limits

Local source and deterministic tests pass. A real microphone, provider,
PostgreSQL migration, Chrome/Android/Safari matrix and deployed runtime smoke
remain required before production GO.

## Reconnect security

The browser keeps only the short-lived resume token returned by the backend.
The token is sent back only to `/api/voice/.../resume`, rotates after a
successful resume and is never persisted to local storage.

