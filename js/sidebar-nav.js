(() => {
  'use strict';

  const KEY = 'moneyflow-v3';
  const sidebar = document.getElementById('sidebar');
  const menu = document.getElementById('mobileMenu');
  const app = document.querySelector('.app-layout');
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const read = () => {
    try {
      const state = JSON.parse(localStorage.getItem(KEY) || '{}');
      state.transactions = Array.isArray(state.transactions) ? state.transactions : [];
      state.loans = Array.isArray(state.loans) ? state.loans : [];
      state.budgets = Array.isArray(state.budgets) ? state.budgets : [];
      return state;
    } catch (_) { return { transactions: [], loans: [], budgets: [] }; }
  };
  const write = state => localStorage.setItem(KEY, JSON.stringify(state));
  const money = value => `${Math.round(Number(value) || 0).toLocaleString()} MMK`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const toast = message => {
    const node = $('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('on');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('on'), 2400);
  };

  const style = document.createElement('style');
  style.textContent = `
    .mobile-menu{display:inline-grid;place-items:center;min-width:42px;min-height:42px;border:1px solid var(--line);border-radius:12px;background:var(--surface-solid);color:var(--text);font-size:1.2rem}
    .app-layout.sidebar-collapsed .sidebar{width:76px;padding-inline:10px}.app-layout.sidebar-collapsed .brand>div,.app-layout.sidebar-collapsed .nav-item span:last-child,.app-layout.sidebar-collapsed .theme-button span:last-child{display:none}.app-layout.sidebar-collapsed .nav-item,.app-layout.sidebar-collapsed .theme-button{justify-content:center}
    select,select option{background:var(--surface-solid);color:var(--text);color-scheme:light}body.dark select,body.dark select option{background:#0d1424;color:#f2f6ff;color-scheme:dark}
    .modal-backdrop{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:18px;background:rgba(2,6,23,.7);backdrop-filter:blur(7px)}.modal-backdrop[hidden]{display:none}.transaction-modal{width:min(640px,100%);max-height:90vh;overflow:auto;margin:0;background:var(--surface-solid);color:var(--text)}.modal-close{border:0;background:transparent;color:var(--muted);font-size:1.6rem;cursor:pointer}.transaction-tabs{display:flex;gap:8px;margin-bottom:16px}.transaction-tab{flex:1;padding:11px;border:1px solid var(--line);border-radius:12px;background:transparent;color:var(--text);font-weight:700}.transaction-tab.active{border-color:var(--blue);background:rgba(79,140,255,.16);color:var(--blue)}
    .form-error{display:none;padding:10px 12px;border:1px solid rgba(251,113,133,.4);border-radius:10px;background:rgba(251,113,133,.1);color:var(--red);font-size:.86rem}.form-error.show{display:block}.clear-all-btn{margin-left:auto}
    #budgetVsSpendingChart{display:grid;gap:16px}.budget-chart-row{display:grid;grid-template-columns:minmax(110px,.3fr) 1fr auto;align-items:center;gap:12px}.budget-chart-row .bar-track{height:18px;background:rgba(148,163,184,.16);border:1px solid var(--line)}.budget-chart-row .bar-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--blue),var(--cyan));transition:width .35s ease}.budget-chart-row.spending .bar-fill{background:linear-gradient(90deg,var(--violet),var(--red))}.budget-chart-row small{color:var(--muted);text-align:right;white-space:nowrap}.budget-chart-empty{color:var(--muted);padding:14px 0}
    @media(max-width:760px){.app-layout.sidebar-collapsed .sidebar{width:100%}.app-layout.sidebar-collapsed .brand>div,.app-layout.sidebar-collapsed .nav-item span:last-child,.app-layout.sidebar-collapsed .theme-button span:last-child{display:block}.budget-chart-row{grid-template-columns:1fr auto}.budget-chart-row .bar-track{grid-column:1/-1;grid-row:2}}
  `;
  document.head.appendChild(style);

  const setNavigation = open => {
    if (!sidebar || !menu) return;
    sidebar.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  };
  if (sidebar && menu) {
    menu.addEventListener('click', () => window.innerWidth <= 760 ? setNavigation(!sidebar.classList.contains('open')) : app?.classList.toggle('sidebar-collapsed'));
    sidebar.addEventListener('click', event => { if (event.target.closest('.nav-item')) setNavigation(false); });
    document.addEventListener('click', event => { if (sidebar.classList.contains('open') && !sidebar.contains(event.target) && !menu.contains(event.target)) setNavigation(false); });
  }

  const moveManagement = () => {
    const settings = $('#settings');
    const add = $('#add');
    if (!settings || !add || settings.dataset.managementMoved) return;
    const panels = [$('#budgetForm', add)?.closest('.panel), $('#categoryForm', add)?.closest('.panel')].filter(Boolean);
    if (!panels.length) return;
    const host = document.createElement('div');
    host.className = 'settings-management';
    host.innerHTML = '<div class="section-title"><small>Planning</small><h2>Budget & category management</h2><p>Manage your limits and categories from one place.</p></div>';
    panels.forEach(panel => host.appendChild(panel));
    settings.appendChild(host);
    settings.dataset.managementMoved = 'true';
  };

  let modal = null;
  let repayment = false;
  let errorBox = null;
  const form = () => $('#transactionForm', modal || document);
  const closeModal = () => { if (modal) modal.hidden = true; document.body.classList.remove('modal-open'); };
  const populateLoans = () => {
    const select = $('[name="loanId"]', modal);
    if (!select) return;
    select.innerHTML = '<option value="">Select an active loan</option>' + read().loans
      .filter(loan => Number(loan.remaining || loan.principal) > 0)
      .map(loan => `<option value="${esc(loan.id)}">${esc(loan.name || 'Loan')} — ${money(loan.remaining || loan.principal)}</option>`).join('');
  };
  const setMode = isRepayment => {
    repayment = isRepayment;
    $$('.transaction-tab', modal).forEach(tab => tab.classList.toggle('active', tab.dataset.mode === (repayment ? 'repayment' : 'standard')));
    const currentForm = form();
    if (!currentForm) return;
    const type = $('[name="type"]', currentForm);
    const category = $('[name="category"]', currentForm);
    const loan = $('[name="loanId"]', currentForm);
    const loanField = $('[data-loan-field]', currentForm);
    if (repayment) {
      type.value = 'expense'; type.disabled = true;
      category.value = 'Loan Repayment'; category.disabled = true;
      loan.required = true; loanField.hidden = false; populateLoans();
    } else {
      type.disabled = false; category.disabled = false; loan.required = false; loan.value = ''; loanField.hidden = true;
    }
    errorBox?.classList.remove('show');
  };
  const openModal = () => {
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    setMode(false);
    setTimeout(() => $('[name="amount"]', form())?.focus(), 0);
  };

  const setupModal = () => {
    const original = $('#transactionForm');
    if (!original || modal) return;
    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.hidden = true;
    modal.innerHTML = '<div class="panel transaction-modal" role="dialog" aria-modal="true" aria-labelledby="txTitle"><div class="section-head"><div><small>Transaction</small><h2 id="txTitle">Add transaction</h2></div><button type="button" class="modal-close" aria-label="Close">×</button></div><div class="transaction-tabs"><button type="button" class="transaction-tab active" data-mode="standard">Income / Expense</button><button type="button" class="transaction-tab" data-mode="repayment">Loan repayment</button></div></div>';
    const shell = $('.transaction-modal', modal);
    const loanField = document.createElement('label');
    loanField.dataset.loanField = 'true'; loanField.hidden = true;
    loanField.innerHTML = '<span>Loan to repay</span><select name="loanId" aria-label="Loan to repay"></select>';
    original.remove();
    shell.appendChild(original);
    $('[name="note"]', original)?.parentElement.insertAdjacentElement('afterend', loanField);
    errorBox = document.createElement('div');
    errorBox.className = 'form-error'; errorBox.setAttribute('role', 'alert');
    original.prepend(errorBox);
    document.body.appendChild(modal);
    $('.modal-close', modal).addEventListener('click', closeModal);
    modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
    $$('.transaction-tab', modal).forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode === 'repayment')));
  };

  // Validate repayment in capture phase, but never intercept normal saves.
  document.addEventListener('submit', event => {
    if (event.target.id !== 'transactionForm' || !repayment) return;
    const currentForm = event.target;
    const amount = Number($('[name="amount"]', currentForm)?.value || 0);
    const loanId = $('[name="loanId"]', currentForm)?.value;
    const loan = read().loans.find(item => String(item.id) === String(loanId));
    const errors = [];
    if (!loan) errors.push('Select an active loan to repay.');
    if (!(amount > 0)) errors.push('Enter a repayment amount greater than zero.');
    if (loan && amount > Number(loan.remaining || loan.principal)) errors.push(`Repayment cannot exceed the remaining balance of ${money(loan.remaining || loan.principal)}.`);
    if (errors.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      errorBox.textContent = errors.join(' ');
      errorBox.classList.add('show');
      return;
    }
    setTimeout(() => {
      const state = read();
      const selected = state.loans.find(item => String(item.id) === String(loanId));
      if (selected) { selected.remaining = Math.max(0, Number(selected.remaining || selected.principal) - amount); write(state); }
    }, 50);
  }, true);

  const addClearButton = () => {
    const head = $('.section-head', $('#transactionTable')?.closest('.panel));
    if (!head || $('.clear-all-btn', head)) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'ghost-btn clear-all-btn'; button.textContent = 'Clear all';
    button.addEventListener('click', () => {
      if (!read().transactions.length || !window.confirm('Clear all transactions? This cannot be undone.')) return;
      const state = read(); state.transactions = []; write(state); location.reload();
    });
    head.appendChild(button);
  };

  const renderBudgetChart = () => {
    const host = $('#budgetVsSpendingChart');
    if (!host) return;
    const state = read();
    const month = state.reportMonth || new Date().toISOString().slice(0, 7);
    const monthOf = value => String(value || '').slice(0, 7);
    const budgets = state.budgets.filter(item => monthOf(item.month) === month);
    const transactions = state.transactions.filter(item => monthOf(item.date) === month && item.type === 'expense');
    const rows = budgets.map(budget => ({ label: budget.category, budget: Number(budget.amount || 0), spent: transactions.filter(tx => tx.category === budget.category).reduce((sum, tx) => sum + Number(tx.amount || 0), 0) }));
    if (!rows.length) { host.innerHTML = '<div class="budget-chart-empty">No budget or transaction data for this month.</div>'; return; }
    const max = Math.max(...rows.map(row => Math.max(row.budget, row.spent)), 1);
    host.innerHTML = rows.map(row => `<div class="budget-chart-row"><strong>${esc(row.label)}</strong><div class="bar-track" aria-label="${esc(row.label)} spending"><div class="bar-fill" style="width:${Math.min(100, row.spent / max * 100)}%"></div></div><small>${money(row.spent)} / ${money(row.budget)}</small></div>`).join('');
  };

  const refresh = () => { moveManagement(); addClearButton(); renderBudgetChart(); };
  const init = () => {
    setupModal();
    refresh();
    document.addEventListener('click', event => { if (event.target.closest('[data-page="add"]')) { event.preventDefault(); openModal(); } });
    document.addEventListener('submit', event => { if (event.target.id === 'transactionForm' && !event.defaultPrevented) setTimeout(closeModal, 100); });
    window.addEventListener('storage', refresh);
    document.addEventListener('moneyflow:refresh', refresh);
    // Refresh after app.js completes its render without observing our own DOM writes.
    setInterval(renderBudgetChart, 1000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
