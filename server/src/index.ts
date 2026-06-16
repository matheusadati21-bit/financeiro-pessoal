import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { PrismaClient, BoxEntryType, ExpenseType, InvestmentType } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware, createToken } from './auth.js';
import { ensureDefaultData } from './seed.js';
import { addMonths, currency, endOfMonth, monthKey, parseDate, startOfMonth, toNumber } from './utils.js';

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const emitUpdate = () => io.emit('finance:updated', { at: new Date().toISOString() });

const asyncHandler = (fn: express.RequestHandler): express.RequestHandler => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const moneySchema = z.coerce.number().finite().min(0);
const signedMoneySchema = z.coerce.number().finite();
const dateSchema = z.string().min(8);

const categoryDto = (category: any) => ({ ...category });

const expenseDto = (expense: any) => ({
  ...expense,
  amount: currency(expense.amount),
  date: expense.date.toISOString().slice(0, 10),
  category: expense.category ? categoryDto(expense.category) : undefined
});

const boxDto = (box: any) => {
  const balance = (box.entries || []).reduce((sum: number, entry: any) => {
    const amount = toNumber(entry.amount);
    return entry.type === 'DEPOSIT' ? sum + amount : sum - amount;
  }, 0);
  const target = toNumber(box.target);
  const progress = target > 0 ? Math.min(100, Math.max(0, (balance / target) * 100)) : 0;
  return {
    ...box,
    target: currency(box.target),
    deadline: box.deadline ? box.deadline.toISOString().slice(0, 10) : null,
    balance: currency(balance),
    progress: currency(progress),
    entries: (box.entries || []).map((entry: any) => ({
      ...entry,
      amount: currency(entry.amount),
      date: entry.date.toISOString().slice(0, 10)
    }))
  };
};

const investmentDto = (investment: any) => {
  const records = (investment.records || [])
    .slice()
    .sort((a: any, b: any) => a.date.getTime() - b.date.getTime())
    .map((record: any) => ({
      ...record,
      date: record.date.toISOString().slice(0, 10),
      investedAmount: currency(record.investedAmount),
      currentValue: currency(record.currentValue),
      monthlyContribution: currency(record.monthlyContribution)
    }));
  const latest = records.at(-1);
  const first = records.at(0);
  const profitability = latest && first && first.investedAmount > 0
    ? currency(((latest.currentValue - latest.investedAmount) / latest.investedAmount) * 100)
    : 0;
  return {
    ...investment,
    goal: investment.goal ? currency(investment.goal) : null,
    records,
    latestValue: latest?.currentValue || 0,
    latestInvested: latest?.investedAmount || 0,
    profitability
  };
};

const snapshotDto = (snapshot: any) => ({
  ...snapshot,
  date: snapshot.date.toISOString().slice(0, 10),
  cash: currency(snapshot.cash),
  otherAssets: currency(snapshot.otherAssets),
  liabilities: currency(snapshot.liabilities)
});

const latestInvestmentValueAt = async (date: Date) => {
  const investments = await prisma.investment.findMany({
    where: { archived: false },
    include: { records: { where: { date: { lte: date } }, orderBy: { date: 'desc' }, take: 1 } }
  });
  return investments.reduce((sum, inv) => sum + toNumber(inv.records[0]?.currentValue), 0);
};

const boxesBalanceAt = async (date: Date) => {
  const entries = await prisma.boxEntry.findMany({ where: { date: { lte: date }, box: { archived: false } } });
  return entries.reduce((sum, entry) => sum + (entry.type === 'DEPOSIT' ? toNumber(entry.amount) : -toNumber(entry.amount)), 0);
};

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const { email, password } = schema.parse(req.body);
  const appEmail = process.env.APP_EMAIL;
  const appPassword = process.env.APP_PASSWORD;

  if (!appEmail || !appPassword) return res.status(500).json({ message: 'APP_EMAIL e APP_PASSWORD não configurados.' });
  if (email.toLowerCase() !== appEmail.toLowerCase() || password !== appPassword) {
    return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
  }

  const token = createToken(email);
  res.cookie('finance_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 1000 * 60 * 60 * 24 * 7
  });
  res.json({ email, appName: process.env.APP_NAME || 'Meu Financeiro' });
}));

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('finance_token');
  res.json({ ok: true });
});

app.get('/api/auth/me', authMiddleware, (_req, res) => {
  res.json({ email: process.env.APP_EMAIL, appName: process.env.APP_NAME || 'Meu Financeiro' });
});

