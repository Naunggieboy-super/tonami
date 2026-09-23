(() => {
  'use strict';

  const KEY = 'moneyflow-v3';
  const sidebar = document.getElementById('sidebar');
  const menu = document.getElementById('mobileMenu');
  const app = document.querySelector('.app-layout');
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const read = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); s.transactions = Array.isArray(s.transactions) ? s.transactions : []; s.loans = Array.isArray(s.loans) ? s.loans : []; s.budgets = Array.isArray(s.budgets) ? s.budgets : []; return s; } catch (_) { return { transactions: [], loans: [], budgets: [] }; } };
  const write = s => localStorage.setItem(KEY, JSON.stringify(s));
  const money = n => `${Math.round(Number(n) || 0).toLocaleString()} MMK`;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const toast = message => { const el = $('#toast'); if (!el) return; el.textContent = message; el.classList.add('on'); clearTimeout(el._timer); el._timer = setTimeout(() => el.classList.remove('on'), 2400); };

  const style = document.createElement('style');
  style.textContent = `
    .mobile-menu{display:inline-grid;place-items:center;min-width:42px;min-height:42px;border:1px solid var(--line);border-radius:12px;background:var(--surface-solid);color:var(--text);font-size:1.2rem}
    .app-layout.sidebar-collapsed .sidebar{width:76px;padding-inline:10px}.app-layout.sidebar-collapsed .brand>div,.app-layout.sidebar-collapsed .nav-item span:last-child,.app-layout.sidebar-collapsed .theme-button span:last-child{display:none}.app-layout.sidebar-collapsed .nav-item,.app-layout.sidebar-collapsed .theme-button{justify-content:center}
    select,select option{background:var(--surface-solid);color:var(--text);color-scheme:light}body.dark select,body.dark select option{background:#0d1424;color:#f2f6ff;color-scheme:dark}
    .modal-backdrop{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:18px;background:rgba(2,6,23,.7);backdrop-filter:blur(7px)}.modal-backdrop[hidden]{display:none}.transaction-modal{width:min(640px,100%);max-height:90vh;overflow:auto;margin:0;background:var(--surface-solid);color:var(--text)}.modal-close{border:0;background:transparent;color:var(--muted);font-size:1.6rem;cursor:pointer}.transaction-tabs{display:flex;gap:8px;margin-bottom:16px}.transaction-tab{flex:1;padding:11px;border:1px solid var(--line);border-radius:12px;background:transparent;color:var(--text);font-weight:700}.transaction-tab.active{border-color:var(--blue);background:color-mix(in srgb,var(--blue) 16%,transparent);color:var(--blue)}
    .form-error{display:none;padding:10px 12px;border:1px solid rgba(251,113,133,.4);border-radius:10px;background:rgba(251,113,133,.1);color:var(--red);font-size:.86rem}.form-error.show{display:block}.clear-all-btn{margin-left:auto}
    #budgetVsSpendingChart{display:grid;gap:16px}.budget-chart-row{display:grid;grid-template-columns:minmax(110px,.3fr) 1fr auto;align-items:center;gap:12px}.budget-chart-row .bar-track{height:18px;background:color-mix(in srgb,var(--muted) 16%,transparent);border:1px solid var(--line)}.budget-chart-row .bar-fill{height:100%;min-width:0;border-radius:inherit;background:linear-gradient(90deg,var(--blue),var(--cyan));transition:width .35s ease}.budget-chart-row.spending .bar-fill{background:linear-gradient(90deg,var(--violet),var(--red))}.budget-chart-row small{color:var(--muted);text-align:right;white-space:nowrap}.budget-chart-empty{color:var(--muted);padding:14px 0}
    @media(max-width:760px){.app-layout.sidebar-collapsed .sidebar{width:100%}.app-layout.sidebar-collapsed .brand>div,.app-layout.sidebar-collapsed .nav-item span:last-child,.app-layout.sidebar-collapsed .theme-button span:last-child{display:block}.budget-chart-row{grid-template-columns:1fr auto}.budget-chart-row .bar-track{grid-column:1/-1;grid-row:2}}
  `;
  document.head.appendChild(style);

  if (sidebar && menu) {
    const setOpen = open => { sidebar.classList.toggle('open', open); menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); };
    menu.addEventListener('click', () => window.innerWidth <= 760 ? setOpen(!sidebar.classList.contains('open')) : app?.classList.toggle('sidebar-collapsed'));
    sidebar.addEventListener('click', e => { if (e.target.closest('.nav-item')) setOpen(false); });
    document.addEventListener('click', e => { if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !menu.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { setOpen(false); closeModal(); } });
  }

  const moveManagement = () => {
    const settings = $('#settings'), add = $('#add');
    if (!settings || !add || settings.dataset.managementMoved) return;
    const panels = [$('#budgetForm', add)?.closest('.panel'), $('#categoryForm', add)?.closest('.panel')].filter(Boolean);
    if (!panels.length) return;
    const host = document.createElement('div'); host.className = 'settings-management';
    host.innerHTML = '<div class="section-title"><small>Planning</small><h2>Budget & category management</h2><p>Manage your limits and categories from one place.</p></div>';
    panels.forEach(panel => host.appendChild(panel)); settings.appendChild(host); settings.dataset.managementMoved = 'true';
  };

  let modal = null, repayment = false, errorBox = null;
  const txForm = () => $('#transactionForm', modal || document);
  const closeModal = () => { if (modal) modal.hidden = true; document.body.classList.remove('modal-open'); };
  const loansInField = () => { const field = $('[name="loanId"]', modal); if (!field) return; field.innerHTML = '<option value="">Select an active loan</option>' + read().loans.filter(l => Number(l.remaining || l.principal) > 0).map(l => `<option value="${esc(l.id)}">${esc(l.name || 'Loan')} — ${money(l.remaining || l.principal)}</option>`).join(''); };
  const mode = isRepayment => {
    repayment = isRepayment; $$('.transaction-tab', modal).forEach(t => t.classList.toggle('active', t.dataset.mode === (repayment ? 'repayment' : 'standard')));
    const f = txForm(); if (!f) return;
    const type = $('[name="type"]', f), category = $('[name="category"]', f), loan = $('[name="loanId"]', f), loanWrap = $('[data-loan-field]', f);
    if (repayment) { type.value = 'expense'; type.disabled = true; category.value = 'Loan Repayment'; category.disabled = true; loan.required = true; loanWrap.hidden = false; loansInField(); }
    else { type.disabled = false; category.disabled = false; loan.required = false; loan.value = ''; loanWrap.hidden = true; }
    errorBox?.classList.remove('show');
  };
  const openModal = () => { if (!modal) return; modal.hidden = false; document.body.classList.add('modal-open'); loansInField(); mode(false); setTimeout(() => $('[name="amount"]', txForm())?.focus(), 0); };

  const setupModal = () => {
    const original = $('#transactionForm'); if (!original || modal) return;
    modal = document.createElement('div'); modal.className = 'modal-backdrop'; modal.hidden = true;
    modal.innerHTML = '<div class="panel transaction-modal" role="dialog" aria-modal="true" aria-labelledby="txTitle"><div class="section-head"><div><small>Transaction</small><h2 id="txTitle">Add transaction</h2></div><button type="button" class="modal-close" aria-label="Close">×</button></div><div class="transaction-tabs"><button type="button" class="transaction-tab active" data-mode="standard">Income / Expense</button><button type="button" class="transaction-tab" data-mode="repayment">Loan repayment</button></div></div>';
    const shell = $('.transaction-modal', modal), loanWrap = document.createElement('label'); loanWrap.dataset.loanField = 'true'; loanWrap.hidden = true; loanWrap.innerHTML = '<span>Loan to repay</span><select name="loanId" aria-label="Loan to repay"></select>';
    original.remove(); shell.appendChild(original); $('[name="note"]', original)?.parentElement.insertAdjacentElement('afterend', loanWrap);
    errorBox = document.createElement('div'); errorBox.className = 'form-error'; errorBox.setAttribute('role', 'alert'); original.prepend(errorBox); document.body.appendChild(modal);
    $('.modal-close', modal).addEventListener('click', closeModal); modal.addEventListener('click', e => { if (e.target === modal) closeModal(); }); $$('.transaction-tab', modal).forEach(t => t.addEventListener('click', () => mode(t.dataset.mode === 'repayment')));
  };

  // Capture before app.js: repayment is a separate, validated transaction flow.
  document.addEventListener('submit', event => {
    if (event.target.id !== 'transactionForm' || !repayment) return;
    const f = event.target, amount = Number($('[name="amount"]', f)?.value || 0), loanId = $('[name="loanId"]', f)?.value;
    const loan = read().loans.find(l => String(l.id) === String(loanId));
    const errors = [];
    if (!loanId || !loan) errors.push('Select an active loan to repay.');
    if (!(amount > 0)) errors.push('Enter a repayment amount greater than zero.');
    if (loan && amount > Number(loan.remaining || loan.principal)) errors.push(`Repayment cannot exceed the remaining balance of ${money(loan.remaining || loan.principal)}.`);
    if (errors.length) { event.preventDefault(); event.stopImmediatePropagation(); errorBox.textContent = errors.join(' '); errorBox.classList.add('show'); return; }
    // App.js persists the transaction. Update the selected loan only after that succeeds.
    setTimeout(() => { const state = read(), selected = state.loans.find(l => String(l.id) === String(loanId)); if (selected) { selected.remaining = Math.max(0, Number(selected.remaining || selected.principal) - amount); write(state); } }, 50);
  }, true);

  const addClearButton = () => { const panel = $('#transactionTable')?.closest('.panel'), head = $('.section-head', panel); if (!head || $('.clear-all-btn', head)) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost-btn clear-all-btn'; b.textContent = 'Clear all'; b.addEventListener('click', () => { if (!read().transactions.length || !confirm('Clear all transactions? This cannot be undone.')) return; const s = read(); s.transactions = []; write(s); location.reload(); }); head.appendChild(b); };

  const renderBudgetChart = () => {
    const host = $('#budgetVsSpendingChart'); if (!host) return;
    const state = read(), month = state.reportMonth || new Date().toISOString().slice(0, 7), monthOf = v => String(v || '').slice(0, 7);
    const budgets = state.budgets.filter(b => monthOf(b.month) === month), tx = state.transactions.filter(t => monthOf(t.date) === month && t.type === 'expense');
    const totalBudget = budgets.reduce((n, b) => n + Number(b.amount || 0), 0), spent = tx.reduce((n, t) => n + Number(t.amount || 0), 0);
    const rows = budgets.length ? budgets.map(b => { const used = tx.filter(t => t.category === b.category).reduce((n, t) => n + Number(t.amount || 0), 0); return { label: b.category, budget: Number(b.amount || 0), spent: used }; }) : [{ label: 'All spending', budget: totalBudget || spent || 1, spent }];
    const max = Math.max(...rows.map(r => Math.max(r.budget, r.spent)), 1);
    host.innerHTML = rows.map(r => `<div class="budget-chart-row"><strong>${esc(r.label)}</strong><div class="bar-track" aria-label="${esc(r.label)} spending ${money(r.spent)} of ${money(r.budget)}"><div class="bar-fill" style="width:${Math.min(100, r.budget / max * 100)}%"></div></div><small>${money(r.spent)} / ${money(r.budget)}</small><div class="budget-chart-row spending"><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, r.spent / max * 100)}%"></div></div></div></div>`).join('') || '<div class="budget-chart-empty">No budget or transaction data for this month.</div>';
  };
  const init = () => { moveManagement(); setupModal(); addClearButton(); renderBudgetChart(); const chart = $('#budgetVsSpendingChart'); if (chart) new MutationObserver(() => renderBudgetChart()).observe(chart, { childList: true }); document.addEventListener('click', e => { if (e.target.closest('[data-page="add"]')) { e.preventDefault(); openModal(); } }); document.addEventListener('submit', e => { if (e.target.id === 'transactionForm' && !e.defaultPrevented) setTimeout(closeModal, 100); }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
