// ==========================================
// ADMIN SETTINGS SCREEN
// ==========================================

async function renderAdminScreen() {
  const container = document.getElementById('adminContent');
  const role = getDeviceRole();
  const isAdmin = role === 'admin';
  const deviceName = await window.electronAPI.getSetting('deviceName') || 'Unknown';
  const deviceId = currentDeviceId || 'Not registered';
  const backupSettings = await window.electronAPI.backupGetSettings();
  const lastBackupDisplay = backupSettings.lastBackupTime
    ? new Date(backupSettings.lastBackupTime).toLocaleString()
    : 'Never';

  container.innerHTML = `
    <!-- Device Info -->
    <div class="admin-section">
      <h3>Device Info</h3>
      <div class="admin-info-grid">
        <div class="admin-info-item"><span class="admin-info-label">Device Name</span><span class="admin-info-value">${esc(deviceName)}</span></div>
        <div class="admin-info-item"><span class="admin-info-label">Device ID</span><span class="admin-info-value" style="font-size:11px;font-family:monospace;">${esc(deviceId)}</span></div>
        <div class="admin-info-item"><span class="admin-info-label">Role</span><span class="admin-info-value admin-role-badge ${isAdmin ? 'role-admin' : 'role-standard'}">${isAdmin ? 'Admin' : 'Standard'}</span></div>
      </div>
    </div>

    <!-- Admin Access -->
    <div class="admin-section">
      <h3>Admin Access</h3>
      ${isAdmin ? `
        <div class="admin-notice admin-notice-success">
          <strong>This is the Admin device.</strong> You can edit formulary, sites, physicians, procedures, and presets. Other devices will sync your changes.
        </div>
        <div style="margin-top:12px;">
          <button class="btn btn-secondary" onclick="showChangePassword()">Change Admin Password</button>
          <button class="btn btn-danger" style="margin-left:8px;" onclick="releaseAdmin()">Release Admin Role</button>
        </div>
        <div id="adminPasswordChangeArea" style="display:none;margin-top:12px;">
          <div class="form-group" style="max-width:300px;"><label>New Password</label><input type="password" id="adminNewPw" placeholder="New password"></div>
          <div class="form-group" style="max-width:300px;"><label>Confirm</label><input type="password" id="adminNewPwConfirm" placeholder="Confirm"></div>
          <div id="adminPwChangeError" class="wizard-error" style="display:none;"></div>
          <button class="btn btn-primary" onclick="saveNewAdminPassword()" style="margin-top:8px;">Save New Password</button>
        </div>
      ` : `
        <div class="admin-notice">
          This device is in <strong>Standard</strong> mode. Configuration (formulary, sites, physicians, etc.) is managed by the Admin device and synced automatically.
        </div>
        <div style="margin-top:12px;">
          <div class="form-group" style="max-width:300px;"><label>Admin Password</label><input type="password" id="adminClaimPw" placeholder="Enter admin password"></div>
          <div id="adminClaimError" class="wizard-error" style="display:none;"></div>
          <button class="btn btn-primary" onclick="claimAdminRole()" style="margin-top:8px;">Claim Admin Access</button>
        </div>
      `}
    </div>


    <!-- Backup & Restore -->
    <div class="admin-section">
      <h3>Backup &amp; Restore</h3>
      <p style="font-size:13px;color:var(--gray-500);margin-bottom:12px;">Save all records and settings to a file, or restore from one. <strong>Especially important in offline-only mode</strong> &mdash; a backup is your only safety net if the device is lost or the app is removed. Restoring merges into this device and never deletes existing records.</p>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="doDownloadBackup()">&#11015;&#65039; Download Backup</button>
        <button class="btn btn-secondary" onclick="document.getElementById('restoreFileInput').click()">&#11014;&#65039; Restore from File</button>
        <input type="file" id="restoreFileInput" accept="application/json,.json" style="display:none;" onchange="doRestoreBackup(this)">
      </div>
      <div id="backupStatusMsg" style="margin-top:8px;font-size:12px;"></div>
    </div>

    <!-- Cloud Connection -->
    <div class="admin-section">
      ${isStandaloneMode() ? `
        <h3>Cloud Connection</h3>
        <div class="admin-notice" style="margin-bottom:12px;">
          <strong>This device is running in offline-only mode.</strong> All data is stored locally. To enable multi-device sync, connect to a Supabase cloud database.
        </div>
        <div id="standaloneConnectArea" style="display:none;margin-top:12px;">
          <div class="form-grid" style="max-width:600px;">
            <div class="form-group full"><label>Supabase URL</label><input type="text" id="standaloneUrl" placeholder="https://your-project.supabase.co"></div>
            <div class="form-group full"><label>Supabase Anon Key</label><input type="text" id="standaloneKey" placeholder="eyJ..."></div>
          </div>
          <div id="standaloneConnectError" class="wizard-error" style="display:none;"></div>
          <div id="standaloneConnectStatus" style="margin-top:8px;font-size:12px;color:var(--gray-500);display:none;"></div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn btn-primary" id="btnStandaloneConnect" onclick="connectStandaloneToCloud()">Test & Connect</button>
            <button class="btn btn-secondary" onclick="toggleStandaloneConnect()">Cancel</button>
          </div>
        </div>
        <div id="standaloneConnectToggle">
          <button class="btn btn-primary" onclick="toggleStandaloneConnect()" style="padding:8px 20px;">Connect to Cloud</button>
        </div>
      ` : `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <h3 style="margin:0;">Cloud Connection</h3>
            <span class="sync-status-label" id="syncStatusLabel" style="font-size:13px;">Checking...</span>
          </div>
          <button class="btn btn-primary" id="btnSyncNow" style="padding:8px 20px;">&#8635; Sync Now</button>
        </div>
        <div id="cloudCredsToggle">
          <button class="btn btn-secondary" onclick="toggleCloudCreds()" style="font-size:12px;padding:6px 14px;">&#9881; Edit Connection Settings</button>
        </div>
        <div id="cloudCredsArea" style="display:none;margin-top:12px;">
          ${!isAdmin ? `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:var(--radius);padding:10px 14px;margin-bottom:12px;font-size:12px;color:#991b1b;">
              <strong>&#9888; Warning:</strong> Do not change these settings unless instructed by your organization's admin. Incorrect values will break syncing.
            </div>
          ` : ''}
          <div class="form-grid" style="max-width:600px;">
            <div class="form-group full"><label>Supabase URL</label><input type="text" id="syncUrl" placeholder="https://your-project.supabase.co"></div>
            <div class="form-group full"><label>Supabase Anon Key</label><input type="text" id="syncKey" placeholder="eyJ..."></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn btn-primary" id="btnSaveSync">Save & Connect</button>
            <button class="btn btn-secondary" onclick="toggleCloudCreds()">Cancel</button>
          </div>
        </div>
      `}
    </div>
  `;

  // Re-init sync UI elements after rendering
  initSyncUI();
}

