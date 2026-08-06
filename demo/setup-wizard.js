// ==========================================
// SETUP WIZARD
// ==========================================

const WIZARD_STEPS_FULL = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'create-project', title: 'Create Supabase Project' },
  { id: 'credentials', title: 'Enter Credentials' },
  { id: 'create-tables', title: 'Create Tables' },
  { id: 'verify', title: 'Verify' },
  { id: 'seed', title: 'Seed Config' },
  { id: 'device', title: 'Register Device' },
  { id: 'admin-password', title: 'Admin Password' },
  { id: 'done', title: 'Done' }
];

const WIZARD_STEPS_JOIN = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'credentials', title: 'Enter Credentials' },
  { id: 'device', title: 'Register Device' },
  { id: 'done', title: 'Done' }
];

const WIZARD_STEPS_STANDALONE = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'device', title: 'Name Your Device' },
  { id: 'done', title: 'Done' }
];

let WIZARD_STEPS = WIZARD_STEPS_FULL;
let wizardStep = 0;
let wizardUrl = '';
let wizardKey = '';
let wizardIsJoining = false;
let wizardIsStandalone = false;

function showSetupWizard() {
  document.getElementById('setupWizard').style.display = '';
  wizardStep = 0;
  renderWizardStep();
}

function hideSetupWizard() {
  document.getElementById('setupWizard').style.display = 'none';
}

function renderWizardProgress() {
  const el = document.getElementById('wizardProgress');
  el.innerHTML = WIZARD_STEPS.map((s, i) => {
    let cls = 'wizard-step-dot';
    if (i < wizardStep) cls += ' done';
    else if (i === wizardStep) cls += ' active';
    return `<div class="${cls}" title="${s.title}"></div>`;
  }).join('');
}

