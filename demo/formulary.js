// ==========================================
// FORMULARY
// ==========================================
function renderFormulary() {
  const formulary = getFormulary();
  const isAdmin = getDeviceRole() === 'admin';
  const categories = [...new Set(formulary.map(f => f.category))];
  const body = document.getElementById('formularyBody');
  let html = '';
  categories.forEach(cat => {
    html += `<tr class="cat-row"><td colspan="5">${esc(cat)}</td></tr>`;
    formulary.filter(f => f.category === cat).forEach(med => {
      html += `<tr><td>${esc(med.name)}</td><td>${esc(med.dose)} ${esc(med.unit)}</td><td>${esc(med.category)}</td><td>${med.controlled ? '\u26a0 Yes' : 'No'}</td>
        ${isAdmin ? `<td class="formulary-actions"><button class="btn-edit" data-id="${med.id}">Edit</button><button class="btn-del" data-id="${med.id}">Remove</button></td>` : '<td></td>'}</tr>`;
    });
  });
  body.innerHTML = html;
  body.querySelectorAll('.btn-edit').forEach(btn => { btn.addEventListener('click', () => openFormularyModal(btn.dataset.id)); });
  body.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Remove this medication from the formulary?')) return;
      let f = getFormulary(); f = f.filter(m => m.id !== btn.dataset.id); saveFormulary(f); renderFormulary();
    });
  });
}

function openFormularyModal(editId) {
  editingFormularyId = editId || null;
  const modal = document.getElementById('formularyModal');
  if (editId) {
    const med = getFormulary().find(m => m.id === editId);
    if (!med) return;
    document.getElementById('formularyModalTitle').textContent = 'Edit Medication';
    document.getElementById('fmName').value = med.name;
    document.getElementById('fmDose').value = med.dose;
    document.getElementById('fmUnit').value = med.unit;
    document.getElementById('fmCategory').value = med.category;
    document.getElementById('fmControlled').checked = med.controlled;
  } else {
    document.getElementById('formularyModalTitle').textContent = 'Add Medication';
    document.getElementById('fmName').value = ''; document.getElementById('fmDose').value = '';
    document.getElementById('fmUnit').value = 'tabs'; document.getElementById('fmCategory').value = 'Antibiotics';
    document.getElementById('fmControlled').checked = false;
  }
  modal.classList.add('open');
}
function closeFormularyModal() { document.getElementById('formularyModal').classList.remove('open'); editingFormularyId = null; }

function saveFormularyItem() {
  const name = document.getElementById('fmName').value.trim();
  if (!name) { alert('Medication name is required.'); return; }
  const item = { id: editingFormularyId || 'custom-' + crypto.randomUUID().slice(0, 8), name,
    dose: document.getElementById('fmDose').value.trim(), unit: document.getElementById('fmUnit').value,
    category: document.getElementById('fmCategory').value, controlled: document.getElementById('fmControlled').checked };
  let formulary = getFormulary();
  if (editingFormularyId) { const idx = formulary.findIndex(m => m.id === editingFormularyId); if (idx >= 0) formulary[idx] = item; }
  else formulary.push(item);
  saveFormulary(formulary); renderFormulary(); closeFormularyModal();
}
