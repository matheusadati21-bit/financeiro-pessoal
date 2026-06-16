const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const state = {
  user: null,
  appName: 'Meu Financeiro',
  page: localStorage.getItem('financePage') || 'dashboard',
  month: localStorage.getItem('financeMonth') || new Date().toISOString().slice(0, 7),
  theme: localStorage.getItem('financeTheme') || 'light',
  data: emptyData(),
  ws: null,
  activeQuickType: 'expense',
  activeInvestmentId: null
};

function emptyData() {
  return {
    categories: [], accounts: [], transactions: [], boxes: [], boxMovements: [], investments: [],
    investmentRecords: [], patrimonySnapshots: [], monthlyPlans: []
  };
}

const routes = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', eyebrow: 'Visão geral' },
  { id: 'expenses', label: 'Gastos', icon: '💳', eyebrow: 'Fluxo mensal' },
  { id: 'boxes', label: 'Caixinhas', icon: '🎯', eyebrow: 'Objetivos' },
  { id: 'investments', label: 'Investimentos', icon: '📈', eyebrow: 'Evolução mensal' },
  { id: 'patrimony', label: 'Patrimônio', icon: '🏦', eyebrow: 'Histórico patrimonial' },
  { id: 'planning', label: 'Planejamento', icon: '🧭', eyebrow: 'Metas mensais' },
  { id: 'settings', label: 'Contas', icon: '⚙️', eyebrow: 'Configurações' }
];

const mobileRoutes = routes.slice(0, 5);

const colors = ['#2563eb', '#10b981', '#f97316', '#a855f7', '#ef4444', '#06b6d4', '#f59e0b', '#64748b'];

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function shortMoney(value) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return money(n).replace(',00', '');
}
function pct(value) { return `${Math.round(Number(value || 0))}%`; }
function num(value) { return Number(value || 0); }
function html(str) {
  return String(str ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function dateBR(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}
function monthBR(value) {
  if (!value) return '-';
  const [year, month] = String(value).slice(0, 7).split('-');
  return `${month}/${year}`;
}
function today() { return new Date().toISOString().slice(0, 10); }
function monthNow() { return new Date().toISOString().slice(0, 7); }
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function monthAdd(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
function monthRange(count, end = state.month) {
  return Array.from({ length: count }, (_, i) => monthAdd(end, i - count + 1));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  if (!response.ok) {
    let error = 'Erro ao processar solicitação.';
    try { error = (await response.json()).error || error; } catch {}
    throw new Error(error);
  }
  return response.json();
}

async function boot() {
  document.documentElement.dataset.theme = state.theme;
  bindBaseEvents();
  try {
    const me = await api('/api/me');
    state.user = me.user;
    state.appName = me.appName || state.appName;
    await loadData();
    showApp();
    connectWs();
  } catch {
    showLogin();
  }
}

function showLogin() {
  $('#loginScreen').classList.remove('hidden');
  $('#appShell').classList.add('hidden');
}
function showApp() {
  $('#loginScreen').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  $('#appName').textContent = state.appName;
  renderNav();
  renderPage();
}
async function loadData(silent = true) {
  state.data = await api('/api/bootstrap');
  state.appName = state.data.appName || state.appName;
  if (!silent) showToast('Dados atualizados');
}
function bindBaseEvents() {
  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    try {
      const result = await api('/api/login', { method: 'POST', body: data });
      state.user = result.user;
      state.appName = result.appName || state.appName;
      await loadData();
      showApp();
      connectWs();
    } catch (err) { showToast(err.message); }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    location.reload();
  });
  $('#themeToggle').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('financeTheme', state.theme);
    document.documentElement.dataset.theme = state.theme;
    renderPage();
  });
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', (e) => { if (e.target.id === 'modalBackdrop') closeModal(); });
  document.body.addEventListener('click', (event) => {
    const modal = event.target.closest('[data-open-modal]');
    if (modal) openModal(modal.dataset.openModal, modal.dataset.id || null);
  });
  document.body.addEventListener('submit', handleFormSubmit);
  window.addEventListener('resize', debounce(() => renderChartsForPage(), 180));
}

function connectWs() {
  if (state.ws) state.ws.close();
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  state.ws = ws;
  ws.onopen = () => $('#liveStatus')?.classList.remove('offline');
  ws.onclose = () => {
    $('#liveStatus')?.classList.add('offline');
    setTimeout(connectWs, 3500);
  };
  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.event === 'data-changed') {
        await loadData(true);
        renderPage();
        showToast('Atualizado em tempo real');
      }
    } catch {}
  };
}

function renderNav() {
  const make = (route) => `
    <button class="nav-item ${state.page === route.id ? 'active' : ''}" data-page="${route.id}" type="button">
      <span class="nav-icon">${route.icon}</span><span>${route.label}</span>
    </button>`;
  $('#desktopNav').innerHTML = routes.map(make).join('');
  $('#mobileNav').innerHTML = mobileRoutes.map(make).join('');
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => {
    state.page = btn.dataset.page;
    localStorage.setItem('financePage', state.page);
    renderNav();
    renderPage();
  }));
}

function renderPage() {
  const route = routes.find(r => r.id === state.page) || routes[0];
  $('#pageTitle').textContent = route.label;
  $('#pageEyebrow').textContent = route.eyebrow;
  const map = {
    dashboard: renderDashboard,
    expenses: renderExpenses,
    boxes: renderBoxes,
    investments: renderInvestments,
    patrimony: renderPatrimony,
    planning: renderPlanning,
    settings: renderSettings
  };
  $('#pageContent').innerHTML = map[route.id]();
  bindPageEvents();
  requestAnimationFrame(renderChartsForPage);
}

function bindPageEvents() {
  $$('[data-month]').forEach(input => input.addEventListener('change', () => {
    state.month = input.value || monthNow();
    localStorage.setItem('financeMonth', state.month);
    renderPage();
  }));
  $$('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Deseja excluir este registro?')) return;
    try {
      await api(`/api/${btn.dataset.delete}/${btn.dataset.id}`, { method: 'DELETE' });
      await loadData(true); renderPage(); showToast('Registro excluído');
    } catch (err) { showToast(err.message); }
  }));
  $$('[data-investment-tab]').forEach(btn => btn.addEventListener('click', () => {
    state.activeInvestmentId = btn.dataset.investmentTab;
    renderPage();
  }));
}

