// ==========================================
// PWA SYNC ENGINE - Supabase cloud sync for IndexedDB
// Replicates desktop sync.js logic using browser fetch()
// ==========================================
const pwaSync = (function() {
  // See idb-storage.js: non-production builds get an isolated storage namespace.
  const PREFIX = 'dhemr' + ((typeof window !== 'undefined' && window.DH_STORAGE_SUFFIX) || '') + '_';
  const IDB_RECORDS_KEY = PREFIX + 'records';

  let syncStatus = 'disabled'; // disabled | syncing | synced | error
  let supabaseUrl = null;
  let supabaseKey = null;
  let _statusCallbacks = [];

  /**
   * Headers for a Supabase REST call.
   *
   * Two kinds of key exist. The legacy anon key is a JWT and PostgREST accepts
   * it in either header. The current publishable key (sb_publishable_...) is
   * NOT a JWT, and sending it as `Authorization: Bearer` makes PostgREST try to
   * parse it as one and reject the request. Only the legacy key gets a Bearer
   * header, so the same code works with either.
   *
   * This matters beyond tidiness: rotating a leaked legacy key means rotating
   * the project's JWT secret, which invalidates service_role at the same time.
   * Moving to a publishable key lets a compromised key be deleted on its own.
   */
  function supabaseHeaders(key, extra) {
    const k = key || supabaseKey;
    const headers = { 'apikey': k, ...(extra || {}) };
    // A JWT is three dot-separated base64url segments. Publishable and secret
    // keys are prefixed instead, and must not be sent as a bearer token.
    if (k && !/^sb_(publishable|secret)_/.test(k)) headers['Authorization'] = `Bearer ${k}`;
    return headers;
  }

  function supabaseFetch(url, options = {}) {
    return fetch(url, { ...options, headers: supabaseHeaders(supabaseKey, options.headers) });
  }

  async function fetchWithRetry(url, options, maxRetries = 3) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await supabaseFetch(url, options);
        if (res.ok) return res;
        if (res.status >= 400 && res.status < 500 && res.status !== 429) return res;
        lastError = new Error(`HTTP ${res.status}`);
      } catch (err) {
        lastError = err;
      }
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw lastError;
  }

  function setStatus(status) {
    syncStatus = status;
    _statusCallbacks.forEach(cb => {
      try { cb(status); } catch {}
    });
  }

  function onStatus(cb) {
    _statusCallbacks.push(cb);
  }

  function getStatus() {
    return syncStatus;
  }

  async function init() {
    const url = await idbSettingGet('supabaseUrl');
    const key = await idbSettingGet('supabaseKey');
    const standalone = await idbSettingGet('standaloneMode');
    if (standalone === 'true') return;
    if (url && key) {
      supabaseUrl = url;
      supabaseKey = key;
      // 'idle' = connected but not yet synced this session. Do NOT claim 'synced'
      // here - that faked a "Last sync: just now" on every launch, even offline.
      setStatus('idle');
    }
  }

  function updateCredentials(url, key) {
    supabaseUrl = url;
    supabaseKey = key;
    idbSettingSet('supabaseUrl', url);
    idbSettingSet('supabaseKey', key);
    if (url && key) {
      setStatus('idle');
    } else {
      setStatus('disabled');
    }
  }

  function getCredentials() {
    return { url: supabaseUrl, key: supabaseKey };
  }

  // --- IndexedDB setting helpers (reuse idbStore from idb-storage.js) ---
  async function idbSettingGet(key) {
    try {
      const val = await idbStore.getItem(PREFIX + 'setting_' + key);
      if (val !== null && val !== undefined) return val;
    } catch {}
    // Fall back to localStorage
    try {
      const v = localStorage.getItem(PREFIX + 'setting_' + key);
      return v !== null ? JSON.parse(v) : null;
    } catch { return null; }
  }

  async function idbSettingSet(key, value) {
    try {
      await idbStore.setItem(PREFIX + 'setting_' + key, value);
    } catch {}
    try {
      localStorage.setItem(PREFIX + 'setting_' + key, JSON.stringify(value));
    } catch {}
  }

  // --- Record helpers ---
  async function getAllRecordsRaw() {
    // Prefer the platform layer so sync shares its cache AND its single-writer
    // queue (see lockedRecordsUpdate) - no clobbering local saves.
    if (typeof window !== 'undefined' && window.platformRecords) {
      return await window.platformRecords.getAll();
    }
    try {
      const data = await idbStore.getItem(IDB_RECORDS_KEY);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async function saveAllRecords(records) {
    if (typeof window !== 'undefined' && window.platformRecords) {
      return await window.platformRecords.setAll(records);
    }
    await idbStore.setItem(IDB_RECORDS_KEY, records);
  }

  // Atomic read-modify-write on the platform's single-writer queue: re-reads the
  // freshest array, applies the mutator in place, then writes it back - so a
  // record saved during an in-flight sync is never lost to a stale snapshot.
  async function lockedRecordsUpdate(mutator) {
    const run = async () => {
      const all = await getAllRecordsRaw();
      const out = await mutator(all);
      await saveAllRecords(all);
      return out;
    };
    if (typeof window !== 'undefined' && window.platformRecords) {
      return await window.platformRecords.withLock(run);
    }
    return await run();
  }

  async function getUnsyncedRecords() {
    const all = await getAllRecordsRaw();
    return all.filter(r => (r.sync_version || 1) > (r.synced_version || 0));
  }

  async function getUnsyncedCount() {
    const unsynced = await getUnsyncedRecords();
    return unsynced.length;
  }

  // --- SYNC NOW ---
  async function syncNow() {
    if (!supabaseUrl || !supabaseKey) return;
    if (syncStatus === 'syncing') return;

    setStatus('syncing');
    try {
      const role = await idbSettingGet('deviceRole');
      // Config: pull others' changes BEFORE pushing ours, so two admins editing
      // presets concurrently merge instead of overwriting each other.
      await pullConfig();
      if (role === 'admin') {
        try { await pushConfig(); } catch (e) { console.warn('[pwa-sync] pushConfig failed:', e.message); }
      }
      await pushRecords();
      await pullRecords();
      await pullDeviceRole();
      setStatus('synced');
    } catch (err) {
      console.error('[pwa-sync] Sync error:', err.message);
      setStatus('error');
    }
  }

  // --- PUSH CONFIG (admin only) ---
  // Keys that this device should treat as authoritative when pushing config.
  // These match the localStorage keys used by platform.js (saveX functions).
  const CONFIG_PUSH_KEYS = [
    'sites', 'providers', 'formulary', 'rxPresets',
    'procedures', 'referralTypes', 'customDxPresets',
    'complaints', 'customLabTests', 'hiddenPresets', 'formSchema', 'formTemplates'
  ];

  async function pushConfig() {
    if (!supabaseUrl || !supabaseKey) return;
    const lsPrefix = PREFIX;
    const items = [];
    for (const k of CONFIG_PUSH_KEYS) {
      try {
        const raw = localStorage.getItem(lsPrefix + k);
        if (raw === null) continue;
        // Only push keys that ACTUALLY changed since our last push. Previously
        // every key was re-stamped every 2 minutes, so a second admin's edits
        // were repeatedly overwritten by this device's unchanged copies.
        const lastPushed = await idbSettingGet('cfgPushed_' + k);
        if (lastPushed === raw) continue;
        let parsed;
        try { parsed = JSON.parse(raw); } catch { continue; }
        if (parsed === null || parsed === undefined) continue;
        items.push({ key: k, value: parsed, updated_at: new Date().toISOString(), _raw: raw });
      } catch {}
    }
    if (items.length === 0) return;
    const res = await fetchWithRetry(`${supabaseUrl}/rest/v1/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(items.map(({ _raw, ...it }) => it))
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Push config failed: ${res.status} ${errText}`);
    }
    // Remember exactly what we pushed per key (do NOT blindly bump the pull
    // cursor - that skipped other admins' changes written in between).
    for (const it of items) { await idbSettingSet('cfgPushed_' + it.key, it._raw); }
    console.log(`[pwa-sync] Pushed ${items.length} changed config keys`);
  }

  // --- PUSH ---
  // Merge a remote (pulled) record into the local copy. This is the SINGLE
  // point where record conflict policy lives. Currently last-write-wins: the
  // server's pulled copy wins. To add live multi-user collaboration later,
  // upgrade this to a field-level merge (per-field timestamps / version vectors)
  // - callers (pullRecords) won't need to change.
  function mergeRecords(local, remote) {
    // Conflict policy (single source of truth). Previously an unconditional
    // whole-row overwrite, which let a stale device clobber newer edits and
    // let deletions resurrect. Now:
    //  1. If the local copy has an unsynced edit, keep it - the next push sends it.
    //  2. Otherwise prefer whichever copy has the newer saved_at.
    if ((local.sync_version || 1) > (local.synced_version || 0)) {
      return local;
    }
    const localTs = local.savedAt || local.saved_at || '';
    const remoteTs = remote.savedAt || remote.saved_at || '';
    if (localTs && remoteTs && remoteTs < localTs) {
      return local;
    }
    return { ...local, ...remote };
  }

  function recordToSupabaseRow(record) {
    return {
      id: record.id,
      device_id: record.deviceId || record.device_id || currentDeviceId,
      site: record.site || null,
      date: record.date || null,
      mrn: record.mrn || null,
      given_name: record.givenName || record.given_name || null,
      family_name: record.familyName || record.family_name || null,
      name: record.name || null,
      sex: record.sex || null,
      dob: record.dob || null,
      phone: record.phone || null,
      pregnant: record.pregnant || null,
      breastfeeding: record.breastfeeding || null,
      temp: record.temp || null,
      bp: record.bp || null,
      weight: record.weight || null,
      allergies: record.allergies || null,
      current_meds: record.currentMeds || record.current_meds || null,
      pmh: record.pmh || null,
      chief_concern: record.chiefConcern || record.chief_concern || null,
      transport: record.transport || null,
      travel_time: record.travelTime || record.travel_time || null,
      access_to_care: record.accessToCare || record.access_to_care || null,
      labs: record.labs || {},
      lab_comments: record.labComments || record.lab_comments || null,
      urinalysis: record.urinalysis || {},
      blood_glucose: record.bloodGlucose || record.blood_glucose || null,
      diagnosis: record.diagnosis || null,
      diagnosis_codes: record.diagnosisCodes || record.diagnosis_codes || [],
      medications: record.medications || [],
      treatment_notes: record.treatmentNotes || record.treatment_notes || null,
      treatment: record.treatment || null,
      procedures: record.procedures || [],
      imaging: record.imaging || null,
      surgery: record.surgery || null,
      referral_type: record.referralType || record.referral_type || null,
      referral_date: record.referralDate || record.referral_date || null,
      referral_status: record.referralStatus || record.referral_status || null,
      provider: record.provider || null,
      notes: record.notes || null,
      age_estimated: !!record.ageEstimated,
      saved_at: record.savedAt || record.saved_at || null,
      custom_fields: record.customFields || record.custom_fields || {},
      template_id: record.templateId || record.template_id || null,
      template_name: record.templateName || record.template_name || null,
      deleted: !!record.deleted
    };
  }

  function supabaseRowToRecord(row) {
    return {
      id: row.id,
      deviceId: row.device_id || '',
      site: row.site || '',
      date: row.date || '',
      mrn: row.mrn || '',
      givenName: row.given_name || '',
      familyName: row.family_name || '',
      name: row.name || '',
      sex: row.sex || '',
      dob: row.dob || '',
      phone: row.phone || '',
      pregnant: row.pregnant || '',
      breastfeeding: row.breastfeeding || '',
      temp: row.temp || '',
      bp: row.bp || '',
      weight: row.weight || '',
      allergies: row.allergies || '',
      currentMeds: row.current_meds || '',
      pmh: row.pmh || '',
      chiefConcern: row.chief_concern || '',
      transport: row.transport || '',
      travelTime: row.travel_time || '',
      accessToCare: row.access_to_care || null,
      labs: row.labs || {},
      labComments: row.lab_comments || '',
      urinalysis: row.urinalysis || {},
      bloodGlucose: row.blood_glucose || '',
      diagnosis: row.diagnosis || '',
      diagnosisCodes: row.diagnosis_codes || [],
      medications: row.medications || [],
      treatmentNotes: row.treatment_notes || '',
      treatment: row.treatment || '',
      procedures: row.procedures || [],
      imaging: row.imaging || null,
      surgery: row.surgery || null,
      referralType: row.referral_type || '',
      referralDate: row.referral_date || '',
      referralStatus: row.referral_status || '',
      provider: row.provider || '',
      notes: row.notes || '',
      ageEstimated: !!row.age_estimated,
      savedAt: row.saved_at || '',
      customFields: row.custom_fields || {},
      templateId: row.template_id || '',
      templateName: row.template_name || '',
      deleted: !!row.deleted,
      sync_version: row.sync_version || 1,
      synced_version: row.sync_version || 1  // Pulled records are already synced
    };
  }

  async function pushRecords() {
    const unsynced = await getUnsyncedRecords();
    if (unsynced.length === 0) return;

    const BATCH_SIZE = 50;
    // Ids that reached the server, WITH the sync_version we pushed. We do NOT
    // hold the whole array across the network - writing that stale snapshot back
    // afterward was deleting encounters saved during the sync window.
    const pushed = [];

    for (let i = 0; i < unsynced.length; i += BATCH_SIZE) {
      const batch = unsynced.slice(i, i + BATCH_SIZE);
      const rows = batch.map(r => recordToSupabaseRow(r));

      try {
        const res = await fetchWithRetry(`${supabaseUrl}/rest/v1/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify(rows)
        });

        if (res.ok) {
          for (const record of batch) pushed.push({ id: record.id, version: record.sync_version || 1 });
        } else {
          throw new Error('Batch push failed');
        }
      } catch {
        // Fall back to one-by-one
        for (const record of batch) {
          try {
            const row = recordToSupabaseRow(record);
            const res = await fetchWithRetry(`${supabaseUrl}/rest/v1/records`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
              body: JSON.stringify(row)
            });
            if (res.ok) pushed.push({ id: record.id, version: record.sync_version || 1 });
          } catch (err) {
            console.error(`[pwa-sync] Push failed for record ${record.id}:`, err.message);
          }
        }
      }
    }

    // Mark the pushed records synced on a FRESH copy, under the single-writer
    // lock - but only if the record hasn't been edited again since we pushed it
    // (its sync_version still matches), so a mid-sync edit stays "unsynced".
    if (pushed.length) {
      await lockedRecordsUpdate(all => {
        for (const p of pushed) {
          const idx = all.findIndex(r => r.id === p.id);
          if (idx >= 0 && (all[idx].sync_version || 1) === p.version) {
            all[idx].synced_version = p.version;
          }
        }
      });
    }
    console.log(`[pwa-sync] Push: ${pushed.length}/${unsynced.length} records pushed`);

    // Update device last_sync_at
    if (currentDeviceId) {
      await supabaseFetch(`${supabaseUrl}/rest/v1/devices?id=eq.${encodeURIComponent(currentDeviceId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_sync_at: new Date().toISOString() })
      }).catch(() => {});
    }
  }

  // --- PULL ---
  async function pullRecords() {
    if (!currentDeviceId) return;

    const lastPull = await idbSettingGet('lastPullTimestamp') || '1970-01-01T00:00:00.000Z';
    const PAGE = 1000;

    // Keyset pagination over (synced_at, id): loops until a short page returns,
    // so we NEVER silently truncate at Supabase's 1000-row cap, and never skip
    // rows that share a synced_at (a whole batch import shares one timestamp).
    // The device_id echo filter was REMOVED: cross-device updates that keep the
    // original creator's device_id (e.g. a referral marked Completed elsewhere)
    // must reach that device too. Our own echoes are harmless - mergeRecords
    // keeps any local unsynced edit and otherwise merges identical data.
    let cursorTs = lastPull;
    let cursorId = '';
    const rows = [];
    while (true) {
      let filter;
      if (cursorId) {
        filter = `or=(synced_at.gt.${encodeURIComponent(cursorTs)},and(synced_at.eq.${encodeURIComponent(cursorTs)},id.gt.${encodeURIComponent(cursorId)}))`;
      } else {
        filter = `synced_at=gte.${encodeURIComponent(cursorTs)}`;
      }
      const query = `${filter}&order=synced_at.asc,id.asc&limit=${PAGE}`;
      const res = await supabaseFetch(`${supabaseUrl}/rest/v1/records?${query}`);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Pull failed: ${res.status} ${errText}`);
      }
      const page = await res.json();
      if (page.length === 0) break;
      rows.push(...page);
      const last = page[page.length - 1];
      cursorTs = last.synced_at || last.saved_at || cursorTs;
      cursorId = last.id;
      if (page.length < PAGE) break;
    }
    if (rows.length === 0) return;

    let latestTimestamp = lastPull;
    const mrnFixes = []; // MRN reassignments to push back to the server once

    // Apply the whole pulled set to a FRESH copy under the single-writer lock.
    await lockedRecordsUpdate(all => {
      for (const row of rows) {
        const record = supabaseRowToRecord(row);

        // MRN collision detection (different patient, same MRN)
        if (record.mrn) {
          const existing = all.find(r =>
            r.mrn === record.mrn &&
            r.id !== record.id &&
            !r.deleted &&
            ((r.givenName || r.given_name || '') !== (record.givenName || '') ||
             (r.familyName || r.family_name || '') !== (record.familyName || '') ||
             (r.dob || '') !== (record.dob || ''))
          );
          if (existing) {
            let suffix = 1;
            let newMrn = record.mrn + '-' + suffix;
            while (all.some(r => r.mrn === newMrn && r.id !== record.id)) {
              suffix++;
              newMrn = record.mrn + '-' + suffix;
            }
            console.log(`[pwa-sync] MRN collision: "${record.mrn}" reassigned to "${newMrn}"`);
            record.mrn = newMrn;
            mrnFixes.push({ id: record.id, mrn: newMrn });
          }
        }

        const idx = all.findIndex(r => r.id === record.id);
        if (idx >= 0) {
          all[idx] = mergeRecords(all[idx], record);
        } else {
          all.push(record);
        }

        const ts = row.synced_at || row.saved_at;
        if (ts && ts > latestTimestamp) latestTimestamp = ts;
      }
    });

    await idbSettingSet('lastPullTimestamp', latestTimestamp);

    // Push MRN reassignments back to the cloud (outside the local write lock).
    for (const fix of mrnFixes) {
      try {
        await supabaseFetch(`${supabaseUrl}/rest/v1/records?id=eq.${encodeURIComponent(fix.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mrn: fix.mrn })
        });
      } catch {}
    }

    console.log(`[pwa-sync] Pull: ${rows.length} rows processed`);

    // Notify app to refresh
    if (typeof window !== 'undefined' && window._pwaSyncCallbacks) {
      if (window._pwaSyncCallbacks.onRecordsUpdated) {
        window._pwaSyncCallbacks.onRecordsUpdated();
      }
    }
  }

  // --- PULL CONFIG ---
  async function pullConfig() {
    const lastConfigPull = await idbSettingGet('lastConfigPullTimestamp') || '1970-01-01T00:00:00.000Z';
    const query = `updated_at=gt.${encodeURIComponent(lastConfigPull)}&order=updated_at.asc`;

    const res = await supabaseFetch(`${supabaseUrl}/rest/v1/config?${query}`);
    if (!res.ok) return; // Config pull failure is non-fatal

    const rows = await res.json();
    if (rows.length === 0) return;

    let latestTimestamp = lastConfigPull;
    const lsPrefix = PREFIX;

    for (const row of rows) {
      // Save config to localStorage (same as platform.js pattern).
      // Older builds of the seed step pre-JSON.stringify'd values, so the
      // JSONB column held a JSON string. Detect that case and unwrap once
      // so we never end up with double-encoded config in localStorage.
      const key = row.key;
      // Never store a synced admin password. It is device-local only; legacy
      // databases may still hold a plaintext 'adminPassword' row, so skip it.
      if (key === 'adminPassword') {
        if (row.updated_at && row.updated_at > latestTimestamp) latestTimestamp = row.updated_at;
        continue;
      }
      let value = row.value;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length && (trimmed[0] === '{' || trimmed[0] === '[' || trimmed[0] === '"')) {
          try {
            const parsed = JSON.parse(value);
            // Only adopt the parsed form if the original was clearly a JSON
            // encoding of a non-string (array/object), or a quoted string.
            if (parsed && (Array.isArray(parsed) || typeof parsed === 'object' || typeof parsed === 'string')) {
              value = parsed;
            }
          } catch {}
        }
      }
      try {
        localStorage.setItem(lsPrefix + key, JSON.stringify(value));
      } catch {}

      if (row.updated_at && row.updated_at > latestTimestamp) {
        latestTimestamp = row.updated_at;
      }
    }

    await idbSettingSet('lastConfigPullTimestamp', latestTimestamp);

    // Notify app to refresh config
    if (typeof window !== 'undefined' && window._pwaSyncCallbacks) {
      if (window._pwaSyncCallbacks.onConfigUpdated) {
        window._pwaSyncCallbacks.onConfigUpdated();
      }
    }
  }

  // --- PULL DEVICE ROLE ---
  async function pullDeviceRole() {
    if (!currentDeviceId) return;
    try {
      const res = await supabaseFetch(`${supabaseUrl}/rest/v1/devices?id=eq.${encodeURIComponent(currentDeviceId)}&select=role`);
      if (!res.ok) return;
      const rows = await res.json();
      if (rows.length === 0) return;

      const cloudRole = rows[0].role || 'standard';
      const localRole = await idbSettingGet('deviceRole') || 'standard';

      if (cloudRole !== localRole) {
        await idbSettingSet('deviceRole', cloudRole);
        if (typeof _deviceRole !== 'undefined') {
          _deviceRole = cloudRole;
        }
        if (window._pwaSyncCallbacks && window._pwaSyncCallbacks.onConfigUpdated) {
          window._pwaSyncCallbacks.onConfigUpdated();
        }
      }
    } catch {}
  }

  // --- VERIFY TABLES ---
  async function verifyTables(url, key) {
    try {
      const tables = ['records', 'devices', 'config'];
      for (const table of tables) {
        const res = await fetch(`${url || supabaseUrl}/rest/v1/${table}?limit=0`, {
          headers: supabaseHeaders(key || supabaseKey)
        });
        if (res.status === 404) {
          return { ok: false, error: `Table "${table}" not found. Please run the SQL setup script first.` };
        }
        if (!res.ok && res.status !== 200) {
          return { ok: false, error: `Error checking table "${table}": HTTP ${res.status}` };
        }
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // --- SEED CONFIG ---
  async function seedConfig(url, key) {
    try {
      const configItems = [];
      // Seed default config values
      const defaults = {
        sites: typeof DEFAULT_SITES !== 'undefined' ? DEFAULT_SITES : ['Site A'],
        providers: typeof DEFAULT_PHYSICIANS !== 'undefined' ? DEFAULT_PHYSICIANS : ['Physician A'],
        formulary: typeof DEFAULT_FORMULARY !== 'undefined' ? DEFAULT_FORMULARY : [],
        rxPresets: typeof RX_PRESETS !== 'undefined' ? RX_PRESETS : [],
        procedures: typeof DEFAULT_PROCEDURES !== 'undefined' ? DEFAULT_PROCEDURES : [],
        referralTypes: typeof DEFAULT_REFERRAL_TYPES !== 'undefined' ? DEFAULT_REFERRAL_TYPES : [],
        complaints: typeof DEFAULT_COMPLAINTS !== 'undefined' ? DEFAULT_COMPLAINTS : [],
        customDxPresets: typeof DX_PRESETS !== 'undefined' ? DX_PRESETS : []
      };

      for (const [k, v] of Object.entries(defaults)) {
        // value column is JSONB - pass the raw value, NOT a JSON.stringify'd
        // string. Pre-stringifying causes double-encoding on pull.
        configItems.push({ key: k, value: v, updated_at: new Date().toISOString() });
      }

      const res = await fetch(`${url}/rest/v1/config`, {
        method: 'POST',
        headers: supabaseHeaders(key, {
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        }),
        body: JSON.stringify(configItems)
      });

      if (!res.ok) {
        const errText = await res.text();
        return { ok: false, error: `Seed failed: ${errText}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // --- DEVICE REGISTRATION ---
  async function registerDevice(name, url, key) {
    const deviceId = crypto.randomUUID();
    const targetUrl = url || supabaseUrl;
    const targetKey = key || supabaseKey;

    // Save locally
    await idbSettingSet('deviceId', deviceId);
    await idbSettingSet('deviceName', name);

    // Register in cloud if we have credentials
    if (targetUrl && targetKey) {
      try {
        await fetch(`${targetUrl}/rest/v1/devices`, {
          method: 'POST',
          headers: supabaseHeaders(targetKey, {
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          }),
          body: JSON.stringify({
            id: deviceId,
            name: name,
            role: 'standard',
            last_sync_at: new Date().toISOString()
          })
        });
      } catch (err) {
        console.warn('[pwa-sync] Device registration in cloud failed:', err.message);
      }
    }

    return deviceId;
  }

  return {
    init,
    syncNow,
    getStatus,
    updateCredentials,
    getCredentials,
    onStatus,
    getUnsyncedCount,
    getUnsyncedRecords,
    verifyTables,
    seedConfig,
    registerDevice,
    recordToSupabaseRow,
    supabaseRowToRecord,
    mergeRecords,
    idbSettingGet,
    idbSettingSet
  };
})();
