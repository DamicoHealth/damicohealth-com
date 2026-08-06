// ==========================================
// BACKUP & RESTORE — one-tap local data safety
// ==========================================
// Download all records + (non-sensitive) settings to a JSON file, and restore
// from one. This is the safety net for OFFLINE-ONLY devices (their only copy)
// and a no-cloud way to move data between devices. Restore MERGES by record id
// (adds/updates; never deletes) so it can't wipe existing data.

(function () {
  const LS_PREFIX = 'dhemr' + ((typeof window !== 'undefined' && window.DH_STORAGE_SUFFIX) || '') + '_';
  const RECORDS_KEY = LS_PREFIX + 'records';
  // Never put device identity, credentials, or passwords into a backup file.
  const SENSITIVE = /deviceId|supabase|password|adminPassword|_idb_migrated/i;

  async function readRawRecords() {
    try {
      const v = await idbStore.getItem(RECORDS_KEY);
      if (Array.isArray(v)) return v;
    } catch {}
    try { return JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]'); } catch { return []; }
  }

  async function gather() {
    const records = await readRawRecords();
    const config = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(LS_PREFIX) || k === RECORDS_KEY || SENSITIVE.test(k)) continue;
      try { config[k] = JSON.parse(localStorage.getItem(k)); } catch { config[k] = localStorage.getItem(k); }
    }
    return { app: 'DH Field EMR', backupVersion: 1, exportedAt: new Date().toISOString(), recordCount: records.length, records, config };
  }

  async function downloadBackup() {
    const data = await gather();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dh-emr-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return data.recordCount;
  }

  async function restoreFromData(data) {
    if (!data || !Array.isArray(data.records)) throw new Error('Not a valid DH Field EMR backup file.');
    const existing = await readRawRecords();
    const byId = new Map(existing.map((r) => [r.id, r]));
    let added = 0, updated = 0;
    for (const r of data.records) {
      if (!r || !r.id) continue;
      byId.has(r.id) ? updated++ : added++;
      byId.set(r.id, r);
    }
    const merged = [...byId.values()];
    await idbStore.setItem(RECORDS_KEY, merged);
    // Restore non-sensitive config (templates, formulary, sites, presets, etc.)
    if (data.config && typeof data.config === 'object') {
      for (const k of Object.keys(data.config)) {
        if (!k.startsWith(LS_PREFIX) || k === RECORDS_KEY || SENSITIVE.test(k)) continue;
        try { localStorage.setItem(k, typeof data.config[k] === 'string' ? data.config[k] : JSON.stringify(data.config[k])); } catch {}
      }
    }
    return { added, updated, total: merged.length };
  }

  async function restoreFromFile(file) {
    const text = await file.text();
    let data; try { data = JSON.parse(text); } catch { throw new Error('That file is not readable JSON.'); }
    return restoreFromData(data);
  }

  window.Backup = { gather, downloadBackup, restoreFromData, restoreFromFile };
})();

// --- Global handlers wired from the Admin screen ---
async function doDownloadBackup() {
  const el = document.getElementById('backupStatusMsg');
  try {
    const n = await window.Backup.downloadBackup();
    if (el) { el.textContent = '✅ Backup downloaded (' + n + ' records). Keep it somewhere safe.'; el.style.color = 'var(--green)'; }
  } catch (e) { if (el) { el.textContent = 'Backup failed: ' + e.message; el.style.color = 'var(--red)'; } else alert('Backup failed: ' + e.message); }
}

async function doRestoreBackup(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  if (!confirm('Restore from "' + file.name + '"?\n\nThis MERGES the backup into this device (adds/updates records — nothing is deleted). The app will reload afterward.')) { input.value = ''; return; }
  try {
    const r = await window.Backup.restoreFromFile(file);
    alert('✅ Restored: ' + r.added + ' added, ' + r.updated + ' updated (' + r.total + ' total records). Reloading…');
    location.reload();
  } catch (e) { alert('Restore failed: ' + e.message); input.value = ''; }
}