function renderWizardStep() {
  renderWizardProgress();
  const content = document.getElementById('wizardContent');
  const nav = document.getElementById('wizardNav');
  const step = WIZARD_STEPS[wizardStep];

  switch (step.id) {
    case 'welcome':
      content.innerHTML = `
        <h2>Set Up DH Field EMR</h2>
        <p>Is this the first computer being set up for your organization, or are you joining an existing setup?</p>
        <div style="display:flex;gap:12px;margin-top:16px;">
          <button class="btn btn-primary" onclick="wizardStartFull()" style="flex:1;padding:16px;">
            <strong>New Organization</strong><br><span style="font-size:12px;opacity:0.8;">Set up Supabase from scratch</span>
          </button>
          <button class="btn btn-secondary" onclick="wizardStartJoin()" style="flex:1;padding:16px;border:2px solid var(--primary);">
            <strong>Join Existing Setup</strong><br><span style="font-size:12px;opacity:0.8;">Another computer was already set up</span>
          </button>
        </div>
        <div style="margin-top:16px;text-align:center;">
          <button class="btn btn-secondary" onclick="wizardStartStandalone()" style="padding:12px 24px;border:1px solid var(--gray-300);">
            <strong>Standalone (Offline Only)</strong><br><span style="font-size:12px;opacity:0.8;">Single computer, no cloud sync needed</span>
          </button>
        </div>`;
      nav.innerHTML = '';
      break;

    case 'create-project':
      content.innerHTML = `
        <div class="wizard-step-title">Step 1: Create a Supabase Project</div>
        <ol style="font-size:14px;line-height:2.2;margin:8px 0 0 20px;">
          <li>Go to <strong>supabase.com</strong> and create a free account</li>
          <li>Click <strong>"New Project"</strong> — pick any name and a strong database password</li>
          <li>Select the region closest to you, then click <strong>"Create new project"</strong></li>
          <li>Wait for the project to finish setting up (takes ~1 minute)</li>
          <li>In the left sidebar, click <strong>Settings</strong> (gear icon at the bottom)</li>
          <li>Then click <strong>"Data API"</strong> under the Configuration section</li>
        </ol>
        <p style="margin-top:12px;">You'll need two values from this page:</p>
        <ul style="font-size:13px;color:var(--gray-600);margin:4px 0 0 20px;line-height:2;">
          <li><strong>Project URL</strong> — at the top, looks like <code>https://xxxxx.supabase.co</code></li>
          <li><strong>Anon Key</strong> — on the Data API page, you'll see <strong>"Project API keys"</strong>. You may see "Publishable" and "Secret" keys by default. Look for a toggle or link that says <strong>"Legacy anon, service_role API keys"</strong> — click it to reveal the legacy keys. Copy the <strong>anon</strong> key (the long string starting with <code>eyJ</code>). If you only see a "Publishable" key, that will work too.</li>
        </ul>
        <div style="margin-top:12px;padding:10px;background:var(--blue-50, #eff6ff);border-radius:8px;font-size:12px;color:var(--gray-600);">
          <strong>&#9432; Quick tips:</strong>
          <ul style="margin:4px 0 0 16px;line-height:1.8;">
            <li>Ignore any prompts about Row Level Security (RLS) — the next steps handle that</li>
            <li>Ignore the database password — you won't need it for this app</li>
            <li>The Project URL looks like <code>https://abcdefg.supabase.co</code> — make sure to copy the full URL</li>
            <li>The anon key is very long (200+ characters) — make sure you copy the entire thing</li>
          </ul>
        </div>`;
      nav.innerHTML = `<button class="btn btn-secondary" onclick="wizardBack()">Back</button><button class="btn btn-primary" onclick="wizardNext()">I Have My Credentials</button>`;
      break;

    case 'credentials':
      const credTitle = wizardIsJoining ? 'Enter Your Organization\'s Credentials' : 'Step 2: Enter Supabase Credentials';
      const credDesc = wizardIsJoining
        ? '<strong>Ask the person who set up the first computer</strong> for these two values. They are the same Supabase URL and key used during initial setup. If you don\'t have them, check with your team lead or organization administrator.'
        : 'Paste your Project URL and anon key from the Supabase dashboard below.';
      content.innerHTML = `
        <div class="wizard-step-title">${credTitle}</div>
        <p>${credDesc}</p>
        <div class="form-group" style="margin-top:12px;"><label>Supabase URL</label><input type="text" id="wizardUrl" placeholder="https://your-project.supabase.co" value="${esc(wizardUrl)}"></div>
        <div class="form-group"><label>Supabase Anon Key</label><input type="text" id="wizardKey" placeholder="eyJ..." value="${esc(wizardKey)}"></div>
        <div id="wizardCredError" class="wizard-error" style="display:none;"></div>`;
      nav.innerHTML = `<button class="btn btn-secondary" onclick="wizardBack()">Back</button><button class="btn btn-primary" id="btnWizardTestConn" onclick="wizardTestConnection()">Test Connection</button>`;
      break;

    case 'create-tables':
      content.innerHTML = `
        <div class="wizard-step-title">Step 3: Create Database Tables</div>
        <ol style="font-size:14px;line-height:2.2;margin:8px 0 0 20px;">
          <li>In your Supabase dashboard, click <strong>"SQL Editor"</strong> in the left sidebar</li>
          <li>Click <strong>"New Query"</strong> (top-left area)</li>
          <li>Click the button below to copy the SQL, then paste it into the editor</li>
          <li>Click the green <strong>"Run"</strong> button (or press Ctrl/Cmd+Enter)</li>
          <li>You should see <strong>"Success. No rows returned"</strong> — that means it worked!</li>
        </ol>
        <button class="btn btn-primary" onclick="copyWizardSql()" style="margin-top:12px;">Copy SQL to Clipboard</button>
        <div id="wizardCopyMsg" style="color:var(--green);font-size:12px;margin-top:4px;display:none;">&#10003; Copied! Now paste it into the Supabase SQL Editor.</div>
        <details style="margin-top:12px;"><summary style="cursor:pointer;font-size:12px;color:var(--gray-500);">Preview SQL (optional)</summary><code id="wizardSqlCode" style="margin-top:8px;font-size:11px;">${esc(SETUP_SQL)}</code></details>
        <p style="margin-top:8px;font-size:12px;color:var(--gray-500);">&#9432; This creates 3 tables (records, devices, config) and sets up security policies. If Supabase asks about RLS, you can ignore it — it's already handled.</p>`;
      nav.innerHTML = `<button class="btn btn-secondary" onclick="wizardBack()">Back</button><button class="btn btn-primary" onclick="wizardNext()">I've Run the SQL</button>`;
      break;

    case 'verify':
      content.innerHTML = `
        <div class="wizard-step-title">Step 4: Verify Tables</div>
        <p>Let's confirm the tables were created correctly.</p>
        <div id="wizardVerifyResult" style="margin-top:12px;"></div>`;
      nav.innerHTML = `<button class="btn btn-secondary" onclick="wizardBack()">Back</button><button class="btn btn-primary" id="btnWizardVerify" onclick="wizardVerifyTables()">Verify Tables</button>`;
      break;

    case 'seed':
      content.innerHTML = `
        <div class="wizard-step-title">Step 5: Seed Default Configuration</div>
        <p>This will upload the default configuration to your cloud database: medications, diagnosis presets, procedures, referral types, chief complaints, and sample site names.</p>
        <p style="margin-top:8px;font-size:12px;color:var(--gray-500);">You can customize all of these later in the <strong>Options</strong> tab — add your own sites, physicians, medications, and more.</p>
        <div id="wizardSeedResult" style="margin-top:12px;"></div>`;
      nav.innerHTML = `<button class="btn btn-secondary" onclick="wizardBack()">Back</button><button class="btn btn-primary" id="btnWizardSeed" onclick="wizardSeedConfig()">Seed Config</button>`;
      break;

    case 'device':
      const deviceTitle = wizardIsStandalone ? 'Name Your Device' : 'Step 6: Register This Device';
      const deviceDesc = wizardIsStandalone
        ? 'Give this computer a name to identify it in the system.'
        : 'Give this computer a name so you can identify it in the system.';
      content.innerHTML = `
        <div class="wizard-step-title">${deviceTitle}</div>
        <p>${deviceDesc}</p>
        <div class="form-group" style="margin-top:12px;"><label>Device Name</label><input type="text" id="wizardDeviceName" placeholder="e.g. Laptop 1, Clinic iPad"></div>
        <div id="wizardDeviceError" class="wizard-error" style="display:none;"></div>`;
      nav.innerHTML = `<button class="btn btn-secondary" onclick="wizardBack()">Back</button><button class="btn btn-primary" onclick="wizardRegisterDevice()">Register Device</button>`;
      break;

    case 'admin-password':
      content.innerHTML = `
        <div class="wizard-step-title">Step 7: Set Admin Password</div>
        <p>This device will be the <strong>Admin</strong> device. Set a password that other devices will need to claim admin access.</p>
        <div class="form-group" style="margin-top:12px;"><label>Admin Password</label><input type="password" id="wizardAdminPw" placeholder="Choose a password"></div>
        <div class="form-group"><label>Confirm Password</label><input type="password" id="wizardAdminPwConfirm" placeholder="Confirm password"></div>
        <div id="wizardAdminPwError" class="wizard-error" style="display:none;"></div>`;
      nav.innerHTML = `<button class="btn btn-secondary" onclick="wizardBack()">Back</button><button class="btn btn-primary" onclick="wizardSetAdminPassword()">Set Password</button>`;
      break;

    case 'done':
      const doneMsg = wizardIsStandalone
        ? 'Your EMR is ready!'
        : wizardIsJoining
          ? 'This device is now connected to your organization. Hit "Sync Now" to download records from other devices.'
          : 'Your DH Field EMR is set up and connected to the cloud!';
      const doneHint = wizardIsStandalone
        ? `<p style="margin-top:16px;font-size:13px;color:var(--gray-500);">All data will be saved locally on this device. You can connect to the cloud later in the <strong>Admin</strong> settings if you need multi-device sync.</p>`
        : wizardIsJoining
          ? '<p style="margin-top:16px;font-size:13px;color:var(--gray-500);">This device will download configuration (medications, sites, etc.) from the admin device on the first sync. You can start entering patient records right away.</p>'
          : `<div style="margin-top:16px;padding:12px;background:var(--blue-50, #eff6ff);border-radius:8px;font-size:13px;color:var(--gray-600);text-align:left;">
            <strong>Next steps:</strong>
            <ul style="margin:6px 0 0 16px;line-height:2;">
              <li>Go to <strong>Options</strong> to customize sites, physicians, medications, and more</li>
              <li>To add more computers, download the app on each and choose <strong>"Join Existing Setup"</strong></li>
              <li>Share your Supabase URL and anon key with other devices — they'll need it to connect</li>
              <li>Use <strong>"Sync Now"</strong> to upload/download records between devices</li>
            </ul>
          </div>`;
      content.innerHTML = `
        <div style="text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;">&#10003;</div>
          <h2>You're All Set!</h2>
          <p>${doneMsg}</p>
          ${doneHint}
        </div>`;
      nav.innerHTML = `<span></span><button class="btn btn-primary" onclick="wizardFinish()" style="padding:10px 40px;">Launch App</button>`;
      break;
  }
}

