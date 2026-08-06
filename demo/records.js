// ==========================================
// RECORDS SCREEN
// ==========================================
function renderStats() {
  const today = new Date().toISOString().slice(0, 10);
  const todayRecords = records.filter(r => r.date === today);
  const pediatric = records.filter(r => r.dob && calcAge(r.dob) < 18);
  const uniquePatients = new Set(records.map(r => r.mrn || r.id)).size;
  document.getElementById('statsBar').innerHTML = `
    <div class="stat-card"><div class="stat-val">${records.length}</div><div class="stat-lbl">Total Encounters</div></div>
    <div class="stat-card"><div class="stat-val">${uniquePatients}</div><div class="stat-lbl">Unique Patients</div></div>
    <div class="stat-card"><div class="stat-val">${todayRecords.length}</div><div class="stat-lbl">Today</div></div>
    <div class="stat-card"><div class="stat-val">${pediatric.length}</div><div class="stat-lbl">Pediatric (&lt;18)</div></div>`;
}

function renderDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const todayRecords = records.filter(r => r.date === today);
  const el = document.getElementById('dashboard');
  if (!el) return;

  // Pending referrals (any date, not completed)
  const pendingReferrals = records.filter(r =>
    !r.deleted && r.referralType && r.referralType !== 'None' &&
    (!r.referralStatus || r.referralStatus === 'Pending')
  );

  // Upcoming scheduled (today or future, pending)
  const upcoming = pendingReferrals.filter(r => r.referralDate && r.referralDate >= today)
    .sort((a, b) => (a.referralDate || '').localeCompare(b.referralDate || ''));

  // Today's referrals specifically
  const todayReferrals = pendingReferrals.filter(r => r.referralDate === today);

  // Recent surgeries (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const recentSurgeries = records.filter(r =>
    !r.deleted && r.surgery && r.surgery.type && r.date >= weekAgo
  );

  // Top diagnoses today
  const dxCounts = {};
  todayRecords.forEach(r => {
    if (r.diagnosis) {
      r.diagnosis.split(/[,;]/).forEach(d => {
        const dx = d.trim();
        if (dx) dxCounts[dx] = (dxCounts[dx] || 0) + 1;
      });
    }
  });
  const topDx = Object.entries(dxCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  let html = `<div class="dashboard-grid">`;

  // Today's summary
  html += `<div class="dash-card">
    <div class="dash-card-title">Today's Summary</div>
    <div class="dash-card-body">
      <div class="dash-stat"><span class="dash-stat-val">${todayRecords.length}</span> patients seen</div>
      ${todayRecords.filter(r => r.sex === 'F').length ? `<div class="dash-stat"><span class="dash-stat-val">${todayRecords.filter(r => r.sex === 'F').length}</span> female / <span class="dash-stat-val">${todayRecords.filter(r => r.sex === 'M').length}</span> male</div>` : ''}
      ${topDx.length ? `<div style="margin-top:6px;font-size:11px;color:var(--gray-500);text-transform:uppercase;">Top Diagnoses</div>
        ${topDx.map(([dx, c]) => `<div style="font-size:12px;">${esc(dx)} <span style="color:var(--primary);font-weight:700;">(${c})</span></div>`).join('')}` : '<div style="color:var(--gray-400);font-size:12px;margin-top:8px;">No patients yet today</div>'}
    </div>
  </div>`;

  // Upcoming referrals
  html += `<div class="dash-card">
    <div class="dash-card-title">Upcoming Referrals <span class="badge badge-amber" style="margin-left:6px;">${upcoming.length}</span></div>
    <div class="dash-card-body">
      ${todayReferrals.length ? `<div style="margin-bottom:6px;font-size:12px;font-weight:700;color:var(--red);">${todayReferrals.length} scheduled TODAY</div>` : ''}
      ${upcoming.length === 0 ? '<div style="color:var(--gray-400);font-size:12px;">No pending referrals</div>' :
        upcoming.slice(0, 6).map(r => `<div class="dash-referral-row">
          <span class="badge ${r.referralDate === today ? 'badge-red' : 'badge-amber'}" style="min-width:60px;text-align:center;">${r.referralDate === today ? 'TODAY' : formatDate(r.referralDate)}</span>
          <span style="font-size:12px;font-weight:600;">${esc(r.name || (r.givenName + ' ' + (r.familyName || '')))}</span>
          <span style="font-size:11px;color:var(--gray-500);">${esc(r.referralType)}</span>
        </div>`).join('') +
        (upcoming.length > 6 ? `<div style="font-size:11px;color:var(--gray-400);margin-top:4px;">+ ${upcoming.length - 6} more</div>` : '')}
    </div>
  </div>`;

  // Recent surgeries
  html += `<div class="dash-card">
    <div class="dash-card-title">Recent Surgeries (7 days)</div>
    <div class="dash-card-body">
      ${recentSurgeries.length === 0 ? '<div style="color:var(--gray-400);font-size:12px;">No recent surgeries</div>' :
        recentSurgeries.slice(0, 5).map(r => `<div style="font-size:12px;padding:3px 0;border-bottom:1px solid var(--gray-100);">
          <strong>${esc(r.name || (r.givenName + ' ' + (r.familyName || '')))}</strong> — ${esc(r.surgery.type)}
          <span style="color:var(--gray-400);font-size:11px;">${formatDate(r.date)}</span>
        </div>`).join('')}
    </div>
  </div>`;

  html += `</div>`;
  el.innerHTML = html;
}