function data() { return state.data || emptyData(); }
function categoryById(id) { return data().categories.find(c => c.id === id); }
function accountById(id) { return data().accounts.find(a => a.id === id); }
function investmentById(id) { return data().investments.find(i => i.id === id); }
function boxById(id) { return data().boxes.find(b => b.id === id); }
function txInMonth(month = state.month) { return data().transactions.filter(t => String(t.occurred_at).slice(0,7) === month); }
function incomeInMonth(month = state.month) { return txInMonth(month).filter(t => t.type === 'income').reduce((s,t) => s + num(t.amount), 0); }
function expensesInMonth(month = state.month) { return txInMonth(month).filter(t => t.type === 'expense').reduce((s,t) => s + num(t.amount), 0); }
function boxBalance(boxId, untilMonth = null) {
  const box = boxById(boxId);
  let total = num(box?.initial_amount);
  data().boxMovements.filter(m => m.box_id === boxId).forEach(m => {
    if (untilMonth && String(m.occurred_at).slice(0, 7) > untilMonth) return;
    total += m.type === 'deposit' ? num(m.amount) : -num(m.amount);
  });
  return total;
}
function boxesTotal(untilMonth = null) { return data().boxes.reduce((s,b) => s + boxBalance(b.id, untilMonth), 0); }
function latestInvestmentRecord(investmentId, untilMonth = null) {
  return data().investmentRecords
    .filter(r => r.investment_id === investmentId && (!untilMonth || r.month <= untilMonth))
    .sort((a,b) => a.month.localeCompare(b.month)).at(-1);
}
function investmentsTotal(untilMonth = null) {
  return data().investments.reduce((s, inv) => s + num(latestInvestmentRecord(inv.id, untilMonth)?.current_value), 0);
}
function investedTotal(untilMonth = null) {
  return data().investments.reduce((s, inv) => s + num(latestInvestmentRecord(inv.id, untilMonth)?.invested_amount), 0);
}
function latestPatrimonySnapshot(untilMonth = null) {
  return data().patrimonySnapshots.filter(s => !untilMonth || s.month <= untilMonth).sort((a,b) => a.month.localeCompare(b.month)).at(-1);
}
function netWorthByMonth(month) {
  const snapshot = latestPatrimonySnapshot(month);
  const cash = num(snapshot?.cash_amount);
  const other = num(snapshot?.other_assets);
  const debts = num(snapshot?.debts);
  return cash + other + boxesTotal(month) + investmentsTotal(month) - debts;
}
function allMonthsForPatrimony() {
  const months = new Set([
    ...data().patrimonySnapshots.map(s => s.month),
    ...data().investmentRecords.map(r => r.month),
    ...data().boxMovements.map(m => String(m.occurred_at).slice(0,7)),
    state.month
  ]);
  return Array.from(months).filter(Boolean).sort();
}