function wizardStartFull() {
  wizardIsJoining = false;
  wizardIsStandalone = false;
  WIZARD_STEPS = WIZARD_STEPS_FULL;
  wizardStep = 0;
  wizardNext();
}

function wizardStartJoin() {
  wizardIsJoining = true;
  wizardIsStandalone = false;
  WIZARD_STEPS = WIZARD_STEPS_JOIN;
  wizardStep = 0;
  wizardNext();
}

function wizardStartStandalone() {
  wizardIsJoining = false;
  wizardIsStandalone = true;
  WIZARD_STEPS = WIZARD_STEPS_STANDALONE;
  wizardStep = 0;
  wizardNext();
}

function wizardNext() { wizardStep++; renderWizardStep(); }
function wizardBack() { wizardStep--; renderWizardStep(); }

async function wizardTestConnection() {
  const url = document.getElementById('wizardUrl').value.trim();
  const key = document.getElementById('wizardKey').value.trim();
  const errEl = document.getElementById('wizardCredError');

  if (!url || !key) {
    errEl.textContent = 'Both fields are required.';
    errEl.style.display = '';
    return;
  }

  errEl.style.display = 'none';
  document.getElementById('btnWizardTestConn').textContent = 'Testing...';

  try {
    // Test connection by querying a simple endpoint (schema listing requires service_role, so we use a table query)
    const res = await fetch(`${url}/rest/v1/records?limit=0`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    // 200 = table exists, 404 = table doesn't exist yet (but connection works), both mean key is valid
    if (res.status === 401 || res.status === 403) throw new Error(`Invalid API key (HTTP ${res.status})`);
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);

    wizardUrl = url;
    wizardKey = key;

    if (wizardIsJoining) {
      // Verify tables exist before letting them proceed
      const result = await window.electronAPI.verifyTables(url, key);
      if (!result.ok) {
        errEl.textContent = 'Connected, but database tables were not found. Are you sure this project has been set up? If not, go back and choose "New Organization".';
        errEl.style.display = '';
        document.getElementById('btnWizardTestConn').textContent = 'Test Connection';
        return;
      }
    }

    wizardNext();
  } catch (err) {
    let msg = `Connection failed: ${err.message}`;
    if (err.message.includes('401') || err.message.includes('403')) {
      msg += '\n\nDouble-check your anon key — make sure you copied the entire key (it\'s very long, starting with "eyJ"). Also try the "Publishable" key if the legacy anon key doesn\'t work.';
    } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      msg += '\n\nCould not reach the server. Check your internet connection and make sure the URL is correct (should look like https://abcdefg.supabase.co).';
    }
    errEl.textContent = msg;
    errEl.style.display = '';
    document.getElementById('btnWizardTestConn').textContent = 'Test Connection';
  }
}

