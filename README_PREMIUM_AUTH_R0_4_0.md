# ORKIO Frontend Premium Auth & Console R0.4.0

## Natureza do artefato

Este é um **overlay cumulativo root-ready**. Ele incorpora o hardening de
console/autenticação R0.3.2 e adiciona o fluxo corporativo R0.4.0.

Baseline esperado para aplicação:

- frontend R0.3.0;
- overlay deste ZIP aplicado na raiz do repositório;
- `package.json` e lockfile preservados do baseline;
- revisão obrigatória do diff antes de commit.

O ZIP-base completo R0.3.0 não estava disponível no chat atual. Por segurança,
este overlay não substitui `package.json` nem cria um lockfile artificial.

## Modelo de segurança

- OAuth2/OIDC Authorization Code + PKCE S256;
- nenhum client secret no frontend;
- access token somente em `sessionStorage`;
- identidade demo legada em `localStorage` é removida;
- refresh token é ignorado e nunca persistido;
- modo OIDC envia somente `Authorization: Bearer`;
- headers demo aparecem apenas em `demo_headers`;
- tenant, usuário e role exibidos vêm de `/api/auth/me`;
- SSE usa a mesma identidade canônica das chamadas HTTP;
- stream sem evento terminal `done` é erro explícito.

## Build

O código não adiciona dependências npm. O build determinístico deve ser
executado somente após aplicação sobre o baseline exato e validação do lockfile.
