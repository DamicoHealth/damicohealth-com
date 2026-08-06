// ==========================================
// SYNC UI — real sync status display for PWA
// ==========================================

const SYNC_STATUS_MAP = {
  disabled: { color: '#9ca3af', label: 'Disabled', title: 'Cloud sync disabled' },
  idle:     { color: '#6b7280', label: 'Connected', title: 'Cloud connected — not synced yet this session' },
  offline:  { color: '#9ca3af', label: 'Offline', title: 'Offline — records are saved on this device and will sync when you reconnect' },
  synced:   { color: '#22c55e', label: 'Connected', title: 'All records synced' },
  syncing:  { color: '#f59e0b', label: 'Syncing...', title: 'Syncing records...' },
  pending:  { color: '#f59e0b', label: 'Pending', title: 'Changes are waiting to sync' },
  error:    { color: '#ef4444', label: 'Error', title: 'Sync error — tap to retry, or check your connection/credentials' }
};

let _lastSyncTime = null;
let _syncTimeInterval = null;

function formatTimeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Last sync: just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Last sync: ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last sync: ${hours}h ago`;
  return `Last sync: ${Math.floor(hours / 24)}d ago`;
}

async function updateSyncPendingCount() {
  try {
    const count = await window.electronAPI.getUnsyncedCount();
    const el = document.getElementById('syncPendingLabel');
    if (el) {
      el.textContent = count > 0 ? `${count} pending` : '';
    }
  } catch {}
}

function updateSyncTimeLabel() {
  const el = document.getElementById('syncTimeLabel');
  if (el) {
    el.textContent = formatTimeAgo(_lastSyncTime);
  }
}

function updateSyncUI(status) {
  // Honest offline state: if the device is offline, say so instead of showing a
  // green "Connected" — regardless of whether credentials exist.
  if (status !== 'disabled' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    status = 'offline';
  }
  const info = SYNC_STATUS_MAP[status] || SYNC_STATUS_MAP.disabled;
  const dot = document.getElementById('syncDot');
  const indicator = document.getElementById('syncIndicator');
  const label = document.getElementById('syncStatusLabel');
  if (dot) dot.style.backgroundColor = info.color;
  if (indicator) indicator.title = info.title;
  if (label) {
    label.textContent = info.label;
    label.style.color = info.color;
  }

  // ONLY a genuinely-completed sync stamps the "last sync" time. Previously
  // merely having credentials set status 'synced' and faked "Last sync: just
  // now" on every launch, overwriting the real timestamp.
  if (status === 'synced') {
    _lastSyncTime = new Date();
    try { localStorage.setItem(('dhemr' + (window.DH_STORAGE_SUFFIX || '') + '_lastSyncTime'), _lastSyncTime.toISOString()); } catch (e) {}
    updateSyncTimeLabel();
  }

  // Update pending count on each status change
  updateSyncPendingCount();

  // Show config notice when cloud is connected
  const notice = document.getElementById('configNotice');
  if (notice) notice.style.display = (status === 'synced' || status === 'syncing' || status === 'idle') ? '' : 'none';
}

async function triggerTopbarSync() {
  if (typeof isStandaloneMode === 'function' && isStandaloneMode()) return;
  // If the browser knows it's offline, give immediate feedback instead of
  // letting fetch silently fail.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    alert('You appear to be offline. Records are saved locally and will sync once you reconnect.');
    return;
  }
  try {
    await window.electronAPI.syncNow();
  } catch (e) {
    console.warn('[sync-ui] syncNow failed', e);
  }
  // Refresh records after sync so the records list shows pulled rows
  try {
    if (typeof records !== 'undefined') {
      records = await window.electronAPI.getRecords();
      if (typeof renderRecords === 'function') renderRecords();
      if (typeof renderStats === 'function') renderStats();
      if (typeof renderDashboard === 'function') renderDashboard();
    }
  } catch (e) { console.warn('[sync-ui] refresh after sync failed', e); }
  updateSyncPendingCount();
}

// ---------- AUTO-SYNC (Phase 4) ----------
// Sync automatically when online: on reconnect, on app foreground, shortly
// after a save/delete, and on a gentle periodic backstop. Stays offline-first
// (silent no-op when offline); the manual Sync button still works.
const AUTO_SYNC_INTERVAL_MS = 120000; // 2-min backstop while the app is open
let _autoSyncTimer = null;
let _autoSyncDebounce = null;
let _autoSyncListenersBound = false;

async function refreshAfterSync() {
  try {
    if (typeof records !== 'undefined') {
      records = await window.electronAPI.getRecords();
      if (typeof renderRecords === 'function') renderRecords();
      if (typeof renderStats === 'function') renderStats();
      if (typeof renderDashboard === 'function') renderDashboard();
    }
  } catch (e) { console.warn('[sync-ui] refresh after sync failed', e); }
  updateSyncPendingCount();
}

async function autoSync(reason) {
  if (typeof isStandaloneMode === 'function' && isStandaloneMode()) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return; // silent when offline
  try {
    if ((await window.electronAPI.syncGetStatus()) === 'syncing') return;
  } catch {}
  try {
    await window.electronAPI.syncNow(); // syncNow also guards against re-entry
    await refreshAfterSync();
  } catch (e) { console.warn('[sync-ui] autoSync(' + reason + ') failed', e); }
}

// Debounced trigger; delay>0 coalesces bursts (e.g. several quick saves).
function scheduleAutoSync(reason, delay = 0) {
  if (delay > 0) {
    clearTimeout(_autoSyncDebounce);
    _autoSyncDebounce = setTimeout(() => autoSync(reason), delay);
  } else {
    autoSync(reason);
  }
}

function startAutoSync() {
  if (typeof isStandaloneMode === 'function' && isStandaloneMode()) return;
  if (_autoSyncTimer) clearInterval(_autoSyncTimer);
  _autoSyncTimer = setInterval(() => scheduleAutoSync('interval'), AUTO_SYNC_INTERVAL_MS);
  if (!_autoSyncListenersBound) {
    _autoSyncListenersBound = true;
    window.addEventListener('online', () => scheduleAutoSync('online'));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleAutoSync('foreground'); });
  }
  scheduleAutoSync('startup', 1500);
}

async function initSyncUI() {
  // Skip sync UI initialization in standalone mode
  if (isStandaloneMode()) {
    const indicator = document.getElementById('syncIndicator');
    if (indicator) indicator.style.display = 'none';
    return;
  }

  // Show sync indicator
  const indicator = document.getElementById('syncIndicator');
  if (indicator) indicator.style.display = '';

  // Topbar sync indicator is clickable — tap to sync now. Wire once.
  if (indicator && !indicator.dataset.syncBound) {
    indicator.dataset.syncBound = '1';
    indicator.addEventListener('click', triggerTopbarSync);
    indicator.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerTopbarSync(); }
    });
  }

  // Load saved credentials into fields (if they exist on current screen)
  const url = await window.electronAPI.getSetting('supabaseUrl');
  const key = await window.electronAPI.getSetting('supabaseKey');
  const urlEl = document.getElementById('syncUrl');
  const keyEl = document.getElementById('syncKey');
  if (urlEl && url) urlEl.value = url;
  if (keyEl && key) keyEl.value = key;

  // Restore last sync time across reloads
  try {
    const stored = localStorage.getItem(('dhemr' + (window.DH_STORAGE_SUFFIX || '') + '_lastSyncTime'));
    if (stored) {
      const d = new Date(stored);
      if (!isNaN(d.getTime())) _lastSyncTime = d;
    }
  } catch (e) {}

  // Get initial status
  const status = await window.electronAPI.syncGetStatus();
  updateSyncUI(status);
  updateSyncTimeLabel();

  // Update pending count initially
  updateSyncPendingCount();

  // Update the time label every 30 seconds
  if (_syncTimeInterval) clearInterval(_syncTimeInterval);
  _syncTimeInterval = setInterval(updateSyncTimeLabel, 30000);

  // Listen for status changes
  window.electronAPI.onSyncStatus(updateSyncUI);

  // Reflect connectivity changes in the indicator immediately (honest offline).
  window.addEventListener('offline', () => updateSyncUI('offline'));
  window.addEventListener('online', async () => {
    try { updateSyncUI(await window.electronAPI.syncGetStatus()); } catch {}
  });

  // Begin connectivity-aware auto-sync (offline-first; manual button still works)
  startAutoSync();

  // Save & Connect button (if it exists)
  const btnSave = document.getElementById('btnSaveSync');
  if (btnSave) {
    const newBtn = btnSave.cloneNode(true);
    btnSave.parentNode.replaceChild(newBtn, btnSave);
    newBtn.addEventListener('click', async () => {
      const newUrl = document.getElementById('syncUrl').value.trim();
      const newKey = document.getElementById('syncKey').value.trim();
      await window.electronAPI.syncUpdateCredentials(newUrl, newKey);
    });
  }

  // Sync Now button (if it exists)
  const btnSync = document.getElementById('btnSyncNow');
  if (btnSync) {
    const newBtn = btnSync.cloneNode(true);
    btnSync.parentNode.replaceChild(newBtn, btnSync);
    newBtn.addEventListener('click', async () => {
      await window.electronAPI.syncNow();
      // Refresh records after sync
      if (typeof records !== 'undefined') {
        records = await window.electronAPI.getRecords();
        if (typeof renderRecords === 'function') renderRecords();
        if (typeof renderStats === 'function') renderStats();
        if (typeof renderDashboard === 'function') renderDashboard();
      }
    });
  }
}
