// ==========================================
// ROLE GATING HELPER
// ==========================================
function updateConfigLockUI() {
  const isAdmin = getDeviceRole() === 'admin';
  const banner = document.getElementById('configLockBanner');
  if (banner) banner.style.display = isAdmin ? 'none' : '';
  // Hide/show all add buttons
  ['btnAddMed', 'btnAddSite', 'btnAddRxPreset', 'btnAddProcedureOption', 'btnAddProvider', 'btnAddReferralType', 'btnAddDxPreset', 'btnAddComplaint', 'btnAddLabTest'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isAdmin ? '' : 'none';
  });
}

// ==========================================
// PROVIDERS EDITOR
// ==========================================
function renderProviders() {
  try {
  const providers = getProviders();
  if (!providers) return;
  const isAdmin = getDeviceRole() === 'admin';
  const body = document.getElementById('providerBody');
  if (!body) return;
  body.innerHTML = providers.map((p, i) => `<tr>
    <td>${esc(p)}</td>
    ${isAdmin ? `<td class="formulary-actions">
      <button class="btn-edit" data-idx="${i}" title="Edit">&#9998;</button>
      <button class="btn-del" data-idx="${i}" title="Remove">&#128465;</button>
    </td>` : '<td></td>'}
  </tr>`).join('');
  body.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openProviderModal(parseInt(btn.dataset.idx)));
  });
  body.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ps = getProviders();
      const name = ps[parseInt(btn.dataset.idx)];
      const count = await window.electronAPI.countRecordsByField('provider', name);
      const msg = count > 0
        ? `${count} record(s) reference "${name}". Removing it won't change those records. Continue?`
        : `Remove physician "${name}"?`;
      if (!confirm(msg)) return;
      ps.splice(parseInt(btn.dataset.idx), 1);
      saveProviders(ps); renderProviders(); renderProviderButtons();
    });
  });
  } catch (e) { console.error('renderProviders error:', e); }
}

function openProviderModal(editIdx) {
  editingProviderId = editIdx !== undefined ? editIdx : null;
  const modal = document.getElementById('providerModal');
  if (editIdx !== undefined && editIdx !== null) {
    const providers = getProviders();
    document.getElementById('providerModalTitle').textContent = 'Edit Physician';
    document.getElementById('pmName').value = providers[editIdx] || '';
  } else {
    document.getElementById('providerModalTitle').textContent = 'Add Physician';
    document.getElementById('pmName').value = '';
  }
  modal.classList.add('open');
}
function closeProviderModal() { document.getElementById('providerModal').classList.remove('open'); editingProviderId = null; }

function saveProviderItem() {
  const name = document.getElementById('pmName').value.trim();
  if (!name) { alert('Physician name is required.'); return; }
  const providers = getProviders();
  if (editingProviderId !== null && editingProviderId !== undefined) {
    providers[editingProviderId] = name;
  } else {
    providers.push(name);
  }
  saveProviders(providers); renderProviders(); renderProviderButtons(); closeProviderModal();
}

// ==========================================
// SITES EDITOR
// ==========================================
function renderSites() {
  try {
  const sites = getSites();
  if (!sites) return;
  const isAdmin = getDeviceRole() === 'admin';
  const body = document.getElementById('siteBody');
  if (!body) return;
  body.innerHTML = sites.map((s, i) => `<tr>
    <td>${esc(s)}</td>
    ${isAdmin ? `<td class="formulary-actions">
      <button class="btn-edit" data-idx="${i}" title="Edit">&#9998;</button>
      <button class="btn-del" data-idx="${i}" title="Remove">&#128465;</button>
    </td>` : '<td></td>'}
  </tr>`).join('');
  body.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openSiteModal(parseInt(btn.dataset.idx)));
  });
  body.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ss = getSites();
      const name = ss[parseInt(btn.dataset.idx)];
      const count = await window.electronAPI.countRecordsByField('site', name);
      const msg = count > 0
        ? `${count} record(s) reference "${name}". Removing it won't change those records. Continue?`
        : `Remove site "${name}"?`;
      if (!confirm(msg)) return;
      ss.splice(parseInt(btn.dataset.idx), 1);
      saveSites(ss); renderSites(); populateSiteSelects();
    });
  });
  } catch (e) { console.error('renderSites error:', e); }
}

