// ==========================================
// ANALYTICS
// ==========================================
function getFilteredRecords() {
  const from = document.getElementById('analyticsFrom').value;
  const to = document.getElementById('analyticsTo').value;
  const site = document.getElementById('analyticsSite').value;
  const sex = document.getElementById('analyticsSex').value;
  return records.filter(r => {
    if (from && r.date < from) return false; if (to && r.date > to) return false;
    if (site && r.site !== site) return false; if (sex && r.sex !== sex) return false; return true;
  });
}

function renderAnalytics() {
  const filtered = getFilteredRecords();
  const total = filtered.length;
  const femaleCount = filtered.filter(r => r.sex === 'F').length;
  const femalePct = total ? Math.round((femaleCount / total) * 100) : 0;
  const labPos = filtered.filter(r => hasLabPositive(r)).length;
  const referred = filtered.filter(r => r.referralType && r.referralType !== 'None').length;
  const pregnant = filtered.filter(r => r.pregnant === 'Yes').length;
  let totalDispensed = 0;
  filtered.forEach(r => { if (r.medications) r.medications.forEach(m => { if (m.qty) totalDispensed += m.qty; }); });
  const uniquePatients = new Set(filtered.map(r => r.mrn || r.id)).size;
  document.getElementById('analyticsSummary').innerHTML = `
    <div class="stat-card"><div class="stat-val">${total}</div><div class="stat-lbl">Encounters</div></div>
    <div class="stat-card"><div class="stat-val">${uniquePatients}</div><div class="stat-lbl">Unique Patients</div></div>
    <div class="stat-card"><div class="stat-val">${femalePct}%</div><div class="stat-lbl">Female</div></div>
    <div class="stat-card"><div class="stat-val">${labPos}</div><div class="stat-lbl">Lab Positives</div></div>
    <div class="stat-card"><div class="stat-val">${referred}</div><div class="stat-lbl">Referred</div></div>
    <div class="stat-card"><div class="stat-val">${pregnant}</div><div class="stat-lbl">Pregnant</div></div>
    <div class="stat-card"><div class="stat-val">${totalDispensed}</div><div class="stat-lbl">Meds Dispensed</div></div>`;
  const sectionHeader = (title) => `<div class="chart-section-header" style="grid-column:1/-1;font-size:16px;font-weight:700;color:var(--primary-dark);margin-top:8px;padding-top:12px;border-top:2px solid var(--border);">${title}</div>`;
  document.getElementById('chartGrid').innerHTML = `
    ${sectionHeader('Overview')}
    <div class="chart-card full"><h4>Disease Burden</h4><canvas id="chartDisease" height="300"></canvas></div>
    <div class="chart-card full"><h4>Top Diagnoses</h4><div id="topDiagnosesTable"></div></div>
    ${sectionHeader('Demographics')}
    <div class="chart-card"><h4>Patients by Site</h4><canvas id="chartSites" height="250"></canvas></div>
    <div class="chart-card"><h4>Sex Distribution</h4><canvas id="chartSex" height="250"></canvas></div>
    <div class="chart-card"><h4>Patients by Camp Day</h4><canvas id="chartDays" height="250"></canvas></div>
    <div class="chart-card"><h4>Age Distribution</h4><canvas id="chartAge" height="250"></canvas></div>
    ${sectionHeader('Clinical')}
    <div class="chart-card full"><h4>Lab Positivity</h4><div id="labPositivityTable"></div></div>
    <div class="chart-card"><h4>Physician Encounters</h4><canvas id="chartProviders" height="250"></canvas></div>
    <div class="chart-card full"><h4>Procedures</h4><canvas id="chartProcedures" height="300"></canvas></div>
    ${sectionHeader('Referrals')}
    <div class="chart-card"><h4>Referrals by Type</h4><canvas id="chartReferralTypes" height="250"></canvas></div>
    ${sectionHeader('Medications')}
    <div class="chart-card full"><h4>Medication Usage (Top 15)</h4><canvas id="chartMeds" height="300"></canvas></div>
    <div class="chart-card full"><h4>Medication Dispensing (Total Tabs/Caps)</h4><canvas id="chartDispensing" height="300"></canvas></div>
    ${sectionHeader('Provider Productivity')}
    <div class="chart-card full"><h4>Provider Productivity Report</h4><div id="providerProductivityTable"></div></div>
    <div class="chart-card full"><h4>Encounters per Provider</h4><canvas id="chartProviderProductivity" height="300"></canvas></div>
    ${sectionHeader('Data Quality')}
    <div class="chart-card full"><h4>Data Quality Dashboard</h4><div id="dataQualityDashboard"></div></div>`;
  // Ensure summary modal container exists
  if (!document.getElementById('analyticsSummaryModal')) {
    const modalDiv = document.createElement('div');
    modalDiv.id = 'analyticsSummaryModal';
    modalDiv.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;';
    modalDiv.innerHTML = '<div id="analyticsSummaryContent" style="background:var(--surface,#fff);border-radius:12px;padding:24px;max-width:520px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.2);position:relative;"></div>';
    modalDiv.addEventListener('click', (e) => { if (e.target === modalDiv) modalDiv.style.display = 'none'; });
    document.body.appendChild(modalDiv);
  }
  drawDiseaseChart(filtered); drawTopDiagnoses(filtered);
  drawSitesDonut(filtered); drawSexDonut(filtered);
  drawDaysChart(filtered); drawAgeChart(filtered);
  drawLabPositivity(filtered); drawProviderChart(filtered); drawProceduresChart(filtered);
  drawReferralTypesChart(filtered);
  drawMedsChart(filtered); drawDispensingChart(filtered);
  drawProviderProductivity(filtered);
  drawDataQualityDashboard(filtered);
}

