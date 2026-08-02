# ORKIO Frontend Pre-deploy Hardening R0.4.2

## Correções

- adiciona servidor estático sem dependências externas;
- emite Content-Security-Policy deny-by-default;
- bloqueia `unsafe-eval`, scripts inline e framing;
- adiciona `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  COOP, CORP e `X-Frame-Options`;
- valida origens de `connect-src` como origin-only;
- adiciona smoke automatizado dos headers;
- adiciona varredura automatizada de sinks XSS;
- mantém token OIDC em `sessionStorage`.

## Variável obrigatória de RC1/produção

`ORKIO_CSP_CONNECT_SRC` deve listar apenas as origens HTTPS necessárias
ao browser, por exemplo a API e o token endpoint do IdP.

O servidor é iniciado por:

```text
npm start
```

Nenhuma dependência npm foi adicionada.
