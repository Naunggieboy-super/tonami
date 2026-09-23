(() => {
  'use strict';

  const STORAGE_KEY = 'moneyflow-v3';
  const SYNC_STATE_KEY = 'moneyflow-sync-state';
  const identityMap = (items, keyGetter) => {
    const map = new Map();
    (items || []).forEach((item) => {
      const key = String(keyGetter(item));
      if (key) map.set(key, JSON.stringify(item));
    });
    return map;
  };

  const safeNumber = (value) => {
    const n = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const monthOf = (dateValue) => {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return String(dateValue).slice(0, 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const getState = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
        budgets: Array.isArray(raw.budgets) ? raw.budgets : [],
        loans: Array.isArray(raw.loans) ? raw.loans : [],
        categories: Array.isArray(raw.categories) ? raw.categories : [],
        settings: raw.settings || { darkMode: true, syncUrl: '', monthReset: false },
        reportMonth: /^\d{4}-\d{2}$/.test(String(raw.reportMonth || '')) ? raw.reportMonth : new Date().toISOString().slice(0, 7)
      };
    } catch (_) {
      return { transactions: [], budgets: [], loans: [], categories: [], settings: { darkMode: true, syncUrl: '', monthReset: false }, reportMonth: new Date().toISOString().slice(0, 7) };
    }
  };

  const getLastSyncState = () => {
    try {
      return JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || '{}');
    } catch (_) {
      return {};
    }
  };

  const setLastSyncState = (state) => {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify({
      transactions: state.transactions || [],
      budgets: state.budgets || [],
      loans: state.loans || [],
      categories: state.categories || []
    }));
  };

  const toast = (message) => {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('on');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('on'), 2400);
  };

  const keyFor = (item) => {
    if (!item) return '';
    if (item.id) return `id:${String(item.id)}`;
    if (item.category && item.month) return `budget:${String(item.category)}:${String(item.month)}`;
    if (item.category) return `category:${String(item.category)}:${String(item.type || 'expense')}`;
    if (item.name) return `name:${String(item.name)}`;
    return JSON.stringify(item);
  };

  const collectDelta = (previous, next) => {
    const result = { transactions: [], budgets: [], loans: [], categories: [] };
    ['transactions', 'budgets', 'loans', 'categories'].forEach((key) => {
      const prevMap = identityMap(previous[key], keyFor);
      const nextItems = Array.isArray(next[key]) ? next[key] : [];
      nextItems.forEach((item) => {
        const keyName = keyFor(item);
        const prevValue = prevMap.get(keyName);
        const currentValue = JSON.stringify(item);
        if (!prevValue || prevValue !== currentValue) result[key].push(item);
      });
    });
    return result;
  };

  const syncToGoogleSheets = async () => {
    const state = getState();
    const url = String((state.settings || {}).syncUrl || '').trim();
    if (!url) {
      toast('Add a Google Sheets sync URL in settings first.');
      return false;
    }

    const previous = getLastSyncState();
    const delta = collectDelta(previous, state);
    const hasData = Object.values(delta).some((items) => items.length > 0);
    if (!hasData) {
      toast('No new data to sync.');
      return true;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'appendDelta', ...delta, syncedAt: new Date().toISOString() })
      });
      if (!response.ok) throw new Error('sync request failed');
      setLastSyncState(state);
      toast('Synced new records.');
      return true;
    } catch (_) {
      toast('Sync failed. Check the Apps Script URL.');
      return false;
    }
  };

  const refreshDailyBudget = () => {
    const state = getState();
    const month = state.reportMonth || new Date().toISOString().slice(0, 7);
    const transactions = (state.transactions || []).filter((tx) => monthOf(tx.date) === month);
    const income = transactions.filter((tx) => String(tx.type).toLowerCase() === 'income').reduce((sum, tx) => sum + safeNumber(tx.amount), 0);
    const expense = transactions.filter((tx) => String(tx.type).toLowerCase() === 'expense').reduce((sum, tx) => sum + safeNumber(tx.amount), 0);
    const net = income - expense;
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = Math.max(1, lastDay - now.getDate() + 1);
    const daily = Math.max(0, net / remainingDays);

    const valueEl = document.getElementById('dailyBudgetValue');
    if (valueEl) valueEl.textContent = `${Math.round(daily).toLocaleString()} MMK`;

    const metaEl = document.getElementById('dailyBudgetMeta');
    if (metaEl) metaEl.textContent = `${remainingDays} days remaining · Net ${Math.round(net).toLocaleString()} MMK`;
  };

  const ensureSingleDateSelector = () => {
    const flush = ['homeMonthSelect', 'dashboardMonthSelect'];
    flush.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.closest('label')) el.closest('label').remove();
    });
  };

  const ensureSidebarToggle = () => {
    const app = document.querySelector('.app-layout');
    const sidebar = document.getElementById('sidebar');
    const mobileMenu = document.getElementById('mobileMenu');
    if (!app || !sidebar) return;

    const toggle = document.getElementById('sidebarMenuToggle');
    if (!toggle) {
      const button = document.createElement('button');
      button.id = 'sidebarMenuToggle';
      button.type = 'button';
      button.className = 'sidebar-menu-toggle';
      button.setAttribute('aria-label', 'Show navigation menu');
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = '<span aria-hidden="true">☰</span><span>Show menu</span>';
      const footer = document.querySelector('.sidebar-footer') || sidebar.appendChild(document.createElement('div'));
      footer.classList.add('sidebar-footer');
      footer.insertBefore(button, footer.firstChild);
      button.addEventListener('click', () => {
        const collapsed = !app.classList.contains('sidebar-collapsed');
        app.classList.toggle('sidebar-collapsed', collapsed);
        sidebar.classList.toggle('sidebar-collapsed', collapsed);
        button.setAttribute('aria-expanded', String(!collapsed));
        const label = button.querySelector('span:last-child');
        if (label) label.textContent = collapsed ? 'Hide menu' : 'Show menu';
        if (mobileMenu) {
          mobileMenu.setAttribute('aria-expanded', String(!collapsed));
          mobileMenu.setAttribute('aria-label', collapsed ? 'Hide navigation menu' : 'Show navigation menu');
        }
      });
    }

    app.classList.add('sidebar-collapsed');
    sidebar.classList.add('sidebar-collapsed');
    const button = document.getElementById('sidebarMenuToggle');
    const label = button?.querySelector('span:last-child');
    if (label) label.textContent = 'Show menu';
    if (mobileMenu) {
      mobileMenu.setAttribute('aria-expanded', 'false');
      mobileMenu.setAttribute('aria-label', 'Show navigation menu');
    }

    if (mobileMenu) {
      mobileMenu.addEventListener('click', () => {
        const collapsed = app.classList.contains('sidebar-collapsed');
        app.classList.toggle('sidebar-collapsed', !collapsed);
        sidebar.classList.toggle('sidebar-collapsed', !collapsed);
        const currentState = !app.classList.contains('sidebar-collapsed');
        if (button) {
          button.setAttribute('aria-expanded', String(currentState));
          const labelText = button.querySelector('span:last-child');
          if (labelText) labelText.textContent = currentState ? 'Hide menu' : 'Show menu';
        }
      });
    }

    const style = document.createElement('style');
    style.textContent = `
      .app-layout.sidebar-collapsed .sidebar { width: 78px; padding-inline: 10px; }
      .app-layout.sidebar-collapsed .brand > div,
      .app-layout.sidebar-collapsed .nav-item span:last-child,
      .app-layout.sidebar-collapsed .theme-button span:last-child { display: none; }
      .app-layout.sidebar-collapsed .nav-item,
      .app-layout.sidebar-collapsed .theme-button,
      .app-layout.sidebar-collapsed .sidebar-menu-toggle { justify-content: center; }
      .sidebar-menu-toggle { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-solid); color: var(--text); font-weight: 700; }
      @media (max-width: 760px) { .app-layout.sidebar-collapsed .sidebar { width: 100%; } .app-layout.sidebar-collapsed .brand > div, .app-layout.sidebar-collapsed .nav-item span:last-child, .app-layout.sidebar-collapsed .theme-button span:last-child { display: block; } }
    `;
    document.head.appendChild(style);
  };

  const attachSyncHooks = () => {
    const triggerSync = () => {
      const form = document.activeElement && document.activeElement.form;
      if (form && ['transactionForm', 'budgetForm', 'categoryForm'].includes(form.id)) {
        syncToGoogleSheets();
      }
    };

    document.addEventListener('submit', (event) => {
      if (!event.target || !['transactionForm', 'budgetForm', 'categoryForm'].includes(event.target.id)) return;
      setTimeout(() => {
        syncToGoogleSheets();
      }, 120);
    });

    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-action="sync-google"]')) syncToGoogleSheets();
      if (event.target.closest('[data-action="theme-toggle"]')) triggerSync();
    });
  };

  const init = () => {
    ensureSingleDateSelector();
    ensureSidebarToggle();
    refreshDailyBudget();
    attachSyncHooks();
    window.syncToGoogleSheets = syncToGoogleSheets;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