// Canvas helpers
function drawHorizontalBarChart(canvasId, labels, values, color) {
  const canvas = document.getElementById(canvasId); if (!canvas) return;
  const ctx = canvas.getContext('2d'); const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect(); if (rect.width < 1) return;
  canvas.width = rect.width * dpr; const barH = 28, gap = 4, topPad = 10, labelW = 120;
  const totalH = topPad + labels.length * (barH + gap) + 10;
  canvas.height = totalH * dpr; canvas.style.width = rect.width + 'px'; canvas.style.height = totalH + 'px'; ctx.scale(dpr, dpr);
  const maxVal = Math.max(...values, 1); const barAreaW = rect.width - labelW - 50;
  labels.forEach((label, i) => {
    const y = topPad + i * (barH + gap);
    ctx.fillStyle = '#374151'; ctx.font = '12px -apple-system, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(label, labelW - 8, y + barH / 2);
    const w = (values[i] / maxVal) * barAreaW;
    ctx.fillStyle = color || '#F68630'; ctx.beginPath(); ctx.roundRect(labelW, y, Math.max(w, 2), barH, 4); ctx.fill();
    ctx.fillStyle = '#374151'; ctx.textAlign = 'left'; ctx.fillText(String(values[i]), labelW + w + 6, y + barH / 2);
  });
}
function drawDonut(canvasId, labels, values, colors) {
  const canvas = document.getElementById(canvasId); if (!canvas) return;
  const ctx = canvas.getContext('2d'); const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  if (rect.width < 1) return;
  const donutSize = Math.max(Math.min(rect.width * 0.5, 200), 80);
  const legendW = rect.width - donutSize - 20;
  const totalH = Math.max(donutSize, labels.length * 22 + 10);
  canvas.width = rect.width * dpr; canvas.height = totalH * dpr;
  canvas.style.width = rect.width + 'px'; canvas.style.height = totalH + 'px'; ctx.scale(dpr, dpr);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) { ctx.fillStyle = '#9ca3af'; ctx.font = '14px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('No data', rect.width/2, totalH/2); return; }
  const cx = donutSize/2, cy = totalH/2, r = donutSize/2 - 10, innerR = r * 0.55; let startAngle = -Math.PI / 2;
  values.forEach((val, i) => {
    if (val === 0) return; const sliceAngle = (val / total) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle); ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true); ctx.closePath();
    ctx.fillStyle = colors[i % colors.length]; ctx.fill();
    const lx = cx + Math.cos(startAngle + sliceAngle/2) * (r - 20), ly = cy + Math.sin(startAngle + sliceAngle/2) * (r - 20);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const pct = Math.round((val / total) * 100); if (pct >= 5) ctx.fillText(pct + '%', lx, ly);
    startAngle += sliceAngle;
  });
  // Draw legend
  const legendX = donutSize + 20;
  labels.forEach((label, i) => {
    if (values[i] === 0) return;
    const ly = 10 + i * 22;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(legendX, ly, 12, 12);
    ctx.fillStyle = '#374151'; ctx.font = '12px -apple-system, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const pct = Math.round((values[i] / total) * 100);
    ctx.fillText(`${label} (${values[i]} — ${pct}%)`, legendX + 18, ly + 6);
  });
}
function drawVerticalBarChart(canvasId, labels, values, color) {
  const canvas = document.getElementById(canvasId); if (!canvas) return;
  const ctx = canvas.getContext('2d'); const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect(); if (rect.width < 1) return; const w = rect.width, h = 220;
  canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; ctx.scale(dpr, dpr);
  const pad = { top: 20, bottom: 40, left: 40, right: 20 };
  const chartW = w - pad.left - pad.right, chartH = h - pad.top - pad.bottom;
  const maxVal = Math.max(...values, 1); const barW = Math.min(40, (chartW / labels.length) * 0.7); const barGap = chartW / labels.length;
  ctx.strokeStyle = '#e5e7eb'; ctx.fillStyle = '#9ca3af'; ctx.font = '11px -apple-system, sans-serif'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) { const y = pad.top + chartH - (chartH * i / 4); ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke(); ctx.fillText(String(Math.round(maxVal * i / 4)), pad.left - 6, y + 3); }
  labels.forEach((label, i) => {
    const x = pad.left + barGap * i + (barGap - barW) / 2; const bH = (values[i] / maxVal) * chartH; const y = pad.top + chartH - bH;
    ctx.fillStyle = color || '#F68630'; ctx.beginPath(); ctx.roundRect(x, y, barW, bH, [4, 4, 0, 0]); ctx.fill();
    ctx.fillStyle = '#374151'; ctx.font = '11px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(values[i]), x + barW/2, y - 5);
    ctx.fillStyle = '#6b7280'; ctx.font = '10px -apple-system, sans-serif'; ctx.save(); ctx.translate(x + barW/2, pad.top + chartH + 6); ctx.rotate(Math.PI / 6); ctx.textAlign = 'left'; ctx.fillText(label, 0, 0); ctx.restore();
  });
}