function openSiteModal(editIdx) {
  editingSiteId = editIdx !== undefined ? editIdx : null;
  const modal = document.getElementById('siteModal');
  if (editIdx !== undefined && editIdx !== null) {
    const sites = getSites();
    document.getElementById('siteModalTitle').textContent = 'Edit Site';
    document.getElementById('smName').value = sites[editIdx] || '';
  } else {
    document.getElementById('siteModalTitle').textContent = 'Add Site';
    document.getElementById('smName').value = '';
  }
  modal.classList.add('open');
}
function closeSiteModal() { document.getElementById('siteModal').classList.remove('open'); editingSiteId = null; }

function saveSiteItem() {
  const name = document.getElementById('smName').value.trim();
  if (!name) { alert('Site name is required.'); return; }
  const sites = getSites();
  if (editingSiteId !== null && editingSiteId !== undefined) {
    sites[editingSiteId] = name;
  } else {
    sites.push(name);
  }
  saveSites(sites); renderSites(); populateSiteSelects(); closeSiteModal();
}

// ==========================================
// PROCEDURES EDITOR
// ==========================================
function renderProceduresEditor() {
  try {
  const procs = getProcedures();
  if (!procs) return;
  const isAdmin = getDeviceRole() === 'admin';
  const body = document.getElementById('procedureBody');
  if (!body) return;
  body.innerHTML = procs.map((p, i) => {
    const hidden = isPresetHidden('procedures', p);
    const rowClass = hidden ? ' class="preset-hidden-row"' : '';
    const eyeIcon = hidden ? '\u{1F441}\u200D\u{1F5E8}' : '\u{1F441}';
    return `<tr${rowClass}>
    <td>${esc(p)}</td>
    ${isAdmin ? `<td class="formulary-actions">
      <button class="btn-visibility${hidden ? ' is-hidden' : ''}" data-idx="${i}" data-name="${esc(p)}" title="${hidden ? 'Show on forms' : 'Hide from forms'}">${eyeIcon}</button>
      <button class="btn-edit" data-idx="${i}" title="Edit">&#9998;</button>
      <button class="btn-del" data-idx="${i}" title="Remove">&#128465;</button>
    </td>` : '<td></td>'}
  </tr>`;
  }).join('');
  body.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openProcedureModal(parseInt(btn.dataset.idx)));
  });
  body.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Remove this procedure?')) return;
      const ps = getProcedures(); ps.splice(parseInt(btn.dataset.idx), 1);
      saveProceduresData(ps); renderProceduresEditor(); renderProcedureButtons();
    });
  });
  body.querySelectorAll('.btn-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      togglePresetVisibility('procedures', btn.dataset.name);
      renderProceduresEditor(); renderProcedureButtons();
    });
  });
  } catch (e) { console.error('renderProceduresEditor error:', e); }
}

function openProcedureModal(editIdx) {
  editingProcedureId = editIdx !== undefined ? editIdx : null;
  const modal = document.getElementById('procedureModal');
  if (editIdx !== undefined && editIdx !== null) {
    const procs = getProcedures();
    document.getElementById('procedureModalTitle').textContent = 'Edit Procedure';
    document.getElementById('procmName').value = procs[editIdx] || '';
  } else {
    document.getElementById('procedureModalTitle').textContent = 'Add Procedure';
    document.getElementById('procmName').value = '';
  }
  modal.classList.add('open');
}
function closeProcedureModal() { document.getElementById('procedureModal').classList.remove('open'); editingProcedureId = null; }

function saveProcedureItem() {
  const name = document.getElementById('procmName').value.trim();
  if (!name) { alert('Procedure name is required.'); return; }
  const procs = getProcedures();
  if (editingProcedureId !== null && editingProcedureId !== undefined) {
    procs[editingProcedureId] = name;
  } else {
    procs.push(name);
  }
  saveProceduresData(procs); renderProceduresEditor(); renderProcedureButtons(); closeProcedureModal();
}

