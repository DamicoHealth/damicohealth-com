// ==========================================
// SCHEDULING — Weekly calendar with clinic days + referral tracking
// ==========================================

const REFERRAL_STATUSES = ['Pending', 'Completed', 'No Show', 'Cancelled'];
const STATUS_COLORS = { Pending: 'badge-amber', Completed: 'badge-green', 'No Show': 'badge-red', Cancelled: 'badge-blue' };
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let _scheduleWeekStart = null; // Monday of current displayed week
let _selectedScheduleDate = null;

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function renderScheduling() {
  // Initialize to current week if not set
  if (!_scheduleWeekStart) {
    _scheduleWeekStart = getMonday(new Date());
  }

  // Populate referral type filter
  const typeSelect = document.getElementById('scheduleType');
  if (typeSelect) {
    const types = getReferralTypes();
    typeSelect.innerHTML = '<option value="">All Referrals</option>' +
      types.filter(t => t !== 'None').map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  }

  renderWeekCalendar();

  // Wire up nav buttons
  const prevBtn = document.getElementById('weekPrev');
  const nextBtn = document.getElementById('weekNext');
  if (prevBtn) {
    prevBtn.onclick = () => {
      _scheduleWeekStart = new Date(_scheduleWeekStart.getTime() - 7 * 86400000);
      renderWeekCalendar();
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      _scheduleWeekStart = new Date(_scheduleWeekStart.getTime() + 7 * 86400000);
      renderWeekCalendar();
    };
  }

  // Wire up type filter
  if (typeSelect) {
    typeSelect.onchange = () => {
      if (_selectedScheduleDate) showDaySchedule(_selectedScheduleDate);
    };
  }
}

function renderWeekCalendar() {
  const cal = document.getElementById('weekCalendar');
  const label = document.getElementById('weekLabel');
  if (!cal || !label) return;

  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(_scheduleWeekStart.getTime() + i * 86400000);
    weekDates.push(d);
  }

  const startStr = `${MONTH_NAMES[weekDates[0].getMonth()]} ${weekDates[0].getDate()}`;
  const endStr = `${MONTH_NAMES[weekDates[6].getMonth()]} ${weekDates[6].getDate()}, ${weekDates[6].getFullYear()}`;
  label.textContent = `${startStr} — ${endStr}`;

  const activeRecords = records.filter(r => !r.deleted);

  cal.innerHTML = weekDates.map(d => {
    const dateStr = formatDateISO(d);
    const dayName = DAY_NAMES[d.getDay()];
    const dayNum = d.getDate();
    const isSelected = _selectedScheduleDate === dateStr;
    const isToday = dateStr === formatDateISO(new Date());

    // Count patients seen on this date
    const dayPatients = activeRecords.filter(r => r.date === dateStr);
    const patientCount = dayPatients.length;

    // Count referrals scheduled for this date
    const dayReferrals = activeRecords.filter(r => r.referralDate === dateStr && r.referralType && r.referralType !== 'None');
    const referralCount = dayReferrals.length;

    // Determine if it's a surgery day
    const surgeryReferrals = dayReferrals.filter(r => r.referralType === 'Surgery');
    const isSurgeryDay = surgeryReferrals.length > 0;

    // Get unique sites for this day
    const sites = [...new Set(dayPatients.map(r => r.site).filter(Boolean))];
    const isClinicDay = patientCount > 0;

    let classes = 'week-day-card';
    if (isSelected) classes += ' selected';
    if (isSurgeryDay) classes += ' has-surgery';
    else if (isClinicDay) classes += ' has-clinic';

    let badges = '';
    if (isClinicDay) badges += `<div class="day-badge clinic">${patientCount} patients</div>`;
    if (isSurgeryDay) badges += `<div class="day-badge surgery">${surgeryReferrals.length} surgery</div>`;
    else if (referralCount > 0) badges += `<div class="day-badge referrals">${referralCount} referrals</div>`;

    return `<div class="${classes}" data-date="${dateStr}" onclick="selectScheduleDay('${dateStr}')">
      <div class="day-name">${dayName}${isToday ? ' (today)' : ''}</div>
      <div class="day-date">${dayNum}</div>
      ${sites.length > 0 ? `<div class="day-site">${sites.join(', ')}</div>` : '<div class="day-site" style="color:var(--gray-300);">—</div>'}
      ${badges}
    </div>`;
  }).join('');

  // If a day was selected, refresh its detail
  if (_selectedScheduleDate) showDaySchedule(_selectedScheduleDate);
}

