# ORKIO Frontend — Premium Console R0.3.2

The frontend first calls:

```text
GET /api/auth/status
```

Behavior:

```text
demo_headers
→ display controlled RC1 login
→ use the backend-provided synthetic profile

external_required
→ clear any stored demo session
→ lock the console safely
→ never create a fake session
```

Authentication failures clear stale demo state. Ordinary authorization errors
such as `ADMIN_ROLE_REQUIRED` do not log out a valid member session.

The composer now distinguishes:

```text
no thread          → Crie uma conversa
active stream      → Transmitindo…
ready with content → Enviar
```

The UI includes responsive premium styling, explicit loading/error states and
server-authoritative session bootstrap through `/api/auth/me`.