// ==========================================
// RX PRESETS EDITOR
// ==========================================
function renderRxPresetsEditor() {
  try {
  const presets = getRxPresetsData();
  if (!presets) return;
  const isAdmin = getDeviceRole() === 'admin';
  const body = document.getElementById('rxPresetBody');
  if (!body) return;
  body.innerHTML = presets.map((p, i) => {
    const hidden = isPresetHidden('rxPresets', p.name);
    const rowClass = hidden ? ' class="preset-hidden-row"' : '';
    const eyeIcon = hidden ? '\u{1F441}\u200D\u{1F5E8}' : '\u{1F441}';
    return `<tr${rowClass}>
    <td>${esc(p.name)}</td>
    <td style="font-size:12px;color:var(--gray-600);">${esc(p.rx)}</td>
    ${isAdmin ? `<td class="formulary-actions">
      <button class="btn-visibility${hidden ? ' is-hidden' : ''}" data-idx="${i}" data-name="${esc(p.name)}" title="${hidden ? 'Show on forms' : 'Hide from forms'}">${eyeIcon}</button>
      <button class="btn-edit" data-idx="${i}" title="Edit">&#9998;</button>
      <button class="btn-del" data-idx="${i}" title="Remove">&#128465;</button>
    </td>` : '<td></td>'}
  </tr>`;
  }).join('');
  body.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openRxPresetModal(parseInt(btn.dataset.idx)));
  });
  body.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Remove this Rx preset?')) return;
      const ps = getRxPresetsData(); ps.splice(parseInt(btn.dataset.idx), 1);
      saveRxPresetsData(ps); renderRxPresetsEditor();
    });
  });
  body.querySelectorAll('.btn-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      togglePresetVisibility('rxPresets', btn.dataset.name);
      renderRxPresetsEditor(); renderRxPresets();
    });
  });
  } catch (e) { console.error('renderRxPresetsEditor error:', e); }
}

function buildRpmDrugSelect(selectedId) {
  const formulary = getFormulary();
  const categories = [...new Set(formulary.map(f => f.category))];
  let html = '<option value="">\u2014 Select medication \u2014</option>';
  categories.forEach(cat => {
    html += `<optgroup label="${esc(cat)}">`;
    formulary.filter(f => f.category === cat).forEach(med => {
      const sel = med.id === selectedId ? 'selected' : '';
      const ctrl = med.controlled ? ' \u26a0' : '';
      html += `<option value="${med.id}" ${sel}>${esc(med.name)}${ctrl}</option>`;
    });
    html += '</optgroup>';
  });
  return html;
}

function addRpmMedLine(medId, dose, freq, duration) {
  const formulary = getFormulary();
  const med = medId ? formulary.find(f => f.id === medId) : null;
  const div = document.createElement('div');
  div.className = 'med-line';
  const doseVal = dose || (med ? med.dose : '');
  div.innerHTML = `
    <select class="med-drug-select">${buildRpmDrugSelect(medId || '')}</select>
    <input type="text" class="med-dose-input" value="${esc(doseVal)}" placeholder="Dose">
    <select class="med-freq-select">${FREQUENCIES.map(f => `<option value="${f.value}" ${f.value === (freq||'') ? 'selected' : ''}>${f.label}</option>`).join('')}</select>
    <select class="med-dur-select">${DURATIONS.map(d => `<option ${d === (duration||'') ? 'selected' : ''}>${d}</option>`).join('')}</select>
    <button class="btn-remove" title="Remove">&times;</button>`;
  document.getElementById('rpmMedBuilder').appendChild(div);
  div.querySelector('.med-drug-select').addEventListener('change', function() {
    const selMed = formulary.find(f => f.id === this.value);
    if (selMed) div.querySelector('.med-dose-input').value = selMed.dose;
  });
  div.querySelector('.btn-remove').addEventListener('click', () => div.remove());
}

function generateRxSummary() {
  const formulary = getFormulary();
  const lines = [];
  document.querySelectorAll('#rpmMedBuilder .med-line').forEach(line => {
    const medId = line.querySelector('.med-drug-select').value;
    const med = formulary.find(f => f.id === medId);
    if (!med) return;
    const dose = line.querySelector('.med-dose-input').value;
    const freq = line.querySelector('.med-freq-select').value;
    const dur = line.querySelector('.med-dur-select').value;
    const freqLabel = FREQUENCIES.find(f => f.value === freq)?.label || freq;
    lines.push(`${med.name} ${dose} ${freqLabel} ${dur}`);
  });
  return lines.join(' + ');
}

function openRxPresetModal(editIdx) {
  editingRxPresetId = editIdx !== undefined ? editIdx : null;
  const modal = document.getElementById('rxPresetModal');
  document.getElementById('rpmMedBuilder').innerHTML = '';
  if (editIdx !== undefined && editIdx !== null) {
    const presets = getRxPresetsData();
    const p = presets[editIdx];
    document.getElementById('rxPresetModalTitle').textContent = 'Edit Rx Preset';
    document.getElementById('rpmName').value = p.name || '';
    document.getElementById('rpmNotes').value = p.notes || '';
    if (p.meds && p.meds.length) {
      p.meds.forEach(m => addRpmMedLine(m.medId, m.dose, m.freq, m.duration));
    }
  } else {
    document.getElementById('rxPresetModalTitle').textContent = 'Add Rx Preset';
    document.getElementById('rpmName').value = '';
    document.getElementById('rpmNotes').value = '';
  }
  modal.classList.add('open');
}