function stat(label, value, sub = '', accent = 'rgba(37,99,235,.13)') {
  return `<div class="stat-card" style="--accent:${accent}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
}
function monthFilter(extra = '') {
  return `<div class="filters"><input data-month type="month" value="${state.month}" />${extra}</div>`;
}
function empty(text) { return `<div class="empty">${text}</div>`; }

function renderDashboard() {
  const income = incomeInMonth();
  const expense = expensesInMonth();
  const net = income - expense;
  const invTotal = investmentsTotal();
  const boxTotal = boxesTotal();
  const netWorth = netWorthByMonth(state.month);
  const recent = data().transactions.slice(0, 7);
  const boxes = data().boxes.slice(0, 4);

  return `
    ${monthFilter()}
    <section class="grid cols-4">
      ${stat('Entradas do mês', money(income), 'Receitas registradas', 'rgba(16,185,129,.16)')}
      ${stat('Gastos do mês', money(expense), 'Saídas registradas', 'rgba(239,68,68,.14)')}
      ${stat('Saldo do mês', money(net), net >= 0 ? 'Você fechou positivo' : 'Mês no vermelho', net >= 0 ? 'rgba(16,185,129,.16)' : 'rgba(239,68,68,.14)')}
      ${stat('Patrimônio atual', money(netWorth), `${money(invTotal)} em investimentos`, 'rgba(37,99,235,.16)')}
    </section>

    <section class="grid cols-2">
      <div class="chart-card"><div class="chart-header"><div><h3>Fluxo dos últimos 6 meses</h3><p>Entradas, gastos e saldo mensal.</p></div></div><canvas id="cashflowChart" class="chart-canvas"></canvas></div>
      <div class="chart-card"><div class="chart-header"><div><h3>Patrimônio no tempo</h3><p>Caixinhas, investimentos, contas e dívidas.</p></div></div><canvas id="netWorthChart" class="chart-canvas"></canvas></div>
    </section>

    <section class="grid cols-2">
      <div class="card">
        <div class="chart-header"><div><h3>Últimos lançamentos</h3><p>Movimentos mais recentes.</p></div><button class="btn secondary" data-open-modal="quickAdd">Adicionar</button></div>
        ${recent.length ? `<div class="list">${recent.map(transactionListItem).join('')}</div>` : empty('Nenhum lançamento ainda. Comece adicionando um gasto ou entrada.')}
      </div>
      <div class="card">
        <div class="chart-header"><div><h3>Caixinhas em andamento</h3><p>${money(boxTotal)} guardados nos seus objetivos.</p></div><button class="btn secondary" data-open-modal="box">Nova</button></div>
        ${boxes.length ? `<div class="list">${boxes.map(boxProgressItem).join('')}</div>` : empty('Crie suas caixinhas para acompanhar seus objetivos.')}
      </div>
    </section>
  `;
}

function transactionListItem(t) {
  const cat = categoryById(t.category_id);
  const acc = accountById(t.account_id);
  const sign = t.type === 'income' ? '+' : '-';
  return `<div class="list-item">
    <span class="dot" style="--color:${cat?.color || '#2563eb'}"></span>
    <div><div class="list-title">${html(t.description)}</div><div class="list-subtitle">${dateBR(t.occurred_at)} • ${html(cat?.name || 'Sem categoria')} • ${html(acc?.name || 'Sem conta')}</div></div>
    <div class="amount ${t.type === 'income' ? 'positive' : 'negative'}">${sign}${money(t.amount)}</div>
  </div>`;
}
function boxProgressItem(b) {
  const balance = boxBalance(b.id);
  const progress = num(b.target_amount) ? Math.min(100, (balance / num(b.target_amount)) * 100) : 0;
  return `<div class="list-item">
    <span class="dot" style="--color:${b.color || '#0ea5e9'}"></span>
    <div>
      <div class="list-title">${html(b.name)}</div>
      <div class="list-subtitle">${money(balance)} de ${money(b.target_amount)} • ${pct(progress)}</div>
      <div class="progress" style="margin-top:8px"><i style="--value:${progress}%;--color:${b.color || '#0ea5e9'}"></i></div>
    </div>
    <button class="icon-btn" data-open-modal="boxMovement" data-id="${b.id}">+</button>
  </div>`;
}

function renderExpenses() {
  const list = txInMonth();
  const income = incomeInMonth();
  const expense = expensesInMonth();
  const net = income - expense;
  return `
    <section class="grid cols-3">
      ${stat('Entradas', money(income), monthBR(state.month), 'rgba(16,185,129,.16)')}
      ${stat('Gastos', money(expense), monthBR(state.month), 'rgba(239,68,68,.14)')}
      ${stat('Resultado', money(net), net >= 0 ? 'Sobra no mês' : 'Faltou no mês', net >= 0 ? 'rgba(16,185,129,.16)' : 'rgba(239,68,68,.14)')}
    </section>
    <div class="card">
      <div class="chart-header"><div><h3>Controle mensal</h3><p>Filtre o mês e lance seus gastos ou entradas.</p></div><button class="btn primary" data-open-modal="quickAdd">+ Lançar</button></div>
      ${monthFilter(`<button class="btn secondary" data-open-modal="category">Nova categoria</button>`)}
    </div>
    <section class="grid cols-2">
      <div class="chart-card"><div class="chart-header"><div><h3>Gastos por categoria</h3><p>Onde seu dinheiro mais saiu.</p></div></div><canvas id="categoryChart" class="chart-canvas"></canvas></div>
      <div class="chart-card"><div class="chart-header"><div><h3>Movimento diário</h3><p>Entradas e saídas ao longo do mês.</p></div></div><canvas id="dailyChart" class="chart-canvas"></canvas></div>
    </section>
    <div class="table-card">
      <div class="table-head"><div><h3>Lançamentos de ${monthBR(state.month)}</h3><p class="muted">Edite excluindo e lançando novamente quando necessário.</p></div></div>
      <div class="table-wrap">
        ${list.length ? `<table><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Conta</th><th>Valor</th><th></th></tr></thead><tbody>${list.map(t => `<tr><td>${dateBR(t.occurred_at)}</td><td><strong>${html(t.description)}</strong><div class="list-subtitle">${html(t.payment_method || '')}</div></td><td>${t.type === 'income' ? '<span class="badge green">Entrada</span>' : '<span class="badge red">Gasto</span>'}</td><td>${html(categoryById(t.category_id)?.name || '-')}</td><td>${html(accountById(t.account_id)?.name || '-')}</td><td class="amount ${t.type === 'income' ? 'positive' : 'negative'}">${t.type === 'income' ? '+' : '-'}${money(t.amount)}</td><td><button class="icon-btn" data-delete="transactions" data-id="${t.id}">×</button></td></tr>`).join('')}</tbody></table>` : empty('Nenhum lançamento para este mês.')}
      </div>
    </div>
  `;
}

function renderBoxes() {
  const total = boxesTotal();
  const target = data().boxes.reduce((s,b) => s + num(b.target_amount), 0);
  const progress = target ? (total / target) * 100 : 0;
  return `
    <section class="grid cols-3">
      ${stat('Guardado', money(total), 'Total nas caixinhas', 'rgba(14,165,233,.16)')}
      ${stat('Meta total', money(target), `${pct(progress)} concluído`, 'rgba(37,99,235,.16)')}
      ${stat('Caixinhas', data().boxes.length, 'Objetivos cadastrados', 'rgba(168,85,247,.14)')}
    </section>
    <div class="card"><div class="chart-header"><div><h3>Objetivos financeiros</h3><p>Cadastre viagens, reserva, carro, casa, presentes ou qualquer meta.</p></div><button class="btn primary" data-open-modal="box">+ Nova caixinha</button></div></div>
    <section class="grid auto">
      ${data().boxes.length ? data().boxes.map(boxCard).join('') : empty('Você ainda não criou caixinhas. Crie a primeira para começar a acompanhar seus objetivos.')}
    </section>
    <section class="grid cols-2">
      <div class="chart-card"><div class="chart-header"><div><h3>Distribuição das caixinhas</h3><p>Participação de cada objetivo.</p></div></div><canvas id="boxesChart" class="chart-canvas"></canvas></div>
      <div class="card"><div class="chart-header"><div><h3>Últimos movimentos</h3><p>Depósitos e retiradas.</p></div></div>${data().boxMovements.slice(0, 10).length ? `<div class="list">${data().boxMovements.slice(0,10).map(m => { const box = boxById(m.box_id); return `<div class="list-item"><span class="dot" style="--color:${box?.color || '#0ea5e9'}"></span><div><div class="list-title">${html(box?.name || 'Caixinha')}</div><div class="list-subtitle">${dateBR(m.occurred_at)} • ${html(m.notes || '')}</div></div><div class="amount ${m.type === 'deposit' ? 'positive' : 'negative'}">${m.type === 'deposit' ? '+' : '-'}${money(m.amount)}</div></div>`; }).join('')}</div>` : empty('Nenhum movimento nas caixinhas ainda.')}</div>
    </section>
  `;
}
function boxCard(b) {
  const balance = boxBalance(b.id);
  const target = num(b.target_amount);
  const progress = target ? Math.min(100, balance / target * 100) : 0;
  const remaining = Math.max(0, target - balance);
  return `<article class="card">
    <div class="chart-header"><div><h3>${html(b.name)}</h3><p>${html(b.objective || 'Objetivo pessoal')}</p></div><button class="icon-btn" data-delete="savings-boxes" data-id="${b.id}">×</button></div>
    <div class="progress"><i style="--value:${progress}%;--color:${b.color || '#0ea5e9'}"></i></div>
    <div class="kpi-row"><span>Guardado</span><strong>${money(balance)}</strong></div>
    <div class="kpi-row"><span>Meta</span><strong>${money(target)}</strong></div>
    <div class="kpi-row"><span>Falta</span><strong>${money(remaining)}</strong></div>
    <div class="kpi-row"><span>Prazo</span><strong>${b.deadline ? dateBR(b.deadline) : 'Sem prazo'}</strong></div>
    <button class="btn secondary full" style="margin-top:16px" data-open-modal="boxMovement" data-id="${b.id}">Movimentar</button>
  </article>`;
}

function renderInvestments() {
  const invs = data().investments;
  if (!state.activeInvestmentId && invs[0]) state.activeInvestmentId = invs[0].id;
  if (state.activeInvestmentId && !invs.some(i => i.id === state.activeInvestmentId)) state.activeInvestmentId = invs[0]?.id || null;
  const active = investmentById(state.activeInvestmentId);
  const current = investmentsTotal();
  const invested = investedTotal();
  const profit = current - invested;
  return `
    <section class="grid cols-4">
      ${stat('Valor atual', money(current), 'Carteira total', 'rgba(16,185,129,.16)')}
      ${stat('Valor investido', money(invested), 'Custo acumulado', 'rgba(37,99,235,.16)')}
      ${stat('Resultado', money(profit), profit >= 0 ? 'Ganho acumulado' : 'Perda acumulada', profit >= 0 ? 'rgba(16,185,129,.16)' : 'rgba(239,68,68,.14)')}
      ${stat('Ativos', invs.length, 'Investimentos cadastrados', 'rgba(168,85,247,.14)')}
    </section>
    <div class="card"><div class="chart-header"><div><h3>Investimentos</h3><p>Registre mensalmente cada ativo para acompanhar evolução individual e geral.</p></div><div class="filters"><button class="btn secondary" data-open-modal="investment">Novo ativo</button><button class="btn primary" data-open-modal="investmentRecord">Registrar mês</button></div></div></div>
    ${invs.length ? `<div class="filters">${invs.map(i => `<button class="btn ${i.id === state.activeInvestmentId ? 'primary' : 'secondary'}" data-investment-tab="${i.id}">${html(i.name)}</button>`).join('')}</div>` : ''}
    <section class="grid cols-2">
      <div class="chart-card"><div class="chart-header"><div><h3>${active ? html(active.name) : 'Evolução do investimento'}</h3><p>Valor investido, valor atual e aportes por mês.</p></div></div><canvas id="investmentChart" class="chart-canvas"></canvas></div>
      <div class="chart-card"><div class="chart-header"><div><h3>Composição da carteira</h3><p>Participação por ativo no valor atual.</p></div></div><canvas id="portfolioChart" class="chart-canvas"></canvas></div>
    </section>
    <section class="grid auto">
      ${invs.length ? invs.map(investmentCard).join('') : empty('Cadastre seu primeiro investimento e depois lance os valores mês a mês.')}
    </section>
    <div class="table-card"><div class="table-head"><div><h3>Histórico mensal</h3><p class="muted">Todos os registros feitos para os investimentos.</p></div></div><div class="table-wrap">${renderInvestmentRecordsTable()}</div></div>
  `;
}
function investmentCard(inv) {
  const latest = latestInvestmentRecord(inv.id);
  const invested = num(latest?.invested_amount);
  const current = num(latest?.current_value);
  const result = current - invested;
  const resultPct = invested ? (result / invested) * 100 : 0;
  return `<article class="card">
    <div class="chart-header"><div><h3>${html(inv.name)}</h3><p>${html(inv.kind)} • ${html(inv.institution || 'Sem instituição')}</p></div><button class="icon-btn" data-delete="investments" data-id="${inv.id}">×</button></div>
    <div class="kpi-row"><span>Valor atual</span><strong>${money(current)}</strong></div>
    <div class="kpi-row"><span>Investido</span><strong>${money(invested)}</strong></div>
    <div class="kpi-row"><span>Resultado</span><strong class="amount ${result >= 0 ? 'positive' : 'negative'}">${money(result)} (${resultPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)</strong></div>
    <div class="kpi-row"><span>Último mês</span><strong>${monthBR(latest?.month)}</strong></div>
  </article>`;
}
function renderInvestmentRecordsTable() {
  const rows = data().investmentRecords.slice().sort((a,b) => b.month.localeCompare(a.month));
  if (!rows.length) return empty('Nenhum registro mensal ainda.');
  return `<table><thead><tr><th>Mês</th><th>Investimento</th><th>Investido</th><th>Valor atual</th><th>Aporte</th><th>Resultado</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td>${monthBR(r.month)}</td><td><strong>${html(investmentById(r.investment_id)?.name || '-')}</strong></td><td>${money(r.invested_amount)}</td><td>${money(r.current_value)}</td><td>${money(r.contribution)}</td><td class="amount ${num(r.current_value)-num(r.invested_amount)>=0 ? 'positive':'negative'}">${money(num(r.current_value)-num(r.invested_amount))}</td><td><button class="icon-btn" data-delete="investment-records" data-id="${r.id}">×</button></td></tr>`).join('')}</tbody></table>`;
}

function renderPatrimony() {
  const months = allMonthsForPatrimony();
  const latest = latestPatrimonySnapshot(state.month);
  const net = netWorthByMonth(state.month);
  const inv = investmentsTotal(state.month);
  const box = boxesTotal(state.month);
  const debts = num(latest?.debts);
  return `
    ${monthFilter(`<button class="btn primary" data-open-modal="patrimony">Registrar patrimônio</button>`)}
    <section class="grid cols-4">
      ${stat('Patrimônio líquido', money(net), monthBR(state.month), 'rgba(37,99,235,.16)')}
      ${stat('Investimentos', money(inv), 'Valor atual dos ativos', 'rgba(16,185,129,.16)')}
      ${stat('Caixinhas', money(box), 'Objetivos guardados', 'rgba(14,165,233,.16)')}
      ${stat('Dívidas', money(debts), 'Passivos informados', 'rgba(239,68,68,.14)')}
    </section>
    <section class="grid cols-2">
      <div class="chart-card"><div class="chart-header"><div><h3>Evolução patrimonial</h3><p>Histórico consolidado por mês.</p></div></div><canvas id="patrimonyChart" class="chart-canvas"></canvas></div>
      <div class="chart-card"><div class="chart-header"><div><h3>Composição atual</h3><p>Onde seu patrimônio está concentrado.</p></div></div><canvas id="patrimonyMixChart" class="chart-canvas"></canvas></div>
    </section>
    <div class="table-card"><div class="table-head"><div><h3>Fechamentos mensais</h3><p class="muted">Registre dinheiro em conta, bens e dívidas. Investimentos e caixinhas entram automaticamente.</p></div></div><div class="table-wrap">${months.length ? `<table><thead><tr><th>Mês</th><th>Contas</th><th>Outros bens</th><th>Investimentos</th><th>Caixinhas</th><th>Dívidas</th><th>Patrimônio</th></tr></thead><tbody>${months.slice().reverse().map(m => { const s = latestPatrimonySnapshot(m); return `<tr><td>${monthBR(m)}</td><td>${money(s?.cash_amount)}</td><td>${money(s?.other_assets)}</td><td>${money(investmentsTotal(m))}</td><td>${money(boxesTotal(m))}</td><td class="amount negative">${money(s?.debts)}</td><td><strong>${money(netWorthByMonth(m))}</strong></td></tr>`; }).join('')}</tbody></table>` : empty('Nenhum histórico patrimonial ainda.')}</div></div>
  `;
}

function renderPlanning() {
  const plan = data().monthlyPlans.find(p => p.month === state.month);
  const income = incomeInMonth();
  const expense = expensesInMonth();
  const saved = Math.max(0, income - expense);
  const incomePct = num(plan?.income_goal) ? Math.min(100, income / num(plan.income_goal) * 100) : 0;
  const expensePct = num(plan?.expense_limit) ? Math.min(100, expense / num(plan.expense_limit) * 100) : 0;
  const savedPct = num(plan?.saving_goal) ? Math.min(100, saved / num(plan.saving_goal) * 100) : 0;
  return `
    <div class="card"><div class="chart-header"><div><h3>Planejamento de ${monthBR(state.month)}</h3><p>Defina metas e acompanhe se o mês está caminhando bem.</p></div><button class="btn primary" data-open-modal="monthlyPlan">Definir metas</button></div>${monthFilter()}</div>
    <section class="grid cols-3">
      ${goalCard('Meta de renda', income, num(plan?.income_goal), incomePct, '#10b981')}
      ${goalCard('Limite de gastos', expense, num(plan?.expense_limit), expensePct, expensePct > 90 ? '#ef4444' : '#f59e0b')}
      ${goalCard('Meta de sobra', saved, num(plan?.saving_goal), savedPct, '#2563eb')}
    </section>
    <section class="grid cols-2">
      <div class="chart-card"><div class="chart-header"><div><h3>Metas vs realizado</h3><p>Comparação do mês selecionado.</p></div></div><canvas id="planningChart" class="chart-canvas"></canvas></div>
      <div class="card"><h3>Notas do mês</h3><p class="muted">${html(plan?.notes || 'Nenhuma observação cadastrada para este mês.')}</p></div>
    </section>
  `;
}
function goalCard(title, current, target, progress, color) {
  return `<div class="card"><h3>${title}</h3><div class="kpi-row"><span>Realizado</span><strong>${money(current)}</strong></div><div class="kpi-row"><span>Meta</span><strong>${money(target)}</strong></div><div class="progress" style="margin-top:18px"><i style="--value:${progress}%;--color:${color}"></i></div><div class="kpi-row"><span>Progresso</span><strong>${pct(progress)}</strong></div></div>`;
}

function renderSettings() {
  return `
    <section class="grid cols-2">
      <div class="card"><div class="chart-header"><div><h3>Contas e saldos</h3><p>Cadastre contas bancárias, carteiras ou dinheiro em espécie.</p></div><button class="btn primary" data-open-modal="account">Nova conta</button></div>
        ${data().accounts.length ? `<div class="list">${data().accounts.map(a => `<div class="list-item"><span class="dot" style="--color:${a.color || '#2563eb'}"></span><div><div class="list-title">${html(a.name)}</div><div class="list-subtitle">${html(a.institution || '')} • ${html(a.kind)}</div></div><div><strong>${money(a.balance)}</strong><button class="icon-btn" data-delete="accounts" data-id="${a.id}" style="margin-left:8px">×</button></div></div>`).join('')}</div>` : empty('Nenhuma conta cadastrada.')}
      </div>
      <div class="card"><div class="chart-header"><div><h3>Categorias</h3><p>Organize seus gastos e entradas.</p></div><button class="btn primary" data-open-modal="category">Nova categoria</button></div>
        ${data().categories.length ? `<div class="list">${data().categories.map(c => `<div class="list-item"><span class="dot" style="--color:${c.color}"></span><div><div class="list-title">${html(c.name)}</div><div class="list-subtitle">${c.kind === 'income' ? 'Entrada' : 'Gasto'} ${c.monthly_limit ? '• limite ' + money(c.monthly_limit) : ''}</div></div><button class="icon-btn" data-delete="categories" data-id="${c.id}">×</button></div>`).join('')}</div>` : empty('Nenhuma categoria cadastrada.')}
      </div>
    </section>
  `;
}

function openModal(kind, id = null) {
  const modal = $('#modalBox');
  modal.classList.remove('wide');
  const content = $('#modalContent');
  const builders = {
    quickAdd: modalQuickAdd,
    category: modalCategory,
    account: modalAccount,
    box: modalBoxForm,
    boxMovement: () => modalBoxMovement(id),
    investment: modalInvestment,
    investmentRecord: modalInvestmentRecord,
    patrimony: modalPatrimony,
    monthlyPlan: modalMonthlyPlan
  };
  content.innerHTML = builders[kind] ? builders[kind]() : '';
  $('#modalBackdrop').classList.remove('hidden');
  if (kind === 'quickAdd') bindQuickAddTabs();
}
function closeModal() { $('#modalBackdrop').classList.add('hidden'); }

function modalQuickAdd() {
  return `
    <h2>Lançamento rápido</h2><p>Escolha o tipo de lançamento para registrar no seu financeiro.</p>
    <div class="segmented">
      ${['expense','income','saving','investment'].map(type => `<button type="button" data-quick-tab="${type}" class="${state.activeQuickType === type ? 'active' : ''}">${quickLabel(type)}</button>`).join('')}
    </div>
    <div id="quickFormArea">${quickForm(state.activeQuickType)}</div>
  `;
}
function quickLabel(type) { return { expense: 'Gasto', income: 'Entrada', saving: 'Caixinha', investment: 'Investimento' }[type]; }
function bindQuickAddTabs() {
  $$('[data-quick-tab]').forEach(btn => btn.addEventListener('click', () => {
    state.activeQuickType = btn.dataset.quickTab;
    $('#modalContent').innerHTML = modalQuickAdd();
    bindQuickAddTabs();
  }));
}
function quickForm(type) {
  if (type === 'saving') return modalBoxMovement(null, true);
  if (type === 'investment') return modalInvestmentRecord(true);
  return `
    <form data-form="transaction" class="form-stack">
      <input type="hidden" name="type" value="${type}" />
      <div class="form-grid">
        <label>Descrição<input name="description" required placeholder="Ex: Mercado, salário, consulta..." /></label>
        <label>Valor<input name="amount" type="number" min="0" step="0.01" required placeholder="0,00" /></label>
      </div>
      <div class="form-grid three">
        <label>Data<input name="occurred_at" type="date" value="${today()}" required /></label>
        <label>Categoria<select name="category_id">${categoryOptions(type)}</select></label>
        <label>Conta<select name="account_id">${accountOptions()}</select></label>
      </div>
      <div class="form-grid">
        <label>Forma<select name="payment_method"><option value="pix">Pix</option><option value="cartao_credito">Cartão de crédito</option><option value="cartao_debito">Cartão de débito</option><option value="dinheiro">Dinheiro</option><option value="boleto">Boleto</option><option value="transferencia">Transferência</option></select></label>
        <label>Observação<input name="notes" placeholder="Opcional" /></label>
      </div>
      <button class="btn primary full" type="submit">Salvar lançamento</button>
    </form>`;
}
function categoryOptions(kind = 'expense') { return data().categories.filter(c => c.kind === kind).map(c => `<option value="${c.id}">${html(c.name)}</option>`).join(''); }
function accountOptions() { return data().accounts.map(a => `<option value="${a.id}">${html(a.name)}</option>`).join(''); }
function boxOptions(selected = '') { return data().boxes.map(b => `<option value="${b.id}" ${selected === b.id ? 'selected' : ''}>${html(b.name)}</option>`).join(''); }
function investmentOptions(selected = '') { return data().investments.map(i => `<option value="${i.id}" ${selected === i.id ? 'selected' : ''}>${html(i.name)}</option>`).join(''); }

function modalCategory() {
  return `<h2>Nova categoria</h2><p>Use categorias para separar seus gastos e entradas nos gráficos.</p>
    <form data-form="category" class="form-stack">
      <div class="form-grid">
        <label>Nome<input name="name" required placeholder="Ex: Mercado" /></label>
        <label>Tipo<select name="kind"><option value="expense">Gasto</option><option value="income">Entrada</option></select></label>
      </div>
      <div class="form-grid">
        <label>Cor<input name="color" type="color" value="#2563eb" /></label>
        <label>Limite mensal<input name="monthly_limit" type="number" min="0" step="0.01" placeholder="Opcional" /></label>
      </div>
      <input type="hidden" name="icon" value="circle" />
      <button class="btn primary full" type="submit">Salvar categoria</button>
    </form>`;
}
function modalAccount() {
  return `<h2>Nova conta</h2><p>Cadastre onde o dinheiro fica: banco, carteira, conta corrente ou reserva.</p>
    <form data-form="account" class="form-stack">
      <div class="form-grid">
        <label>Nome<input name="name" required placeholder="Ex: Nubank, Itaú, Carteira" /></label>
        <label>Instituição<input name="institution" placeholder="Opcional" /></label>
      </div>
      <div class="form-grid three">
        <label>Tipo<select name="kind"><option value="checking">Conta corrente</option><option value="wallet">Carteira</option><option value="savings">Poupança</option><option value="credit">Cartão</option><option value="other">Outra</option></select></label>
        <label>Saldo inicial<input name="balance" type="number" step="0.01" value="0" /></label>
        <label>Cor<input name="color" type="color" value="#2563eb" /></label>
      </div>
      <button class="btn primary full" type="submit">Salvar conta</button>
    </form>`;
}
function modalBoxForm() {
  return `<h2>Nova caixinha</h2><p>Crie objetivos com meta, prazo e acompanhamento automático.</p>
    <form data-form="box" class="form-stack">
      <div class="form-grid">
        <label>Nome<input name="name" required placeholder="Ex: Reserva de emergência" /></label>
        <label>Valor-alvo<input name="target_amount" type="number" min="0" step="0.01" required /></label>
      </div>
      <label>Objetivo<input name="objective" placeholder="Por que você está juntando esse dinheiro?" /></label>
      <div class="form-grid three">
        <label>Valor inicial<input name="initial_amount" type="number" min="0" step="0.01" value="0" /></label>
        <label>Prazo<input name="deadline" type="date" /></label>
        <label>Prioridade<select name="priority"><option value="alta">Alta</option><option value="media" selected>Média</option><option value="baixa">Baixa</option></select></label>
      </div>
      <div class="form-grid">
        <label>Cor<input name="color" type="color" value="#0ea5e9" /></label>
        <label>Ícone<input name="icon" value="vault" /></label>
      </div>
      <button class="btn primary full" type="submit">Criar caixinha</button>
    </form>`;
}
function modalBoxMovement(selectedId = null, embed = false) {
  if (!data().boxes.length) return `<div class="empty">Crie uma caixinha antes de registrar movimentos.</div>`;
  return `${embed ? '' : '<h2>Movimentar caixinha</h2><p>Registre depósitos ou retiradas dos seus objetivos.</p>'}
    <form data-form="boxMovement" class="form-stack">
      <div class="form-grid">
        <label>Caixinha<select name="box_id" required>${boxOptions(selectedId || '')}</select></label>
        <label>Tipo<select name="type"><option value="deposit">Depósito</option><option value="withdraw">Retirada</option></select></label>
      </div>
      <div class="form-grid">
        <label>Valor<input name="amount" type="number" min="0" step="0.01" required /></label>
        <label>Data<input name="occurred_at" type="date" value="${today()}" required /></label>
      </div>
      <label>Observação<input name="notes" placeholder="Ex: aporte mensal, usei parte da reserva..." /></label>
      <button class="btn primary full" type="submit">Salvar movimento</button>
    </form>`;
}
function modalInvestment() {
  return `<h2>Novo investimento</h2><p>Cadastre o ativo e depois registre mês a mês o valor investido e o valor atual.</p>
    <form data-form="investment" class="form-stack">
      <div class="form-grid">
        <label>Nome<input name="name" required placeholder="Ex: Tesouro Selic, CDB, ETF, FII" /></label>
        <label>Tipo<select name="kind"><option value="renda_fixa">Renda fixa</option><option value="acoes">Ações</option><option value="fii">FII</option><option value="etf">ETF</option><option value="cripto">Cripto</option><option value="previdencia">Previdência</option><option value="outro">Outro</option></select></label>
      </div>
      <div class="form-grid">
        <label>Instituição<input name="institution" placeholder="Ex: Banco, corretora" /></label>
        <label>Cor<input name="color" type="color" value="#10b981" /></label>
      </div>
      <label>Estratégia<textarea name="strategy" placeholder="Ex: reserva de liquidez, longo prazo, dividendos..."></textarea></label>
      <button class="btn primary full" type="submit">Salvar investimento</button>
    </form>`;
}
function modalInvestmentRecord(embed = false) {
  if (!data().investments.length) return `<div class="empty">Cadastre um investimento antes de registrar a evolução mensal.</div>`;
  return `${embed ? '' : '<h2>Registro mensal</h2><p>Lance o fechamento de cada investimento mês a mês.</p>'}
    <form data-form="investmentRecord" class="form-stack">
      <div class="form-grid">
        <label>Investimento<select name="investment_id" required>${investmentOptions(state.activeInvestmentId || '')}</select></label>
        <label>Mês<input name="month" type="month" value="${state.month}" required /></label>
      </div>
      <div class="form-grid three">
        <label>Total investido<input name="invested_amount" type="number" min="0" step="0.01" required /></label>
        <label>Valor atual<input name="current_value" type="number" min="0" step="0.01" required /></label>
        <label>Aporte no mês<input name="contribution" type="number" min="0" step="0.01" value="0" /></label>
      </div>
      <label>Rendimento do mês<input name="yield_amount" type="number" step="0.01" value="0" /></label>
      <label>Notas<input name="notes" placeholder="Opcional" /></label>
      <button class="btn primary full" type="submit">Salvar registro mensal</button>
    </form>`;
}
function modalPatrimony() {
  const existing = data().patrimonySnapshots.find(s => s.month === state.month) || {};
  return `<h2>Fechamento patrimonial</h2><p>Informe apenas contas, outros bens e dívidas. Investimentos e caixinhas entram automaticamente.</p>
    <form data-form="patrimony" class="form-stack">
      <label>Mês<input name="month" type="month" value="${state.month}" required /></label>
      <div class="form-grid three">
        <label>Dinheiro em contas<input name="cash_amount" type="number" step="0.01" value="${existing.cash_amount || 0}" /></label>
        <label>Outros bens<input name="other_assets" type="number" step="0.01" value="${existing.other_assets || 0}" /></label>
        <label>Dívidas<input name="debts" type="number" step="0.01" value="${existing.debts || 0}" /></label>
      </div>
      <label>Observações<input name="notes" value="${html(existing.notes || '')}" /></label>
      <button class="btn primary full" type="submit">Salvar fechamento</button>
    </form>`;
}
function modalMonthlyPlan() {
  const existing = data().monthlyPlans.find(p => p.month === state.month) || {};
  return `<h2>Metas do mês</h2><p>Defina renda esperada, limite de gastos e valor que deseja sobrar.</p>
    <form data-form="monthlyPlan" class="form-stack">
      <label>Mês<input name="month" type="month" value="${state.month}" required /></label>
      <div class="form-grid three">
        <label>Meta de renda<input name="income_goal" type="number" min="0" step="0.01" value="${existing.income_goal || 0}" /></label>
        <label>Limite de gastos<input name="expense_limit" type="number" min="0" step="0.01" value="${existing.expense_limit || 0}" /></label>
        <label>Meta de sobra<input name="saving_goal" type="number" min="0" step="0.01" value="${existing.saving_goal || 0}" /></label>
      </div>
      <label>Notas<textarea name="notes">${html(existing.notes || '')}</textarea></label>
      <button class="btn primary full" type="submit">Salvar metas</button>
    </form>`;
}

async function handleFormSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const kind = form.dataset.form;
  const payload = Object.fromEntries(new FormData(form));
  const endpoint = {
    transaction: '/api/transactions', category: '/api/categories', account: '/api/accounts', box: '/api/savings-boxes',
    boxMovement: '/api/savings-movements', investment: '/api/investments', investmentRecord: '/api/investment-records',
    patrimony: '/api/patrimony-snapshots', monthlyPlan: '/api/monthly-plans'
  }[kind];
  try {
    await api(endpoint, { method: 'POST', body: payload });
    if (payload.month) { state.month = payload.month; localStorage.setItem('financeMonth', state.month); }
    await loadData(true);
    closeModal();
    renderPage();
    showToast('Salvo com sucesso');
  } catch (err) { showToast(err.message); }
}

