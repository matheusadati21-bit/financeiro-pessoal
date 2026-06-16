import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  DATABASE_URL,
  APP_EMAIL = 'admin@financeiro.local',
  APP_PASSWORD = 'admin123456',
  JWT_SECRET = 'dev_secret_change_this_in_production_123456789',
  APP_NAME = 'Meu Financeiro',
  COOKIE_SECURE = 'false',
  PORT = 3000
} = process.env;

if (!DATABASE_URL) {
  console.error('DATABASE_URL não foi configurada.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

const mainUserId = 'main';

function id() {
  return crypto.randomUUID();
}

function boolEnv(value) {
  return String(value).toLowerCase() === 'true';
}

function signToken() {
  return jwt.sign({ sub: mainUserId, email: APP_EMAIL }, JWT_SECRET, { expiresIn: '14d' });
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.finance_token;
}

function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ error: 'Não autenticado.' });
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
}

function parseNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function parseMonth(value) {
  if (!value) return new Date().toISOString().slice(0, 7);
  return String(value).slice(0, 7);
}

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result;
}

async function initializeDatabase() {
  await query(`
    create table if not exists app_meta (
      key text primary key,
      value text not null,
      updated_at timestamptz not null default now()
    );

    create table if not exists categories (
      id text primary key,
      user_id text not null,
      name text not null,
      kind text not null check (kind in ('expense','income')),
      color text not null default '#2563eb',
      icon text not null default 'circle',
      monthly_limit numeric(14,2),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists accounts (
      id text primary key,
      user_id text not null,
      name text not null,
      kind text not null default 'checking',
      institution text,
      balance numeric(14,2) not null default 0,
      color text not null default '#0f172a',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists transactions (
      id text primary key,
      user_id text not null,
      account_id text references accounts(id) on delete set null,
      category_id text references categories(id) on delete set null,
      type text not null check (type in ('expense','income')),
      description text not null,
      amount numeric(14,2) not null,
      occurred_at date not null,
      payment_method text not null default 'pix',
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists savings_boxes (
      id text primary key,
      user_id text not null,
      name text not null,
      objective text,
      target_amount numeric(14,2) not null default 0,
      initial_amount numeric(14,2) not null default 0,
      deadline date,
      priority text not null default 'media',
      color text not null default '#0ea5e9',
      icon text not null default 'vault',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists savings_movements (
      id text primary key,
      user_id text not null,
      box_id text not null references savings_boxes(id) on delete cascade,
      type text not null check (type in ('deposit','withdraw')),
      amount numeric(14,2) not null,
      occurred_at date not null,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists investments (
      id text primary key,
      user_id text not null,
      name text not null,
      kind text not null default 'outro',
      institution text,
      strategy text,
      color text not null default '#10b981',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists investment_records (
      id text primary key,
      user_id text not null,
      investment_id text not null references investments(id) on delete cascade,
      month text not null,
      invested_amount numeric(14,2) not null default 0,
      current_value numeric(14,2) not null default 0,
      contribution numeric(14,2) not null default 0,
      yield_amount numeric(14,2) not null default 0,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(user_id, investment_id, month)
    );

    create table if not exists patrimony_snapshots (
      id text primary key,
      user_id text not null,
      month text not null,
      cash_amount numeric(14,2) not null default 0,
      other_assets numeric(14,2) not null default 0,
      debts numeric(14,2) not null default 0,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(user_id, month)
    );

    create table if not exists monthly_plans (
      id text primary key,
      user_id text not null,
      month text not null,
      income_goal numeric(14,2) not null default 0,
      expense_limit numeric(14,2) not null default 0,
      saving_goal numeric(14,2) not null default 0,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(user_id, month)
    );
  `);

  const countCategories = await query('select count(*)::int as count from categories where user_id = $1', [mainUserId]);
  if (countCategories.rows[0].count === 0) {
    const defaults = [
      ['Moradia', 'expense', '#3b82f6', 'home', 0],
      ['Mercado', 'expense', '#22c55e', 'cart', 0],
      ['Transporte', 'expense', '#f97316', 'car', 0],
      ['Saúde', 'expense', '#ef4444', 'heart', 0],
      ['Lazer', 'expense', '#a855f7', 'sparkles', 0],
      ['Educação', 'expense', '#06b6d4', 'book', 0],
      ['Assinaturas', 'expense', '#64748b', 'card', 0],
      ['Salário', 'income', '#16a34a', 'wallet', 0],
      ['Freelance', 'income', '#0ea5e9', 'briefcase', 0],
      ['Rendimentos', 'income', '#10b981', 'trending', 0]
    ];
    for (const item of defaults) {
      await query('insert into categories (id, user_id, name, kind, color, icon, monthly_limit) values ($1,$2,$3,$4,$5,$6,$7)', [id(), mainUserId, ...item]);
    }
  }

  const countAccounts = await query('select count(*)::int as count from accounts where user_id = $1', [mainUserId]);
  if (countAccounts.rows[0].count === 0) {
    await query('insert into accounts (id, user_id, name, kind, institution, balance, color) values ($1,$2,$3,$4,$5,$6,$7)', [id(), mainUserId, 'Conta principal', 'checking', 'Banco', 0, '#2563eb']);
  }
}