function closeRxPresetModal() { document.getElementById('rxPresetModal').classList.remove('open'); editingRxPresetId = null; }

function saveRxPresetItem() {
  const name = document.getElementById('rpmName').value.trim();
  if (!name) { alert('Preset name is required.'); return; }
  const formulary = getFormulary();
  const meds = [];
  document.querySelectorAll('#rpmMedBuilder .med-line').forEach(line => {
    const medId = line.querySelector('.med-drug-select').value;
    const dose = line.querySelector('.med-dose-input').value;
    const freq = line.querySelector('.med-freq-select').value;
    const duration = line.querySelector('.med-dur-select').value;
    if (medId) meds.push({ medId, dose, freq, duration });
  });
  const rx = generateRxSummary() || 'See treatment notes';
  const notes = document.getElementById('rpmNotes').value.trim();
  const item = { name, rx, meds };
  if (notes) item.notes = notes;
  const presets = getRxPresetsData();
  if (editingRxPresetId !== null && editingRxPresetId !== undefined) {
    presets[editingRxPresetId] = item;
  } else {
    presets.push(item);
  }
  saveRxPresetsData(presets); renderRxPresetsEditor(); closeRxPresetModal();
}

// ==========================================
// CHIEF COMPLAINTS EDITOR
// ==========================================
function renderComplaintsEditor() {
  try {
  const complaints = getComplaints();
  if (!complaints) return;
  const isAdmin = getDeviceRole() === 'admin';
  const body = document.getElementById('complaintBody');
  if (!body) return;
  body.innerHTML = complaints.map((c, i) => {
    const hidden = isPresetHidden('complaints', c);
    const rowClass = hidden ? ' class="preset-hidden-row"' : '';
    const eyeIcon = hidden ? '\u{1F441}\u200D\u{1F5E8}' : '\u{1F441}';
    return `<tr${rowClass}>
    <td>${esc(c)}</td>
    ${isAdmin ? `<td class="formulary-actions">
      <button class="btn-visibility${hidden ? ' is-hidden' : ''}" data-idx="${i}" data-name="${esc(c)}" title="${hidden ? 'Show on forms' : 'Hide from forms'}">${eyeIcon}</button>
      <button class="btn-edit" data-idx="${i}" title="Edit">&#9998;</button>
      <button class="btn-del" data-idx="${i}" title="Remove">&#128465;</button>
    </td>` : '<td></td>'}
  </tr>`;
  }).join('');
  body.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx);
      const oldName = complaints[idx];
      const newName = await customPrompt('Edit complaint:', oldName);
      if (newName && newName.trim() && newName.trim() !== oldName) {
        complaints[idx] = newName.trim();
        saveComplaints(complaints);
        COMMON_COMPLAINTS = complaints;
        renderComplaintsEditor(); renderComplaintButtons();
      }
    });
  });
  body.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (!confirm(`Remove complaint "${complaints[idx]}"?`)) return;
      complaints.splice(idx, 1);
      saveComplaints(complaints);
      COMMON_COMPLAINTS = complaints;
      renderComplaintsEditor(); renderComplaintButtons();
    });
  });
  body.querySelectorAll('.btn-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      togglePresetVisibility('complaints', btn.dataset.name);
      renderComplaintsEditor(); renderComplaintButtons();
    });
  });
  } catch (e) { console.error('renderComplaintsEditor error:', e); }
}