function copyWizardSql() {
  navigator.clipboard.writeText(SETUP_SQL).then(() => {
    const msg = document.getElementById('wizardCopyMsg');
    msg.style.display = '';
    setTimeout(() => { msg.style.display = 'none'; }, 2000);
  });
}

async function wizardVerifyTables() {
  const resultEl = document.getElementById('wizardVerifyResult');
  document.getElementById('btnWizardVerify').textContent = 'Verifying...';

  const result = await window.electronAPI.verifyTables(wizardUrl, wizardKey);
  if (result.ok) {
    resultEl.innerHTML = '<span class="wizard-success">All tables verified successfully!</span>';
    setTimeout(() => wizardNext(), 800);
  } else {
    resultEl.innerHTML = `<span class="wizard-error">${esc(result.error)}</span>`;
    document.getElementById('btnWizardVerify').textContent = 'Verify Tables';
  }
}

async function wizardSeedConfig() {
  const resultEl = document.getElementById('wizardSeedResult');
  document.getElementById('btnWizardSeed').textContent = 'Seeding...';

  const result = await window.electronAPI.seedConfig(wizardUrl, wizardKey);
  if (result.ok) {
    resultEl.innerHTML = '<span class="wizard-success">Default configuration uploaded!</span>';
    setTimeout(() => wizardNext(), 800);
  } else {
    resultEl.innerHTML = `<span class="wizard-error">${esc(result.error)}</span>`;
    document.getElementById('btnWizardSeed').textContent = 'Seed Config';
  }
}

