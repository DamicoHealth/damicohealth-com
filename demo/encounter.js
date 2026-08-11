// ==========================================
// ENCOUNTER PANEL — SINGLE-PAGE FORM
// ==========================================

// Urinalysis collapse toggle (kept for the inline section in Labs card)
function toggleUrinalysisCollapse() {
  const content = document.getElementById('uaCollapsible');
  const btn = document.getElementById('uaCollapseBtn');
  if (!content || !btn) return;
  if (content.style.display === 'none') {
    content.style.display = 'block';
    btn.innerHTML = 'Urinalysis &#9660;';
  } else {
    content.style.display = 'none';
    btn.innerHTML = 'Urinalysis &#9654;';
  }
}

// Imaging / Surgery collapsible cards
function toggleImagingCollapse() {
  const body = document.getElementById('imagingCollapsible');
  const arrow = document.getElementById('imagingArrow');
  if (!body || !arrow) return;
  if (body.style.display === 'none') { body.style.display = 'block'; arrow.innerHTML = '&#9660;'; }
  else { body.style.display = 'none'; arrow.innerHTML = '&#9654;'; }
}
function toggleSurgeryCollapse() {
  const body = document.getElementById('surgeryCollapsible');
  const arrow = document.getElementById('surgeryArrow');
  if (!body || !arrow) return;
  if (body.style.display === 'none') { body.style.display = 'block'; arrow.innerHTML = '&#9660;'; }
  else { body.style.display = 'none'; arrow.innerHTML = '&#9654;'; }
}

// ==========================================
// PANEL OPEN / CLOSE
// ==========================================
function openPanel() {
  const panel = document.getElementById('encounterPanel');
  panel.classList.add('open');
  // Auto-scroll to top of body
  const body = document.getElementById('encounterPanelBody');
  if (body) body.scrollTop = 0;
}
function closePanel() {
  document.getElementById('encounterPanel').classList.remove('open');
  editingRecordId = null;
  panelMode = 'new';
}

// View vs edit mode toggle
function showViewMode() {
  document.getElementById('viewModeContent').style.display = 'block';
  document.getElementById('editModeContent').style.display = 'none';
  renderViewRecord();
}
// The form template (encounter type) the panel is currently showing.
let currentEncounterTemplateId = null;