app.use('/api', authMiddleware);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/expense-categories', asyncHandler(async (_req, res) => {
  const categories = await prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } });
  res.json(categories.map(categoryDto));
}));

app.post('/api/expense-categories', asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string().min(2), color: z.string().default('#0f6bff'), icon: z.string().default('CircleDollarSign') });
  const data = schema.parse(req.body);
  const category = await prisma.expenseCategory.create({ data });
  emitUpdate();
  res.json(categoryDto(category));
}));

app.delete('/api/expense-categories/:id', asyncHandler(async (req, res) => {
  await prisma.expenseCategory.delete({ where: { id: req.params.id } });
  emitUpdate();
  res.json({ ok: true });
}));

app.get('/api/expenses', asyncHandler(async (req, res) => {
  const month = String(req.query.month || monthKey(new Date()));
  const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
  const expenses = await prisma.expense.findMany({
    where: {
      date: { gte: startOfMonth(month), lt: endOfMonth(month) },
      ...(categoryId ? { categoryId } : {})
    },
    include: { category: true },
    orderBy: { date: 'desc' }
  });
  res.json(expenses.map(expenseDto));
}));

app.post('/api/expenses', asyncHandler(async (req, res) => {
  const schema = z.object({
    description: z.string().min(2),
    amount: moneySchema,
    date: dateSchema,
    type: z.nativeEnum(ExpenseType).default('VARIABLE'),
    payment: z.string().optional().default('Conta principal'),
    notes: z.string().optional(),
    categoryId: z.string().min(1)
  });
  const data = schema.parse(req.body);
  const expense = await prisma.expense.create({
    data: { ...data, date: parseDate(data.date) },
    include: { category: true }
  });
  emitUpdate();
  res.json(expenseDto(expense));
}));

app.put('/api/expenses/:id', asyncHandler(async (req, res) => {
  const schema = z.object({
    description: z.string().min(2).optional(),
    amount: moneySchema.optional(),
    date: dateSchema.optional(),
    type: z.nativeEnum(ExpenseType).optional(),
    payment: z.string().optional(),
    notes: z.string().optional(),
    categoryId: z.string().optional()
  });
  const data = schema.parse(req.body);
  const expense = await prisma.expense.update({
    where: { id: req.params.id },
    data: { ...data, ...(data.date ? { date: parseDate(data.date) } : {}) },
    include: { category: true }
  });
  emitUpdate();
  res.json(expenseDto(expense));
}));

app.delete('/api/expenses/:id', asyncHandler(async (req, res) => {
  await prisma.expense.delete({ where: { id: req.params.id } });
  emitUpdate();
  res.json({ ok: true });
}));

app.get('/api/boxes', asyncHandler(async (_req, res) => {
  const boxes = await prisma.savingBox.findMany({
    where: { archived: false },
    include: { entries: { orderBy: { date: 'desc' } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(boxes.map(boxDto));
}));

app.post('/api/boxes', asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    target: moneySchema,
    deadline: z.string().optional().nullable(),
    color: z.string().default('#0f6bff'),
    icon: z.string().default('PiggyBank')
  });
  const data = schema.parse(req.body);
  const box = await prisma.savingBox.create({
    data: { ...data, deadline: data.deadline ? parseDate(data.deadline) : null },
    include: { entries: true }
  });
  emitUpdate();
  res.json(boxDto(box));
}));

app.put('/api/boxes/:id', asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional().nullable(),
    target: moneySchema.optional(),
    deadline: z.string().optional().nullable(),
    color: z.string().optional(),
    icon: z.string().optional(),
    archived: z.boolean().optional()
  });
  const data = schema.parse(req.body);
  const box = await prisma.savingBox.update({
    where: { id: req.params.id },
    data: { ...data, ...(data.deadline !== undefined ? { deadline: data.deadline ? parseDate(data.deadline) : null } : {}) },
    include: { entries: { orderBy: { date: 'desc' } } }
  });
  emitUpdate();
  res.json(boxDto(box));
}));

app.delete('/api/boxes/:id', asyncHandler(async (req, res) => {
  await prisma.savingBox.delete({ where: { id: req.params.id } });
  emitUpdate();
  res.json({ ok: true });
}));

app.post('/api/boxes/:id/entries', asyncHandler(async (req, res) => {
  const schema = z.object({ type: z.nativeEnum(BoxEntryType), amount: moneySchema, date: dateSchema, note: z.string().optional() });
  const data = schema.parse(req.body);
  const entry = await prisma.boxEntry.create({ data: { ...data, boxId: req.params.id, date: parseDate(data.date) } });
  emitUpdate();
  res.json({ ...entry, amount: currency(entry.amount), date: entry.date.toISOString().slice(0, 10) });
}));

