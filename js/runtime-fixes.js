(() => {
  'use strict';

  const STORAGE_KEY = 'moneyflow-v3';
  const SYNC_STATE_KEY = 'moneyflow-sync-state';
  let syncInFlight = false;
  let lastSyncAt = 0;

  const readState = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) { return {}; } };
  const toast = (message, tone = '') => {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
    node.classList.add('on');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('on'), 2800);
  };
  const status = (message, tone = 'idle') => {
    const node = document.getElementById('syncStatus');
    if (node) { node.textContent = message; node.dataset.status = tone; }
  };
  const key = (item) => String(item?.id || `${item?.category || item?.name || ''}:${item?.month || ''}:${item?.type || ''}`);
  const snapshot = (state) => {
    const result = {};
    ['transactions', 'budgets', 'loans', 'categories'].forEach((name) => {
      result[name] = Object.fromEntries((Array.isArray(state[name]) ? state[name] : []).map((item) => [key(item), JSON.stringify(item)]));
    });
    return result;
  };
  const delta = (before, after) => {
    const result = { transactions: [], budgets: [], loans: [], categories: [] };
    ['transactions', 'budgets', 'loans', 'categories'].forEach((name) => {
      const previous = before[name] || {};
      (Array.isArray(after[name]) ? after[name] : []).forEach((item) => {
        if (previous[key(item)] !== JSON.stringify(item)) result[name].push(item);
      });
    });
    return result;
  };
  const getSyncUrl = () => String(readState().settings?.syncUrl || '').trim();
  const getPrevious = () => { try { return JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || '{}'); } catch (_) { return {}; } };
  const sync = async (reason = 'manual') => {
    if (syncInFlight) return false;
    const url = getSyncUrl();
    if (!url) { status('Sync URL not configured', 'warning'); if (reason === 'manual') toast('Add a Google Sheets sync URL in Settings.', 'warning'); return false; }
    const state = readState();
    const changes = delta(getPrevious(), state);
    if (!Object.values(changes).some((items) => items.length)) { status('Up to date', 'success'); if (reason === 'manual') toast('Everything is already synced.', 'success'); return true; }
    syncInFlight = true; status('Syncing new records…', 'loading');
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'appendDelta', ...changes, syncedAt: new Date().toISOString() }) });
      if (!response.ok) throw new Error('sync request failed');
      localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(snapshot(state)));
      lastSyncAt = Date.now(); status(`Synced just now · ${Object.values(changes).reduce((sum, items) => sum + items.length, 0)} new`, 'success');
      toast('New data synced successfully.', 'success');
      return true;
    } catch (_) {
      status('Sync failed · retry available', 'error');
      toast('Saved locally. Sync will retry when available.', 'error');
      return false;
    } finally { syncInFlight = false; }
  };
  const updateDailyBudget = () => {
    const state = readState(); const month = state.reportMonth || new Date().toISOString().slice(0, 7);
    const items = (state.transactions || []).filter((item) => String(item.date || '').slice(0, 7) === month);
    const income = items.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expense = items.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const today = new Date(); const days = Math.max(1, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1);
    const value = Math.max(0, (income - expense) / days);
    const node = document.getElementById('dailyBudgetValue'); if (node) node.textContent = `${Math.round(value).toLocaleString()} MMK`;
    const meta = document.getElementById('dailyBudgetMeta'); if (meta) meta.textContent = `${days} days remaining · Net ${Math.round(income - expense).toLocaleString()} MMK`;
  };
  const init = () => {
    updateDailyBudget();
    document.getElementById('syncStatus')?.setAttribute('aria-live', 'polite');
    document.addEventListener('submit', (event) => {
      if (!['transactionForm', 'budgetForm', 'categoryForm'].includes(event.target?.id)) return;
      setTimeout(() => sync('save'), 180);
    });
    document.addEventListener('click', (event) => { if (event.target.closest('[data-action="sync-google"]')) sync('manual'); });
    document.addEventListener('change', (event) => { if (event.target.matches('#syncUrl')) status(getSyncUrl() ? 'Ready to sync' : 'Sync URL not configured', getSyncUrl() ? 'idle' : 'warning'); });
    window.addEventListener('storage', updateDailyBudget);
    status(getSyncUrl() ? 'Ready to sync' : 'Sync URL not configured', getSyncUrl() ? 'idle' : 'warning');
    window.syncToGoogleSheets = sync;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