function drawDiseaseChart(filtered) {
  const counts = {}; Object.keys(DISEASE_CATEGORIES).forEach(k => { counts[k] = 0; });
  filtered.forEach(r => { if (!r.diagnosis) return; Object.entries(DISEASE_CATEGORIES).forEach(([cat, regex]) => { if (regex.test(r.diagnosis)) counts[cat]++; }); });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  drawHorizontalBarChart('chartDisease', sorted.map(s => s[0]), sorted.map(s => s[1]), '#F68630');
}
function drawSitesDonut(filtered) { const sites = getSites(); drawDonut('chartSites', sites, sites.map(s => filtered.filter(r => r.site === s).length), ['#F68630', '#c2590a', '#fb923c', '#fed7aa', '#ea580c', '#fdba74']); }
function drawSexDonut(filtered) { drawDonut('chartSex', ['Male', 'Female'], [filtered.filter(r => r.sex === 'M').length, filtered.filter(r => r.sex === 'F').length], ['#3b82f6', '#F68630']); }
function drawLabPositivity(filtered) {
  // Only show toggle-type tests in positivity table
  const toggleTests = DEFAULT_LAB_TESTS.filter(t => t.type === 'toggle');
  let html = '<table class="lab-table"><thead><tr><th>Test</th><th>Ordered</th><th>Positive</th><th>%</th></tr></thead><tbody>';
  toggleTests.forEach((t, idx) => {
    const ordered = filtered.filter(r => r.labs && r.labs[t.name] && r.labs[t.name].ordered).length;
    const posRecords = filtered.filter(r => r.labs && r.labs[t.name] && r.labs[t.name].result === 'POS');
    const positive = posRecords.length;
    const pct = ordered ? Math.round((positive / ordered) * 100) : 0;
    html += `<tr style="cursor:pointer;" onclick="(function(el){var d=el.parentNode.querySelector('.lab-detail-row-${idx}');if(d)d.style.display=d.style.display==='none'?'table-row':'none';})(this)"><td>${esc(t.name)} ${positive > 0 ? '&#9662;' : ''}</td><td>${ordered}</td><td>${positive}</td><td class="${pct >= 10 ? 'pct-red' : pct >= 5 ? 'pct-amber' : ''}">${pct}%</td></tr>`;
    if (positive > 0) {
      html += `<tr class="lab-detail-row-${idx}" style="display:none;"><td colspan="4" style="padding:4px 12px;background:var(--surface-alt,#f9fafb);"><div style="font-size:12px;color:#374151;">`;
      posRecords.forEach(r => {
        const name = esc(r.name || r.givenName || 'Unknown');
        html += `<div style="padding:2px 0;">${name} &mdash; ${esc(r.labs[t.name].result)}</div>`;
      });
      html += '</div></td></tr>';
    }
  });
  document.getElementById('labPositivityTable').innerHTML = html + '</tbody></table>';
}
function drawDaysChart(filtered) {
  const days = {}; filtered.forEach(r => { if (r.date) days[r.date] = (days[r.date] || 0) + 1; });
  const sorted = Object.entries(days).sort((a, b) => a[0].localeCompare(b[0]));
  drawVerticalBarChart('chartDays', sorted.map(s => formatDate(s[0])), sorted.map(s => s[1]), '#F68630');
}
function drawAgeChart(filtered) {
  const bins = { '0-12': 0, '13-18': 0, '19-35': 0, '36-59': 0, '60+': 0 };
  filtered.forEach(r => { if (!r.dob) return; const age = calcAge(r.dob); if (age <= 12) bins['0-12']++; else if (age <= 18) bins['13-18']++; else if (age <= 35) bins['19-35']++; else if (age <= 59) bins['36-59']++; else bins['60+']++; });
  drawVerticalBarChart('chartAge', Object.keys(bins), Object.values(bins), '#fb923c');
}
function drawReferralTypesChart(filtered) {
  const types = getReferralTypes().filter(t => t !== 'None');
  const counts = {};
  types.forEach(t => { counts[t] = 0; });
  filtered.forEach(r => { if (r.referralType && r.referralType !== 'None' && counts[r.referralType] !== undefined) counts[r.referralType]++; });
  const sorted = Object.entries(counts).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
  if (sorted.length) drawVerticalBarChart('chartReferralTypes', sorted.map(s => s[0]), sorted.map(s => s[1]), '#ea580c');
}
function drawReferralsList(filtered) {
  let items = [];
  filtered.forEach(r => {
    if (r.referralType && r.referralType !== 'None') items.push({ record: r, name: r.name || r.givenName || 'Unknown', detail: 'Referral: ' + r.referralType });
    if (hasLabPositive(r)) { const posTests = getPositiveLabNames(r.labs); items.push({ record: r, name: r.name || r.givenName || 'Unknown', detail: 'Lab+: ' + posTests.join(', ') }); }
  });
  const container = document.getElementById('referralsList');
  if (items.length === 0) { container.innerHTML = '<div class="empty-state" style="padding:20px;">No referrals or positive labs in selection.</div>'; return; }
  container.innerHTML = '<div class="named-list">' + items.map((it, i) => `<div class="named-list-item" style="cursor:pointer;" data-ref-idx="${i}"><span class="nli-name">${esc(it.name)}</span><span class="nli-detail">${esc(it.detail)}</span></div>`).join('') + '</div>';
  container.querySelectorAll('[data-ref-idx]').forEach(el => {
    el.addEventListener('click', () => { showPatientSummary(items[parseInt(el.dataset.refIdx)].record); });
  });
}
function drawProviderChart(filtered) {
  const providers = getProviders(); const counts = {};
  providers.forEach(p => { counts[p] = 0; });
  filtered.forEach(r => { if (r.provider && counts[r.provider] !== undefined) counts[r.provider]++; });
  const sorted = Object.entries(counts).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
  if (sorted.length) drawVerticalBarChart('chartProviders', sorted.map(s => s[0]), sorted.map(s => s[1]), '#c2590a');
}
function getMedName(medId) {
  const formulary = getFormulary();
  const med = formulary.find(f => f.id === medId);
  if (med) return med.name;
  // Try to make a readable name from the ID (e.g., 'abx-amox500' -> 'Amox500')
  if (medId && medId.includes('-')) return medId.split('-').slice(1).join(' ');
  return medId || 'Unknown';
}
function drawMedsChart(filtered) {
  const counts = {};
  filtered.forEach(r => { if (!r.medications) return; r.medications.forEach(m => { if (!m.medId) return; const name = getMedName(m.medId); counts[name] = (counts[name] || 0) + 1; }); });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (sorted.length) drawHorizontalBarChart('chartMeds', sorted.map(s => s[0]), sorted.map(s => s[1]), '#F68630');
  else { const c = document.getElementById('chartMeds'); if (c) { const ctx = c.getContext('2d'); ctx.fillStyle = '#9ca3af'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('No medication data', c.width/2, 50); } }
}
function drawDispensingChart(filtered) {
  const totals = {};
  filtered.forEach(r => {
    if (!r.medications) return;
    r.medications.forEach(m => {
      if (!m.qty || !m.medId) return;
      const name = getMedName(m.medId);
      totals[name] = (totals[name] || 0) + m.qty;
    });
  });
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (sorted.length) drawHorizontalBarChart('chartDispensing', sorted.map(s => s[0]), sorted.map(s => s[1]), '#2E86AB');
  else { const c = document.getElementById('chartDispensing'); if (c) { const ctx = c.getContext('2d'); ctx.fillStyle = '#9ca3af'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('No dispensing data (qty not recorded)', c.width/2, 50); } }
}