async function wizardRegisterDevice() {
  const name = document.getElementById('wizardDeviceName').value.trim();
  const errEl = document.getElementById('wizardDeviceError');
  if (!name) {
    errEl.textContent = 'Please enter a device name.';
    errEl.style.display = '';
    return;
  }

  if (wizardIsStandalone) {
    // Standalone mode: no cloud credentials needed
    // Set standalone mode flag
    await window.electronAPI.setSetting('standaloneMode', 'true');
    // Register device locally (no cloud registration will happen since no creds)
    currentDeviceId = await window.electronAPI.registerDevice(name);
    // Set device role to admin (standalone devices are always admin)
    await window.electronAPI.setSetting('deviceRole', 'admin');
    await window.electronAPI.setDeviceRole('admin');
    wizardNext();
    return;
  }

  // Save credentials first so sync can work
  await window.electronAPI.syncUpdateCredentials(wizardUrl, wizardKey);

  // Register device
  currentDeviceId = await window.electronAPI.registerDevice(name);

  // Explicitly set role: 'standard' for join, 'admin' is set in admin password step
  if (wizardIsJoining) {
    await window.electronAPI.setSetting('deviceRole', 'standard');
    if (window.electronAPI.setDeviceRole) {
      await window.electronAPI.setDeviceRole('standard');
    }
  }
  wizardNext();
}

async function wizardSetAdminPassword() {
  const pw = document.getElementById('wizardAdminPw').value;
  const pwConfirm = document.getElementById('wizardAdminPwConfirm').value;
  const errEl = document.getElementById('wizardAdminPwError');

  if (!pw) { errEl.textContent = 'Please enter a password.'; errEl.style.display = ''; return; }
  if (pw !== pwConfirm) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = ''; return; }
  if (pw.length < 4) { errEl.textContent = 'Password must be at least 4 characters.'; errEl.style.display = ''; return; }

  errEl.style.display = 'none';

  try {
    const result = await window.electronAPI.setAdminPassword(pw);
    if (!result.ok) { errEl.textContent = result.error; errEl.style.display = ''; return; }

    // Set this device as admin
    const roleResult = await window.electronAPI.setDeviceRole('admin');
    if (!roleResult.ok) { errEl.textContent = roleResult.error; errEl.style.display = ''; return; }

    wizardNext();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = '';
  }
}

async function wizardFinish() {
  hideSetupWizard();
  // Initialize sync engine now that credentials are saved
  if (typeof pwaSync !== 'undefined') {
    await pwaSync.init();
  }
  await launchApp();
}