function toggleCloudCreds() {
  const area = document.getElementById('cloudCredsArea');
  const toggle = document.getElementById('cloudCredsToggle');
  const isHidden = area.style.display === 'none';
  area.style.display = isHidden ? '' : 'none';
  toggle.style.display = isHidden ? 'none' : '';
}

function showChangePassword() {
  const area = document.getElementById('adminPasswordChangeArea');
  area.style.display = area.style.display === 'none' ? '' : 'none';
}

async function saveNewAdminPassword() {
  const pw = document.getElementById('adminNewPw').value;
  const pwConfirm = document.getElementById('adminNewPwConfirm').value;
  const errEl = document.getElementById('adminPwChangeError');

  if (!pw) { errEl.textContent = 'Please enter a password.'; errEl.style.display = ''; return; }
  if (pw !== pwConfirm) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = ''; return; }
  if (pw.length < 4) { errEl.textContent = 'Password must be at least 4 characters.'; errEl.style.display = ''; return; }

  errEl.style.display = 'none';
  const result = await window.electronAPI.setAdminPassword(pw);
  if (result.ok) {
    alert('Admin password updated successfully.');
    document.getElementById('adminPasswordChangeArea').style.display = 'none';
  } else {
    errEl.textContent = result.error;
    errEl.style.display = '';
  }
}

