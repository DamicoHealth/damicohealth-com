// ==========================================
// LAB GRID — supports toggle and numeric tests
// ==========================================
function labKey(name) { return name.replace(/[^a-zA-Z0-9]/g, '_'); }

function renderLabGrid() {
  const grid = document.getElementById('labGrid');
  if (!grid) { console.error('labGrid element not found!'); return; }
  const tests = getLabTests();
  if (tests.length === 0) {
    grid.innerHTML = '<div style="padding:12px;color:var(--gray-500);font-size:12px;">All lab tests are hidden. Go to <strong>Options &rarr; Lab Tests</strong> to enable them.</div>';
    return;
  }

  let html = '';
  tests.forEach(t => {
    const key = labKey(t.name);
    if (t.type === 'toggle') {
      html += `
        <div class="lab-row" data-test="${esc(t.name)}" data-test-id="${t.id}" data-type="toggle">
          <span class="lab-name">${esc(t.name)}</span>
          <div class="lab-btns">
            <button class="lab-btn lab-btn-pos" data-action="pos">POS</button>
            <button class="lab-btn lab-btn-neg" data-action="neg">NEG</button>
          </div>
        </div>`;
    } else if (t.type === 'numeric') {
      html += `
        <div class="lab-row lab-row-numeric" data-test="${esc(t.name)}" data-test-id="${t.id}" data-type="numeric">
          <span class="lab-name">${esc(t.name)}</span>
          <div class="lab-numeric-input">
            <input type="number" class="lab-numeric-field" id="lab-num-${key}" step="any" min="0" placeholder="${t.unit || ''}" style="width:90px;">
            <span class="lab-unit">${esc(t.unit || '')}</span>
            <span class="lab-interp" id="lab-interp-${key}"></span>
          </div>
        </div>`;
    }
  });

  grid.innerHTML = html;

  // Wire up toggle buttons (POS/NEG)
  grid.querySelectorAll('.lab-row[data-type="toggle"] .lab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.lab-row');
      const action = btn.dataset.action;
      const posBtn = row.querySelector('.lab-btn-pos');
      const negBtn = row.querySelector('.lab-btn-neg');
      if (action === 'pos') {
        posBtn.classList.toggle('active-pos');
        negBtn.classList.remove('active-neg');
      } else if (action === 'neg') {
        negBtn.classList.toggle('active-neg');
        posBtn.classList.remove('active-pos');
      }
    });
  });

  // Wire up numeric inputs with interpretation
  grid.querySelectorAll('.lab-row[data-type="numeric"] .lab-numeric-field').forEach(input => {
    input.addEventListener('input', () => {
      const row = input.closest('.lab-row');
      const testName = row.dataset.test;
      const test = getLabTestByName(testName);
      const key = labKey(testName);
      const interpEl = document.getElementById('lab-interp-' + key);
      if (!interpEl || !test) return;
      const val = parseFloat(input.value);
      if (!input.value || isNaN(val)) { interpEl.innerHTML = ''; return; }
      const interp = interpretNumericLab(test, val);
      if (interp) {
        interpEl.innerHTML = `<span style="color:${interp.color};font-weight:600;">${interp.label}</span>`;
      } else {
        interpEl.innerHTML = '';
      }
    });
  });

}

function resetLabs() {
  getMergedLabTests().forEach(t => {
    const key = labKey(t.name);
    const row = document.querySelector(`.lab-row[data-test="${t.name}"]`);
    if (!row) return;
    if (t.type === 'toggle') {
      row.querySelectorAll('.lab-btn').forEach(b => {
        b.classList.remove('active-pos', 'active-neg');
      });
    } else if (t.type === 'numeric') {
      const input = document.getElementById('lab-num-' + key);
      if (input) input.value = '';
      const interp = document.getElementById('lab-interp-' + key);
      if (interp) interp.innerHTML = '';
    }
  });
}

function collectLabData() {
  const labs = {};
  getMergedLabTests().forEach(t => {
    const row = document.querySelector(`.lab-row[data-test="${t.name}"]`);
    if (!row) {
      // Hidden test - no data
      labs[t.name] = { ordered: false, result: 'N/A', type: t.type };
      return;
    }
    if (t.type === 'toggle') {
      let result = 'N/A';
      if (row.querySelector('.lab-btn-pos')?.classList.contains('active-pos')) result = 'POS';
      else if (row.querySelector('.lab-btn-neg')?.classList.contains('active-neg')) result = 'NEG';
      const ordered = result !== 'N/A';
      labs[t.name] = { ordered, result, type: 'toggle' };
    } else if (t.type === 'numeric') {
      const key = labKey(t.name);
      const input = document.getElementById('lab-num-' + key);
      const value = input ? input.value : '';
      const ordered = !!value;
      const interp = value ? interpretNumericLab(t, parseFloat(value)) : null;
      labs[t.name] = { ordered, value, unit: t.unit, type: 'numeric', interpretation: interp ? interp.label : '' };
    }
  });
  return labs;
}

function populateLabData(labsData) {
  resetLabs();
  if (!labsData) return;
  getMergedLabTests().forEach(t => {
    const data = labsData[t.name];
    if (!data) return;
    const row = document.querySelector(`.lab-row[data-test="${t.name}"]`);
    if (!row) return;

    if (t.type === 'toggle') {
      if (data.result === 'POS') row.querySelector('.lab-btn-pos')?.classList.add('active-pos');
      if (data.result === 'NEG') row.querySelector('.lab-btn-neg')?.classList.add('active-neg');
    } else if (t.type === 'numeric') {
      const key = labKey(t.name);
      const input = document.getElementById('lab-num-' + key);
      if (input && data.value) {
        input.value = data.value;
        // Trigger interpretation
        input.dispatchEvent(new Event('input'));
      }
    }
  });
}

function renderLabsForView(data) {
  let html = '';
  getMergedLabTests().forEach(t => {
    const labData = data.labs && data.labs[t.name];
    if (!labData || !labData.ordered) return;

    if (t.type === 'toggle' || labData.type === 'toggle') {
      const rClass = labData.result === 'POS' ? 'style="color:var(--red);font-weight:700;"' : '';
      html += `<div class="view-row"><span class="view-label">${esc(t.name)}</span><span class="view-value" ${rClass}>${labData.result}</span></div>`;
    } else if (t.type === 'numeric' || labData.type === 'numeric') {
      const val = labData.value;
      const interp = labData.interpretation || '';
      const interpColor = interp.includes('High') || interp.includes('Severe') ? 'var(--red)' :
                          interp.includes('Elevated') || interp.includes('Moderate') || interp.includes('Mild') || interp.includes('Low') ? 'var(--amber)' :
                          interp.includes('Normal') ? 'var(--green)' : '';
      html += `<div class="view-row"><span class="view-label">${esc(t.name)}</span><span class="view-value" style="font-weight:700;${interpColor ? 'color:' + interpColor + ';' : ''}">${esc(val)} ${esc(labData.unit || t.unit || '')}${interp ? ' — ' + esc(interp) : ''}</span></div>`;
    }
  });
  return html;
}

// Backward compat: check if any toggle test is POS
function hasLabPositiveResult(labs) {
  if (!labs) return false;
  return getMergedLabTests().some(t => {
    const d = labs[t.name];
    return d && d.ordered && (d.result === 'POS');
  });
}

function getPositiveLabNames(labs) {
  if (!labs) return [];
  return getMergedLabTests().filter(t => {
    const d = labs[t.name];
    return d && d.ordered && d.result === 'POS';
  }).map(t => t.name);
}