// SQL that users paste into Supabase SQL Editor.
// This MUST stay identical in effect to supabase/setup.sql — the app pushes
// custom_fields, template_id, template_name, and diagnosis_codes on every
// record, and incremental pull relies on the synced_at trigger. Omitting any of
// them permanently breaks record sync for orgs created via this wizard.
const SETUP_SQL = `-- DH Field EMR — Supabase setup (run once). Safe to re-run.
-- Paste this ENTIRE block into your Supabase SQL Editor and click Run.

-- ---------- Patient encounter records ----------
CREATE TABLE IF NOT EXISTS records (
  id UUID PRIMARY KEY,
  device_id TEXT,
  site TEXT,
  date TEXT,
  mrn TEXT,
  given_name TEXT,
  family_name TEXT,
  name TEXT,
  sex TEXT,
  dob TEXT,
  phone TEXT,
  pregnant TEXT,
  breastfeeding TEXT,
  temp TEXT,
  bp TEXT,
  weight TEXT,
  allergies TEXT,
  current_meds TEXT,
  pmh TEXT,
  chief_concern TEXT,
  labs JSONB DEFAULT '{}'::jsonb,
  lab_comments TEXT,
  urinalysis JSONB DEFAULT '{}'::jsonb,
  blood_glucose TEXT,
  diagnosis TEXT,
  diagnosis_codes JSONB DEFAULT '[]'::jsonb,
  medications JSONB DEFAULT '[]'::jsonb,
  treatment_notes TEXT,
  treatment TEXT,
  procedures JSONB DEFAULT '[]'::jsonb,
  transport TEXT,
  travel_time TEXT,
  access_to_care JSONB,
  referral_type TEXT,
  referral_date TEXT,
  referral_status TEXT,
  imaging JSONB,
  surgery JSONB,
  provider TEXT,
  notes TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  template_id TEXT,
  template_name TEXT,
  age_estimated BOOLEAN DEFAULT false,
  saved_at TIMESTAMPTZ,
  sync_version INTEGER DEFAULT 1,
  deleted BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- If you are upgrading an older database, these add the newer columns safely.
ALTER TABLE records ADD COLUMN IF NOT EXISTS diagnosis_codes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE records ADD COLUMN IF NOT EXISTS custom_fields  JSONB DEFAULT '{}'::jsonb;
ALTER TABLE records ADD COLUMN IF NOT EXISTS template_id    TEXT;
ALTER TABLE records ADD COLUMN IF NOT EXISTS template_name  TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_records_date ON records (date);
CREATE INDEX IF NOT EXISTS idx_records_site ON records (site);
CREATE INDEX IF NOT EXISTS idx_records_deleted ON records (deleted);
CREATE INDEX IF NOT EXISTS idx_records_device_id ON records (device_id);
CREATE INDEX IF NOT EXISTS idx_records_saved_at ON records (saved_at);
CREATE INDEX IF NOT EXISTS idx_records_mrn ON records (mrn);
CREATE INDEX IF NOT EXISTS idx_records_referral_type ON records (referral_type);
CREATE INDEX IF NOT EXISTS idx_records_referral_date ON records (referral_date);
CREATE INDEX IF NOT EXISTS idx_records_provider ON records (provider);
CREATE INDEX IF NOT EXISTS idx_records_synced_at ON records (synced_at);

-- ---------- Devices (one row per phone/tablet/laptop) ----------
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'standard',
  org_name TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- Config (presets, form definitions, settings) ----------
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE config  ENABLE ROW LEVEL SECURITY;

-- Each policy is dropped first so this file is safe to re-run: a duplicate
-- CREATE POLICY would otherwise error and abort the whole transaction.
DROP POLICY IF EXISTS "anon_read_records"   ON records;
CREATE POLICY "anon_read_records"   ON records FOR SELECT USING (true);
DROP POLICY IF EXISTS "anon_insert_records" ON records;
CREATE POLICY "anon_insert_records" ON records FOR INSERT WITH CHECK (
  device_id IS NOT NULL AND EXISTS (SELECT 1 FROM devices WHERE id = device_id)
);
DROP POLICY IF EXISTS "anon_update_records" ON records;
CREATE POLICY "anon_update_records" ON records FOR UPDATE USING (
  device_id IS NOT NULL AND EXISTS (SELECT 1 FROM devices WHERE id = device_id)
);

DROP POLICY IF EXISTS "anon_read_devices"   ON devices;
CREATE POLICY "anon_read_devices"   ON devices FOR SELECT USING (true);
DROP POLICY IF EXISTS "anon_insert_devices" ON devices;
CREATE POLICY "anon_insert_devices" ON devices FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_devices" ON devices;
CREATE POLICY "anon_update_devices" ON devices FOR UPDATE USING (true);

DROP POLICY IF EXISTS "anon_read_config"   ON config;
CREATE POLICY "anon_read_config"   ON config FOR SELECT USING (true);
DROP POLICY IF EXISTS "anon_write_config"  ON config;
CREATE POLICY "anon_write_config"  ON config FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_config" ON config;
CREATE POLICY "anon_update_config" ON config FOR UPDATE USING (true);

DROP POLICY IF EXISTS "no_delete_records" ON records;
CREATE POLICY "no_delete_records" ON records FOR DELETE USING (false);
DROP POLICY IF EXISTS "no_delete_devices" ON devices;
CREATE POLICY "no_delete_devices" ON devices FOR DELETE USING (false);
DROP POLICY IF EXISTS "no_delete_config"  ON config;
CREATE POLICY "no_delete_config"  ON config  FOR DELETE USING (false);

-- Server-side timestamp on every write (field device clocks are unreliable).
-- Incremental pull depends on this trigger keeping synced_at fresh.
CREATE OR REPLACE FUNCTION update_synced_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.synced_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_records_synced_at ON records;
CREATE TRIGGER trg_records_synced_at
  BEFORE INSERT OR UPDATE ON records
  FOR EACH ROW
  EXECUTE FUNCTION update_synced_at();`;