function hasLabPositive(r) {
  return hasLabPositiveResult(r.labs);
}

function populateFilterDropdowns() {
  // Provider dropdown
  const providerSel = document.getElementById('filterProvider');
  if (providerSel) {
    const current = providerSel.value;
    const providers = getProviders();
    providerSel.innerHTML = '<option value="">All Providers</option>' +
      providers.map(p => `<option>${typeof p === 'string' ? p : p.name || p}</option>`).join('');
    providerSel.value = current;
  }
  // Referral type dropdown
  const refSel = document.getElementById('filterReferralType');
  if (refSel) {
    const current = refSel.value;
    const types = getReferralTypes().filter(t => t !== 'None');
    refSel.innerHTML = '<option value="">All Referrals</option>' +
      types.map(t => `<option>${t}</option>`).join('');
    refSel.value = current;
  }
}

function initAdvancedFilters() {
  const toggleBtn = document.getElementById('btnToggleFilters');
  const filtersPanel = document.getElementById('advancedFilters');
  if (toggleBtn && filtersPanel) {
    toggleBtn.addEventListener('click', () => {
      const isVisible = filtersPanel.style.display !== 'none';
      filtersPanel.style.display = isVisible ? 'none' : '';
      toggleBtn.innerHTML = isVisible ? 'Filters &#9660;' : 'Filters &#9650;';
    });
  }

  // Filter change listeners
  ['filterDateFrom', 'filterDateTo', 'filterProvider', 'filterReferralType'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', renderRecords);
  });

  // Today's Patients button
  const btnToday = document.getElementById('btnTodayPatients');
  if (btnToday) {
    btnToday.addEventListener('click', () => {
      const today = new Date().toISOString().slice(0, 10);
      document.getElementById('filterDateFrom').value = today;
      document.getElementById('filterDateTo').value = today;
      renderRecords();
    });
  }

  // Reset Filters button
  const btnReset = document.getElementById('btnResetFilters');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      document.getElementById('filterDateFrom').value = '';
      document.getElementById('filterDateTo').value = '';
      document.getElementById('filterProvider').value = '';
      document.getElementById('filterReferralType').value = '';
      document.getElementById('searchInput').value = '';
      document.getElementById('siteFilter').value = '';
      renderRecords();
    });
  }

  populateFilterDropdowns();
}