function selectScheduleDay(dateStr) {
  _selectedScheduleDate = dateStr;
  // Update selected state
  document.querySelectorAll('.week-day-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector(`.week-day-card[data-date="${dateStr}"]`);
  if (card) card.classList.add('selected');
  showDaySchedule(dateStr);
}

function showDaySchedule(dateStr) {
  const typeVal = document.getElementById('scheduleType')?.value || '';
  const list = document.getElementById('scheduleList');
  const stats = document.getElementById('scheduleStats');
  if (!list || !stats) return;

  const activeRecords = records.filter(r => !r.deleted);

  // Patients seen on this date
  const dayPatients = activeRecords.filter(r => r.date === dateStr);

  // Referrals scheduled for this date
  const dayReferrals = activeRecords.filter(r => {
    if (!r.referralDate || r.referralDate !== dateStr) return false;
    if (!r.referralType || r.referralType === 'None') return false;
    if (typeVal && r.referralType !== typeVal) return false;
    return true;
  });

  const d = new Date(dateStr + 'T12:00:00');
  const dateLabel = `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

  let html = '';

  // Clinic summary
  if (dayPatients.length > 0) {
    const sites = [...new Set(dayPatients.map(r => r.site).filter(Boolean))];
    const providers = [...new Set(dayPatients.map(r => r.provider).filter(Boolean))];
    html += `<div class="schedule-group">
      <h3 class="schedule-group-title">Clinic Day — ${dateLabel}</h3>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px;">
        <div style="text-align:center;padding:12px;background:var(--gray-50);border-radius:8px;">
          <div style="font-size:24px;font-weight:800;color:var(--primary);">${dayPatients.length}</div>
          <div style="font-size:11px;color:var(--gray-400);font-weight:600;">Patients Seen</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--gray-50);border-radius:8px;">
          <div style="font-size:24px;font-weight:800;color:var(--blue);">${sites.length}</div>
          <div style="font-size:11px;color:var(--gray-400);font-weight:600;">Site${sites.length !== 1 ? 's' : ''}</div>
          <div style="font-size:10px;color:var(--gray-500);margin-top:2px;">${sites.join(', ')}</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--gray-50);border-radius:8px;">
          <div style="font-size:24px;font-weight:800;color:var(--green);">${providers.length}</div>
          <div style="font-size:11px;color:var(--gray-400);font-weight:600;">Providers</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--gray-50);border-radius:8px;">
          <div style="font-size:24px;font-weight:800;color:var(--amber);">${dayReferrals.length}</div>
          <div style="font-size:11px;color:var(--gray-400);font-weight:600;">Referrals</div>
        </div>
      </div>
    </div>`;
  }

  // Referral tables
  if (dayReferrals.length > 0) {
    const groups = {};
    dayReferrals.forEach(r => {
      const type = r.referralType;
      if (!groups[type]) groups[type] = [];
      groups[type].push(r);
    });

    const completed = dayReferrals.filter(r => r.referralStatus === 'Completed').length;
    const pending = dayReferrals.filter(r => !r.referralStatus || r.referralStatus === 'Pending').length;
    stats.innerHTML = `<strong>${dayReferrals.length}</strong> referral${dayReferrals.length !== 1 ? 's' : ''} — <span style="color:var(--green);">${completed} completed</span>, <span style="color:var(--amber);">${pending} pending</span>`;

    for (const [type, patients] of Object.entries(groups)) {
      html += `<div class="schedule-group">
        <h3 class="schedule-group-title">${esc(type)} (${patients.length})</h3>
        <table class="schedule-table">
          <thead><tr><th>#</th><th>Patient Name</th><th>MRN</th><th>Age/Sex</th><th>Diagnosis</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${patients.map((p, i) => {
              const age = p.dob ? calcAge(p.dob) : '';
              const status = p.referralStatus || 'Pending';
              const statusCls = STATUS_COLORS[status] || 'badge-amber';
              return `<tr>
                <td>${i + 1}</td>
                <td style="cursor:pointer;color:var(--primary);font-weight:600;" onclick="openRecord('${p.id}')">${esc(p.name || (p.givenName + ' ' + (p.familyName || '')))}</td>
                <td style="font-family:monospace;font-size:12px;">${esc(p.mrn || '')}</td>
                <td>${age}${p.sex ? '/' + p.sex : ''}</td>
                <td>${esc(truncate(p.diagnosis || '', 40))}</td>
                <td><span class="badge ${statusCls}">${status}</span></td>
                <td>
                  <select class="status-select" data-id="${p.id}" onchange="updateReferralStatusFromSelect(this)">
                    ${REFERRAL_STATUSES.map(s => `<option value="${s}" ${s === status ? 'selected' : ''}>${s}</option>`).join('')}
                  </select>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    }
  } else if (dayPatients.length === 0) {
    stats.textContent = '';
    html += `<div class="empty-state">No activity on ${dateLabel}.</div>`;
  } else {
    stats.textContent = '';
  }

  list.innerHTML = html;
}

async function updateReferralStatusFromSelect(selectEl) {
  const recId = selectEl.dataset.id;
  const newStatus = selectEl.value;
  await updateReferralStatus(recId, newStatus);
  renderWeekCalendar();
}

async function updateReferralStatus(recordId, status) {
  const rec = records.find(r => r.id === recordId);
  if (!rec) return;
  rec.referralStatus = status;
  records = await window.electronAPI.saveRecord(rec);
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '...' : str;
}
