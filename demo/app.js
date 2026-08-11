// ==========================================
// INIT & EVENT LISTENERS
// ==========================================
async function init() {
  // Demo builds seed sample patients + force standalone mode before we read any
  // settings, so the demo opens straight into a populated clinic (no wizard).
  if (window.__demoReady) { try { await window.__demoReady; } catch (e) { console.warn('[demo] bootstrap failed', e); } }

  // Check if running in standalone mode
  const standaloneMode = await window.electronAPI.getSetting('standaloneMode');

  if (standaloneMode === 'true') {
    // Standalone mode — no cloud credentials needed
    currentDeviceId = await window.electronAPI.getDeviceId();
    if (!currentDeviceId) {
      showDeviceSignIn();
      return;
    }
    await launchApp();
    return;
  }

  // Check if Supabase is configured — if not, show setup wizard
  const supabaseUrl = await window.electronAPI.getSetting('supabaseUrl');
  const supabaseKey = await window.electronAPI.getSetting('supabaseKey');

  if (!supabaseUrl || !supabaseKey) {
    // No cloud credentials — show setup wizard
    showSetupWizard();
    return;
  }

  // Check device identity — show sign-in if not registered
  currentDeviceId = await window.electronAPI.getDeviceId();
  if (!currentDeviceId) {
    showDeviceSignIn();
    return;
  }

  await launchApp();
}

function showDeviceSignIn() {
  document.getElementById('deviceSignIn').style.display = '';
  document.getElementById('btnDeviceStart').addEventListener('click', async () => {
    const name = document.getElementById('deviceNameInput').value.trim();
    if (!name) { alert('Please enter a device name.'); return; }
    currentDeviceId = await window.electronAPI.registerDevice(name);
    document.getElementById('deviceSignIn').style.display = 'none';
    await launchApp();
  });
  // Allow Enter key
  document.getElementById('deviceNameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnDeviceStart').click();
  });
}

async function launchApp() {
  // Ensure pwaSync has loaded credentials from IndexedDB into memory before
  // any sync calls happen. Without this, syncNow() silently no-ops on second
  // launches because supabaseUrl/supabaseKey are null in the module closure.
  if (typeof pwaSync !== 'undefined' && typeof pwaSync.init === 'function') {
    try { await pwaSync.init(); } catch (e) { console.warn('pwaSync.init failed:', e); }
  }
  await loadConfig();
  records = await window.electronAPI.getRecords();
  const renderSteps = [
    ['populateSiteSelects', () => populateSiteSelects()],
    ['initAdvancedFilters', () => initAdvancedFilters()],
    ['renderRecords', () => renderRecords()],
    ['renderStats', () => renderStats()],
    ['renderDashboard', () => renderDashboard()],
    ['renderFormulary', () => renderFormulary()],
    ['renderProviders', () => renderProviders()],
    ['renderSites', () => renderSites()],
    ['renderProceduresEditor', () => renderProceduresEditor()],
    ['renderRxPresetsEditor', () => renderRxPresetsEditor()],
    ['renderReferralTypesEditor', () => renderReferralTypesEditor()],
    ['renderDxPresetsEditor', () => renderDxPresetsEditor()],
    ['renderComplaintsEditor', () => renderComplaintsEditor()],
    ['renderLabTestsEditor', () => renderLabTestsEditor()],
    ['renderFormBuilder', () => renderFormBuilder()],
    ['renderLabGrid', () => renderLabGrid()],
    ['renderDxPresets', () => renderDxPresets()],
    ['renderRxPresets', () => renderRxPresets()],
    ['renderComplaintButtons', () => renderComplaintButtons()],
    ['renderProviderButtons', () => renderProviderButtons()],
    ['renderProcedureButtons', () => renderProcedureButtons()],
    ['renderReferralButtons', () => renderReferralButtons()],
    ['updateConfigLockUI', () => updateConfigLockUI()]
  ];
  for (const [name, fn] of renderSteps) {
    try { fn(); } catch (e) { console.error(`launchApp: ${name} failed:`, e); }
  }
  setupEventListeners();

  // Check standalone mode — skip sync and hide sync indicator
  const isStandalone = isStandaloneMode();
  if (isStandalone) {
    const syncIndicator = document.getElementById('syncIndicator');
    if (syncIndicator) syncIndicator.style.display = 'none';
  } else {
    initSyncUI();
  }

  // Offline-durability guidance (iOS eviction defense). Runs on every launch and
  // whenever the app returns to the foreground, so a device running in a Safari
  // tab / without persistent storage is warned before records are lost.
  if (window.StorageHealth && typeof window.StorageHealth.checkAndRender === 'function') {
    window.StorageHealth.checkAndRender().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        window.StorageHealth.checkAndRender().catch(() => {});
      }
    });
  }
}

