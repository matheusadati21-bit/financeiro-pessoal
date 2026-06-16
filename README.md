# Meu Financeiro

App financeiro pessoal, privado e sem dependência do n8n.

Ele foi feito para rodar em Docker/EasyPanel com PostgreSQL e interface 100% responsiva.

## O que vem pronto

- Login privado por e-mail e senha definidos nas variáveis de ambiente.
- Dashboard com visão geral em tempo real.
- Página de gastos por mês, categoria, tipo e forma de pagamento.
- Cadastro de categorias de gastos.
- Página de caixinhas/objetivos, com meta, prazo, entradas, saídas e progresso.
- Página de investimentos, com registro mensal por investimento.
- Gráfico individual para cada investimento.
- Página de patrimônio, com fechamento mensal e gráfico patrimonial geral.
- Atualização em tempo real via Socket.IO.
- Banco PostgreSQL com Prisma.
- Layout moderno, clean, fluido e mobile-first.

## Tecnologias

- React + Vite
- Tailwind CSS
- Framer Motion
- Recharts
- Node.js + Express
- Socket.IO
- PostgreSQL
- Prisma
- Docker

## Variáveis de ambiente

Copie `.env.example` para `.env` no ambiente local ou configure no EasyPanel:

```env
DATABASE_URL="postgresql://financeiro:troque_esta_senha@postgres:5432/financeiro?schema=public"
APP_EMAIL="seuemail@email.com"
APP_PASSWORD="troque_esta_senha"
JWT_SECRET="gere_um_segredo_grande_com_32_caracteres_ou_mais"
APP_NAME="Meu Financeiro"
NODE_ENV="production"
PORT=3000
COOKIE_SECURE=false
```

Use `COOKIE_SECURE=true` apenas quando o domínio já estiver com HTTPS ativo.

## Rodar localmente com Docker

```bash
cp .env.example .env
# ajuste APP_EMAIL, APP_PASSWORD e JWT_SECRET no .env

docker compose up -d --build
```

Acesse:

```text
http://localhost:3000
```

## Rodar localmente em modo desenvolvimento

Você precisa ter Node.js 20+ e PostgreSQL.

```bash
npm install
cp .env.example .env
npm run db:push
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:3000
```

## Publicar no EasyPanel

### Opção recomendada

1. Crie um repositório no GitHub.
2. Suba todos os arquivos deste projeto para o repositório.
3. No EasyPanel, crie um projeto novo.
4. Crie um serviço PostgreSQL.
5. Anote usuário, senha, host interno, porta e nome do banco.
6. Crie um serviço App apontando para o repositório GitHub.
7. O EasyPanel vai usar o `Dockerfile` do projeto.
8. Configure a porta exposta como `3000`.
9. Configure as variáveis de ambiente:

```env
DATABASE_URL="postgresql://USUARIO:SENHA@HOST_INTERNO:5432/NOME_DO_BANCO?schema=public"
APP_EMAIL="seuemail@email.com"
APP_PASSWORD="sua_senha_forte"
JWT_SECRET="um_segredo_grande_com_32_caracteres_ou_mais"
APP_NAME="Meu Financeiro"
NODE_ENV="production"
PORT=3000
COOKIE_SECURE=false
```

10. Faça o deploy.
11. Depois que o domínio e HTTPS estiverem ativos, você pode trocar `COOKIE_SECURE` para `true` e redeployar.

## Observações importantes

- O app não usa n8n.
- Os dados ficam no seu PostgreSQL.
- O comando inicial sincroniza o banco automaticamente com Prisma.
- Antes de usar de verdade, defina uma senha forte e gere um `JWT_SECRET` seguro.
- Faça backup periódico do volume PostgreSQL no EasyPanel.

## Como usar

### Gastos

Entre em **Gastos**, selecione o mês e registre despesas.
Você pode criar novas categorias e acompanhar gráficos por categoria e por dia.

### Caixinhas

Entre em **Caixinhas**, crie objetivos como reserva, viagem, carro ou apartamento.
Depois registre entradas e saídas em cada caixinha.

### Investimentos

Entre em **Investimentos**, crie cada aplicação separadamente.
Todo mês registre:

- valor total investido;
- valor atual;
- aporte do mês;
- observação opcional.

Cada investimento terá seu próprio gráfico.

### Patrimônio

Entre em **Patrimônio** e registre o fechamento mensal.
O sistema calcula:

```text
patrimônio = saldo em contas + outros bens + investimentos + caixinhas - dívidas
```

Esse é o gráfico principal para acompanhar sua evolução patrimonial no tempo.