app.delete('/api/box-entries/:id', asyncHandler(async (req, res) => {
  await prisma.boxEntry.delete({ where: { id: req.params.id } });
  emitUpdate();
  res.json({ ok: true });
}));

app.get('/api/investments', asyncHandler(async (_req, res) => {
  const investments = await prisma.investment.findMany({
    where: { archived: false },
    include: { records: { orderBy: { date: 'asc' } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(investments.map(investmentDto));
}));

app.post('/api/investments', asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    type: z.nativeEnum(InvestmentType).default('OUTRO'),
    institution: z.string().optional(),
    goal: moneySchema.optional().nullable(),
    color: z.string().default('#0f6bff')
  });
  const data = schema.parse(req.body);
  const investment = await prisma.investment.create({ data, include: { records: true } });
  emitUpdate();
  res.json(investmentDto(investment));
}));

app.put('/api/investments/:id', asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    type: z.nativeEnum(InvestmentType).optional(),
    institution: z.string().optional().nullable(),
    goal: moneySchema.optional().nullable(),
    color: z.string().optional(),
    archived: z.boolean().optional()
  });
  const data = schema.parse(req.body);
  const investment = await prisma.investment.update({ where: { id: req.params.id }, data, include: { records: { orderBy: { date: 'asc' } } } });
  emitUpdate();
  res.json(investmentDto(investment));
}));

app.delete('/api/investments/:id', asyncHandler(async (req, res) => {
  await prisma.investment.delete({ where: { id: req.params.id } });
  emitUpdate();
  res.json({ ok: true });
}));

app.post('/api/investments/:id/records', asyncHandler(async (req, res) => {
  const schema = z.object({
    date: dateSchema,
    investedAmount: moneySchema,
    currentValue: moneySchema,
    monthlyContribution: moneySchema.default(0),
    note: z.string().optional()
  });
  const data = schema.parse(req.body);
  const record = await prisma.investmentRecord.create({ data: { ...data, investmentId: req.params.id, date: parseDate(data.date) } });
  emitUpdate();
  res.json({
    ...record,
    date: record.date.toISOString().slice(0, 10),
    investedAmount: currency(record.investedAmount),
    currentValue: currency(record.currentValue),
    monthlyContribution: currency(record.monthlyContribution)
  });
}));

app.delete('/api/investment-records/:id', asyncHandler(async (req, res) => {
  await prisma.investmentRecord.delete({ where: { id: req.params.id } });
  emitUpdate();
  res.json({ ok: true });
}));

app.get('/api/net-worth-snapshots', asyncHandler(async (_req, res) => {
  const snapshots = await prisma.netWorthSnapshot.findMany({ orderBy: { date: 'asc' } });
  const enriched = await Promise.all(snapshots.map(async (snapshot) => {
    const date = snapshot.date;
    const investments = await latestInvestmentValueAt(date);
    const boxes = await boxesBalanceAt(date);
    const total = toNumber(snapshot.cash) + toNumber(snapshot.otherAssets) + investments + boxes - toNumber(snapshot.liabilities);
    return { ...snapshotDto(snapshot), investments: currency(investments), boxes: currency(boxes), total: currency(total) };
  }));
  res.json(enriched);
}));

app.post('/api/net-worth-snapshots', asyncHandler(async (req, res) => {
  const schema = z.object({ date: dateSchema, cash: signedMoneySchema.default(0), otherAssets: signedMoneySchema.default(0), liabilities: moneySchema.default(0), note: z.string().optional() });
  const data = schema.parse(req.body);
  const date = parseDate(data.date);
  const snapshot = await prisma.netWorthSnapshot.upsert({
    where: { date },
    create: { ...data, date },
    update: { cash: data.cash, otherAssets: data.otherAssets, liabilities: data.liabilities, note: data.note }
  });
  emitUpdate();
  res.json(snapshotDto(snapshot));
}));

app.delete('/api/net-worth-snapshots/:id', asyncHandler(async (req, res) => {
  await prisma.netWorthSnapshot.delete({ where: { id: req.params.id } });
  emitUpdate();
  res.json({ ok: true });
}));