// NAVIGATION
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + btn.dataset.screen).classList.add('active');
    if (btn.dataset.screen === 'analytics') renderAnalytics();
    if (btn.dataset.screen === 'scheduling') renderScheduling();
    if (btn.dataset.screen === 'admin') renderAdminScreen();
    if (btn.dataset.screen === 'formulary') renderFormBuilder();
  });
});

// EVENT LISTENERS
function _bindClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handler);
  else console.warn('setupEventListeners: element not found:', id);
}

function setupEventListeners() {
  // NOTE: wrap in an arrow so the click PointerEvent is NOT passed as the
  // templateId argument. Passing the event poisoned the saved record (an event
  // object is not structured-cloneable), silently failing the IndexedDB write.
  _bindClick('btnNewEncounter', () => newEncounter());
  _bindClick('panelClose', closePanel);
  _bindClick('btnAddMedLine', () => addMedLine());
  // Toggle button groups
  try {
    initToggleGroup('sexToggle', () => { updateSexDependentFields(); updateMRN(); });
    initToggleGroup('pregnantToggle');
    initToggleGroup('bfToggle');
    // Imaging toggle (inside collapsible)
    initToggleGroup('imagingToggle', (val) => {
      const det = document.getElementById('imagingDetails');
      if (det) det.style.display = val === 'Ultrasound' ? 'block' : 'none';
      if (val !== 'Ultrasound') {
        selectedImagingType = '';
        document.querySelectorAll('#imagingTypeGrid .complaint-btn').forEach(b => b.classList.remove('selected'));
        const f = document.getElementById('fImagingFindings');
        if (f) f.value = '';
      }
    });
    // Surgery toggle (inside collapsible)
    initToggleGroup('surgeryToggle', (val) => {
      const det = document.getElementById('surgeryDetails');
      if (det) det.style.display = val === 'Yes' ? 'block' : 'none';
      if (val !== 'Yes') {
        const t = document.getElementById('fSurgeryType');
        const n = document.getElementById('fSurgeryNotes');
        if (t) t.value = '';
        if (n) n.value = '';
      }
    });
    // Access to Care Y/N toggles
    initToggleGroup('accCareNotProvided', (val) => {
      document.getElementById('accCareNotProvidedNoteRow').style.display = val === 'Yes' ? 'block' : 'none';
    });
    initToggleGroup('accSoughtCareBefore', (val) => {
      document.getElementById('accCareLocationsRow').style.display = val === 'Yes' ? 'block' : 'none';
    });
    initToggleGroup('accDelayedCare', (val) => {
      document.getElementById('accDelayReasonsRow').style.display = val === 'Yes' ? 'block' : 'none';
    });
    initToggleGroup('accDelayedDueToCost');
    initToggleGroup('accDelayedDueToDistance');
    initToggleGroup('accRanOutOfMeds');
    // Urinalysis toggle groups
    UA_PARAMS.forEach(p => initToggleGroup(UA_FIELD_IDS[p]));
  } catch (e) { console.error('setupEventListeners: toggle init error', e); }
  // Imaging type buttons
  document.querySelectorAll('#imagingTypeGrid .complaint-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#imagingTypeGrid .complaint-btn').forEach(b => b.classList.remove('selected'));
      if (selectedImagingType === btn.dataset.val) {
        selectedImagingType = '';
      } else {
        selectedImagingType = btn.dataset.val;
        btn.classList.add('selected');
      }
    });
  });
  // DOB text input — auto-format DD/MM/YYYY + name -> MRN
  try {
    if (typeof wireDOBTextInput === 'function') wireDOBTextInput();
    document.getElementById('fGivenName').addEventListener('input', updateMRN);
    document.getElementById('fFamilyName').addEventListener('input', updateMRN);
    // DOB Unknown checkbox
    document.getElementById('fDOBUnknown').addEventListener('change', function() {
      dobUnknown = this.checked;
      const dob = document.getElementById('fDOB');
      const ageBox = document.getElementById('ageInputContainer');
      if (dob) dob.style.display = dobUnknown ? 'none' : '';
      if (ageBox) ageBox.style.display = dobUnknown ? 'block' : 'none';
      if (!dobUnknown) {
        const ae = document.getElementById('fAgeEstimate');
        if (ae) ae.value = '';
      }
      updateMRN();
    });
    document.getElementById('fAgeEstimate').addEventListener('input', function() {
      const age = parseInt(this.value);
      if (age >= 0 && age < 150) {
        const yr = new Date().getFullYear() - age;
        const isoApprox = yr + '-01-01';
        const dobEl = document.getElementById('fDOB');
        if (dobEl) {
          dobEl.value = '01/01/' + yr;
          dobEl.dataset.iso = isoApprox;
        }
        updateAgeDisplay();
        updateMRN();
      }
    });
  } catch (e) { console.error('setupEventListeners: form fields error', e); }
  // Temperature numeric input + interpretation
  try {
    const tempInput = document.getElementById('fTemp');
    if (tempInput) tempInput.addEventListener('input', updateTempInterp);
    const weightInput = document.getElementById('fWeight');
    if (weightInput) weightInput.addEventListener('input', () => {
      selectedWeight = weightInput.value;
    });
  } catch (e) { console.error('setupEventListeners: vitals input error', e); }
  // Dx sort bar
  _bindClick('dxSortBar', function(e) {
    const btn = e.target.closest('.dx-sort-btn');
    if (!btn) return;
    dxSortMode = btn.dataset.sort;
    this.querySelectorAll('.dx-sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDxPresets();
  });
  const fSiteEl = document.getElementById('fSite');
  if (fSiteEl) fSiteEl.addEventListener('change', function() { setLastSite(this.value); });
  const searchEl = document.getElementById('searchInput');
  if (searchEl) {
    // Debounce so we don't re-render the whole list on every keystroke.
    let _searchDebounce;
    searchEl.addEventListener('input', () => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(renderRecords, 200);
    });
  }
  const siteFilterEl = document.getElementById('siteFilter');
  if (siteFilterEl) siteFilterEl.addEventListener('change', renderRecords);
  // Formulary
  _bindClick('btnAddMed', () => openFormularyModal());
  _bindClick('fmCancel', closeFormularyModal);
  _bindClick('fmSave', saveFormularyItem);
  // Sites
  _bindClick('btnAddSite', () => openSiteModal());
  _bindClick('smCancel', closeSiteModal);
  _bindClick('smSave', saveSiteItem);
  // Physicians
  _bindClick('btnAddProvider', () => openProviderModal());
  _bindClick('pmCancel', closeProviderModal);
  _bindClick('pmSave', saveProviderItem);
  // Procedures Editor
  _bindClick('btnAddProcedureOption', () => openProcedureModal());
  _bindClick('procmCancel', closeProcedureModal);
  _bindClick('procmSave', saveProcedureItem);
  // Complaints Editor
  _bindClick('btnAddComplaint', async () => {
    console.log('[btnAddComplaint] handler fired');
    const name = await customPrompt('Add a new chief complaint:');
    if (!name || !name.trim()) return;
    const complaints = getComplaints();
    complaints.push(name.trim());
    saveComplaints(complaints);
    COMMON_COMPLAINTS = complaints;
    renderComplaintsEditor(); renderComplaintButtons();
  });
  // Referral Types Editor
  _bindClick('btnAddReferralType', async () => {
    console.log('[btnAddReferralType] handler fired');
    const name = await customPrompt('Add a new referral type:');
    if (!name || !name.trim()) return;
    const types = getReferralTypes();
    types.push(name.trim());
    saveReferralTypes(types); renderReferralTypesEditor(); populateReferralSelect();
  });
  // Dx Presets Editor
  _bindClick('btnAddDxPreset', () => { console.log('[btnAddDxPreset] handler fired'); addDxPresetItem(); });
  // Lab Tests Editor
  _bindClick('btnAddLabTest', () => addCustomLabTest());
  _bindClick('ltmCancel', closeLabTestModal);
  _bindClick('ltmSave', saveLabTestItem);
  // Rx Presets Editor
  _bindClick('btnAddRxPreset', () => openRxPresetModal());
  _bindClick('btnAddRpmMedLine', () => addRpmMedLine());
  _bindClick('rpmCancel', closeRxPresetModal);
  _bindClick('rpmSave', saveRxPresetItem);
  // Analytics
  ['analyticsFrom', 'analyticsTo', 'analyticsSite', 'analyticsSex'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', renderAnalytics);
  });
  _bindClick('analyticsReset', () => {
    document.getElementById('analyticsFrom').value = ''; document.getElementById('analyticsTo').value = '';
    document.getElementById('analyticsSite').value = ''; document.getElementById('analyticsSex').value = ''; renderAnalytics();
  });
  _bindClick('analyticsExport', () => exportCSV(getFilteredRecords()));
  _bindClick('btnDonorReport', generateDonorReport);

  // IPC events
  window.electronAPI.onNewEncounter(() => newEncounter());
  window.electronAPI.onExportCSV(() => exportCSV());
  window.electronAPI.onRecordsRestored(async () => { records = await window.electronAPI.getRecords(); renderRecords(); renderStats(); renderDashboard(); });

  // Sync-down events — refresh when other devices push data
  window.electronAPI.onRecordsUpdated(async () => {
    records = await window.electronAPI.getRecords();
    renderRecords();
    renderStats();
    renderDashboard();
  });
  window.electronAPI.onConfigUpdated(async () => {
    await loadConfig();
    populateSiteSelects();
    populateFilterDropdowns();
    populateReferralSelect();
    updateConfigLockUI();
    renderFormulary();
    renderProviders();
    renderSites();
    renderProceduresEditor();
    renderRxPresetsEditor();
    renderReferralTypesEditor();
    renderDxPresetsEditor();
    renderLabTestsEditor();
    // These were missing, so synced changes to chief complaints, lab tests,
    // and form templates never refreshed on other devices until a full reload.
    renderComplaintsEditor();
    renderFormBuilder();
    // Widgets INSIDE the encounter form rebuild their DOM from scratch, which
    // would wipe a clinician's in-progress entry (the lab grid holds POS/NEG and
    // typed values only in the DOM). Only refresh them when no encounter is open;
    // they re-render anyway the next time the form is opened.
    const _enc = document.getElementById('encounterPanel');
    if (!_enc || !_enc.classList.contains('open')) {
      renderProviderButtons();
      renderProcedureButtons();
      renderRxPresets();
      renderDxPresets();
      renderComplaintButtons();
      renderLabGrid();
    }
    // Section visibility removed — all sections always visible
  });
}

init();