// ==========================================
// REFERRAL TYPES EDITOR
// ==========================================
function renderReferralTypesEditor() {
  try {
  const types = getReferralTypes();
  if (!types) return;
  const isAdmin = getDeviceRole() === 'admin';
  const body = document.getElementById('referralTypeBody');
  if (!body) return;
  body.innerHTML = types.map((t, i) => {
    const hidden = isPresetHidden('referralTypes', t);
    const rowClass = hidden ? ' class="preset-hidden-row"' : '';
    const eyeIcon = hidden ? '\u{1F441}\u200D\u{1F5E8}' : '\u{1F441}';
    return `<tr${rowClass}>
    <td>${esc(t)}</td>
    ${isAdmin ? `<td class="formulary-actions">
      ${t !== 'None' ? `<button class="btn-visibility${hidden ? ' is-hidden' : ''}" data-idx="${i}" data-name="${esc(t)}" title="${hidden ? 'Show on forms' : 'Hide from forms'}">${eyeIcon}</button>` : ''}
      <button class="btn-edit" data-idx="${i}" title="Edit">&#9998;</button>
      ${t !== 'None' ? `<button class="btn-del" data-idx="${i}" title="Remove">&#128465;</button>` : ''}
    </td>` : '<td></td>'}
  </tr>`;
  }).join('');
  body.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx);
      const oldName = types[idx];
      const newName = await customPrompt('Edit referral type:', oldName);
      if (newName && newName.trim() && newName.trim() !== oldName) {
        types[idx] = newName.trim();
        saveReferralTypes(types); renderReferralTypesEditor(); populateReferralSelect();
      }
    });
  });
  body.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx);
      const name = types[idx];
      const count = await window.electronAPI.countRecordsByField('referral_type', name);
      const msg = count > 0
        ? `${count} record(s) have referral type "${name}". Removing it won't change those records. Continue?`
        : `Remove referral type "${name}"?`;
      if (!confirm(msg)) return;
      types.splice(idx, 1);
      saveReferralTypes(types); renderReferralTypesEditor(); populateReferralSelect();
    });
  });
  body.querySelectorAll('.btn-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      togglePresetVisibility('referralTypes', btn.dataset.name);
      renderReferralTypesEditor(); populateReferralSelect();
    });
  });
  } catch (e) { console.error('renderReferralTypesEditor error:', e); }
}

// ==========================================
// DX PRESETS EDITOR
// ==========================================
function getDxPresetsList() {
  return getCustomDxPresets();
}

function saveCustomDxPresets(list) {
  _cachedCustomDxPresets = list;
  window.electronAPI.saveCustomDxPresets(list);
}

function renderDxPresetsEditor() {
  try {
  const presets = getDxPresetsList();
  if (!presets) return;
  const isAdmin = getDeviceRole() === 'admin';
  const body = document.getElementById('dxPresetBody');
  if (!body) return;
  body.innerHTML = presets.map((d, i) => {
    const hidden = isPresetHidden('diagnoses', d);
    const rowClass = hidden ? ' class="preset-hidden-row"' : '';
    const eyeIcon = hidden ? '\u{1F441}\u200D\u{1F5E8}' : '\u{1F441}';
    return `<tr${rowClass}>
    <td>${esc(d)}</td>
    ${isAdmin ? `<td class="formulary-actions">
      <button class="btn-visibility${hidden ? ' is-hidden' : ''}" data-idx="${i}" data-name="${esc(d)}" title="${hidden ? 'Show on forms' : 'Hide from forms'}">${eyeIcon}</button>
      <button class="btn-edit" data-idx="${i}" title="Edit">&#9998;</button>
      <button class="btn-del" data-idx="${i}" title="Remove">&#128465;</button>
    </td>` : '<td></td>'}
  </tr>`;
  }).join('');
  body.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx);
      const list = getDxPresetsList();
      const oldName = list[idx];
      const newName = await customPrompt('Edit diagnosis:', oldName);
      if (newName && newName.trim() && newName.trim() !== oldName) {
        list[idx] = newName.trim();
        saveCustomDxPresets(list);
        renderDxPresetsEditor(); renderDxPresets();
      }
    });
  });
  body.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const list = getDxPresetsList();
      const name = list[idx];
      if (!confirm(`Remove diagnosis "${name}"?`)) return;
      list.splice(idx, 1);
      saveCustomDxPresets(list);
      renderDxPresetsEditor(); renderDxPresets();
    });
  });
  body.querySelectorAll('.btn-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      togglePresetVisibility('diagnoses', btn.dataset.name);
      renderDxPresetsEditor(); renderDxPresets();
    });
  });
  } catch (e) { console.error('renderDxPresetsEditor error:', e); }
}