function renderChartsForPage() {
  if ($('#cashflowChart')) drawCashflowChart();
  if ($('#netWorthChart')) drawNetWorthChart('netWorthChart', 8);
  if ($('#categoryChart')) drawCategoryChart();
  if ($('#dailyChart')) drawDailyChart();
  if ($('#boxesChart')) drawBoxesChart();
  if ($('#investmentChart')) drawInvestmentChart();
  if ($('#portfolioChart')) drawPortfolioChart();
  if ($('#patrimonyChart')) drawNetWorthChart('patrimonyChart', 14);
  if ($('#patrimonyMixChart')) drawPatrimonyMixChart();
  if ($('#planningChart')) drawPlanningChart();
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, Math.floor(rect.width * dpr));
  canvas.height = Math.max(220, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  return { ctx, width: rect.width, height: rect.height };
}
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function drawNoData(canvas, text = 'Sem dados suficientes') {
  const { ctx, width, height } = setupCanvas(canvas);
  ctx.fillStyle = cssVar('--muted');
  ctx.font = '700 14px Inter, system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(text, width / 2, height / 2);
}
function niceMax(values) {
  const max = Math.max(...values.map(v => Math.abs(Number(v) || 0)), 1);
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / pow) * pow;
}
function drawLineChart(canvas, series, labels, options = {}) {
  if (!labels.length || series.every(s => !s.values.some(Boolean))) return drawNoData(canvas);
  const { ctx, width, height } = setupCanvas(canvas);
  const pad = { left: 48, right: 18, top: 18, bottom: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const all = series.flatMap(s => s.values);
  let min = options.zeroMin ? 0 : Math.min(0, ...all);
  let max = niceMax(all);
  if (options.allowNegative) min = Math.min(...all, 0);
  const range = max - min || 1;
  ctx.strokeStyle = cssVar('--line');
  ctx.lineWidth = 1;
  ctx.fillStyle = cssVar('--muted');
  ctx.font = '700 11px Inter, system-ui';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (innerH / 4) * i;
    const value = max - (range / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
    ctx.fillText(shortMoney(value), pad.left - 8, y + 4);
  }
  ctx.textAlign = 'center';
  labels.forEach((label, i) => {
    const x = pad.left + (labels.length === 1 ? innerW / 2 : (innerW / (labels.length - 1)) * i);
    if (i % Math.ceil(labels.length / 6) === 0 || labels.length <= 6) ctx.fillText(label, x, height - 12);
  });
  series.forEach((s, idx) => {
    const color = s.color || colors[idx % colors.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    s.values.forEach((value, i) => {
      const x = pad.left + (labels.length === 1 ? innerW / 2 : (innerW / (labels.length - 1)) * i);
      const y = pad.top + innerH - (((value - min) / range) * innerH);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    s.values.forEach((value, i) => {
      const x = pad.left + (labels.length === 1 ? innerW / 2 : (innerW / (labels.length - 1)) * i);
      const y = pad.top + innerH - (((value - min) / range) * innerH);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = cssVar('--panel-solid'); ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    });
  });
}
function drawBarChart(canvas, items, options = {}) {
  if (!items.length || !items.some(i => i.value)) return drawNoData(canvas);
  const { ctx, width, height } = setupCanvas(canvas);
  const pad = { left: 48, right: 18, top: 18, bottom: 42 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(items.map(i => i.value));
  ctx.strokeStyle = cssVar('--line');
  ctx.fillStyle = cssVar('--muted');
  ctx.font = '700 11px Inter, system-ui';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (innerH / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
    ctx.fillText(shortMoney(max - (max/4)*i), pad.left - 8, y + 4);
  }
  const gap = 10;
  const barW = Math.max(12, (innerW - gap * (items.length - 1)) / items.length);
  items.forEach((item, i) => {
    const x = pad.left + i * (barW + gap);
    const h = (num(item.value) / max) * innerH;
    const y = pad.top + innerH - h;
    ctx.fillStyle = item.color || colors[i % colors.length];
    roundRect(ctx, x, y, barW, h, 9); ctx.fill();
    ctx.fillStyle = cssVar('--muted');
    ctx.textAlign = 'center';
    ctx.fillText(String(item.label).slice(0, 10), x + barW/2, height - 15);
  });
}
function drawDoughnutChart(canvas, items) {
  if (!items.length || !items.some(i => i.value)) return drawNoData(canvas);
  const { ctx, width, height } = setupCanvas(canvas);
  const cx = width * 0.36, cy = height / 2;
  const r = Math.min(width, height) * 0.29;
  const total = items.reduce((s,i) => s + num(i.value), 0);
  let start = -Math.PI / 2;
  items.forEach((item, i) => {
    const angle = (num(item.value) / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, start + angle); ctx.closePath();
    ctx.fillStyle = item.color || colors[i % colors.length]; ctx.fill();
    start += angle;
  });
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(cx, cy, r * .62, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = cssVar('--text');
  ctx.font = '900 18px Inter, system-ui'; ctx.textAlign = 'center'; ctx.fillText(shortMoney(total), cx, cy + 6);

  const legendX = width * 0.66;
  ctx.textAlign = 'left';
  ctx.font = '800 12px Inter, system-ui';
  items.slice(0, 7).forEach((item, i) => {
    const y = 38 + i * 25;
    ctx.fillStyle = item.color || colors[i % colors.length];
    ctx.beginPath(); ctx.arc(legendX, y - 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = cssVar('--text'); ctx.fillText(String(item.label).slice(0, 18), legendX + 13, y);
    ctx.fillStyle = cssVar('--muted'); ctx.fillText(`${Math.round(num(item.value)/total*100)}%`, legendX + 132, y);
  });
}
function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawCashflowChart() {
  const months = monthRange(6);
  drawLineChart($('#cashflowChart'), [
    { values: months.map(m => incomeInMonth(m)), color: '#10b981' },
    { values: months.map(m => expensesInMonth(m)), color: '#ef4444' },
    { values: months.map(m => incomeInMonth(m) - expensesInMonth(m)), color: '#2563eb' }
  ], months.map(monthBR), { zeroMin: false, allowNegative: true });
}
function drawNetWorthChart(id, count) {
  const all = allMonthsForPatrimony();
  const months = all.length ? all.slice(-count) : monthRange(count);
  drawLineChart($(`#${id}`), [{ values: months.map(netWorthByMonth), color: '#2563eb' }], months.map(monthBR), { zeroMin: true });
}
function drawCategoryChart() {
  const map = new Map();
  txInMonth().filter(t => t.type === 'expense').forEach(t => {
    const c = categoryById(t.category_id);
    const key = c?.name || 'Sem categoria';
    map.set(key, { label: key, value: (map.get(key)?.value || 0) + num(t.amount), color: c?.color });
  });
  drawDoughnutChart($('#categoryChart'), Array.from(map.values()).sort((a,b) => b.value-a.value));
}
function drawDailyChart() {
  const days = new Date(Number(state.month.slice(0,4)), Number(state.month.slice(5,7)), 0).getDate();
  const step = Math.ceil(days / 12);
  const items = [];
  for (let d = 1; d <= days; d += step) {
    const keys = Array.from({ length: step }, (_, i) => d+i).filter(x => x <= days);
    const value = txInMonth().filter(t => keys.includes(Number(String(t.occurred_at).slice(8,10))) && t.type === 'expense').reduce((s,t) => s + num(t.amount), 0);
    items.push({ label: `${d}`, value, color: '#ef4444' });
  }
  drawBarChart($('#dailyChart'), items);
}
function drawBoxesChart() {
  const items = data().boxes.map((b, i) => ({ label: b.name, value: boxBalance(b.id), color: b.color || colors[i % colors.length] }));
  drawDoughnutChart($('#boxesChart'), items);
}
function drawInvestmentChart() {
  const inv = investmentById(state.activeInvestmentId);
  const records = data().investmentRecords.filter(r => r.investment_id === inv?.id).sort((a,b) => a.month.localeCompare(b.month));
  drawLineChart($('#investmentChart'), [
    { values: records.map(r => num(r.invested_amount)), color: '#64748b' },
    { values: records.map(r => num(r.current_value)), color: '#10b981' },
    { values: records.map(r => num(r.contribution)), color: '#2563eb' }
  ], records.map(r => monthBR(r.month)), { zeroMin: true });
}
function drawPortfolioChart() {
  const items = data().investments.map((i, idx) => ({ label: i.name, value: num(latestInvestmentRecord(i.id)?.current_value), color: i.color || colors[idx % colors.length] }));
  drawDoughnutChart($('#portfolioChart'), items);
}
function drawPatrimonyMixChart() {
  const snapshot = latestPatrimonySnapshot(state.month);
  drawDoughnutChart($('#patrimonyMixChart'), [
    { label: 'Contas', value: num(snapshot?.cash_amount), color: '#2563eb' },
    { label: 'Outros bens', value: num(snapshot?.other_assets), color: '#a855f7' },
    { label: 'Investimentos', value: investmentsTotal(state.month), color: '#10b981' },
    { label: 'Caixinhas', value: boxesTotal(state.month), color: '#0ea5e9' }
  ]);
}
function drawPlanningChart() {
  const plan = data().monthlyPlans.find(p => p.month === state.month) || {};
  drawBarChart($('#planningChart'), [
    { label: 'Renda', value: incomeInMonth(), color: '#10b981' },
    { label: 'Meta renda', value: num(plan.income_goal), color: '#86efac' },
    { label: 'Gastos', value: expensesInMonth(), color: '#ef4444' },
    { label: 'Limite', value: num(plan.expense_limit), color: '#fca5a5' },
    { label: 'Sobra', value: Math.max(0, incomeInMonth() - expensesInMonth()), color: '#2563eb' },
    { label: 'Meta sobra', value: num(plan.saving_goal), color: '#93c5fd' }
  ]);
}

function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

boot();