function renderRecords() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const siteFilter = document.getElementById('siteFilter').value;
  const dateFrom = document.getElementById('filterDateFrom') ? document.getElementById('filterDateFrom').value : '';
  const dateTo = document.getElementById('filterDateTo') ? document.getElementById('filterDateTo').value : '';
  const providerFilter = document.getElementById('filterProvider') ? document.getElementById('filterProvider').value : '';
  const referralFilter = document.getElementById('filterReferralType') ? document.getElementById('filterReferralType').value : '';

  let filtered = records.filter(r => {
    if (siteFilter && r.site !== siteFilter) return false;
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    if (providerFilter && r.provider !== providerFilter) return false;
    if (referralFilter && r.referralType !== referralFilter) return false;
    if (search) {
      const fullN = r.givenName ? `${r.givenName} ${r.familyName}` : r.name;
      const hay = `${fullN} ${r.mrn || ''} ${r.chiefConcern} ${r.diagnosis}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
  filtered.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));

  if (filtered.length === 0) {
    document.getElementById('recordsList').innerHTML = '<div class="empty-state">No records found. Click "+ New Encounter" to add one.</div>';
    return;
  }

  // Group records by MRN (base MRN without suffix for grouping same patient)
  const patientGroups = new Map();
  filtered.forEach(r => {
    const mrn = r.mrn || r.id; // fallback to id if no MRN
    if (!patientGroups.has(mrn)) patientGroups.set(mrn, []);
    patientGroups.get(mrn).push(r);
  });

  let html = '';
  // Cap the number of patient groups rendered so the DOM stays small and the
  // list stays fast at thousands of records (a clinician never scrolls 5,000
  // cards). Refine search/filters to see more; search is debounced in app.js.
  const RENDER_CAP = 150;
  let _shown = 0;
  patientGroups.forEach((encounters, mrn) => {
    if (_shown >= RENDER_CAP) return; // over the cap — skipped; see the "+ more" note below
    _shown++;
    // Sort encounters by date (newest first)
    encounters.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latest = encounters[0];
    const visitCount = encounters.length;
    const age = latest.dob ? calcAge(latest.dob) : '';
    const sexAge = [latest.sex, age ? age + 'y' : ''].filter(Boolean).join('/');
    const badges = [];
    // Check badges across ALL encounters for this patient
    if (encounters.some(r => hasLabPositive(r))) badges.push('<span class="badge badge-red">Lab+</span>');
    if (encounters.some(r => r.referralType && r.referralType !== 'None')) badges.push('<span class="badge badge-amber">Referred</span>');
    if (encounters.some(r => r.pregnant === 'Yes')) badges.push('<span class="badge badge-blue">Pregnant</span>');
    if (visitCount > 1) badges.push(`<span class="badge badge-green">${visitCount} visits</span>`);
    const dxPreview = (latest.diagnosis || '').slice(0, 80) + ((latest.diagnosis || '').length > 80 ? '...' : '');

    if (visitCount === 1) {
      // Single encounter — show as before
      html += `
        <div class="record-card" data-id="${latest.id}">
          <div>
            <div class="rc-name">${esc(latest.givenName ? latest.givenName + ' ' + (latest.familyName || '') : latest.name || 'Unknown')}</div>
            <div class="rc-meta">${esc(latest.site || '')} \u00b7 ${formatDate(latest.date)} \u00b7 ${esc(sexAge)} \u00b7 MRN: ${esc(mrn)}</div>
            ${latest.deviceId && latest.deviceId !== currentDeviceId ? `<div class="rc-device">From: ${esc(latest.deviceId)}</div>` : ''}
          </div>
          <div class="rc-badges">${badges.join('')}</div>
          ${dxPreview ? `<div class="rc-dx">${esc(dxPreview)}</div>` : ''}
        </div>`;
    } else {
      // Multi-encounter patient — show patient header with expandable encounters
      html += `
        <div class="patient-group" data-mrn="${esc(mrn)}">
          <div class="patient-header" data-mrn="${esc(mrn)}">
            <div>
              <div class="rc-name">${esc(latest.givenName ? latest.givenName + ' ' + (latest.familyName || '') : latest.name || 'Unknown')}</div>
              <div class="rc-meta">${esc(sexAge)} \u00b7 MRN: ${esc(mrn)} \u00b7 Last: ${formatDate(latest.date)}</div>
            </div>
            <div class="rc-badges">${badges.join('')}</div>
          </div>
          <div class="encounter-list" id="enc-${esc(mrn)}" style="display:none;">
            <button class="btn btn-primary btn-sm enc-new-btn" data-mrn="${esc(mrn)}" data-latest-id="${latest.id}">+ New Encounter for This Patient</button>
            ${encounters.map((r, i) => {
              const encBadges = [];
              if (hasLabPositive(r)) encBadges.push('<span class="badge badge-red">Lab+</span>');
              if (r.referralType && r.referralType !== 'None') encBadges.push('<span class="badge badge-amber">' + esc(r.referralType) + '</span>');
              return `<div class="encounter-card" data-id="${r.id}">
                <div class="enc-header">Encounter #${visitCount - i} — ${formatDate(r.date)} — ${esc(r.site || '')}</div>
                <div class="enc-detail">${esc(r.diagnosis || 'No diagnosis')} ${encBadges.join(' ')}</div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }
  });

  if (patientGroups.size > RENDER_CAP) {
    html += `<div class="empty-state" style="text-align:center;color:var(--gray-500);padding:12px;">Showing the first ${RENDER_CAP} of ${patientGroups.size} patients. Refine your search or filters to see the rest.</div>`;
  }

  document.getElementById('recordsList').innerHTML = html;

  // Click handlers — single records
  document.querySelectorAll('.record-card').forEach(card => {
    card.addEventListener('click', () => openRecord(card.dataset.id));
  });
  // Click handlers — patient group headers (toggle expand)
  document.querySelectorAll('.patient-header').forEach(header => {
    header.addEventListener('click', () => {
      const mrn = header.dataset.mrn;
      const list = document.getElementById('enc-' + mrn);
      if (list) list.style.display = list.style.display === 'none' ? 'block' : 'none';
    });
  });
  // Click handlers — individual encounters within a group
  document.querySelectorAll('.encounter-card').forEach(card => {
    card.addEventListener('click', () => openRecord(card.dataset.id));
  });
  // Click handlers — "New Encounter for This Patient" buttons
  document.querySelectorAll('.enc-new-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      newEncounter();
      // newEncounter() calls resetForm() synchronously, so prefill immediately after
      prefillFromPrevious(btn.dataset.latestId);
    });
  });
}

function populateSiteSelects() {
  const sites = getSites();
  const selects = [document.getElementById('fSite'), document.getElementById('siteFilter'), document.getElementById('analyticsSite')];
  selects.forEach(sel => {
    if (!sel) return;
    const current = sel.value;
    const isFilter = sel.id !== 'fSite';
    sel.innerHTML = (isFilter ? '<option value="">All Sites</option>' : '<option value="">Select Site</option>') +
      sites.map(s => `<option>${s}</option>`).join('');
    sel.value = current;
    // Auto-select if only one site and this is the encounter form
    if (sel.id === 'fSite' && !current && sites.length === 1) sel.value = sites[0];
  });
}
