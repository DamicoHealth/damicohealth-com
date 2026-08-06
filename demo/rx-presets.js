// ==========================================
// RX PRESETS
// ==========================================
function getMalariaWeightBracket(weightKg) {
  if (!weightKg || weightKg < 5) return null;
  if (weightKg > 35) return '>35kg';
  if (weightKg >= 25) return '25-35kg';
  if (weightKg >= 15) return '15-25kg';
  return '5-15kg';
}

function renderRxPresets() {
  const grid = document.getElementById('rxPresetsGrid');
  if (!grid) return;
  const presets = getRxPresetsData();
  // Plain preset buttons \u2014 no smart highlighting from diagnoses or weight.
  grid.innerHTML = presets.map((p, i) => {
    if (isPresetHidden('rxPresets', p.name)) return '';
    const sel = selectedRxPresets.has(i) ? ' selected' : '';
    return `<button class="rx-preset-btn${sel}" data-idx="${i}">
      <div class="rx-name">${esc(p.name)}</div>
      <div class="rx-detail">${esc(p.rx)}</div>
    </button>`;
  }).join('');
  grid.querySelectorAll('.rx-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleRxPreset(parseInt(btn.dataset.idx)));
  });
}

function toggleRxPreset(idx) {
  const presets = getRxPresetsData();
  const preset = presets[idx];
  if (!preset) return;
  if (selectedRxPresets.has(idx)) {
    selectedRxPresets.delete(idx);
    preset.meds.forEach(pm => {
      const lines = document.querySelectorAll('.med-line');
      for (const line of lines) {
        if (line.querySelector('.med-drug-select').value === pm.medId) {
          line.remove();
          break;
        }
      }
    });
  } else {
    selectedRxPresets.add(idx);
    preset.meds.forEach(m => addMedLine(m.medId, m.dose, m.freq, m.duration));
    if (preset.notes) {
      const tn = document.getElementById('fTreatmentNotes');
      tn.value = tn.value ? tn.value + '\n' + preset.notes : preset.notes;
    }
  }
  renderRxPresets();
}
