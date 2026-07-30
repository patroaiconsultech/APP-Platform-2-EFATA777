# Frontend Build Status

```text
SOURCE_GENERATION=PASS
CONTRACT_TESTS=PASS
DEPENDENCY_INSTALL=BLOCKED_BY_ENVIRONMENT_REGISTRY
PRODUCTION_BUILD=NOT_EXECUTED
PACKAGE_LOCK=NOT_GENERATED
```

Falha observada:

```text
E404 @vitejs/plugin-react@4.3.1 not found in the configured internal registry
```

Próxima validação:

1. usar registry aprovado com cobertura das dependências;
2. gerar `package-lock.json`;
3. executar `npm ci`;
4. executar `npm test`;
5. executar `npm run build`;
6. inspecionar `dist`;
7. gerar hash do artefato.
