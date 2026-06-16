# Meu Financeiro Premium

App financeiro pessoal completo, responsivo e pronto para subir no EasyPanel.

Ele não depende do n8n. A aplicação tem backend próprio em Node.js, banco PostgreSQL, frontend responsivo, gráficos em Canvas e atualização em tempo real via WebSocket.

## O que vem pronto

- Login privado por e-mail e senha configurados em variável de ambiente
- Dashboard geral
- Gastos e entradas mensais
- Categorias de gastos e receitas
- Contas bancárias e carteiras
- Caixinhas com objetivo, valor-alvo, prazo e progresso
- Movimentos de depósito e retirada nas caixinhas
- Investimentos cadastráveis por ativo
- Registro mensal de cada investimento
- Gráfico individual para cada investimento
- Composição da carteira
- Fechamento patrimonial mensal
- Gráfico de patrimônio geral no tempo
- Planejamento mensal com meta de renda, limite de gastos e meta de sobra
- Tema claro e escuro
- Layout responsivo para desktop e mobile
- PWA básico para instalar no celular
- Dockerfile pronto
- docker-compose para teste local

## Stack

- Node.js
- Express
- PostgreSQL
- WebSocket
- HTML, CSS e JavaScript puro
- Docker

## Estrutura

```txt
.
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
├── server.js
├── .env.example
└── public
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── manifest.webmanifest
    └── icons
```

## Variáveis de ambiente

Crie estas variáveis no EasyPanel:

```env
DATABASE_URL=postgresql://postgres:SENHA@postgres-financeiro:5432/app_financeiro?schema=public
APP_EMAIL=seuemail@email.com
APP_PASSWORD=sua_senha_forte
JWT_SECRET=troque_por_um_segredo_grande_com_32_caracteres_ou_mais
APP_NAME=Meu Financeiro
PORT=3000
NODE_ENV=production
COOKIE_SECURE=false
```

Depois que o domínio estiver com HTTPS funcionando, você pode trocar:

```env
COOKIE_SECURE=true
```

## Como criar o PostgreSQL no EasyPanel

Na tela de criar Postgres, use:

```txt
Nome do serviço: postgres-financeiro
Nome do banco de dados: app_financeiro
Usuário: postgres
Senha: gerar automaticamente
Imagem Docker: postgres:17
```

Depois copie a senha gerada e monte a `DATABASE_URL`.

Exemplo:

```env
DATABASE_URL=postgresql://postgres:SENHA_GERADA@postgres-financeiro:5432/app_financeiro?schema=public
```

## Como subir no EasyPanel

1. Suba este projeto para um repositório no GitHub.
2. No EasyPanel, crie um novo projeto ou use um projeto existente.
3. Crie primeiro o serviço PostgreSQL.
4. Crie um novo serviço do tipo App.
5. Escolha o repositório GitHub do projeto.
6. Configure a porta interna como `3000`.
7. Cadastre as variáveis de ambiente.
8. Clique em Deploy.

O app cria as tabelas automaticamente na primeira inicialização.

## Como rodar localmente

Com Docker instalado:

```bash
docker compose up -d --build
```

Depois acesse:

```txt
http://localhost:3000
```

Login local padrão do `docker-compose.yml`:

```txt
E-mail: admin@financeiro.local
Senha: admin123456
```

## Como usar

### Dashboard

Mostra o resumo do mês, entradas, gastos, saldo, patrimônio, fluxo dos últimos meses, patrimônio no tempo, últimos lançamentos e progresso das caixinhas.

### Gastos

Registre gastos e entradas por data, conta, categoria, forma de pagamento e observação. Os gráficos mostram gastos por categoria e movimentação diária.

### Caixinhas

Crie objetivos como reserva de emergência, viagem, carro, casa ou qualquer meta pessoal. Depois registre depósitos e retiradas.

### Investimentos

Cadastre cada investimento e registre mensalmente:

- total investido
- valor atual
- aporte do mês
- rendimento do mês
- notas

Cada investimento tem gráfico individual e a carteira geral mostra composição e resultado.

### Patrimônio

Todo mês, registre dinheiro em contas, outros bens e dívidas. O sistema soma automaticamente caixinhas e investimentos para gerar o patrimônio líquido.

### Planejamento

Defina meta de renda, limite de gastos e meta de sobra para cada mês.

## Backup recomendado

Como é um app pessoal com dados financeiros, faça backup periódico do PostgreSQL no EasyPanel ou use uma rotina externa de backup.

## Observação importante

Este projeto é um controle financeiro pessoal e não substitui consultoria financeira, contábil ou tributária.
