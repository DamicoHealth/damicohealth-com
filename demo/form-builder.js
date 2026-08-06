// ==========================================
// FORM BUILDER — admin UI for the form-template library
// ==========================================
// Lets an admin manage a LIBRARY of encounter forms ("templates"):
//   - pick a template to edit, add a new one (blank or from a specialty
//     starter), rename, duplicate, enable/disable, delete;
//   - within a template: show/hide & rename sections, add custom sections
//     and questions (the 7 field types).
// All changes save automatically via window.FormSchema and sync to all devices.
// Editable only on the admin device (standard devices see it read-only).

let _fbSelectedTemplate = null;

function fbSelectedId() {
  const templates = window.FormSchema.getTemplates();
  if (!templates.length) return null;
  if (!_fbSelectedTemplate || !templates.find((t) => t.id === _fbSelectedTemplate)) {
    _fbSelectedTemplate = templates[0].id;
  }
  return _fbSelectedTemplate;
}

function fbFieldTypeLabel(type) {
  const t = (window.FormSchema.FIELD_TYPES || []).find((x) => x.type === type);
  return t ? t.label : type;
}

function fbFieldEditor(s, isAdmin) {
  const fields = (s.fields || []).map((f) => `
    <div class="fb-field">
      <span class="fb-field-label">${esc(f.label)}</span>
      <span class="fb-field-type">${esc(fbFieldTypeLabel(f.type))}${(f.options && f.options.length) ? ' · ' + esc(f.options.join(', ')) : ''}</span>
      ${isAdmin ? `<button type="button" class="fb-field-del" data-sid="${esc(s.id)}" data-fid="${esc(f.id)}" title="Remove question">✕</button>` : ''}
    </div>`).join('') || '<div class="fb-field fb-field-empty">No questions yet.</div>';

  const adder = isAdmin ? `
    <div class="fb-add-field" data-sid="${esc(s.id)}">
      <input type="text" class="fb-nf-label" placeholder="New question…">
      <select class="fb-nf-type">${(window.FormSchema.FIELD_TYPES || []).map((t) => `<option value="${esc(t.type)}">${esc(t.label)}</option>`).join('')}</select>
      <input type="text" class="fb-nf-options" placeholder="Options (comma-separated)" style="display:none;">
      <button type="button" class="btn btn-secondary fb-nf-add" data-sid="${esc(s.id)}">Add question</button>
    </div>` : '';

  return `<div class="fb-fields">${fields}${adder}</div>`;
}

function fbSectionRow(s, isAdmin) {
  const control = s.required
    ? '<span class="fb-required">always shown</span>'
    : `<label class="fb-switch" title="Show or hide this section on the encounter form">
         <input type="checkbox" class="fb-toggle" data-id="${esc(s.id)}" ${s.hidden ? '' : 'checked'} ${isAdmin ? '' : 'disabled'}>
         <span class="fb-switch-label">${s.hidden ? 'Hidden' : 'Shown'}</span>
       </label>`;
  const head = `
    <div class="fb-row${s.hidden ? ' fb-row-hidden' : ''}" data-id="${esc(s.id)}">
      <input class="fb-title" type="text" value="${esc(s.title)}" data-id="${esc(s.id)}" ${isAdmin ? '' : 'disabled'} aria-label="Section name">
      <span class="fb-badge${s.builtin ? '' : ' fb-badge-custom'}">${s.builtin ? 'built-in' : 'custom'}</span>
      ${control}
      ${(!s.builtin && isAdmin) ? `<button type="button" class="fb-del" data-id="${esc(s.id)}" title="Delete section">🗑</button>` : ''}
    </div>`;
  return s.builtin ? head : head + fbFieldEditor(s, isAdmin);
}