// When multiple form templates are active, ask the clinician which to use.
function showTemplatePicker() {
  if (!window.FormSchema) { newEncounter(null); return; }
  const active = window.FormSchema.getActiveTemplates();
  let overlay = document.getElementById('templatePicker');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'templatePicker';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div class="modal tpl-picker">
      <h3>New encounter — choose a form</h3>
      <div class="tpl-picker-grid">
        ${active.map((t) => `<button type="button" class="tpl-picker-btn" data-tpl="${esc(t.id)}">${esc(t.name)}</button>`).join('')}
      </div>
      <div class="modal-actions"><button class="btn btn-secondary" id="tplPickerCancel">Cancel</button></div>
    </div>`;
  overlay.style.display = 'flex';
  overlay.querySelectorAll('.tpl-picker-btn').forEach((b) =>
    b.addEventListener('click', () => { overlay.style.display = 'none'; newEncounter(b.dataset.tpl); }));
  const cancel = document.getElementById('tplPickerCancel');
  if (cancel) cancel.addEventListener('click', () => { overlay.style.display = 'none'; });
}

function showEditMode() {
  document.getElementById('viewModeContent').style.display = 'none';
  document.getElementById('editModeContent').style.display = 'block';
  // Apply the chosen form template (show/hide & rename sections; render custom sections)
  if (window.FormSchema) {
    window.FormSchema.applyFormSchema(null, currentEncounterTemplateId);
    const rec = editingRecordId ? records.find((r) => r.id === editingRecordId) : null;
    window.FormSchema.populateCustomFields(rec && rec.customFields ? rec.customFields : {});
  }
  // Collapsible sections + sticky section jump-bar (tames the long form)
  if (window.FormNav) window.FormNav.refresh();
  // Auto-scroll to top
  const body = document.getElementById('encounterPanelBody');
  if (body) body.scrollTop = 0;
}

// Backward-compat shim — older callers may invoke switchTab(); route them to edit mode
function switchTab(tabName) {
  if (tabName === 'view') showViewMode();
  else showEditMode();
}

// ==========================================
// NEW / OPEN / EDIT
// ==========================================
function newEncounter(templateId) {
  try {
    // If more than one form template is active, ask which to use first.
    if (!templateId && window.FormSchema) {
      const active = window.FormSchema.getActiveTemplates();
      if (active.length > 1) { showTemplatePicker(); return; }
      templateId = active.length ? active[0].id : null;
    }
    currentEncounterTemplateId = templateId || (window.FormSchema && window.FormSchema.getActiveTemplateId());
    panelMode = 'new';
    editingRecordId = null;
    selectedDxPresets = new Set();
    selectedRxPresets = new Set();
    selectedComplaints = new Set();
    accessCareLocations = new Set();
    accessCareBarriers = new Set();
    accessPainLevel = null;
    resetForm();
    const lastSite = getLastSite();
    if (lastSite) {
      const siteEl = document.getElementById('fSite');
      if (siteEl) siteEl.value = lastSite;
    }
    renderDxPresets();
    renderRxPresets();
    renderAllAccessToCare();
    document.getElementById('panelTitle').textContent = 'New Encounter';
    document.getElementById('btnDeleteRecord').style.display = 'none';
    const btnDelView = document.getElementById('btnDeleteRecordView');
    if (btnDelView) btnDelView.style.display = 'none';
    document.getElementById('btnSaveNewRecord').style.display = '';
    showEditMode();
    openPanel();
  } catch (err) {
    console.error('newEncounter error:', err);
    alert('Error opening encounter: ' + err.message);
  }
}

function openRecord(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  currentEncounterTemplateId = rec.templateId || (window.FormSchema && window.FormSchema.getActiveTemplateId());
  panelMode = 'view';
  editingRecordId = id;
  selectedDxPresets = new Set();
  selectedRxPresets = new Set();
  selectedComplaints = new Set();
  accessCareLocations = new Set();
  accessCareBarriers = new Set();
  accessPainLevel = null;
  populateForm(rec);
  renderDxPresets();
  renderRxPresets();
  renderAllAccessToCare();
  const recDisplayName = rec.givenName ? [rec.givenName, rec.familyName].filter(Boolean).join(' ') : rec.name;
  document.getElementById('panelTitle').textContent = `Record: ${recDisplayName || 'Unknown'}`;
  document.getElementById('btnDeleteRecord').style.display = '';
  const btnDelView = document.getElementById('btnDeleteRecordView');
  if (btnDelView) btnDelView.style.display = '';
  document.getElementById('btnSaveNewRecord').style.display = 'none';
  showViewMode();
  openPanel();
}

function editRecord() {
  panelMode = 'edit';
  const gn = document.getElementById('fGivenName').value;
  const fn = document.getElementById('fFamilyName').value;
  document.getElementById('panelTitle').textContent = `Editing: ${[gn, fn].filter(Boolean).join(' ') || 'Unknown'}`;
  showEditMode();
}

// ==========================================
// FORM RESET / POPULATE
// ==========================================
function resetForm() {
  try {
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  setVal('fSite', '');
  setVal('fDate', new Date().toISOString().slice(0, 10));
  setVal('fMRN', '');
  setVal('fGivenName', '');
  setVal('fFamilyName', '');
  setToggleValue('sexToggle', '');
  // DOB text input
  const dobEl = document.getElementById('fDOB');
  if (dobEl) { dobEl.value = ''; if (dobEl.dataset) dobEl.dataset.iso = ''; }
  const ageDisp = document.getElementById('ageDisplay');
  if (ageDisp) ageDisp.textContent = '';
  dobUnknown = false;
  const dobUnkCb = document.getElementById('fDOBUnknown');
  if (dobUnkCb) dobUnkCb.checked = false;
  if (dobEl) dobEl.style.display = '';
  const ageContainer = document.getElementById('ageInputContainer');
  if (ageContainer) ageContainer.style.display = 'none';
  setVal('fAgeEstimate', '');
  setVal('fPhone', '256');
  setToggleValue('pregnantToggle', 'N/A');
  setToggleValue('bfToggle', 'N/A');
  updateSexDependentFields();
  // Vitals
  selectedTemp = '';
  setVal('fTemp', '');
  const tInterp = document.getElementById('tempInterp');
  if (tInterp) tInterp.innerHTML = '';
  setVal('fBP', '');
  selectedWeight = '';
  setVal('fWeight', '');
  setVal('fAllergies', '');
  setVal('fCurrentMeds', '');
  setVal('fPMH', '');
  setVal('fChiefConcern', '');
  selectedComplaints = new Set();
  renderComplaintButtons();
  // Access to Care
  accessCareLocations = new Set();
  accessCareBarriers = new Set();
  accessPainLevel = null;
  setToggleValue('accCareNotProvided', '');
  setVal('accCareNotProvidedNote', '');
  document.getElementById('accCareNotProvidedNoteRow').style.display = 'none';
  setToggleValue('accSoughtCareBefore', '');
  document.getElementById('accCareLocationsRow').style.display = 'none';
  setVal('accCareLocationOther', '');
  document.getElementById('accCareLocationOtherRow').style.display = 'none';
  setVal('accCareBarrierOther', '');
  document.getElementById('accCareBarrierOtherRow').style.display = 'none';
  setToggleValue('accDelayedCare', '');
  document.getElementById('accDelayReasonsRow').style.display = 'none';
  setToggleValue('accDelayedDueToCost', '');
  setToggleValue('accDelayedDueToDistance', '');
  setToggleValue('accRanOutOfMeds', '');
  _accTravelDistance = null;
  _accTravelTime = null;
  _accTransportType = null;
  setVal('accTransportTypeOther', '');
  document.getElementById('accTransportTypeOtherRow').style.display = 'none';
  // Labs / urinalysis
  setVal('fLabComments', '');
  UA_PARAMS.forEach(p => { setToggleValue(UA_FIELD_IDS[p], ''); });
  const uaContent = document.getElementById('uaCollapsible');
  const uaBtn = document.getElementById('uaCollapseBtn');
  if (uaContent) uaContent.style.display = 'none';
  if (uaBtn) uaBtn.innerHTML = 'Urinalysis &#9654;';
  setVal('fDiagnosis', '');
  if (window.ICD10) window.ICD10.reset();
  setVal('fTreatmentNotes', '');
  selectedProcedures = [];
  renderProcedureButtons();
  // Imaging
  selectedImagingType = '';
  setToggleValue('imagingToggle', '');
  const imgDetails = document.getElementById('imagingDetails');
  if (imgDetails) imgDetails.style.display = 'none';
  document.querySelectorAll('#imagingTypeGrid .complaint-btn').forEach(b => b.classList.remove('selected'));
  setVal('fImagingFindings', '');
  // Collapse imaging body
  const imgBody = document.getElementById('imagingCollapsible');
  if (imgBody) imgBody.style.display = 'none';
  const imgArr = document.getElementById('imagingArrow');
  if (imgArr) imgArr.innerHTML = '&#9654;';
  // Surgery
  setToggleValue('surgeryToggle', '');
  const surgDetails = document.getElementById('surgeryDetails');
  if (surgDetails) surgDetails.style.display = 'none';
  setVal('fSurgeryType', '');
  setVal('fSurgeryNotes', '');
  const surgBody = document.getElementById('surgeryCollapsible');
  if (surgBody) surgBody.style.display = 'none';
  const surgArr = document.getElementById('surgeryArrow');
  if (surgArr) surgArr.innerHTML = '&#9654;';
  // Referral / provider
  selectedReferralType = 'None';
  renderReferralButtons();
  setVal('fReferralDate', '');
  document.getElementById('referralDateRow').style.display = 'none';
  selectedProvider = '';
  renderProviderButtons();
  setVal('fNotes', '');
  resetLabs();
  document.getElementById('medBuilder').innerHTML = '';
  hideReturnPatientBanner();
  } catch (err) { console.error('resetForm error:', err); }
}

// Single-select state for Access to Care travel/transport pills
let _accTravelDistance = null;
let _accTravelTime = null;
let _accTransportType = null;

function renderAllAccessToCare() {
  // Pain level
  if (typeof renderPainLevelButtons === 'function') renderPainLevelButtons();
  // Multi-select pills
  if (typeof renderMultiSelectPills === 'function') {
    renderMultiSelectPills('accCareLocations', CARE_LOCATION_OPTIONS, accessCareLocations, () => {
      const showOther = accessCareLocations.has('Other');
      document.getElementById('accCareLocationOtherRow').style.display = showOther ? 'block' : 'none';
    });
    renderMultiSelectPills('accCareBarriers', CARE_BARRIER_OPTIONS, accessCareBarriers, () => {
      const showOther = accessCareBarriers.has('Other');
      document.getElementById('accCareBarrierOtherRow').style.display = showOther ? 'block' : 'none';
    });
  }
  // Single-select pills
  if (typeof renderSingleSelectPills === 'function') {
    renderSingleSelectPills('accTravelDistance', TRAVEL_DISTANCE_OPTIONS, _accTravelDistance, (val) => {
      _accTravelDistance = val;
      renderAllAccessToCare();
    });
    renderSingleSelectPills('accTravelTime', TRAVEL_TIME_OPTIONS, _accTravelTime, (val) => {
      _accTravelTime = val;
      renderAllAccessToCare();
    });
    renderSingleSelectPills('accTransportType', TRANSPORT_TYPE_OPTIONS, _accTransportType, (val) => {
      _accTransportType = val;
      const showOther = val === 'Other';
      document.getElementById('accTransportTypeOtherRow').style.display = showOther ? 'block' : 'none';
      renderAllAccessToCare();
    });
  }
}

function populateForm(rec) {
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const siteSelect = document.getElementById('fSite');
  const siteVal = rec.site || '';
  if (siteSelect) {
    siteSelect.value = siteVal;
    if (siteVal && siteSelect.value !== siteVal) {
      const opt = document.createElement('option');
      opt.value = siteVal;
      opt.textContent = siteVal;
      siteSelect.appendChild(opt);
      siteSelect.value = siteVal;
    }
  }
  setVal('fDate', rec.date || '');
  setVal('fMRN', rec.mrn || '');
  if (rec.givenName !== undefined) {
    setVal('fGivenName', rec.givenName || '');
    setVal('fFamilyName', rec.familyName || '');
  } else {
    const parts = (rec.name || '').split(' ');
    setVal('fGivenName', parts[0] || '');
    setVal('fFamilyName', parts.slice(1).join(' ') || '');
  }
  setToggleValue('sexToggle', rec.sex || '');
  // DOB text input
  const dobEl = document.getElementById('fDOB');
  if (dobEl) {
    if (rec.dob) {
      dobEl.value = isoToDOBString(rec.dob);
      dobEl.dataset.iso = rec.dob;
    } else {
      dobEl.value = '';
      dobEl.dataset.iso = '';
    }
  }
  if (rec.ageEstimated) {
    dobUnknown = true;
    const cb = document.getElementById('fDOBUnknown');
    if (cb) cb.checked = true;
    if (dobEl) dobEl.style.display = 'none';
    const ageContainer = document.getElementById('ageInputContainer');
    if (ageContainer) ageContainer.style.display = 'block';
    setVal('fAgeEstimate', rec.dob ? calcAge(rec.dob) : '');
  } else {
    dobUnknown = false;
    const cb = document.getElementById('fDOBUnknown');
    if (cb) cb.checked = false;
    if (dobEl) dobEl.style.display = '';
    const ageContainer = document.getElementById('ageInputContainer');
    if (ageContainer) ageContainer.style.display = 'none';
  }
  updateAgeDisplay();
  updateMRN();
  setVal('fPhone', rec.phone || '');
  setToggleValue('pregnantToggle', rec.pregnant || 'N/A');
  setToggleValue('bfToggle', rec.breastfeeding || 'N/A');
  updateSexDependentFields();
  // Numeric vitals
  selectedTemp = rec.temp || '';
  setVal('fTemp', rec.temp || '');
  if (typeof updateTempInterp === 'function') updateTempInterp();
  setVal('fBP', rec.bp || '');
  selectedWeight = rec.weight || '';
  // Strip 'kg' if present
  const wRaw = (rec.weight || '').toString().replace(/kg/i, '').trim();
  setVal('fWeight', wRaw);
  setVal('fAllergies', rec.allergies || '');
  setVal('fCurrentMeds', rec.currentMeds || '');
  setVal('fPMH', rec.pmh || '');
  setVal('fChiefConcern', rec.chiefConcern || '');
  selectedComplaints = new Set();
  COMMON_COMPLAINTS.forEach((c, i) => { if (rec.chiefConcern && rec.chiefConcern.includes(c)) selectedComplaints.add(i); });
  renderComplaintButtons();
  // Access to Care
  populateAccessToCare(rec.accessToCare);
  // Lab comments / UA
  setVal('fLabComments', rec.labComments || '');
  if (rec.urinalysis) {
    UA_PARAMS.forEach(p => { setToggleValue(UA_FIELD_IDS[p], rec.urinalysis[p] || ''); });
    const uaContent = document.getElementById('uaCollapsible');
    const uaBtn = document.getElementById('uaCollapseBtn');
    if (uaContent && uaBtn) {
      const hasData = UA_PARAMS.some(p => rec.urinalysis[p]);
      if (hasData) { uaContent.style.display = 'block'; uaBtn.innerHTML = 'Urinalysis &#9660;'; }
    }
  } else {
    UA_PARAMS.forEach(p => { setToggleValue(UA_FIELD_IDS[p], ''); });
  }
  setVal('fDiagnosis', rec.diagnosis || '');
  if (window.ICD10) window.ICD10.set(rec.diagnosisCodes || []);
  setVal('fTreatmentNotes', rec.treatmentNotes || '');
  selectedProcedures = rec.procedures ? [...rec.procedures] : [];
  renderProcedureButtons();
  // Imaging
  if (rec.imaging && rec.imaging.type) {
    selectedImagingType = rec.imaging.type;
    setToggleValue('imagingToggle', 'Ultrasound');
    document.getElementById('imagingDetails').style.display = 'block';
    document.querySelectorAll('#imagingTypeGrid .complaint-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.val === rec.imaging.type);
    });
    setVal('fImagingFindings', rec.imaging.findings || '');
    // Auto-expand the imaging card
    const imgBody = document.getElementById('imagingCollapsible');
    const imgArr = document.getElementById('imagingArrow');
    if (imgBody) imgBody.style.display = 'block';
    if (imgArr) imgArr.innerHTML = '&#9660;';
  } else {
    selectedImagingType = '';
    setToggleValue('imagingToggle', '');
    document.getElementById('imagingDetails').style.display = 'none';
    document.querySelectorAll('#imagingTypeGrid .complaint-btn').forEach(b => b.classList.remove('selected'));
    setVal('fImagingFindings', '');
  }
  // Surgery
  if (rec.surgery && rec.surgery.type) {
    setToggleValue('surgeryToggle', 'Yes');
    document.getElementById('surgeryDetails').style.display = 'block';
    setVal('fSurgeryType', rec.surgery.type || '');
    setVal('fSurgeryNotes', rec.surgery.notes || '');
    const surgBody = document.getElementById('surgeryCollapsible');
    const surgArr = document.getElementById('surgeryArrow');
    if (surgBody) surgBody.style.display = 'block';
    if (surgArr) surgArr.innerHTML = '&#9660;';
  } else {
    setToggleValue('surgeryToggle', '');
    document.getElementById('surgeryDetails').style.display = 'none';
    setVal('fSurgeryType', '');
    setVal('fSurgeryNotes', '');
  }
  selectedReferralType = rec.referralType || 'None';
  renderReferralButtons();
  const dateRow = document.getElementById('referralDateRow');
  if (dateRow) {
    dateRow.style.display = (selectedReferralType && selectedReferralType !== 'None') ? 'block' : 'none';
    setVal('fReferralDate', rec.referralDate || '');
  }
  selectedProvider = rec.provider || '';
  renderProviderButtons();
  setVal('fNotes', rec.notes || '');
  // Labs (legacy migration: if bloodGlucose was stored separately, merge it into labs)
  const labsToPopulate = rec.labs ? { ...rec.labs } : {};
  if (rec.bloodGlucose && (!labsToPopulate['Blood Glucose'] || !labsToPopulate['Blood Glucose'].ordered)) {
    labsToPopulate['Blood Glucose'] = { ordered: true, value: rec.bloodGlucose, unit: 'mg/dL', type: 'numeric', interpretation: '' };
  }
  populateLabData(labsToPopulate);
  document.getElementById('medBuilder').innerHTML = '';
  if (rec.medications && rec.medications.length) {
    rec.medications.forEach(m => addMedLine(m.medId, m.dose, m.freq, m.duration));
  }
}

function populateAccessToCare(atc) {
  // Clear all
  accessCareLocations = new Set();
  accessCareBarriers = new Set();
  accessPainLevel = null;
  _accTravelDistance = null;
  _accTravelTime = null;
  _accTransportType = null;
  setToggleValue('accCareNotProvided', '');
  setToggleValue('accSoughtCareBefore', '');
  setToggleValue('accDelayedCare', '');
  setToggleValue('accDelayedDueToCost', '');
  setToggleValue('accDelayedDueToDistance', '');
  setToggleValue('accRanOutOfMeds', '');
  document.getElementById('accCareNotProvidedNoteRow').style.display = 'none';
  document.getElementById('accCareLocationsRow').style.display = 'none';
  document.getElementById('accCareLocationOtherRow').style.display = 'none';
  document.getElementById('accCareBarrierOtherRow').style.display = 'none';
  document.getElementById('accDelayReasonsRow').style.display = 'none';
  document.getElementById('accTransportTypeOtherRow').style.display = 'none';

  if (!atc || typeof atc !== 'object') {
    renderAllAccessToCare();
    return;
  }

  if (atc.careNotProvided) {
    setToggleValue('accCareNotProvided', atc.careNotProvided);
    if (atc.careNotProvided === 'Yes') {
      document.getElementById('accCareNotProvidedNoteRow').style.display = 'block';
      document.getElementById('accCareNotProvidedNote').value = atc.careNotProvidedNote || '';
    }
  }
  if (typeof atc.painLevel === 'number') accessPainLevel = atc.painLevel;
  if (atc.soughtCareBefore) {
    setToggleValue('accSoughtCareBefore', atc.soughtCareBefore);
    if (atc.soughtCareBefore === 'Yes') {
      document.getElementById('accCareLocationsRow').style.display = 'block';
    }
  }
  if (Array.isArray(atc.careLocations)) accessCareLocations = new Set(atc.careLocations);
  if (atc.careLocationOther) {
    document.getElementById('accCareLocationOther').value = atc.careLocationOther;
    if (accessCareLocations.has('Other')) {
      document.getElementById('accCareLocationOtherRow').style.display = 'block';
    }
  }
  if (Array.isArray(atc.careBarriers)) accessCareBarriers = new Set(atc.careBarriers);
  if (atc.careBarrierOther) {
    document.getElementById('accCareBarrierOther').value = atc.careBarrierOther;
    if (accessCareBarriers.has('Other')) {
      document.getElementById('accCareBarrierOtherRow').style.display = 'block';
    }
  }
  if (atc.delayedCare) {
    setToggleValue('accDelayedCare', atc.delayedCare);
    if (atc.delayedCare === 'Yes') {
      document.getElementById('accDelayReasonsRow').style.display = 'block';
      if (atc.delayedDueToCost) setToggleValue('accDelayedDueToCost', atc.delayedDueToCost);
      if (atc.delayedDueToDistance) setToggleValue('accDelayedDueToDistance', atc.delayedDueToDistance);
    }
  }
  if (atc.ranOutOfMeds) setToggleValue('accRanOutOfMeds', atc.ranOutOfMeds);
  _accTravelDistance = atc.travelDistance || null;
  _accTravelTime = atc.travelTime || null;
  _accTransportType = atc.transportType || null;
  if (atc.transportTypeOther) {
    document.getElementById('accTransportTypeOther').value = atc.transportTypeOther;
    if (atc.transportType === 'Other') {
      document.getElementById('accTransportTypeOtherRow').style.display = 'block';
    }
  }
  renderAllAccessToCare();
}

function collectAccessToCare() {
  const result = {
    careNotProvided: getToggleValue('accCareNotProvided') || null,
    careNotProvidedNote: document.getElementById('accCareNotProvidedNote').value || '',
    painLevel: (typeof accessPainLevel === 'number') ? accessPainLevel : null,
    soughtCareBefore: getToggleValue('accSoughtCareBefore') || null,
    careLocations: [...accessCareLocations],
    careLocationOther: document.getElementById('accCareLocationOther').value || '',
    careBarriers: [...accessCareBarriers],
    careBarrierOther: document.getElementById('accCareBarrierOther').value || '',
    delayedCare: getToggleValue('accDelayedCare') || null,
    delayedDueToCost: getToggleValue('accDelayedDueToCost') || null,
    delayedDueToDistance: getToggleValue('accDelayedDueToDistance') || null,
    ranOutOfMeds: getToggleValue('accRanOutOfMeds') || null,
    travelDistance: _accTravelDistance || null,
    travelTime: _accTravelTime || null,
    transportType: _accTransportType || null,
    transportTypeOther: document.getElementById('accTransportTypeOther').value || ''
  };
  // Detect if any meaningful data was entered — return null if completely empty
  const hasData =
    result.careNotProvided || result.painLevel !== null || result.soughtCareBefore ||
    result.careLocations.length > 0 || result.careBarriers.length > 0 ||
    result.delayedCare || result.ranOutOfMeds ||
    result.travelDistance || result.travelTime || result.transportType;
  return hasData ? result : null;
}

// ==========================================
// COLLECT FORM DATA
// ==========================================
function collectFormData() {
  const labs = collectLabData();
  // Extract blood glucose for backward compatibility
  const bgLabData = labs['Blood Glucose'];
  const bloodGlucoseVal = (bgLabData && bgLabData.ordered) ? bgLabData.value : '';

  const medications = [];
  document.querySelectorAll('.med-line').forEach(line => {
    const medId = line.querySelector('.med-drug-select').value;
    const dose = line.querySelector('.med-dose-input').value;
    const freq = line.querySelector('.med-freq-select').value;
    const duration = line.querySelector('.med-dur-select').value;
    if (medId) {
      const qtyInfo = calcMedQty(medId, dose, freq, duration);
      medications.push({ id: crypto.randomUUID(), medId, dose, freq, duration, qty: qtyInfo ? qtyInfo.qty : null, qtyUnit: qtyInfo ? qtyInfo.unit : null });
    }
  });

  const formulary = getFormulary();
  const treatmentLines = medications.map(m => {
    const med = formulary.find(f => f.id === m.medId);
    const name = med ? med.name : m.medId;
    const freqLabel = FREQUENCIES.find(f => f.value === m.freq)?.label || m.freq;
    return `${name} ${m.dose} ${freqLabel} x ${m.duration}`;
  });
  const treatmentNotesVal = document.getElementById('fTreatmentNotes').value;
  if (treatmentNotesVal.trim()) treatmentLines.push('Notes: ' + treatmentNotesVal.trim());

  const urinalysis = {};
  let uaOrdered = false;
  UA_PARAMS.forEach(p => {
    urinalysis[p] = getToggleValue(UA_FIELD_IDS[p]) || '';
    if (urinalysis[p]) uaOrdered = true;
  });

  const givenName = document.getElementById('fGivenName').value;
  const familyName = document.getElementById('fFamilyName').value;
  const fullName = [givenName, familyName].filter(Boolean).join(' ');

  // DOB: pull from text input -> ISO
  const dobEl = document.getElementById('fDOB');
  let dobIso = '';
  if (dobEl) {
    if (dobEl.dataset && dobEl.dataset.iso) dobIso = dobEl.dataset.iso;
    else if (dobEl.type === 'date') dobIso = dobEl.value;
    else dobIso = parseDOBString(dobEl.value);
  }
  // Vitals from numeric inputs
  const tempVal = document.getElementById('fTemp')?.value || '';
  const weightVal = document.getElementById('fWeight')?.value || '';

  // Access to Care
  const accessToCare = collectAccessToCare();
  // For backward compat fill in legacy transport/travelTime if user supplied them via Access to Care
  const legacyTransport = (accessToCare && accessToCare.transportType) ? accessToCare.transportType : '';
  const legacyTravelTime = (accessToCare && accessToCare.travelTime) ? accessToCare.travelTime : '';

  return {
    id: editingRecordId || crypto.randomUUID(),
    site: document.getElementById('fSite').value,
    date: document.getElementById('fDate').value,
    mrn: document.getElementById('fMRN').value,
    givenName, familyName, name: fullName,
    sex: getToggleValue('sexToggle'),
    dob: dobIso,
    phone: document.getElementById('fPhone').value,
    pregnant: getToggleValue('pregnantToggle'),
    breastfeeding: getToggleValue('bfToggle'),
    temp: tempVal,
    bp: document.getElementById('fBP').value.trim(),
    weight: weightVal,
    allergies: document.getElementById('fAllergies').value,
    currentMeds: document.getElementById('fCurrentMeds').value,
    pmh: document.getElementById('fPMH').value,
    chiefConcern: document.getElementById('fChiefConcern').value,
    transport: legacyTransport,
    travelTime: legacyTravelTime,
    accessToCare,
    labs, labComments: document.getElementById('fLabComments').value,
    urinalysis: uaOrdered ? urinalysis : null,
    diagnosis: document.getElementById('fDiagnosis').value,
    diagnosisCodes: (window.ICD10 ? window.ICD10.get() : []),
    medications, treatmentNotes: treatmentNotesVal, treatment: treatmentLines.join('; '),
    procedures: [...selectedProcedures],
    imaging: selectedImagingType ? {
      modality: 'Ultrasound',
      type: selectedImagingType,
      findings: document.getElementById('fImagingFindings').value
    } : null,
    surgery: getToggleValue('surgeryToggle') === 'Yes' ? {
      type: document.getElementById('fSurgeryType').value.trim(),
      notes: document.getElementById('fSurgeryNotes').value.trim()
    } : null,
    referralType: selectedReferralType,
    referralDate: (selectedReferralType && selectedReferralType !== 'None') ? document.getElementById('fReferralDate').value : '',
    provider: selectedProvider,
    notes: document.getElementById('fNotes').value,
    ageEstimated: dobUnknown,
    bloodGlucose: bloodGlucoseVal,
    templateId: currentEncounterTemplateId || (window.FormSchema && window.FormSchema.getActiveTemplateId()) || null,
    templateName: (function () {
      if (window.FormSchema && currentEncounterTemplateId) {
        const t = (window.FormSchema.getTemplates() || []).find((t) => t.id === currentEncounterTemplateId);
        if (t) return t.name || '';
      }
      // Template was deleted — keep the record's original name rather than blanking it.
      const prev = editingRecordId ? records.find((r) => r.id === editingRecordId) : null;
      return (prev && prev.templateName) || '';
    })(),
    customFields: (function () {
      const collected = window.FormSchema ? window.FormSchema.collectCustomFields() : {};
      const prev = editingRecordId ? records.find((r) => r.id === editingRecordId) : null;
      if (!prev || !prev.customFields || typeof prev.customFields !== 'object') return collected;
      // Preserve prior answers ONLY for fields NOT in the currently rendered schema
      // (a hidden/deleted section, or a different template). Fields that ARE
      // rendered are authoritative from `collected`, so clearing a visible field
      // truly clears it — instead of the old value being merged back in.
      const activeIds = (window.FormSchema && window.FormSchema.getActiveCustomFieldIds)
        ? new Set(window.FormSchema.getActiveCustomFieldIds(currentEncounterTemplateId))
        : null;
      const merged = {};
      for (const k in prev.customFields) {
        if (!activeIds || !activeIds.has(k)) merged[k] = prev.customFields[k];
      }
      Object.assign(merged, collected);
      return merged;
    })(),
    savedAt: new Date().toISOString()
  };
}

// ==========================================
// SAVE / DELETE
// ==========================================
let _saveInProgress = false;
async function saveRecord(andNew) {
  if (_saveInProgress) return; // guard: an iPad double-tap must not create duplicate records
  _saveInProgress = true;
  try {
  const data = collectFormData();
  // Required fields validation
  const missing = [];
  if (!data.givenName || !data.givenName.trim()) missing.push('Given Name');
  if (!data.familyName || !data.familyName.trim()) missing.push('Family Name');
  if (!data.site) missing.push('Site');
  if (!data.date) missing.push('Date');
  if (!data.sex || (data.sex !== 'M' && data.sex !== 'F')) missing.push('Sex (M or F)');
  // DOB required only when not "Unknown"
  if (!dobUnknown && !data.dob) missing.push('Date of Birth (DD/MM/YYYY)');
  if (!data.mrn) missing.push('MRN (auto-generates from name + DOB)');
  if (missing.length > 0) {
    alert('Please complete the following required fields:\n\n- ' + missing.join('\n- '));
    return;
  }
  // Plausibility validation — catch obvious data-entry mistakes before saving.
  const problems = [];
  const _endToday = new Date(); _endToday.setHours(23, 59, 59, 999);
  if (data.dob) { const d = new Date(data.dob); if (!isNaN(d.getTime()) && d > _endToday) problems.push('Date of Birth is in the future.'); }
  if (data.date) { const d = new Date(data.date); if (!isNaN(d.getTime()) && d > _endToday) problems.push('Encounter date is in the future.'); }
  if (data.temp) { const t = parseFloat(data.temp); if (!isNaN(t) && (t < 25 || t > 45)) problems.push('Temperature ' + data.temp + ' °C is outside a plausible range (25–45).'); }
  if (problems.length > 0) {
    alert('Please check the following before saving:\n\n- ' + problems.join('\n- '));
    return;
  }
  if (data.site) setLastSite(data.site);
  const lastDate = data.date;
  const lastSite = data.site;
  records = await window.electronAPI.saveRecord(data);
  renderRecords(); renderStats();
  if (typeof scheduleAutoSync === 'function') scheduleAutoSync('save', 2000);
  if (andNew) {
    newEncounter(currentEncounterTemplateId); // keep the same form type; don't re-prompt the picker
    // Persist site + date for the next patient
    if (lastSite) document.getElementById('fSite').value = lastSite;
    if (lastDate) document.getElementById('fDate').value = lastDate;
    // Always start the next patient at the very top of the form
    const _b = document.getElementById('encounterPanelBody');
    if (_b) requestAnimationFrame(() => { _b.scrollTop = 0; });
  } else {
    closePanel();
  }
  } catch (err) { console.error('saveRecord error:', err); alert('Save error: ' + err.message); }
  finally { _saveInProgress = false; }
}

async function deleteRecord() {
  if (!editingRecordId) return;
  if (!confirm('Delete this record permanently?')) return;
  records = await window.electronAPI.deleteRecord(editingRecordId);
  renderRecords(); renderStats(); closePanel();
  if (typeof scheduleAutoSync === 'function') scheduleAutoSync('delete', 2000);
}

// EXPORT RECORD TO PDF
async function exportRecordPDF() {
  const content = document.getElementById('viewRecordContent');
  if (!content) return;
  const data = collectFormData();
  const patientName = data.name || 'Record';
  const result = await window.electronAPI.exportPDF(content.innerHTML, patientName);
  if (result) alert('PDF exported successfully!');
}

// ==========================================
// VIEW RECORD — patient-centric view
// ==========================================
function renderViewRecord() {
  const data = collectFormData();
  const mrn = data.mrn || '';

  const patientEncounters = mrn
    ? records.filter(r => r.mrn === mrn && !r.deleted).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    : [data];
  const encounterCount = patientEncounters.length;
  const age = data.dob ? calcAge(data.dob) + ' years' : '';

  let html = `
    <div class="view-patient-header">
      <div class="view-patient-name">${esc(data.givenName ? data.givenName + ' ' + (data.familyName || '') : data.name || 'Unknown')}</div>
      <div class="view-patient-meta">
        <span>MRN: <strong>${esc(mrn)}</strong></span>
        <span>${esc(data.sex || '')}${age ? ' / ' + age : ''}</span>
        <span>DOB: ${formatDate(data.dob)}${data.ageEstimated ? ' (est.)' : ''}</span>
        ${data.phone ? `<span>Phone: ${esc(data.phone)}</span>` : ''}
      </div>
    </div>
    <div class="visit-timeline-header" style="margin-bottom:12px;">
      <strong>${encounterCount} Visit${encounterCount !== 1 ? 's' : ''}</strong>
      <button class="btn btn-primary btn-sm" onclick="newEncounterForPatient('${esc(editingRecordId)}')">+ New Visit</button>
    </div>`;

  if (encounterCount >= 2) {
    const vitalsEncounters = [...patientEncounters].reverse();
    html += `<div class="vitals-trend">
      <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--primary);margin-bottom:6px;">Vitals Trend</h4>
      <table class="vitals-trend-table">
        <thead><tr>
          <th>Visit</th>
          ${vitalsEncounters.map((e, i) => `<th>V${i + 1}<br><span style="font-weight:400;font-size:10px;">${formatDate(e.date)}</span></th>`).join('')}
        </tr></thead>
        <tbody>
          <tr><td>Temp</td>${vitalsEncounters.map(e => {
            const t = parseFloat(e.temp);
            const color = !e.temp ? '' : t >= 38.5 ? 'color:var(--red);font-weight:700;' : t >= 37.5 ? 'color:var(--amber);font-weight:700;' : '';
            return `<td style="${color}">${esc(e.temp || '—')}</td>`;
          }).join('')}</tr>
          <tr><td>BP</td>${vitalsEncounters.map(e => {
            const sys = parseInt((e.bp || '').split('/')[0]);
            const color = !e.bp ? '' : sys >= 140 ? 'color:var(--red);font-weight:700;' : sys >= 130 ? 'color:var(--amber);font-weight:700;' : '';
            return `<td style="${color}">${esc(e.bp || '—')}</td>`;
          }).join('')}</tr>
          <tr><td>Weight</td>${vitalsEncounters.map(e => `<td>${esc(e.weight || '—')}</td>`).join('')}</tr>
        </tbody>
      </table>
    </div>`;
  }

  patientEncounters.forEach((enc, i) => {
    const visitNum = encounterCount - i;
    const isCurrent = enc.id === editingRecordId;

    html += `
      <div class="visit-block${isCurrent ? ' visit-block-current' : ''}">
        <div class="visit-block-header">
          <div class="visit-block-title">
            <span class="visit-block-num">Visit ${visitNum}</span>
            <span class="visit-block-date">${formatDate(enc.date)} — ${esc(enc.site || '')}</span>
            ${enc.provider ? `<span class="visit-block-provider">${esc(enc.provider)}</span>` : ''}
          </div>
          <div class="visit-block-actions">
            <button class="btn btn-sm btn-secondary visit-edit-btn" data-id="${enc.id}">Edit</button>
          </div>
        </div>
        ${renderEncounterDetail(enc)}
      </div>`;
  });

  document.getElementById('viewRecordContent').innerHTML = html;

  document.querySelectorAll('.visit-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rec = records.find(r => r.id === btn.dataset.id);
      if (rec) {
        // Switch to THIS visit's template first, so the correct sections/custom
        // fields render and its customFields/templateId aren't overwritten on save.
        currentEncounterTemplateId = rec.templateId || (window.FormSchema && window.FormSchema.getActiveTemplateId());
        editingRecordId = rec.id;
        populateForm(rec);
        editRecord();
      }
    });
  });
}

function newEncounterForPatient(sourceRecordId) {
  newEncounter();
  prefillFromPrevious(sourceRecordId);
}

function renderAccessToCareForView(atc) {
  if (!atc || typeof atc !== 'object') return '';
  const rows = [];
  if (atc.careNotProvided) rows.push(`<div class="view-row"><span class="view-label">Care unmet today</span><span class="view-value">${esc(atc.careNotProvided)}${atc.careNotProvidedNote ? ' — ' + esc(atc.careNotProvidedNote) : ''}</span></div>`);
  if (typeof atc.painLevel === 'number') {
    const color = atc.painLevel <= 3 ? 'var(--green)' : atc.painLevel <= 6 ? 'var(--amber)' : 'var(--red)';
    rows.push(`<div class="view-row"><span class="view-label">Pain Level</span><span class="view-value" style="color:${color};font-weight:700;">${atc.painLevel}/10</span></div>`);
  }
  if (atc.soughtCareBefore) {
    let str = esc(atc.soughtCareBefore);
    if (atc.soughtCareBefore === 'Yes' && Array.isArray(atc.careLocations) && atc.careLocations.length) {
      str += ' — ' + atc.careLocations.map(esc).join(', ');
      if (atc.careLocationOther) str += ` (${esc(atc.careLocationOther)})`;
    }
    rows.push(`<div class="view-row"><span class="view-label">Sought care before</span><span class="view-value">${str}</span></div>`);
  }
  if (Array.isArray(atc.careBarriers) && atc.careBarriers.length) {
    let str = atc.careBarriers.map(esc).join(', ');
    if (atc.careBarrierOther) str += ` (${esc(atc.careBarrierOther)})`;
    rows.push(`<div class="view-row"><span class="view-label">Barriers to care</span><span class="view-value">${str}</span></div>`);
  }
  if (atc.delayedCare) {
    let str = esc(atc.delayedCare);
    if (atc.delayedCare === 'Yes') {
      const reasons = [];
      if (atc.delayedDueToCost === 'Yes') reasons.push('cost');
      if (atc.delayedDueToDistance === 'Yes') reasons.push('distance/transport');
      if (reasons.length) str += ' — due to ' + reasons.join(', ');
    }
    rows.push(`<div class="view-row"><span class="view-label">Delayed care</span><span class="view-value">${str}</span></div>`);
  }
  if (atc.ranOutOfMeds) rows.push(`<div class="view-row"><span class="view-label">Ran out of meds (3mo)</span><span class="view-value">${esc(atc.ranOutOfMeds)}</span></div>`);
  if (atc.travelDistance) rows.push(`<div class="view-row"><span class="view-label">Travel distance</span><span class="view-value">${esc(atc.travelDistance)}</span></div>`);
  if (atc.travelTime) rows.push(`<div class="view-row"><span class="view-label">Travel time</span><span class="view-value">${esc(atc.travelTime)}</span></div>`);
  if (atc.transportType) {
    let str = esc(atc.transportType);
    if (atc.transportType === 'Other' && atc.transportTypeOther) str += ` (${esc(atc.transportTypeOther)})`;
    rows.push(`<div class="view-row"><span class="view-label">Transport type</span><span class="view-value">${str}</span></div>`);
  }
  if (!rows.length) return '';
  return `<div class="view-section"><h4>Access to Care</h4>${rows.join('')}</div>`;
}

// Renders a record's custom (admin-defined) section answers for the read-only
// view + PDF. Without this, everything captured in a custom section was
// write-only — invisible after saving except by re-entering edit mode.
function renderCustomFieldsForView(data) {
  const cf = data && data.customFields;
  if (!cf || typeof cf !== 'object' || !Object.keys(cf).length) return '';
  let sections = [];
  try {
    if (window.FormSchema && window.FormSchema.getEffectiveSchema) {
      const schema = window.FormSchema.getEffectiveSchema(data.templateId);
      if (schema && Array.isArray(schema.sections)) sections = schema.sections;
    }
  } catch (e) {}
  const out = [];
  const rendered = new Set();
  sections.filter(s => !s.builtin).forEach(sec => {
    const rows = [];
    (sec.fields || []).forEach(f => {
      if (!f || !f.id) return;
      rendered.add(f.id);
      const v = cf[f.id];
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return;
      let disp = Array.isArray(v) ? v.map(esc).join(', ') : esc(v);
      if (f.type === 'range' && v !== '' && f.max != null) disp = esc(v) + '/' + esc(f.max);
      rows.push('<div class="view-row"><span class="view-label">' + esc(f.label || f.id) + '</span><span class="view-value">' + disp + '</span></div>');
    });
    if (rows.length) out.push('<div class="view-section"><h4>' + esc(sec.title || 'Custom') + '</h4>' + rows.join('') + '</div>');
  });
  // Answers whose field is no longer in any schema — show raw so history survives.
  const lrows = [];
  Object.keys(cf).forEach(k => {
    if (rendered.has(k)) return;
    const v = cf[k];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return;
    lrows.push('<div class="view-row"><span class="view-label">' + esc(k) + '</span><span class="view-value">' + (Array.isArray(v) ? v.map(esc).join(', ') : esc(v)) + '</span></div>');
  });
  if (lrows.length) out.push('<div class="view-section"><h4>Additional</h4>' + lrows.join('') + '</div>');
  return out.join('');
}

function renderEncounterDetail(data) {
  const formulary = getFormulary();
  let labsHtml = renderLabsForView(data);

  let medsHtml = '';
  if (data.medications && data.medications.length) {
    medsHtml = data.medications.map(m => {
      const med = formulary.find(f => f.id === m.medId);
      const name = med ? med.name : m.medId;
      const freqLabel = FREQUENCIES.find(f => f.value === m.freq)?.label || m.freq;
      const ctrl = med && med.controlled ? ' <span class="med-controlled">⚠ CONTROLLED</span>' : '';
      return `<div style="padding:4px 0;border-bottom:1px solid var(--gray-100);">${esc(name)} ${esc(m.dose)} — ${freqLabel} × ${m.duration}${ctrl}</div>`;
    }).join('');
  }

  let uaHtml = '';
  if (data.urinalysis) {
    const uaLabels = { leukocytes:'Leukocytes', nitrite:'Nitrite', urobilinogen:'Urobilinogen', protein:'Protein', ph:'pH', blood:'Blood', sg:'Specific Gravity', ketones:'Ketones', bilirubin:'Bilirubin', glucose:'Glucose' };
    let uaRows = '';
    UA_PARAMS.forEach(p => { if (data.urinalysis[p]) uaRows += `<div class="view-row"><span class="view-label">${uaLabels[p]}</span><span class="view-value">${esc(data.urinalysis[p])}</span></div>`; });
    if (uaRows) uaHtml = `<div class="view-section"><h4>Urinalysis</h4>${uaRows}</div>`;
  }

  const procHtml = data.procedures && data.procedures.length ? `<div class="view-row" style="margin-top:8px;"><span class="view-label">Procedures</span><span class="view-value">${data.procedures.map(p => esc(p)).join(', ')}</span></div>` : '';
  const accessToCareHtml = renderAccessToCareForView(data.accessToCare);

  return `
    <div class="encounter-detail">
      <div class="view-section-row">
        <div class="view-section view-section-half">
          <h4>Vitals</h4>
          <div class="view-row"><span class="view-label">Temp</span><span class="view-value">${data.temp || '—'}</span></div>
          <div class="view-row"><span class="view-label">BP</span><span class="view-value">${data.bp || '—'}</span></div>
          <div class="view-row"><span class="view-label">Weight</span><span class="view-value">${data.weight || '—'}</span></div>
          <div class="view-row"><span class="view-label">Pregnant</span><span class="view-value">${esc(data.pregnant)}</span></div>
          <div class="view-row"><span class="view-label">Breastfeeding</span><span class="view-value">${esc(data.breastfeeding)}</span></div>
        </div>
        <div class="view-section view-section-half">
          <h4>History</h4>
          <div class="view-row"><span class="view-label">Allergies</span><span class="view-value">${esc(data.allergies) || '—'}</span></div>
          <div class="view-row"><span class="view-label">Current Meds</span><span class="view-value">${esc(data.currentMeds) || '—'}</span></div>
          <div class="view-row"><span class="view-label">PMH</span><span class="view-value">${esc(data.pmh) || '—'}</span></div>
          <div class="view-row"><span class="view-label">Chief Concern</span><span class="view-value">${esc(data.chiefConcern) || '—'}</span></div>
        </div>
      </div>
      ${accessToCareHtml}
      ${labsHtml ? `<div class="view-section"><h4>Labs</h4>${labsHtml}${data.labComments ? `<div class="view-row"><span class="view-label">Comments</span><span class="view-value">${esc(data.labComments)}</span></div>` : ''}</div>` : ''}
      ${uaHtml}
      <div class="view-section">
        <h4>Clinical</h4>
        <div class="view-row"><span class="view-label">Diagnosis</span><span class="view-value">${esc(data.diagnosis) || '—'}</span></div>
        ${medsHtml ? `<div style="margin-top:8px;"><strong style="font-size:12px;color:var(--gray-600);">MEDICATIONS</strong>${medsHtml}</div>` : ''}
        ${data.treatmentNotes ? `<div class="view-row" style="margin-top:8px;"><span class="view-label">Treatment Notes</span><span class="view-value">${esc(data.treatmentNotes)}</span></div>` : ''}
        ${procHtml}
        ${data.imaging ? `<div class="view-row" style="margin-top:8px;"><span class="view-label">Imaging</span><span class="view-value">${esc(data.imaging.modality || 'Ultrasound')} — ${esc(data.imaging.type)}${data.imaging.findings ? `<br><em style="color:var(--gray-500);">${esc(data.imaging.findings)}</em>` : ''}</span></div>` : ''}
        ${data.surgery ? `<div class="view-row" style="margin-top:8px;"><span class="view-label">Surgery</span><span class="view-value"><strong>${esc(data.surgery.type)}</strong>${data.surgery.notes ? `<br><em style="color:var(--gray-500);">${esc(data.surgery.notes)}</em>` : ''}</span></div>` : ''}
        <div class="view-row"><span class="view-label">Referral</span><span class="view-value">${esc(data.referralType) || '—'}${data.referralDate ? ` — Scheduled: <strong>${esc(data.referralDate)}</strong>` : ''}</span></div>
        <div class="view-row"><span class="view-label">Physician</span><span class="view-value">${esc(data.provider) || '—'}</span></div>
        ${data.notes ? `<div class="view-row"><span class="view-label">Notes</span><span class="view-value">${esc(data.notes)}</span></div>` : ''}
      </div>
      ${renderCustomFieldsForView(data)}
    </div>`;
}
