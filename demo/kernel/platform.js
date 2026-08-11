// ==========================================
// PLATFORM / DATA LAYER
// The app's data + platform API: records in IndexedDB, config in localStorage,
// cloud sync via Supabase (pwa-sync.js). Exposed as window.platform; the
// historical name window.electronAPI is kept as an alias for older modules.
// (Formerly demo-shim.js — it was never demo-only; it's the production layer.)
// Must load AFTER idb-storage.js and pwa-sync.js, BEFORE all other scripts.
// ==========================================
(function() {
  // See idb-storage.js: non-production builds get an isolated storage namespace.
  const PREFIX = 'dhemr' + ((typeof window !== 'undefined' && window.DH_STORAGE_SUFFIX) || '') + '_';
  const IDB_RECORDS_KEY = PREFIX + 'records';

  // --- localStorage helpers for small config data ---
  function lsGet(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  }

  function lsSet(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch(e) { console.warn('ls write fail', e); }
  }

  // --- IndexedDB helpers for records (large data) ---
  let _recordsCache = null;
  let _recordsCacheReady = false;
  // Did the last records read genuinely succeed? Used to refuse a destructive
  // wholesale overwrite when the store was merely unreadable (not truly empty).
  let _lastLoadOk = false;
  /**
   * Set when a mirror recovery was refused because the mirror is behind.
   * Null at all other times. The UI reads this to explain the blocked state and
   * to offer adoptMirror() as a deliberate, human-confirmed choice.
   */
  let _mirrorRefusal = null;

  // Single-writer queue. EVERY read-modify-write of the records blob — save,
  // delete, and cloud sync push/pull — chains through this promise, so two
  // writers can never each read the array, mutate their own copy, and clobber
  // one another on write-back (the "record saved during sync vanishes" bug).
  let _recordsLock = Promise.resolve();
  function withRecordsLock(fn) {
    const run = _recordsLock.then(fn, fn);
    _recordsLock = run.then(() => {}, () => {});
    return run;
  }

  async function idbGetRecords() {
    if (_recordsCacheReady && _recordsCache !== null) {
      return _recordsCache;
    }
    let data = null;
    let loadOk = false;
    try {
      data = await idbStore.getItem(IDB_RECORDS_KEY);
      loadOk = true; // a resolved read is authoritative, even if empty (null)
    } catch (e) {
      console.warn('[platform] idb read failed', e);
      loadOk = false; // could NOT read — must not be treated as "empty"
    }
    let arr = Array.isArray(data) ? data : [];
    // Safety net: if IndexedDB came back empty but a localStorage mirror has
    // data (e.g. iOS cleared IDB but not localStorage), recover from the mirror.
    //
    // But ONLY if the mirror is actually current. idbSetRecords sets
    // records_mirror_stale whenever the mirror write fails, which is what
    // happens on every save once the array outgrows the ~5MB localStorage
    // quota. Adopting a stale mirror here is not a recovery, it is the
    // mechanism of permanent loss: the app would silently drop back to a
    // months-old truncated dataset and then write it back over IndexedDB as
    // authoritative. records_meta is written in the same step as a SUCCESSFUL
    // mirror write, so meta.count and mirror.length agree exactly when fresh.
    _mirrorRefusal = null;
    if (arr.length === 0) {
      const mirror = lsGet('records', null);
      if (Array.isArray(mirror) && mirror.length > 0) {
        const stale = (() => { try { return localStorage.getItem(PREFIX + 'records_mirror_stale') === '1'; } catch { return true; } })();
        const meta = lsGet('records_meta', null);
        const expected = meta && typeof meta.count === 'number' ? meta.count : null;
        // A mirror from a build that predates the sidecar has no expected
        // count. Allow it: that device never had the quota failure mode.
        const short = expected !== null && mirror.length < expected;
        if (stale || short) {
          console.error('[platform] REFUSED to recover from a stale localStorage mirror',
            { mirrorCount: mirror.length, expected, stale });
          _mirrorRefusal = {
            mirrorCount: mirror.length,
            expectedCount: expected,
            stale,
            mirrorAt: (meta && meta.at) || null,
            newest: (meta && meta.newest) || null
          };
          // Leave the store looking UNREADABLE, not empty. The IndexedDB read
          // itself resolved (iOS evicted the data rather than erroring), so
          // loadOk would otherwise be true and the wipe guard in saveRecord
          // would not fire - the clinician would see zero records and be free
          // to save over the only remaining copy.
          loadOk = false;
        } else {
          console.warn('[platform] recovered', mirror.length, 'records from localStorage mirror');
          arr = mirror;
          loadOk = true;
          try { await idbStore.setItem(IDB_RECORDS_KEY, arr); } catch {}
        }
      }
    }
    _recordsCache = arr;
    _recordsCacheReady = true;
    _lastLoadOk = loadOk;
    return _recordsCache;
  }

  // Write the full records array. THROWS if BOTH IndexedDB and the localStorage
  // mirror fail, so a storage error surfaces to the clinician instead of the app
  // silently pretending the save worked. Also writes a small "sidecar" so a
  // later recovery can tell whether the mirror is fresh or stale.
  async function idbSetRecords(allRecords) {
    _recordsCache = allRecords;
    _recordsCacheReady = true;
    _lastLoadOk = true; // we now hold an authoritative in-memory copy
    let idbOk = false, mirrorOk = false;
    try { await idbStore.setItem(IDB_RECORDS_KEY, allRecords); idbOk = true; }
    catch (e) { console.warn('[platform] idb write failed', e); }
    try {
      localStorage.setItem(PREFIX + 'records', JSON.stringify(allRecords));
      mirrorOk = true;
    } catch (e) { console.warn('[platform] localStorage mirror write failed (quota?)', e); }
    // Mirror freshness sidecar + staleness flag, so recovery never silently
    // adopts an out-of-date mirror.
    try {
      if (mirrorOk) {
        let newest = '';
        for (const r of allRecords) { if (r && r.savedAt && r.savedAt > newest) newest = r.savedAt; }
        localStorage.setItem(PREFIX + 'records_meta', JSON.stringify({ count: allRecords.length, newest, at: new Date().toISOString() }));
        localStorage.removeItem(PREFIX + 'records_mirror_stale');
      } else {
        localStorage.setItem(PREFIX + 'records_mirror_stale', '1');
      }
    } catch {}
    if (!idbOk && !mirrorOk) {
      throw new Error('Could not save to this device’s storage — both the database and the local backup failed to write. The device may be out of space or in a private-browsing window. Your entry was NOT saved.');
    }
  }

  async function getRecords() {
    const all = await idbGetRecords();
    return all.filter(r => !r.deleted);
  }

  async function getAllRecords() {
    return await idbGetRecords();
  }

  // Invalidate cache so next getRecords() re-reads from IDB
  function invalidateCache() {
    _recordsCacheReady = false;
    _recordsCache = null;
  }

  // One-time migration from localStorage to IndexedDB
  async function migrateRecordsToIDB() {
    const migrated = lsGet('_idb_migrated', false);
    if (migrated) return;
    const lsRecords = lsGet('records', null);
    if (lsRecords && Array.isArray(lsRecords) && lsRecords.length > 0) {
      console.log('[pwa-shim] Migrating', lsRecords.length, 'records from localStorage to IndexedDB');
      await idbSetRecords(lsRecords);
      lsSet('_idb_migrated', true);
    } else {
      lsSet('_idb_migrated', true);
    }
  }

  // Run migration immediately
  migrateRecordsToIDB().catch(e => console.warn('[pwa-shim] migration error', e));

  // --- Sync callbacks registry ---
  window._pwaSyncCallbacks = {
    onRecordsUpdated: null,
    onConfigUpdated: null
  };

  // Track registered event handlers
  let _onRecordsUpdatedCb = null;
  let _onConfigUpdatedCb = null;
  let _onSyncStatusCb = null;

  window.electronAPI = {
    // Records — now async with IndexedDB + sync_version tracking
    getRecords: () => getRecords(),
    saveRecord: async (record) => withRecordsLock(async () => {
      const all = await getAllRecords();
      // Wipe guard: if the existing records could NOT be read and the working
      // set is empty, refuse to overwrite the whole store with a tiny array —
      // that is exactly how an unreadable-but-present dataset gets destroyed.
      if (!_lastLoadOk && all.length === 0) {
        throw new Error('Your existing records could not be read from this device right now, so saving was blocked to avoid overwriting them. Please close and reopen the app; if it keeps happening, restart the device before entering more data.');
      }
      const idx = all.findIndex(r => r.id === record.id);
      record.savedAt = new Date().toISOString();
      // Use the registered device ID; never fall back to a shared default
      // (would break multi-device sync because every fresh PWA would
      // upload records with the same device_id).
      const resolvedDeviceId =
        record.deviceId ||
        (typeof currentDeviceId !== 'undefined' && currentDeviceId ? currentDeviceId : null);
      if (!resolvedDeviceId) {
        // Should not happen post-wizard, but if a record is somehow saved
        // before registration, mint a one-off id rather than collide on a default.
        record.deviceId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('pwa-' + Date.now());
        console.warn('[pwa-shim] saveRecord called before device registered; assigned ephemeral id', record.deviceId);
      } else {
        record.deviceId = resolvedDeviceId;
      }

      if (idx >= 0) {
        // Increment sync_version on each save (marks as needing sync)
        const prevVersion = all[idx].sync_version || 1;
        all[idx] = { ...all[idx], ...record, sync_version: prevVersion + 1 };
      } else {
        // New record: start at sync_version 1, synced_version 0
        record.sync_version = 1;
        record.synced_version = 0;
        all.push(record);
      }
      await idbSetRecords(all);
      return getRecords();
    }),
    deleteRecord: async (id) => withRecordsLock(async () => {
      const all = await getAllRecords();
      const idx = all.findIndex(r => r.id === id);
      if (idx >= 0) {
        all[idx].deleted = true;
        all[idx].sync_version = (all[idx].sync_version || 1) + 1;
      }
      await idbSetRecords(all);
      return getRecords();
    }),

    // Config — localStorage is fine for small config data
    getSites: () => Promise.resolve(lsGet('sites', null)),
    saveSites: (v) => { lsSet('sites', v); },
    getProviders: () => Promise.resolve(lsGet('providers', null)),
    saveProviders: (v) => { lsSet('providers', v); },
    getFormulary: () => Promise.resolve(lsGet('formulary', null)),
    saveFormulary: (v) => { lsSet('formulary', v); },
    getRxPresets: () => Promise.resolve(lsGet('rxPresets', null)),
    saveRxPresets: (v) => { lsSet('rxPresets', v); },
    getProcedures: () => Promise.resolve(lsGet('procedures', null)),
    saveProcedures: (v) => { lsSet('procedures', v); },
    getReferralTypes: () => Promise.resolve(lsGet('referralTypes', null)),
    saveReferralTypes: (v) => { lsSet('referralTypes', v); },
    getCustomDxPresets: () => Promise.resolve(lsGet('customDxPresets', null)),
    saveCustomDxPresets: (v) => { lsSet('customDxPresets', v); },
    getComplaints: () => Promise.resolve(lsGet('complaints', null)),
    saveComplaints: (v) => { lsSet('complaints', v); },
    getCustomLabTests: () => Promise.resolve(lsGet('customLabTests', [])),
    saveCustomLabTests: (v) => { lsSet('customLabTests', v); },
    getHiddenPresets: () => Promise.resolve(lsGet('hiddenPresets', null)),
    saveHiddenPresets: (v) => { lsSet('hiddenPresets', v); },
    getFormSchema: () => Promise.resolve(lsGet('formSchema', null)),
    saveFormSchema: (v) => { lsSet('formSchema', v); },
    getFormTemplates: () => Promise.resolve(lsGet('formTemplates', null)),
    saveFormTemplates: (v) => { lsSet('formTemplates', v); },

    // Device — now backed by pwaSync when available
    // Returns null (not a hardcoded default) when no device has been
    // registered yet, so the launch flow can show the sign-in screen
    // and avoid all PWA installs sharing the same device_id.
    getDeviceId: async () => {
      if (typeof pwaSync !== 'undefined') {
        const id = await pwaSync.idbSettingGet('deviceId');
        if (id) return id;
      }
      const stored = lsGet('setting_deviceId', null);
      if (stored && stored !== 'pwa-device-001' && stored !== 'demo-device-001') {
        return stored;
      }
      return null;
    },
    registerDevice: async (name) => {
      if (typeof pwaSync !== 'undefined') {
        const id = await pwaSync.registerDevice(name);
        return id;
      }
      // Fallback: generate local UUID
      const id = crypto.randomUUID();
      lsSet('setting_deviceId', id);
      lsSet('setting_deviceName', name);
      return id;
    },
    getDeviceRole: async () => {
      if (typeof pwaSync !== 'undefined') {
        const role = await pwaSync.idbSettingGet('deviceRole');
        if (role) return role;
      }
      return lsGet('setting_deviceRole', 'standard');
    },
    setDeviceRole: async (role) => {
      if (typeof pwaSync !== 'undefined') {
        await pwaSync.idbSettingSet('deviceRole', role);
      }
      lsSet('setting_deviceRole', role);
      // Update in cloud if connected
      const creds = typeof pwaSync !== 'undefined' ? pwaSync.getCredentials() : {};
      if (creds.url && creds.key && typeof currentDeviceId !== 'undefined' && currentDeviceId) {
        try {
          await fetch(`${creds.url}/rest/v1/devices?id=eq.${encodeURIComponent(currentDeviceId)}`, {
            method: 'PATCH',
            headers: {
              'apikey': creds.key,
              'Authorization': `Bearer ${creds.key}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: role })
          });
        } catch {}
      }
      return { ok: true };
    },
    setAdminPassword: (pw) => {
      // Store ONLY on this device. The admin password is NEVER synced to the
      // shared config table: that table is readable by every device (and anyone
      // holding the anon key), so syncing the password in plaintext gave no real
      // protection while leaking it fleet-wide. Real write-protection must be
      // enforced server-side (authenticated admin role) — see the review.
      lsSet('adminPassword', pw);
      return Promise.resolve({ ok: true });
    },
    claimAdmin: (pw) => {
      const stored = lsGet('adminPassword', '');
      if (!stored || pw === stored) return Promise.resolve({ ok: true });
      return Promise.resolve({ ok: false, error: 'Incorrect password' });
    },
    countRecordsByField: async (field, value) => {
      const recs = await getRecords();
      return recs.filter(r => r[field] === value).length;
    },
    getUnsyncedCount: async () => {
      if (typeof pwaSync !== 'undefined') {
        return await pwaSync.getUnsyncedCount();
      }
      return 0;
    },

    // Settings — use pwaSync IDB when available, fallback to localStorage
    getSetting: async (key) => {
      if (typeof pwaSync !== 'undefined') {
        const val = await pwaSync.idbSettingGet(key);
        if (val !== null && val !== undefined) return val;
      }
      return lsGet('setting_' + key, null);
    },
    setSetting: async (key, value) => {
      if (typeof pwaSync !== 'undefined') {
        await pwaSync.idbSettingSet(key, value);
      }
      lsSet('setting_' + key, value);
    },

    // Export
    exportCSV: (csv) => {
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'dh-emr-export.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      return Promise.resolve(true);
    },
    exportPDF: (html, name) => {
      try {
        const w = window.open('', '_blank');
        if (!w) {
          alert('Pop-up blocked. Please allow pop-ups for this site to export PDFs.');
          return Promise.resolve(false);
        }
        w.document.write('<html><head><title>' + (name || 'Export') + '</title></head><body>' + html + '</body></html>');
        w.document.close();
        setTimeout(() => w.print(), 500);
        return Promise.resolve(true);
      } catch (e) {
        console.error('exportPDF error:', e);
        return Promise.resolve(false);
      }
    },

    // Setup wizard — real implementation via pwaSync
    verifyTables: async (url, key) => {
      if (typeof pwaSync !== 'undefined') {
        return await pwaSync.verifyTables(url, key);
      }
      return { ok: true };
    },
    seedConfig: async (url, key) => {
      if (typeof pwaSync !== 'undefined') {
        return await pwaSync.seedConfig(url, key);
      }
      return { ok: true };
    },

    // Sync — real implementation via pwaSync
    syncGetStatus: async () => {
      if (typeof pwaSync !== 'undefined') {
        return pwaSync.getStatus();
      }
      return 'offline';
    },
    syncUpdateCredentials: async (url, key) => {
      if (typeof pwaSync !== 'undefined') {
        pwaSync.updateCredentials(url, key);
      }
    },
    syncNow: async () => {
      if (typeof pwaSync !== 'undefined') {
        await pwaSync.syncNow();
        // After sync, invalidate cache so records refresh
        invalidateCache();
      }
    },
    onSyncStatus: (cb) => {
      _onSyncStatusCb = cb;
      if (typeof pwaSync !== 'undefined') {
        pwaSync.onStatus(cb);
      }
    },

    // Menu events — wire up to sync callbacks
    onNewEncounter: () => {},
    onExportCSV: () => {},
    onRecordsRestored: () => {},
    onRecordsUpdated: (cb) => {
      _onRecordsUpdatedCb = cb;
      window._pwaSyncCallbacks.onRecordsUpdated = async () => {
        invalidateCache();
        if (cb) cb();
      };
    },
    onConfigUpdated: (cb) => {
      _onConfigUpdatedCb = cb;
      window._pwaSyncCallbacks.onConfigUpdated = () => {
        if (cb) cb();
      };
    },

    // Backup - no-ops for PWA
    backupSelectPath: () => {
      alert('Backup is not available in the PWA version. Data is stored locally on this device.');
      return Promise.resolve(null);
    },
    backupRun: () => Promise.resolve({ ok: true, time: new Date().toISOString() }),
    backupGetSettings: () => Promise.resolve({ path: '', autoBackup: false, lastBackup: '', lastBackupTime: '' }),
    backupSaveSettings: () => Promise.resolve(),
    backupRestartInterval: () => {},
    onBackupCompleted: () => {}
  };

  // Shared records writer for the sync engine, so cloud push/pull serialize on
  // the SAME single-writer queue as local saves (no clobbering) and keep the
  // in-memory cache + localStorage mirror consistent.
  window.platformRecords = {
    withLock: withRecordsLock,
    getAll: () => idbGetRecords(),
    setAll: (arr) => idbSetRecords(arr),
    invalidate: invalidateCache,

    /**
     * Details of a refused mirror recovery, or null.
     *
     * Non-null means: IndexedDB came back empty, a localStorage mirror exists,
     * and that mirror is provably behind. Saving is blocked by the wipe guard
     * until this is resolved. Call after a read.
     */
    mirrorRefusal: () => (_mirrorRefusal ? { ..._mirrorRefusal } : null),

    /**
     * Deliberately adopt the stale mirror anyway.
     *
     * The ONLY correct time to call this is after a human has been told exactly
     * how many records the mirror holds versus how many the device last had,
     * and has chosen it over losing everything. Restoring a backup file is
     * always the better option and should be offered first. Returns the number
     * of records adopted.
     */
    adoptMirror: async () => withRecordsLock(async () => {
      const mirror = lsGet('records', null);
      if (!Array.isArray(mirror) || mirror.length === 0) {
        throw new Error('There is no local backup copy on this device to recover from.');
      }
      console.warn('[platform] adopting stale mirror by explicit confirmation:', mirror.length, 'records');
      // Goes through idbSetRecords, so IndexedDB, the mirror, the sidecar and
      // the staleness flag all end up consistent with each other again.
      await idbSetRecords(mirror);
      _mirrorRefusal = null;
      return mirror.length;
    })
  };

  // Honest, current name for the data/platform layer. New code should use
  // window.platform; window.electronAPI is the legacy alias retained for the
  // existing call sites (migrate opportunistically, then drop the alias).
  window.platform = window.electronAPI;

  console.log('[platform] data layer ready (IndexedDB + Supabase sync) — window.platform (+ legacy window.electronAPI)');
})();
