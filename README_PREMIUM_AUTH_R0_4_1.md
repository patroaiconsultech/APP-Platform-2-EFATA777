# ORKIO Frontend Premium Auth & Console R0.4.1

## Escopo

Snapshot cumulativo RC1 construído a partir do frontend R0.3.2 e do overlay
Premium R0.4.0. Não exige implantação intermediária do R0.3.2.

## Correções R0.4.1

- restaura o reducer SSE completo e seus exports históricos;
- preserva eventos de execução, chunks, `agent_done`, cancelamento e `done`;
- bloqueia eventos posteriores ao terminal;
- exige autenticação explícita nos testes e no cliente;
- mantém OIDC Authorization Code + PKCE e token somente em `sessionStorage`;
- atualiza a identidade da release para R0.4.1.

## Evidência local

- suíte frontend integral: 36 testes aprovados;
- contratos SSE antigo e Premium aprovados;
- nenhuma dependência npm nova.

## Limite de build

O lockfile não foi fabricado. O build Vite permanece condicionado ao lockfile
do baseline exato e a um registry capaz de resolver as dependências fixadas.

## Limite de aplicação

Este snapshot corresponde à árvore RC1 compacta recebida no chat. Ele não deve
ser sobreposto ao `main` oficial sem branch isolada, diff completo e adaptação
à árvore efetivamente carregada pelo runtime.