async function claimAdminRole() {
  const pw = document.getElementById('adminClaimPw').value;
  const errEl = document.getElementById('adminClaimError');

  if (!pw) { errEl.textContent = 'Please enter the admin password.'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';

  const result = await window.electronAPI.claimAdmin(pw);
  if (result.ok) {
    setDeviceRoleLocal('admin');
    renderAdminScreen();
    // Re-render config editors to show edit buttons
    renderFormulary();
    renderProviders();
    renderSites();
    renderProceduresEditor();
    renderRxPresetsEditor();
    renderReferralTypesEditor();
    renderDxPresetsEditor();
  } else {
    errEl.textContent = result.error;
    errEl.style.display = '';
  }
}

// ==========================================
// DATABASE BACKUP
// ==========================================
async function selectBackupPath() {
  const selectedPath = await window.electronAPI.backupSelectPath();
  if (selectedPath) {
    const settings = await window.electronAPI.backupGetSettings();
    settings.path = selectedPath;
    await window.electronAPI.backupSaveSettings(settings);
    renderAdminScreen();
  }
}

async function runBackupNow() {
  const statusEl = document.getElementById('backupStatus');
  if (statusEl) { statusEl.textContent = 'Backing up...'; statusEl.style.display = ''; statusEl.style.color = 'var(--gray-500)'; }
  const result = await window.electronAPI.backupRun();
  if (result.ok) {
    if (statusEl) { statusEl.textContent = 'Backup completed at ' + new Date(result.time).toLocaleString(); statusEl.style.color = 'var(--green)'; }
    const timeEl = document.getElementById('lastBackupTimeDisplay');
    if (timeEl) timeEl.textContent = new Date(result.time).toLocaleString();
  } else {
    if (statusEl) { statusEl.textContent = 'Backup failed: ' + result.error; statusEl.style.color = 'var(--red)'; }
  }
}

async function toggleAutoBackup(enabled) {
  const settings = await window.electronAPI.backupGetSettings();
  settings.autoBackup = enabled;
  await window.electronAPI.backupSaveSettings(settings);
  window.electronAPI.backupRestartInterval();
}

// ==========================================
// STANDALONE → CLOUD CONNECTION
// ==========================================
function toggleStandaloneConnect() {
  const area = document.getElementById('standaloneConnectArea');
  const toggle = document.getElementById('standaloneConnectToggle');
  const isHidden = area.style.display === 'none';
  area.style.display = isHidden ? '' : 'none';
  toggle.style.display = isHidden ? 'none' : '';
}

async function connectStandaloneToCloud() {
  const url = document.getElementById('standaloneUrl').value.trim();
  const key = document.getElementById('standaloneKey').value.trim();
  const errEl = document.getElementById('standaloneConnectError');
  const statusEl = document.getElementById('standaloneConnectStatus');
  const btn = document.getElementById('btnStandaloneConnect');

  if (!url || !key) {
    errEl.textContent = 'Both fields are required.';
    errEl.style.display = '';
    return;
  }

  errEl.style.display = 'none';
  statusEl.style.display = '';
  statusEl.textContent = 'Testing connection...';
  btn.disabled = true;

  try {
    // Test connection
    const res = await fetch(`${url}/rest/v1/records?limit=0`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    if (res.status === 401 || res.status === 403) throw new Error(`Invalid API key (HTTP ${res.status})`);

    // Verify tables exist
    statusEl.textContent = 'Verifying tables...';
    const verifyResult = await window.electronAPI.verifyTables(url, key);
    if (!verifyResult.ok) {
      // Tables do not exist — ask if they want to create them
      errEl.textContent = 'Connected, but database tables were not found. Please run the table creation SQL in the Supabase SQL Editor first, then try again.';
      errEl.style.display = '';
      statusEl.style.display = 'none';
      btn.disabled = false;
      return;
    }

    // Save credentials and disable standalone mode
    statusEl.textContent = 'Connecting...';
    await window.electronAPI.syncUpdateCredentials(url, key);
    await window.electronAPI.setSetting('standaloneMode', 'false');
    setStandaloneMode(false);

    // Register this device in the cloud if not already there
    const deviceName = await window.electronAPI.getSetting('deviceName');
    if (deviceName && currentDeviceId) {
      try {
        // Register device in cloud devices table
        await fetch(`${url}/rest/v1/devices`, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            id: currentDeviceId,
            name: deviceName,
            role: await window.electronAPI.getDeviceRole() || 'admin',
            last_sync_at: new Date().toISOString()
          })
        });
        // Initialize sync engine and do first sync
        if (typeof pwaSync !== 'undefined') {
          await pwaSync.init();
        }
        await window.electronAPI.syncNow();
      } catch {}
    }

    statusEl.textContent = 'Connected! Reloading...';

    // Show sync indicator
    const syncIndicator = document.getElementById('syncIndicator');
    if (syncIndicator) syncIndicator.style.display = '';

    // Re-init sync UI and re-render admin screen
    initSyncUI();
    setTimeout(() => renderAdminScreen(), 500);

  } catch (err) {
    errEl.textContent = `Connection failed: ${err.message}`;
    errEl.style.display = '';
    statusEl.style.display = 'none';
    btn.disabled = false;
  }
}

async function releaseAdmin() {
  if (!confirm('Are you sure? This device will become a Standard device and will no longer be able to edit configuration.')) return;

  const result = await window.electronAPI.setDeviceRole('standard');
  if (result.ok) {
    setDeviceRoleLocal('standard');
    renderAdminScreen();
    renderFormulary();
    renderProviders();
    renderSites();
    renderProceduresEditor();
    renderRxPresetsEditor();
    renderReferralTypesEditor();
    renderDxPresetsEditor();
  } else {
    alert('Failed to release admin: ' + result.error);
  }
}