// Surgery List — expanded with age, sex, provider, meds
function drawSurgeryList(filtered) {
  const surgeries = filtered.filter(r => r.referralType === 'Surgery');
  const container = document.getElementById('surgeryList');
  if (!container) return;
  if (surgeries.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;">No surgery referrals in this period.</div>';
    return;
  }
  const formulary = getFormulary();
  let html = `<div style="margin-bottom:8px;font-size:13px;color:var(--gray-500);">${surgeries.length} surgery referral(s)</div>`;
  html += '<table class="lab-table"><thead><tr><th>Patient</th><th>Age/Sex</th><th>Diagnosis</th><th>Provider</th><th>Site</th><th>Date</th></tr></thead><tbody>';
  surgeries.forEach((r, i) => {
    const age = r.dob ? calcAge(r.dob) : '?';
    html += `<tr style="cursor:pointer;" data-surg-idx="${i}"><td><strong>${esc(r.name || r.givenName || 'Unknown')}</strong></td><td>${esc(r.sex || '')}/${age}</td><td>${esc(r.diagnosis || '')}</td><td>${esc(r.provider || '')}</td><td>${esc(r.site || '')}</td><td>${esc(r.date || '')}</td></tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
  container.querySelectorAll('[data-surg-idx]').forEach(el => {
    el.addEventListener('click', () => { showPatientSummary(surgeries[parseInt(el.dataset.surgIdx)]); });
  });
}

// All Referrals Detail Table
function drawAllReferralsTable(filtered) {
  const referred = filtered.filter(r => r.referralType && r.referralType !== 'None');
  const container = document.getElementById('allReferralsTable');
  if (!container) return;
  if (referred.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;">No referrals in this period.</div>';
    return;
  }
  let html = `<div style="margin-bottom:8px;font-size:13px;color:var(--gray-500);">${referred.length} total referral(s)</div>`;
  html += '<table class="lab-table"><thead><tr><th>Patient</th><th>Type</th><th>Diagnosis</th><th>Age/Sex</th><th>Site</th><th>Date</th></tr></thead><tbody>';
  referred.forEach((r, i) => {
    const age = r.dob ? calcAge(r.dob) : '?';
    const typeColor = r.referralType === 'Surgery' ? 'var(--red)' : r.referralType === 'Hospital' ? 'var(--amber)' : 'var(--primary)';
    html += `<tr style="cursor:pointer;" data-allref-idx="${i}"><td><strong>${esc(r.name || r.givenName || 'Unknown')}</strong></td><td style="color:${typeColor};font-weight:600;">${esc(r.referralType)}</td><td>${esc(r.diagnosis || '')}</td><td>${esc(r.sex || '')}/${age}</td><td>${esc(r.site || '')}</td><td>${esc(r.date || '')}</td></tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
  container.querySelectorAll('[data-allref-idx]').forEach(el => {
    el.addEventListener('click', () => { showPatientSummary(referred[parseInt(el.dataset.allrefIdx)]); });
  });
}

// Procedures Chart
function drawProceduresChart(filtered) {
  const counts = {};
  filtered.forEach(r => {
    if (!r.procedures) return;
    r.procedures.forEach(p => { if (p) counts[p] = (counts[p] || 0) + 1; });
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length) drawHorizontalBarChart('chartProcedures', sorted.map(s => s[0]), sorted.map(s => s[1]), '#2E86AB');
}

// Top Diagnoses Table
function drawTopDiagnoses(filtered) {
  const counts = {};
  filtered.forEach(r => {
    if (!r.diagnosis) return;
    r.diagnosis.split(/[,;]+/).forEach(d => {
      const trimmed = d.trim();
      if (trimmed) counts[trimmed] = (counts[trimmed] || 0) + 1;
    });
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const total = sorted.reduce((s, e) => s + e[1], 0);
  const container = document.getElementById('topDiagnosesTable');
  if (!container) return;
  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;">No diagnoses recorded.</div>';
    return;
  }
  let html = '<table class="lab-table"><thead><tr><th>#</th><th>Diagnosis</th><th>Count</th><th>%</th></tr></thead><tbody>';
  sorted.forEach((entry, i) => {
    const pct = total ? Math.round((entry[1] / total) * 100) : 0;
    html += `<tr><td>${i + 1}</td><td>${esc(entry[0])}</td><td>${entry[1]}</td><td>${pct}%</td></tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ==========================================
// PROVIDER PRODUCTIVITY REPORT
// ==========================================
function drawProviderProductivity(filtered) {
  const container = document.getElementById('providerProductivityTable');
  if (!container) return;

  const providerData = {};
  filtered.forEach(r => {
    if (!r.provider) return;
    if (!providerData[r.provider]) {
      providerData[r.provider] = { encounters: 0, referrals: 0, diagnoses: new Set() };
    }
    providerData[r.provider].encounters++;
    if (r.referralType && r.referralType !== 'None') providerData[r.provider].referrals++;
    if (r.diagnosis) {
      r.diagnosis.split(/[,;]+/).forEach(d => {
        const trimmed = d.trim();
        if (trimmed) providerData[r.provider].diagnoses.add(trimmed);
      });
    }
  });

  const sorted = Object.entries(providerData).sort((a, b) => b[1].encounters - a[1].encounters);

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;">No provider data available.</div>';
    return;
  }

  let html = '<table class="lab-table"><thead><tr><th>Provider</th><th>Encounters</th><th>Referrals Made</th><th>Unique Diagnoses</th></tr></thead><tbody>';
  sorted.forEach(([name, data]) => {
    html += `<tr><td><strong>${esc(name)}</strong></td><td>${data.encounters}</td><td>${data.referrals}</td><td>${data.diagnoses.size}</td></tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;

  // Draw bar chart
  if (sorted.length) {
    drawVerticalBarChart('chartProviderProductivity', sorted.map(s => s[0]), sorted.map(s => s[1].encounters), '#c2590a');
  }
}

// ==========================================
// DATA QUALITY DASHBOARD
// ==========================================
function drawDataQualityDashboard(filtered) {
  const container = document.getElementById('dataQualityDashboard');
  if (!container) return;
  const total = filtered.length;
  if (total === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;">No records to analyze.</div>';
    return;
  }

  const metrics = [
    { label: 'Vitals: Temperature', count: filtered.filter(r => r.temp).length },
    { label: 'Vitals: Blood Pressure', count: filtered.filter(r => r.bp).length },
    { label: 'Vitals: Weight', count: filtered.filter(r => r.weight).length },
    { label: 'Diagnosis Entered', count: filtered.filter(r => r.diagnosis && r.diagnosis.trim()).length },
    { label: 'Provider Assigned', count: filtered.filter(r => r.provider && r.provider.trim()).length },
    { label: 'Medications Prescribed', count: filtered.filter(r => r.medications && r.medications.length > 0).length },
    { label: 'Labs Ordered', count: filtered.filter(r => {
      if (!r.labs) return false;
      return Object.values(r.labs).some(l => l && l.ordered);
    }).length }
  ];

  // Incomplete records: missing diagnosis OR provider OR any vital
  const incompleteRecords = filtered.filter(r => {
    const missingVitals = !r.temp && !r.bp && !r.weight;
    const missingDx = !r.diagnosis || !r.diagnosis.trim();
    const missingProvider = !r.provider || !r.provider.trim();
    return missingVitals || missingDx || missingProvider;
  });

  let html = '<div style="display:grid;gap:10px;margin-bottom:16px;">';
  metrics.forEach(m => {
    const pct = Math.round((m.count / total) * 100);
    const color = pct >= 80 ? 'var(--green, #22c55e)' : pct >= 50 ? 'var(--amber, #f59e0b)' : 'var(--red, #ef4444)';
    html += `
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:200px;font-size:13px;font-weight:500;color:#374151;">${esc(m.label)}</div>
        <div style="flex:1;background:#f3f4f6;border-radius:6px;height:22px;overflow:hidden;position:relative;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:6px;transition:width 0.3s;"></div>
        </div>
        <div style="width:60px;text-align:right;font-size:13px;font-weight:700;color:${color};">${pct}%</div>
        <div style="width:60px;text-align:right;font-size:12px;color:#6b7280;">${m.count}/${total}</div>
      </div>`;
  });
  html += '</div>';

  // Incomplete records section
  html += `<div style="margin-top:12px;padding:12px;background:${incompleteRecords.length > 0 ? '#fef2f2' : '#f0fdf4'};border:1px solid ${incompleteRecords.length > 0 ? '#fecaca' : '#bbf7d0'};border-radius:8px;">
    <div style="font-size:14px;font-weight:600;color:${incompleteRecords.length > 0 ? '#991b1b' : '#166534'};">
      ${incompleteRecords.length} Incomplete Record${incompleteRecords.length !== 1 ? 's' : ''}
      <span style="font-weight:400;font-size:12px;color:#6b7280;margin-left:8px;">(missing vitals, diagnosis, or provider)</span>
    </div>`;

  if (incompleteRecords.length > 0) {
    html += `<div id="incompleteRecordsList" style="margin-top:8px;max-height:200px;overflow-y:auto;">`;
    incompleteRecords.slice(0, 20).forEach(r => {
      const missing = [];
      if (!r.temp && !r.bp && !r.weight) missing.push('vitals');
      if (!r.diagnosis || !r.diagnosis.trim()) missing.push('diagnosis');
      if (!r.provider || !r.provider.trim()) missing.push('provider');
      html += `<div class="dq-incomplete-row" data-id="${r.id}" style="padding:4px 0;border-bottom:1px solid #fecaca;cursor:pointer;font-size:12px;">
        <strong>${esc(r.givenName ? r.givenName + ' ' + (r.familyName || '') : r.name || 'Unknown')}</strong>
        <span style="color:#6b7280;"> -- ${formatDate(r.date)} -- Missing: ${missing.join(', ')}</span>
      </div>`;
    });
    if (incompleteRecords.length > 20) {
      html += `<div style="font-size:11px;color:#6b7280;padding:4px 0;">+ ${incompleteRecords.length - 20} more</div>`;
    }
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;

  // Wire up click handlers for incomplete records
  container.querySelectorAll('.dq-incomplete-row').forEach(el => {
    el.addEventListener('click', () => {
      openRecord(el.dataset.id);
    });
  });
}

// ==========================================
// DONOR SUMMARY REPORT PDF
// ==========================================
async function generateDonorReport() {
  const filtered = getFilteredRecords();
  const total = filtered.length;
  const uniquePatients = new Set(filtered.map(r => r.mrn || r.id)).size;
  const formulary = getFormulary();

  // Date range
  const dates = filtered.map(r => r.date).filter(Boolean).sort();
  const dateFrom = dates.length ? dates[0] : 'N/A';
  const dateTo = dates.length ? dates[dates.length - 1] : 'N/A';

  // Demographics
  const maleCount = filtered.filter(r => r.sex === 'M').length;
  const femaleCount = filtered.filter(r => r.sex === 'F').length;
  const ageBins = { '0-12': 0, '13-18': 0, '19-35': 0, '36-59': 0, '60+': 0 };
  filtered.forEach(r => {
    if (!r.dob) return;
    const age = calcAge(r.dob);
    if (age <= 12) ageBins['0-12']++;
    else if (age <= 18) ageBins['13-18']++;
    else if (age <= 35) ageBins['19-35']++;
    else if (age <= 59) ageBins['36-59']++;
    else ageBins['60+']++;
  });

  // Sites
  const siteCounts = {};
  filtered.forEach(r => { if (r.site) siteCounts[r.site] = (siteCounts[r.site] || 0) + 1; });
  const sortedSites = Object.entries(siteCounts).sort((a, b) => b[1] - a[1]);

  // Top diagnoses
  const dxCounts = {};
  filtered.forEach(r => {
    if (!r.diagnosis) return;
    r.diagnosis.split(/[,;]+/).forEach(d => {
      const trimmed = d.trim();
      if (trimmed) dxCounts[trimmed] = (dxCounts[trimmed] || 0) + 1;
    });
  });
  const topDx = Object.entries(dxCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const totalDx = topDx.reduce((s, e) => s + e[1], 0);

  // Lab summary
  const toggleTests = DEFAULT_LAB_TESTS.filter(t => t.type === 'toggle');
  const labRows = [];
  toggleTests.forEach(t => {
    const ordered = filtered.filter(r => r.labs && r.labs[t.name] && r.labs[t.name].ordered).length;
    const positive = filtered.filter(r => r.labs && r.labs[t.name] && r.labs[t.name].result === 'POS').length;
    if (ordered > 0) {
      labRows.push({ name: t.name, ordered, positive, pct: Math.round((positive / ordered) * 100) });
    }
  });

  // Medications
  const medCounts = {};
  filtered.forEach(r => {
    if (!r.medications) return;
    r.medications.forEach(m => {
      const med = formulary.find(f => f.id === m.medId);
      const name = med ? med.name : m.medId;
      medCounts[name] = (medCounts[name] || 0) + 1;
    });
  });
  const topMeds = Object.entries(medCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

  // Referrals
  const refCounts = {};
  let totalReferrals = 0;
  filtered.forEach(r => {
    if (r.referralType && r.referralType !== 'None') {
      refCounts[r.referralType] = (refCounts[r.referralType] || 0) + 1;
      totalReferrals++;
    }
  });
  const sortedRefs = Object.entries(refCounts).sort((a, b) => b[1] - a[1]);
  const completedReferrals = filtered.filter(r => r.referralStatus === 'Completed').length;

  // Provider encounters
  const provCounts = {};
  filtered.forEach(r => { if (r.provider) provCounts[r.provider] = (provCounts[r.provider] || 0) + 1; });
  const sortedProvs = Object.entries(provCounts).sort((a, b) => b[1] - a[1]);

  const deviceName = await window.electronAPI.getSetting('deviceName') || 'DH Field EMR';

  const htmlContent = `
    <div style="text-align:center;margin-bottom:24px;border-bottom:2px solid #F68630;padding-bottom:16px;">
      <h1 style="margin:0;color:#c2590a;font-size:22px;">${esc(deviceName)}</h1>
      <h2 style="margin:4px 0 0;font-size:16px;color:#374151;font-weight:400;">Field Medical Outreach Report</h2>
      <div style="margin-top:8px;font-size:13px;color:#6b7280;">${formatDate(dateFrom)} to ${formatDate(dateTo)}</div>
    </div>

    <h3 style="color:#c2590a;font-size:14px;text-transform:uppercase;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">Executive Summary</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr><td style="padding:4px 8px;font-weight:600;width:200px;">Total Encounters</td><td style="padding:4px 8px;">${total}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:600;">Unique Patients</td><td style="padding:4px 8px;">${uniquePatients}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:600;">Total Referrals</td><td style="padding:4px 8px;">${totalReferrals}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:600;">Male / Female</td><td style="padding:4px 8px;">${maleCount} / ${femaleCount}</td></tr>
    </table>

    <h3 style="color:#c2590a;font-size:14px;text-transform:uppercase;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">Demographics</h3>
    <div style="display:flex;gap:24px;margin-bottom:16px;">
      <div style="flex:1;">
        <h4 style="font-size:12px;color:#6b7280;margin:0 0 6px;">Age Distribution</h4>
        <table style="width:100%;border-collapse:collapse;">
          ${Object.entries(ageBins).map(([range, count]) => `<tr><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;">${range}</td><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">${count} (${total ? Math.round((count/total)*100) : 0}%)</td></tr>`).join('')}
        </table>
      </div>
      <div style="flex:1;">
        <h4 style="font-size:12px;color:#6b7280;margin:0 0 6px;">Sites</h4>
        <table style="width:100%;border-collapse:collapse;">
          ${sortedSites.map(([site, count]) => `<tr><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;">${esc(site)}</td><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">${count}</td></tr>`).join('')}
        </table>
      </div>
    </div>

    <h3 style="color:#c2590a;font-size:14px;text-transform:uppercase;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">Top 10 Diagnoses</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead><tr style="background:#f9fafb;"><th style="padding:4px 8px;text-align:left;font-size:12px;">#</th><th style="padding:4px 8px;text-align:left;font-size:12px;">Diagnosis</th><th style="padding:4px 8px;text-align:right;font-size:12px;">Count</th><th style="padding:4px 8px;text-align:right;font-size:12px;">%</th></tr></thead>
      <tbody>
        ${topDx.map(([dx, count], i) => `<tr><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;">${i+1}</td><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;">${esc(dx)}</td><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">${count}</td><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">${totalDx ? Math.round((count/totalDx)*100) : 0}%</td></tr>`).join('')}
      </tbody>
    </table>

    ${labRows.length ? `
      <h3 style="color:#c2590a;font-size:14px;text-transform:uppercase;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">Lab Summary</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f9fafb;"><th style="padding:4px 8px;text-align:left;font-size:12px;">Test</th><th style="padding:4px 8px;text-align:right;font-size:12px;">Ordered</th><th style="padding:4px 8px;text-align:right;font-size:12px;">Positive</th><th style="padding:4px 8px;text-align:right;font-size:12px;">Positivity Rate</th></tr></thead>
        <tbody>
          ${labRows.map(l => `<tr><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;">${esc(l.name)}</td><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">${l.ordered}</td><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">${l.positive}</td><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">${l.pct}%</td></tr>`).join('')}
        </tbody>
      </table>
    ` : ''}

    <h3 style="color:#c2590a;font-size:14px;text-transform:uppercase;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">Medications Dispensed (Top 15)</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead><tr style="background:#f9fafb;"><th style="padding:4px 8px;text-align:left;font-size:12px;">Medication</th><th style="padding:4px 8px;text-align:right;font-size:12px;">Prescriptions</th></tr></thead>
      <tbody>
        ${topMeds.map(([name, count]) => `<tr><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;">${esc(name)}</td><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">${count}</td></tr>`).join('')}
      </tbody>
    </table>

    <h3 style="color:#c2590a;font-size:14px;text-transform:uppercase;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">Referrals Summary</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead><tr style="background:#f9fafb;"><th style="padding:4px 8px;text-align:left;font-size:12px;">Type</th><th style="padding:4px 8px;text-align:right;font-size:12px;">Count</th></tr></thead>
      <tbody>
        ${sortedRefs.map(([type, count]) => `<tr><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;">${esc(type)}</td><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">${count}</td></tr>`).join('')}
        <tr style="font-weight:600;"><td style="padding:3px 8px;">Total Referrals</td><td style="padding:3px 8px;text-align:right;">${totalReferrals}</td></tr>
      </tbody>
    </table>

    <h3 style="color:#c2590a;font-size:14px;text-transform:uppercase;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">Provider Encounter Counts</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead><tr style="background:#f9fafb;"><th style="padding:4px 8px;text-align:left;font-size:12px;">Provider</th><th style="padding:4px 8px;text-align:right;font-size:12px;">Encounters</th></tr></thead>
      <tbody>
        ${sortedProvs.map(([prov, count]) => `<tr><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;">${esc(prov)}</td><td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">${count}</td></tr>`).join('')}
      </tbody>
    </table>
  `;

  const result = await window.electronAPI.exportPDF(htmlContent, 'Donor-Report');
  if (result) alert('Donor report exported successfully!');
}

// Patient Summary Modal
function showPatientSummary(record) {
  const modal = document.getElementById('analyticsSummaryModal');
  if (!modal) return;
  const r = record;
  const age = r.dob ? calcAge(r.dob) : 'N/A';
  let medsHtml = '';
  if (r.medications && r.medications.length) {
    medsHtml = '<ul style="margin:4px 0 0 16px;padding:0;">';
    const formulary = getFormulary();
    r.medications.forEach(m => {
      const med = formulary.find(f => f.id === m.medId);
      const name = med ? med.name : m.medId;
      medsHtml += `<li style="margin-bottom:2px;">${esc(name)} ${esc(m.dose || '')} ${esc(m.freq || '')} x${esc(String(m.duration || ''))} days (qty: ${esc(String(m.qty || m.quantity || ''))})</li>`;
    });
    medsHtml += '</ul>';
  } else {
    medsHtml = '<span style="color:#6b7280;">None</span>';
  }
  const content = document.getElementById('analyticsSummaryContent');
  content.innerHTML = `
    <button onclick="document.getElementById('analyticsSummaryModal').style.display='none'" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:20px;cursor:pointer;color:#6b7280;">&times;</button>
    <h3 style="margin:0 0 12px 0;color:var(--primary-dark);">${esc(r.name || ((r.givenName || '') + ' ' + (r.familyName || '')).trim() || 'Unknown')}</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:14px;">
      <div><strong>Age:</strong> ${esc(String(age))}</div>
      <div><strong>Sex:</strong> ${esc(r.sex || 'N/A')}</div>
      <div><strong>Date:</strong> ${esc(r.date || 'N/A')}</div>
      <div><strong>Site:</strong> ${esc(r.site || 'N/A')}</div>
    </div>
    <div style="margin-top:12px;font-size:14px;">
      <div style="margin-bottom:8px;"><strong>Diagnosis:</strong> ${esc(r.diagnosis || 'N/A')}</div>
      <div style="margin-bottom:8px;"><strong>Medications:</strong> ${medsHtml}</div>
      <div style="margin-bottom:8px;"><strong>Referral:</strong> ${esc(r.referralType || 'None')}</div>
      <div><strong>Notes:</strong> ${esc(r.notes || r.treatmentNotes || 'None')}</div>
    </div>`;
  modal.style.display = 'flex';
}