app.get('/api/analytics/overview', asyncHandler(async (req, res) => {
  const currentMonth = String(req.query.month || monthKey(new Date()));
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, index) => addMonths(startOfMonth(now), index - 11));

  const [expenses, categories, boxes, investments, snapshots] = await Promise.all([
    prisma.expense.findMany({
      where: { date: { gte: months[0], lt: endOfMonth(now) } },
      include: { category: true },
      orderBy: { date: 'asc' }
    }),
    prisma.expenseCategory.findMany(),
    prisma.savingBox.findMany({ where: { archived: false }, include: { entries: true } }),
    prisma.investment.findMany({ where: { archived: false }, include: { records: { orderBy: { date: 'asc' } } } }),
    prisma.netWorthSnapshot.findMany({ orderBy: { date: 'asc' } })
  ]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthlyExpenses = expenses.filter((expense) => expense.date >= monthStart && expense.date < monthEnd);
  const monthlyExpensesTotal = monthlyExpenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);

  const expensesByCategory = categories.map((category) => {
    const total = monthlyExpenses.filter((expense) => expense.categoryId === category.id).reduce((sum, expense) => sum + toNumber(expense.amount), 0);
    return { name: category.name, total: currency(total), color: category.color };
  }).filter((item) => item.total > 0).sort((a, b) => b.total - a.total);

  const expenseTrend = months.map((m) => {
    const key = monthKey(m);
    const total = expenses.filter((expense) => monthKey(expense.date) === key).reduce((sum, expense) => sum + toNumber(expense.amount), 0);
    return { month: key, total: currency(total) };
  });

  const boxesWithBalance = boxes.map(boxDto);
  const boxesBalance = boxesWithBalance.reduce((sum, box) => sum + box.balance, 0);
  const boxesTarget = boxesWithBalance.reduce((sum, box) => sum + box.target, 0);

  const investmentsMapped = investments.map(investmentDto);
  const investmentsValue = investmentsMapped.reduce((sum, inv) => sum + inv.latestValue, 0);
  const investmentsInvested = investmentsMapped.reduce((sum, inv) => sum + inv.latestInvested, 0);
  const investmentsProfit = investmentsValue - investmentsInvested;

  const investmentTrend = months.map((m) => {
    const until = endOfMonth(m);
    const total = investments.reduce((sum, investment) => {
      const latest = investment.records.filter(record => record.date < until).at(-1);
      return sum + toNumber(latest?.currentValue);
    }, 0);
    return { month: monthKey(m), total: currency(total) };
  });

  const netWorthHistory = await Promise.all(snapshots.map(async (snapshot) => {
    const investmentsAtDate = await latestInvestmentValueAt(snapshot.date);
    const boxesAtDate = await boxesBalanceAt(snapshot.date);
    const total = toNumber(snapshot.cash) + toNumber(snapshot.otherAssets) + investmentsAtDate + boxesAtDate - toNumber(snapshot.liabilities);
    return {
      month: monthKey(snapshot.date),
      date: snapshot.date.toISOString().slice(0, 10),
      total: currency(total),
      cash: currency(snapshot.cash),
      otherAssets: currency(snapshot.otherAssets),
      liabilities: currency(snapshot.liabilities),
      investments: currency(investmentsAtDate),
      boxes: currency(boxesAtDate)
    };
  }));

  const latestSnapshot = netWorthHistory.at(-1);
  const netWorth = latestSnapshot?.total ?? currency(investmentsValue + boxesBalance);

  res.json({
    cards: {
      monthlyExpenses: currency(monthlyExpensesTotal),
      boxesBalance: currency(boxesBalance),
      boxesTarget: currency(boxesTarget),
      investmentsValue: currency(investmentsValue),
      investmentsInvested: currency(investmentsInvested),
      investmentsProfit: currency(investmentsProfit),
      netWorth
    },
    expensesByCategory,
    expenseTrend,
    boxes: boxesWithBalance,
    investmentTrend,
    investments: investmentsMapped,
    netWorthHistory
  });
}));

const clientDist = path.resolve(__dirname, '../../client-dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err?.name === 'ZodError') return res.status(400).json({ message: 'Dados inválidos.', details: err.errors });
  if (err?.code === 'P2002') return res.status(409).json({ message: 'Já existe um registro com esses dados.' });
  if (err?.code === 'P2025') return res.status(404).json({ message: 'Registro não encontrado.' });
  res.status(500).json({ message: 'Erro interno do servidor.' });
});

io.on('connection', (socket) => {
  socket.emit('finance:connected', { at: new Date().toISOString() });
});

await ensureDefaultData(prisma);
server.listen(PORT, () => {
  console.log(`Financeiro pessoal rodando na porta ${PORT}`);
});