// ==========================================
// LAB TESTS VISIBILITY EDITOR
// ==========================================
function renderLabTestsEditor() {
  try {
  const isAdmin = getDeviceRole() === 'admin';
  const body = document.getElementById('labTestBody');
  if (!body) return;
  const customTests = getCustomLabTests();
  const allTests = getMergedLabTests();
  const customNames = new Set(customTests.map(t => t.name));
  body.innerHTML = allTests.map((t, i) => {
    const hidden = isPresetHidden('labTests', t.name);
    const rowClass = hidden ? ' class="preset-hidden-row"' : '';
    const eyeIcon = hidden ? '\u{1F441}\u200D\u{1F5E8}' : '\u{1F441}';
    const isCustom = customNames.has(t.name);
    const typeLabel = t.type === 'toggle' ? 'POS/NEG' : t.type === 'numeric' ? `Numeric (${t.unit || ''})` : t.type;
    const customBadge = isCustom ? ' <span style="font-size:9px;color:var(--blue);font-weight:600;">CUSTOM</span>' : '';
    return `<tr${rowClass}>
    <td>${esc(t.name)}${customBadge} <span style="font-size:10px;color:var(--gray-400);margin-left:4px;">${typeLabel}</span></td>
    ${isAdmin ? `<td class="formulary-actions">
      <button class="btn-visibility${hidden ? ' is-hidden' : ''}" data-name="${esc(t.name)}" title="${hidden ? 'Show on forms' : 'Hide from forms'}">${eyeIcon}</button>
      ${isCustom ? `<button class="btn-edit-custom-lab" data-name="${esc(t.name)}" title="Edit">&#9998;</button><button class="btn-del-custom-lab" data-name="${esc(t.name)}" title="Remove">&#128465;</button>` : ''}
    </td>` : '<td></td>'}
  </tr>`;
  }).join('');
  body.querySelectorAll('.btn-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      togglePresetVisibility('labTests', btn.dataset.name);
      renderLabTestsEditor(); renderLabGrid();
    });
  });
  body.querySelectorAll('.btn-edit-custom-lab').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oldName = btn.dataset.name;
      const tests = getCustomLabTests();
      const idx = tests.findIndex(t => t.name === oldName);
      if (idx < 0) return;
      const newName = await customPrompt('Edit lab test name:', oldName);
      if (!newName || !newName.trim() || newName.trim() === oldName) return;
      tests[idx].name = newName.trim();
      saveCustomLabTests(tests);
      renderLabTestsEditor(); renderLabGrid();
    });
  });
  body.querySelectorAll('.btn-del-custom-lab').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      if (!confirm(`Remove custom lab test "${name}"?`)) return;
      const tests = getCustomLabTests();
      const idx = tests.findIndex(t => t.name === name);
      if (idx < 0) return;
      tests.splice(idx, 1);
      saveCustomLabTests(tests);
      renderLabTestsEditor(); renderLabGrid();
    });
  });
  } catch (e) { console.error('renderLabTestsEditor error:', e); }
}

let _labTestType = 'toggle';

function selectLabTestType(type) {
  _labTestType = type;
  document.querySelectorAll('#ltmTypeToggle .toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === type);
  });
  document.getElementById('ltmUnitGroup').style.display = type === 'numeric' ? '' : 'none';
}

function openLabTestModal() {
  _labTestType = 'toggle';
  document.getElementById('ltmName').value = '';
  document.getElementById('ltmUnit').value = '';
  document.getElementById('ltmError').style.display = 'none';
  selectLabTestType('toggle');
  document.getElementById('labTestModal').classList.add('open');
  document.getElementById('ltmName').focus();
}

function closeLabTestModal() {
  document.getElementById('labTestModal').classList.remove('open');
}

function saveLabTestItem() {
  const name = document.getElementById('ltmName').value.trim();
  const errEl = document.getElementById('ltmError');
  if (!name) {
    errEl.textContent = 'Test name is required.';
    errEl.style.display = '';
    return;
  }
  const existing = getMergedLabTests();
  if (existing.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    errEl.textContent = 'A lab test with that name already exists.';
    errEl.style.display = '';
    return;
  }
  const testId = 'custom-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36);
  let testDef;
  if (_labTestType === 'toggle') {
    testDef = { id: testId, name, type: 'toggle', enabledByDefault: true };
  } else {
    const unit = document.getElementById('ltmUnit').value.trim();
    testDef = { id: testId, name, type: 'numeric', unit, enabledByDefault: true };
  }
  const tests = getCustomLabTests();
  tests.push(testDef);
  saveCustomLabTests(tests);
  closeLabTestModal();
  renderLabTestsEditor(); renderLabGrid();
}

function addCustomLabTest() {
  openLabTestModal();
}

async function addDxPresetItem() {
  const name = await customPrompt('Add a new diagnosis preset:');
  if (!name || !name.trim()) return;
  const list = getDxPresetsList();
  list.push(name.trim());
  saveCustomDxPresets(list);
  renderDxPresetsEditor(); renderDxPresets();
}
