// ==========================================
// DX PRESETS
// ==========================================
function _getAllDxPresets() {
  return getCustomDxPresets();
}

function getDxUsageCounts() {
  const allDx = _getAllDxPresets();
  const counts = {};
  allDx.forEach((dx, i) => { counts[i] = 0; });
  records.forEach(r => {
    if (!r.diagnosis) return;
    allDx.forEach((dx, i) => { if (r.diagnosis.includes(dx)) counts[i]++; });
  });
  return counts;
}

function renderDxPresets() {
  const allDx = _getAllDxPresets();
  const grid = document.getElementById('dxPresetsGrid');
  const counts = getDxUsageCounts();
  function makeDxBtn(i) {
    if (isPresetHidden('diagnoses', allDx[i])) return '';
    const sel = selectedDxPresets.has(i) ? ' selected' : '';
    const countBadge = counts[i] > 0 ? ` <span style="opacity:0.7;font-size:10px;">(${counts[i]})</span>` : '';
    return `<button class="preset-btn${sel}" data-idx="${i}">${esc(allDx[i])}${countBadge}</button>`;
  }
  if (dxSortMode === 'system') {
    let html = '';
    // Build a set of all indices already placed in a system group
    const placedIdxs = new Set();
    Object.entries(DX_SYSTEMS).forEach(([system, dxList]) => {
      const idxs = dxList.map(dx => allDx.indexOf(dx)).filter(i => i >= 0);
      if (!idxs.length) return;
      html += `<div class="dx-system-header">${esc(system)}</div>`;
      idxs.forEach(i => { html += makeDxBtn(i); placedIdxs.add(i); });
    });
    // Add any custom diagnoses not in DX_SYSTEMS to "Other/Custom"
    const customIdxs = allDx.map((_, i) => i).filter(i => !placedIdxs.has(i));
    if (customIdxs.length) {
      html += `<div class="dx-system-header">Other/Custom</div>`;
      customIdxs.forEach(i => { html += makeDxBtn(i); });
    }
    grid.innerHTML = html;
  } else if (dxSortMode === 'alpha') {
    const sortedIdxs = allDx.map((_, i) => i).sort((a, b) => allDx[a].localeCompare(allDx[b]));
    grid.innerHTML = sortedIdxs.map(i => makeDxBtn(i)).join('');
  } else {
    const sortedIdxs = allDx.map((_, i) => i).sort((a, b) => {
      const diff = (counts[b] || 0) - (counts[a] || 0);
      return diff !== 0 ? diff : allDx[a].localeCompare(allDx[b]);
    });
    grid.innerHTML = sortedIdxs.map(i => makeDxBtn(i)).join('');
  }
  grid.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleDxPreset(parseInt(btn.dataset.idx)));
  });
}

function toggleDxPreset(idx) {
  const allDx = _getAllDxPresets();
  const dx = allDx[idx];
  if (!dx) return;
  const dxEl = document.getElementById('fDiagnosis');
  if (selectedDxPresets.has(idx)) {
    selectedDxPresets.delete(idx);
    const parts = dxEl.value.split('; ').filter(p => p !== dx);
    dxEl.value = parts.join('; ');
  } else {
    selectedDxPresets.add(idx);
    if (dxEl.value && !dxEl.value.includes(dx)) {
      dxEl.value += '; ' + dx;
    } else if (!dxEl.value) {
      dxEl.value = dx;
    }
  }
  renderDxPresets();
  renderRxPresets();
}