function renderFormBuilder() {
  const body = document.getElementById('formBuilderBody');
  if (!body || !window.FormSchema) return;
  const isAdmin = (typeof getDeviceRole === 'function' ? getDeviceRole() : 'admin') === 'admin';
  const templates = window.FormSchema.getTemplates();
  const tid = fbSelectedId();
  const selected = templates.find((t) => t.id === tid) || {};

  // Template tabs
  const tabs = templates.map((t) => `
    <button type="button" class="fb-tpl-tab${t.id === tid ? ' active' : ''}${t.enabled ? '' : ' fb-tpl-off'}" data-tpl="${esc(t.id)}">
      ${esc(t.name)}${t.enabled ? '' : ' · off'}
    </button>`).join('');

  // New-template chooser (hidden until "+ New form")
  const starterOpts = (window.FormSchema.STARTERS || []).map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  const newForm = isAdmin ? `
    <div class="fb-tpl-new" id="fbTplNew" style="display:none;">
      <span>Start from:</span>
      <select class="fb-tpl-starter">${starterOpts}</select>
      <input type="text" class="fb-tpl-name" placeholder="Form name (optional)">
      <button type="button" class="btn btn-secondary fb-tpl-create">Create form</button>
    </div>` : '';

  // Controls for the selected template
  const tplControls = isAdmin ? `
    <div class="fb-tpl-controls">
      <label class="fb-switch" title="When active, clinicians can choose this form for a new encounter">
        <input type="checkbox" class="fb-tpl-enabled" ${selected.enabled ? 'checked' : ''}>
        <span>Active</span>
      </label>
      <button type="button" class="btn btn-secondary btn-sm fb-tpl-rename">Rename</button>
      <button type="button" class="btn btn-secondary btn-sm fb-tpl-dup">Duplicate</button>
      <button type="button" class="btn btn-secondary btn-sm fb-tpl-del" ${templates.length <= 1 ? 'disabled' : ''}>Delete</button>
    </div>` : '';

  const { sections } = window.FormSchema.getEffectiveSchema(tid);
  const sectionsHtml = sections.map((s) => fbSectionRow(s, isAdmin)).join('');
  const addSection = isAdmin ? '<button type="button" class="btn btn-primary btn-sm fb-add-section" style="margin-top:10px;">+ Add Section</button>' : '';

  body.innerHTML = `
    <div class="fb-tpl-bar">${tabs}${isAdmin ? '<button type="button" class="fb-tpl-tab fb-tpl-addbtn" id="fbTplAdd">+ New form</button>' : ''}</div>
    ${newForm}
    ${tplControls}
    <div class="fb-editing-label">Editing: <strong>${esc(selected.name || '')}</strong></div>
    <div class="fb-sections">${sectionsHtml}</div>
    ${addSection}`;

  // Select a template tab
  body.querySelectorAll('.fb-tpl-tab[data-tpl]').forEach((b) =>
    b.addEventListener('click', () => { _fbSelectedTemplate = b.dataset.tpl; renderFormBuilder(); }));

  if (!isAdmin) return; // standard devices: read-only

  // + New form (toggle chooser)
  const addTplBtn = document.getElementById('fbTplAdd');
  if (addTplBtn) addTplBtn.addEventListener('click', () => {
    const nf = document.getElementById('fbTplNew');
    if (nf) nf.style.display = nf.style.display === 'none' ? 'flex' : 'none';
  });
  const createBtn = body.querySelector('.fb-tpl-create');
  if (createBtn) createBtn.addEventListener('click', () => {
    const starterId = body.querySelector('.fb-tpl-starter').value;
    const nameInput = body.querySelector('.fb-tpl-name').value.trim();
    const starter = (window.FormSchema.STARTERS || []).find((s) => s.id === starterId);
    const id = window.FormSchema.addTemplate(nameInput || (starter ? starter.name : 'New Form'), starterId);
    _fbSelectedTemplate = id;
    renderFormBuilder();
  });

  // Template controls
  const en = body.querySelector('.fb-tpl-enabled');
  if (en) en.addEventListener('change', () => { window.FormSchema.setTemplateEnabled(tid, en.checked); renderFormBuilder(); });
  const rn = body.querySelector('.fb-tpl-rename');
  if (rn) rn.addEventListener('click', () => { const name = prompt('Rename this form:', selected.name); if (name && name.trim()) { window.FormSchema.renameTemplate(tid, name); renderFormBuilder(); } });
  const dup = body.querySelector('.fb-tpl-dup');
  if (dup) dup.addEventListener('click', () => { const nid = window.FormSchema.duplicateTemplate(tid); if (nid) { _fbSelectedTemplate = nid; renderFormBuilder(); } });
  const del = body.querySelector('.fb-tpl-del');
  if (del) del.addEventListener('click', () => {
    if (templates.length <= 1) { alert('You need at least one form.'); return; }
    if (confirm('Delete the "' + (selected.name || '') + '" form? Records already saved with it are kept in the data.')) {
      window.FormSchema.deleteTemplate(tid); _fbSelectedTemplate = null; renderFormBuilder();
    }
  });

  // + Add Section (to the selected template)
  const addSecBtn = body.querySelector('.fb-add-section');
  if (addSecBtn) addSecBtn.addEventListener('click', () => {
    const sid = window.FormSchema.addCustomSection(tid, 'New Section');
    renderFormBuilder();
    const row = document.querySelector('.fb-row[data-id="' + sid + '"]');
    if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); const t = row.querySelector('.fb-title'); if (t) { t.focus(); t.select(); } }
  });

  // Section show/hide
  body.querySelectorAll('.fb-toggle').forEach((cb) => cb.addEventListener('change', () => {
    window.FormSchema.setSectionHidden(tid, cb.dataset.id, !cb.checked); renderFormBuilder();
  }));
  // Section rename
  body.querySelectorAll('.fb-title').forEach((inp) => {
    const commit = () => window.FormSchema.setSectionTitle(tid, inp.dataset.id, inp.value);
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
  });
  // Delete custom section
  body.querySelectorAll('.fb-del').forEach((b) => b.addEventListener('click', () => {
    if (confirm('Delete this section and its questions? Answers in existing records are kept.')) {
      window.FormSchema.deleteSection(tid, b.dataset.id); renderFormBuilder();
    }
  }));
  // Remove a custom field
  body.querySelectorAll('.fb-field-del').forEach((b) => b.addEventListener('click', () => {
    window.FormSchema.removeField(tid, b.dataset.sid, b.dataset.fid); renderFormBuilder();
  }));
  // Show options input only for choice types
  body.querySelectorAll('.fb-add-field').forEach((wrap) => {
    const typeSel = wrap.querySelector('.fb-nf-type');
    const optInput = wrap.querySelector('.fb-nf-options');
    const sync = () => { optInput.style.display = (typeSel.value === 'select' || typeSel.value === 'multiselect') ? '' : 'none'; };
    typeSel.addEventListener('change', sync); sync();
  });
  // Add a custom field
  body.querySelectorAll('.fb-nf-add').forEach((b) => b.addEventListener('click', () => {
    const wrap = b.closest('.fb-add-field');
    const label = wrap.querySelector('.fb-nf-label').value.trim();
    const type = wrap.querySelector('.fb-nf-type').value;
    const optsRaw = wrap.querySelector('.fb-nf-options').value.trim();
    if (!label) { alert('Enter a question label first.'); return; }
    const needsOptions = (type === 'select' || type === 'multiselect');
    const options = needsOptions ? optsRaw.split(',').map((x) => x.trim()).filter(Boolean) : [];
    if (needsOptions && options.length === 0) { alert('Add at least one option (comma-separated) for a choice question.'); return; }
    window.FormSchema.addField(tid, b.dataset.sid, { label, type, options });
    renderFormBuilder();
  }));
}