function broadcast(event = 'data-changed', payload = {}) {
  const message = JSON.stringify({ event, payload, at: new Date().toISOString() });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(message);
  }
}

wss.on('connection', (socket, req) => {
  try {
    const cookie = req.headers.cookie || '';
    const tokenMatch = cookie.split(';').map(x => x.trim()).find(x => x.startsWith('finance_token='));
    const token = tokenMatch ? decodeURIComponent(tokenMatch.split('=').slice(1).join('=')) : null;
    if (!token) throw new Error('missing token');
    jwt.verify(token, JWT_SECRET);
    socket.send(JSON.stringify({ event: 'connected', payload: { appName: APP_NAME }, at: new Date().toISOString() }));
  } catch {
    socket.close(1008, 'unauthorized');
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, app: APP_NAME }));

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (email === APP_EMAIL && password === APP_PASSWORD) {
    const token = signToken();
    res.cookie('finance_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: boolEnv(COOKIE_SECURE),
      maxAge: 14 * 24 * 60 * 60 * 1000
    });
    return res.json({ ok: true, user: { email: APP_EMAIL }, appName: APP_NAME });
  }
  return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
});

app.post('/api/logout', (_req, res) => {
  res.clearCookie('finance_token');
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (_req, res) => {
  res.json({ ok: true, user: { email: APP_EMAIL }, appName: APP_NAME });
});

async function getBootstrap() {
  const [categories, accounts, transactions, boxes, boxMovements, investments, investmentRecords, patrimonySnapshots, monthlyPlans] = await Promise.all([
    query('select * from categories where user_id=$1 order by kind asc, name asc', [mainUserId]),
    query('select * from accounts where user_id=$1 order by created_at asc', [mainUserId]),
    query('select * from transactions where user_id=$1 order by occurred_at desc, created_at desc limit 1500', [mainUserId]),
    query('select * from savings_boxes where user_id=$1 order by created_at desc', [mainUserId]),
    query('select * from savings_movements where user_id=$1 order by occurred_at desc, created_at desc limit 2000', [mainUserId]),
    query('select * from investments where user_id=$1 order by created_at desc', [mainUserId]),
    query('select * from investment_records where user_id=$1 order by month asc, created_at asc', [mainUserId]),
    query('select * from patrimony_snapshots where user_id=$1 order by month asc', [mainUserId]),
    query('select * from monthly_plans where user_id=$1 order by month asc', [mainUserId])
  ]);
  return {
    appName: APP_NAME,
    categories: categories.rows,
    accounts: accounts.rows,
    transactions: transactions.rows,
    boxes: boxes.rows,
    boxMovements: boxMovements.rows,
    investments: investments.rows,
    investmentRecords: investmentRecords.rows,
    patrimonySnapshots: patrimonySnapshots.rows,
    monthlyPlans: monthlyPlans.rows,
    serverTime: new Date().toISOString()
  };
}

app.get('/api/bootstrap', requireAuth, async (_req, res, next) => {
  try {
    res.json(await getBootstrap());
  } catch (err) {
    next(err);
  }
});

function createCrudRoutes({ pathName, table, fields, orderBy = 'created_at desc', afterWrite, upsertConflict = null }) {
  app.get(`/api/${pathName}`, requireAuth, async (_req, res, next) => {
    try {
      const result = await query(`select * from ${table} where user_id=$1 order by ${orderBy}`, [mainUserId]);
      res.json(result.rows);
    } catch (err) { next(err); }
  });

  app.post(`/api/${pathName}`, requireAuth, async (req, res, next) => {
    try {
      const item = { id: id(), user_id: mainUserId };
      for (const field of fields) item[field.name] = field.parse ? field.parse(req.body[field.name], req.body) : req.body[field.name];
      const cols = Object.keys(item);
      const params = cols.map((_, i) => `$${i + 1}`).join(',');
      const values = cols.map(k => item[k]);
      let sql = `insert into ${table} (${cols.join(',')}) values (${params})`;
      if (upsertConflict) {
        const updateCols = cols.filter(c => !['id', 'user_id', ...upsertConflict].includes(c));
        const updates = updateCols.map(c => `${c}=excluded.${c}`).join(',');
        sql += ` on conflict (${upsertConflict.join(',')}) do update set ${updates}, updated_at=now()`;
      }
      sql += ' returning *';
      const result = await query(sql, values);
      if (afterWrite) await afterWrite(upsertConflict ? 'upsert' : 'create', result.rows[0], req.body);
      broadcast('data-changed', { pathName, action: 'create' });
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  });

  app.put(`/api/${pathName}/:id`, requireAuth, async (req, res, next) => {
    try {
      const updates = [];
      const values = [];
      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(req.body, field.name)) {
          values.push(field.parse ? field.parse(req.body[field.name], req.body) : req.body[field.name]);
          updates.push(`${field.name}=$${values.length}`);
        }
      }
      if (updates.length === 0) return res.status(400).json({ error: 'Nenhum campo enviado para atualizar.' });
      values.push(req.params.id, mainUserId);
      const result = await query(`update ${table} set ${updates.join(',')}, updated_at=now() where id=$${values.length - 1} and user_id=$${values.length} returning *`, values);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Registro não encontrado.' });
      if (afterWrite) await afterWrite('update', result.rows[0], req.body);
      broadcast('data-changed', { pathName, action: 'update' });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  });

  app.delete(`/api/${pathName}/:id`, requireAuth, async (req, res, next) => {
    try {
      const result = await query(`delete from ${table} where id=$1 and user_id=$2 returning *`, [req.params.id, mainUserId]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Registro não encontrado.' });
      if (afterWrite) await afterWrite('delete', result.rows[0], req.body);
      broadcast('data-changed', { pathName, action: 'delete' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });
}

createCrudRoutes({
  pathName: 'categories',
  table: 'categories',
  orderBy: 'kind asc, name asc',
  fields: [
    { name: 'name', parse: v => String(v || '').trim() },
    { name: 'kind', parse: v => ['income', 'expense'].includes(v) ? v : 'expense' },
    { name: 'color', parse: v => String(v || '#2563eb') },
    { name: 'icon', parse: v => String(v || 'circle') },
    { name: 'monthly_limit', parse: parseNullableNumber }
  ]
});

createCrudRoutes({
  pathName: 'accounts',
  table: 'accounts',
  orderBy: 'created_at asc',
  fields: [
    { name: 'name', parse: v => String(v || '').trim() },
    { name: 'kind', parse: v => String(v || 'checking') },
    { name: 'institution', parse: v => String(v || '') },
    { name: 'balance', parse: parseNumber },
    { name: 'color', parse: v => String(v || '#0f172a') }
  ]
});

createCrudRoutes({
  pathName: 'transactions',
  table: 'transactions',
  orderBy: 'occurred_at desc, created_at desc',
  fields: [
    { name: 'account_id', parse: v => v || null },
    { name: 'category_id', parse: v => v || null },
    { name: 'type', parse: v => ['income', 'expense'].includes(v) ? v : 'expense' },
    { name: 'description', parse: v => String(v || '').trim() || 'Lançamento' },
    { name: 'amount', parse: parseNumber },
    { name: 'occurred_at', parse: parseDate },
    { name: 'payment_method', parse: v => String(v || 'pix') },
    { name: 'notes', parse: v => String(v || '') }
  ]
});

createCrudRoutes({
  pathName: 'savings-boxes',
  table: 'savings_boxes',
  fields: [
    { name: 'name', parse: v => String(v || '').trim() || 'Nova caixinha' },
    { name: 'objective', parse: v => String(v || '') },
    { name: 'target_amount', parse: parseNumber },
    { name: 'initial_amount', parse: parseNumber },
    { name: 'deadline', parse: v => v ? parseDate(v) : null },
    { name: 'priority', parse: v => String(v || 'media') },
    { name: 'color', parse: v => String(v || '#0ea5e9') },
    { name: 'icon', parse: v => String(v || 'vault') }
  ]
});

createCrudRoutes({
  pathName: 'savings-movements',
  table: 'savings_movements',
  orderBy: 'occurred_at desc, created_at desc',
  fields: [
    { name: 'box_id', parse: v => String(v || '') },
    { name: 'type', parse: v => ['deposit', 'withdraw'].includes(v) ? v : 'deposit' },
    { name: 'amount', parse: parseNumber },
    { name: 'occurred_at', parse: parseDate },
    { name: 'notes', parse: v => String(v || '') }
  ]
});

createCrudRoutes({
  pathName: 'investments',
  table: 'investments',
  fields: [
    { name: 'name', parse: v => String(v || '').trim() || 'Novo investimento' },
    { name: 'kind', parse: v => String(v || 'outro') },
    { name: 'institution', parse: v => String(v || '') },
    { name: 'strategy', parse: v => String(v || '') },
    { name: 'color', parse: v => String(v || '#10b981') }
  ]
});

createCrudRoutes({
  pathName: 'investment-records',
  table: 'investment_records',
  orderBy: 'month asc, created_at asc',
  upsertConflict: ['user_id', 'investment_id', 'month'],
  fields: [
    { name: 'investment_id', parse: v => String(v || '') },
    { name: 'month', parse: parseMonth },
    { name: 'invested_amount', parse: parseNumber },
    { name: 'current_value', parse: parseNumber },
    { name: 'contribution', parse: parseNumber },
    { name: 'yield_amount', parse: parseNumber },
    { name: 'notes', parse: v => String(v || '') }
  ]
});

createCrudRoutes({
  pathName: 'patrimony-snapshots',
  table: 'patrimony_snapshots',
  orderBy: 'month asc',
  upsertConflict: ['user_id', 'month'],
  fields: [
    { name: 'month', parse: parseMonth },
    { name: 'cash_amount', parse: parseNumber },
    { name: 'other_assets', parse: parseNumber },
    { name: 'debts', parse: parseNumber },
    { name: 'notes', parse: v => String(v || '') }
  ]
});

createCrudRoutes({
  pathName: 'monthly-plans',
  table: 'monthly_plans',
  orderBy: 'month asc',
  upsertConflict: ['user_id', 'month'],
  fields: [
    { name: 'month', parse: parseMonth },
    { name: 'income_goal', parse: parseNumber },
    { name: 'expense_limit', parse: parseNumber },
    { name: 'saving_goal', parse: parseNumber },
    { name: 'notes', parse: v => String(v || '') }
  ]
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === '23505') return res.status(409).json({ error: 'Já existe um registro com esses dados.' });
  if (err?.code === '23503') return res.status(400).json({ error: 'Registro relacionado não encontrado.' });
  if (err?.code === '23514') return res.status(400).json({ error: 'Valor inválido para este campo.' });
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

initializeDatabase()
  .then(() => {
    server.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`${APP_NAME} rodando na porta ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Erro ao inicializar banco:', err);
    process.exit(1);
  });
