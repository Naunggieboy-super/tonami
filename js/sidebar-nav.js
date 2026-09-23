(() => {
  'use strict';

  const sidebar = document.getElementById('sidebar');
  const menu = document.getElementById('mobileMenu');
  if (!sidebar || !menu) return;

  const STORAGE_KEY = 'moneyflow-v3';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const readState = () => {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      state.transactions = Array.isArray(state.transactions) ? state.transactions : [];
      state.loans = Array.isArray(state.loans) ? state.loans : [];
      return state;
    } catch (_) { return { transactions: [], loans: [] }; }
  };
  const writeState = (state) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const toast = (message) => {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('on');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('on'), 2400);
  };

  const style = document.createElement('style');
  style.textContent = `
    .app-layout.sidebar-collapsed .sidebar { width: 76px; padding-inline: 10px; }
    .app-layout.sidebar-collapsed .sidebar .brand > div,
    .app-layout.sidebar-collapsed .nav-item span:last-child,
    .app-layout.sidebar-collapsed .theme-button span:last-child { display:none; }
    .app-layout.sidebar-collapsed .nav-item,.app-layout.sidebar-collapsed .theme-button { justify-content:center; }
    .mobile-menu { display:inline-grid; place-items:center; border:1px solid var(--line); background:var(--surface); color:var(--text); border-radius:10px; min-width:42px; min-height:42px; font-size:1.25rem; }
    select, select option { background-color: var(--surface-solid); color: var(--text); color-scheme: light; }
    body.dark select, body.dark select option { background-color: #0d1424; color: #f2f6ff; color-scheme: dark; }
    .modal-backdrop { position:fixed; inset:0; z-index:50; display:grid; place-items:center; padding:18px; background:rgba(2,6,23,.68); backdrop-filter:blur(6px); }
    .modal-backdrop[hidden] { display:none; }
    .transaction-modal { width:min(620px,100%); max-height:min(88vh,760px); overflow:auto; margin:0; background:var(--surface-solid); }
    .modal-close { border:0; background:transparent; color:var(--muted); font-size:1.5rem; line-height:1; cursor:pointer; }
    .transaction-tabs { display:flex; gap:8px; margin-bottom:16px; }
    .transaction-tab { flex:1; border:1px solid var(--line); border-radius:10px; padding:10px; background:transparent; color:var(--text); font-weight:700; cursor:pointer; }
    .transaction-tab.active { background:rgba(79,140,255,.16); border-color:var(--blue); color:var(--blue); }
    .clear-all-btn { margin-left:auto; }
    @media (max-width:760px) { .app-layout.sidebar-collapsed .sidebar { width:100%; } .app-layout.sidebar-collapsed .sidebar .brand > div,.app-layout.sidebar-collapsed .nav-item span:last-child,.app-layout.sidebar-collapsed .theme-button span:last-child { display:block; } }
  `;
  document.head.appendChild(style);

  const setOpen = (open) => {
    sidebar.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  };
  menu.addEventListener('click', () => {
    if (window.innerWidth <= 760) setOpen(!sidebar.classList.contains('open'));
    else document.querySelector('.app-layout').classList.toggle('sidebar-collapsed');
  });
  sidebar.addEventListener('click', (event) => { if (event.target.closest('.nav-item')) setOpen(false); });
  document.addEventListener('click', (event) => {
    if (sidebar.classList.contains('open') && !sidebar.contains(event.target) && !menu.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { setOpen(false); closeModal(); } });
  window.addEventListener('resize', () => { if (window.innerWidth > 760) setOpen(false); }, { passive: true });

  // Keep budget and category management together under Settings.
  const moveManagementToSettings = () => {
    const settings = document.getElementById('settings');
    const add = document.getElementById('add');
    if (!settings || !add || settings.dataset.managementMoved) return;
    const budget = $('#budgetForm', add)?.closest('.panel');
    const category = $('#categoryForm', add)?.closest('.panel');
    if (!budget && !category) return;
    const host = document.createElement('div');
    host.className = 'settings-management';
    host.innerHTML = '<div class="section-title"><small>Planning</small><h2>Budget & category management</h2><p>Manage your limits and classification without leaving Settings.</p></div>';
    [budget, category].forEach((panel) => { if (panel) host.appendChild(panel); });
    settings.appendChild(host);
    settings.dataset.managementMoved = 'true';
  };

  let modal;
  let repaymentMode = false;
  const form = () => $('#transactionForm', modal || document);
  const closeModal = () => { if (modal) modal.hidden = true; document.body.classList.remove('modal-open'); };
  const populateLoans = () => {
    const select = $('[name="loanId"]', modal);
    if (!select) return;
    const loans = readState().loans.filter((loan) => Number(loan.remaining || loan.principal) > 0);
    select.innerHTML = '<option value="">Select a loan</option>' + loans.map((loan) => `<option value="${String(loan.id).replace(/"/g, '&quot;')}">${String(loan.name || 'Loan')} — ${Math.round(Number(loan.remaining || loan.principal)).toLocaleString()} MMK</option>`).join('');
  };
  const setTransactionMode = (repayment) => {
    repaymentMode = repayment;
    $$('.transaction-tab', modal).forEach((tab) => tab.classList.toggle('active', tab.dataset.transactionMode === (repayment ? 'repayment' : 'standard')));
    const f = form();
    if (!f) return;
    const type = $('[name="type"]', f);
    const category = $('[name="category"]', f);
    const loan = $('[name="loanId"]', f);
    if (repayment) {
      type.value = 'expense';
      type.disabled = true;
      category.value = 'Loan Repayment';
      category.disabled = true;
      loan.required = true;
      $('[data-loan-field]', f).hidden = false;
      populateLoans();
    } else {
      type.disabled = false;
      category.disabled = false;
      loan.required = false;
      $('[data-loan-field]', f).hidden = true;
    }
  };
  const openModal = () => {
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    populateLoans();
    setTransactionMode(false);
    setTimeout(() => $('[name="amount"]', form())?.focus(), 0);
  };
  const setupModal = () => {
    const original = document.getElementById('transactionForm');
    if (!original || modal) return;
    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.hidden = true;
    modal.innerHTML = '<div class="panel transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transactionModalTitle"><div class="section-head"><div><small>Transaction</small><h2 id="transactionModalTitle">Add transaction</h2></div><button type="button" class="modal-close" aria-label="Close">×</button></div><div class="transaction-tabs"><button type="button" class="transaction-tab active" data-transaction-mode="standard">Income / Expense</button><button type="button" class="transaction-tab" data-transaction-mode="repayment">Loan repayment</button></div></div>';
    const shell = $('.transaction-modal', modal);
    const loanField = document.createElement('label');
    loanField.dataset.loanField = 'true'; loanField.hidden = true;
    loanField.innerHTML = '<span>Loan to repay</span><select name="loanId" aria-label="Loan to repay"></select>';
    original.parentElement.removeChild(original);
    shell.appendChild(original);
    const note = $('[name="note"]', original);
    if (note) note.parentElement.insertAdjacentElement('afterend', loanField);
    document.body.appendChild(modal);
    $('.modal-close', modal).addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    $$('.transaction-tab', modal).forEach((tab) => tab.addEventListener('click', () => setTransactionMode(tab.dataset.transactionMode === 'repayment')));
    original.addEventListener('submit', () => {
      if (!repaymentMode) return;
      const amount = Number($('[name="amount"]', original)?.value || 0);
      const loanId = $('[name="loanId"]', original)?.value;
      if (!loanId || amount <= 0) return;
      setTimeout(() => {
        const state = readState();
        const loan = state.loans.find((item) => String(item.id) === String(loanId));
        if (loan) { loan.remaining = Math.max(0, Number(loan.remaining || loan.principal) - amount); writeState(state); }
      }, 20);
    });
  };

  const clearTransactions = () => {
    const state = readState();
    if (!state.transactions.length) return toast('There are no transactions to clear.');
    if (!window.confirm('Clear all transactions? This cannot be undone.')) return;
    state.transactions = [];
    writeState(state);
    document.dispatchEvent(new Event('moneyflow:refresh'));
    toast('All transactions cleared.');
    setTimeout(() => location.reload(), 80);
  };
  const addClearButton = () => {
    const table = document.getElementById('transactionTable');
    const panel = table?.closest('.panel');
    const head = $('.section-head', panel);
    if (!head || $('.clear-all-btn', head)) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'ghost-btn clear-all-btn'; button.textContent = 'Clear all';
    button.addEventListener('click', clearTransactions); head.appendChild(button);
  };

  document.addEventListener('click', (event) => {
    const pageButton = event.target.closest('[data-page]');
    if (pageButton?.dataset.page === 'add') { event.preventDefault(); openModal(); return; }
    if (event.target.closest('[data-action="open-transaction"]')) openModal();
  });
  document.addEventListener('submit', (event) => {
    if (event.target.id === 'transactionForm') setTimeout(() => { closeModal(); setTransactionMode(false); }, 80);
  });

  const init = () => { moveManagementToSettings(); setupModal(); addClearButton(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
