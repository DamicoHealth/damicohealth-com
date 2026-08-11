// ==========================================
// FORM SCHEMA — data-driven form definitions ("encounter types")
// ==========================================
// The org keeps a LIBRARY of form templates (config key 'formTemplates'),
// synced to every device. Each template is a named form definition:
//   { id, name, enabled, schema: { sections: [...] } }
// A clinician picks a template when starting an encounter; each record records
// its templateId so exports/analytics can segment by encounter type.
//
// Hybrid model (per template):
//   - BUILT-IN sections keep their bespoke HTML (labs grid, med builder, MRN
//     logic, etc.) but can be shown/hidden and renamed via the schema.
//   - CUSTOM sections (admin-defined) render generically into
//     #customSectionsContainer; answers store in record.customFields.
//
// Back-compat: if only the legacy single 'formSchema' key exists, it's wrapped
// as one template named "General Encounter". The first template's schema is
// also mirrored back to 'formSchema' so older readers keep working.
//
// Config lives in localStorage (dhemr_ prefix) for synchronous reads while the
// form renders. Writes go through window.platform (feeds Supabase config sync).

(function () {
  const LS_PREFIX = 'dhemr' + ((typeof window !== 'undefined' && window.DH_STORAGE_SUFFIX) || '') + '_';
  const SCHEMA_KEY = 'formSchema';        // legacy single-form key (back-compat)
  const TEMPLATES_KEY = 'formTemplates';  // template library

  // Built-in sections IN DOCUMENT ORDER (must match the .encounter-card order in
  // index.html). `required` sections cannot be hidden (MRN needs name+DOB;
  // validation needs site/date/sex).
  const BUILTIN_SECTIONS = [
    { id: 'encounter',    title: 'Encounter',          required: true },
    { id: 'patient',      title: 'Patient',            required: true },
    { id: 'vitals',       title: 'Vitals' },
    { id: 'accessToCare', title: 'Access to Care' },
    { id: 'history',      title: 'History' },
    { id: 'chiefConcern', title: 'Chief Concern' },
    { id: 'labs',         title: 'Labs' },
    { id: 'diagnosis',    title: 'Diagnosis' },
    { id: 'rxPresets',    title: 'Rx Presets' },
    { id: 'medications',  title: 'Medications' },
    { id: 'procedures',   title: 'Procedures' },
    { id: 'referral',     title: 'Referral' },
    { id: 'physician',    title: 'Physician' },
    { id: 'imaging',      title: 'Imaging' },
    { id: 'surgery',      title: 'Surgical Encounter' },
    { id: 'notes',        title: 'Notes' },
  ];
  const BUILTIN_IDS = new Set(BUILTIN_SECTIONS.map((s) => s.id));

  const FIELD_TYPES = [
    { type: 'text', label: 'Short text' },
    { type: 'textarea', label: 'Long text' },
    { type: 'select', label: 'Single choice' },
    { type: 'multiselect', label: 'Multiple choice' },
    { type: 'number', label: 'Number' },
    { type: 'range', label: 'Scale (0–N)' },
    { type: 'yesno', label: 'Yes / No' },
    { type: 'date', label: 'Date' },
  ];

  function h(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s); }
  function _uid(prefix) {
    const r = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
    return prefix + r;
  }

  // ========== Specialty starter library ==========
  // Each starter's schema lists only the built-in sections to HIDE plus any
  // custom sections. Custom section/field ids are placeholders — they are
  // regenerated when a starter is instantiated, so copies never collide.
  const STARTERS = [
    { id: 'general', name: 'General Encounter', schema: { sections: [] } },
    {
      id: 'surgery-preop', name: 'Surgery — Pre-Op Eval',
      schema: { sections: [
        { id: 'accessToCare', hidden: true }, { id: 'procedures', hidden: true },
        { id: 'imaging', hidden: true }, { id: 'surgery', hidden: true }, { id: 'rxPresets', hidden: true },
        { id: 's_preop', title: 'Pre-Op Evaluation', order: 50, fields: [
          { id: 'f_asa', label: 'ASA Class', type: 'select', options: ['I', 'II', 'III', 'IV', 'V'] },
          { id: 'f_proc', label: 'Planned procedure', type: 'text' },
          { id: 'f_npo', label: 'NPO since', type: 'text', placeholder: 'e.g. midnight / 6h ago' },
          { id: 'f_consent', label: 'Consent signed', type: 'yesno' },
          { id: 'f_anes', label: 'Anesthesia plan', type: 'select', options: ['General', 'Spinal', 'Regional', 'Local', 'Sedation'] },
          { id: 'f_preopnotes', label: 'Pre-op notes', type: 'textarea' },
        ] },
      ] },
    },
    {
      id: 'surgery-opnote', name: 'Surgery — Op Note',
      schema: { sections: [
        { id: 'accessToCare', hidden: true }, { id: 'labs', hidden: true }, { id: 'rxPresets', hidden: true },
        { id: 'imaging', hidden: true }, { id: 'referral', hidden: true }, { id: 'chiefConcern', hidden: true },
        { id: 'procedures', hidden: true }, { id: 'surgery', hidden: true },
        { id: 's_opnote', title: 'Operative Note', order: 50, fields: [
          { id: 'f_proc', label: 'Procedure performed', type: 'text' },
          { id: 'f_surgeon', label: 'Surgeon', type: 'text' },
          { id: 'f_assist', label: 'Assistant(s)', type: 'text' },
          { id: 'f_anes', label: 'Anesthesia', type: 'select', options: ['General', 'Spinal', 'Regional', 'Local', 'Sedation'] },
          { id: 'f_ebl', label: 'Estimated blood loss (mL)', type: 'number' },
          { id: 'f_findings', label: 'Findings', type: 'textarea' },
          { id: 'f_specimens', label: 'Specimens removed', type: 'text' },
          { id: 'f_complications', label: 'Complications', type: 'yesno' },
          { id: 'f_compdetail', label: 'Complication details', type: 'text' },
          { id: 'f_dispo', label: 'Disposition', type: 'select', options: ['Recovery', 'Ward', 'Discharge', 'Referred'] },
        ] },
      ] },
    },
    {
      id: 'surgery-postop', name: 'Post-Op Check',
      schema: { sections: [
        { id: 'accessToCare', hidden: true }, { id: 'labs', hidden: true }, { id: 'rxPresets', hidden: true },
        { id: 'imaging', hidden: true }, { id: 'procedures', hidden: true }, { id: 'surgery', hidden: true },
        { id: 'chiefConcern', hidden: true },
        { id: 's_postop', title: 'Post-Op Assessment', order: 50, fields: [
          { id: 'f_pod', label: 'Post-op day #', type: 'number' },
          { id: 'f_pain', label: 'Pain', type: 'range', min: 0, max: 10 },
          { id: 'f_wound', label: 'Wound status', type: 'select', options: ['Clean/dry', 'Erythema', 'Discharge', 'Dehiscence'] },
          { id: 'f_drain', label: 'Drain output (mL)', type: 'number' },
          { id: 'f_ambul', label: 'Ambulating', type: 'yesno' },
          { id: 'f_diet', label: 'Tolerating diet', type: 'yesno' },
          { id: 'f_plan', label: 'Plan', type: 'textarea' },
        ] },
      ] },
    },
    {
      id: 'dental', name: 'Dental Exam',
      schema: { sections: [
        { id: 'labs', hidden: true }, { id: 'imaging', hidden: true }, { id: 'accessToCare', hidden: true },
        { id: 'surgery', hidden: true }, { id: 'rxPresets', hidden: true },
        { id: 's_dental', title: 'Dental', order: 50, fields: [
          { id: 'f_teeth', label: 'Tooth / teeth involved', type: 'text' },
          { id: 'f_exam', label: 'Exam findings', type: 'textarea' },
          { id: 'f_tx', label: 'Treatment performed', type: 'multiselect', options: ['Cleaning', 'Filling', 'Extraction', 'Scaling', 'Other'] },
          { id: 'f_anesthetic', label: 'Local anesthetic', type: 'text' },
          { id: 'f_instr', label: 'Post-op instructions given', type: 'yesno' },
          { id: 'f_followup', label: 'Follow-up needed', type: 'yesno' },
        ] },
      ] },
    },
  ];

  function _regenIds(schema) {
    (schema.sections || []).forEach((sec) => {
      if (!BUILTIN_IDS.has(sec.id)) sec.id = _uid('custom_');
      (sec.fields || []).forEach((f) => { f.id = _uid('f_'); });
    });
    return schema;
  }
  function instantiateStarter(starterId) {
    const s = STARTERS.find((x) => x.id === starterId);
    const schema = s ? JSON.parse(JSON.stringify(s.schema)) : { sections: [] };
    return _regenIds(schema);
  }

  // ========== Template store ==========
  function readTemplates() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(LS_PREFIX + TEMPLATES_KEY) || 'null'); } catch {}
    if (raw && Array.isArray(raw.templates) && raw.templates.length) return raw;
    // Back-compat: wrap the legacy single form as one "General Encounter" template.
    let legacy = null;
    try { legacy = JSON.parse(localStorage.getItem(LS_PREFIX + SCHEMA_KEY) || 'null'); } catch {}
    const schema = (legacy && Array.isArray(legacy.sections)) ? legacy : { sections: [] };
    return { version: 1, templates: [{ id: 'general', name: 'General Encounter', enabled: true, schema }] };
  }
  function saveTemplates(obj) {
    const v = obj || { version: 1, templates: [] };
    if (window.platform && window.platform.saveFormTemplates) window.platform.saveFormTemplates(v);
    else localStorage.setItem(LS_PREFIX + TEMPLATES_KEY, JSON.stringify(v));
    // Mirror the first template back to the legacy formSchema key for old readers.
    try {
      const first = v.templates && v.templates[0];
      if (first && first.schema && window.platform && window.platform.saveFormSchema) {
        window.platform.saveFormSchema(first.schema);
      }
    } catch {}
  }
  function getTemplates() {
    return readTemplates().templates.map((t) => ({ id: t.id, name: t.name, enabled: t.enabled !== false }));
  }
  function getActiveTemplates() {
    return readTemplates().templates.filter((t) => t.enabled !== false).map((t) => ({ id: t.id, name: t.name }));
  }
  function getTemplate(id) {
    const all = readTemplates().templates;
    return all.find((t) => t.id === id) || all[0] || null;
  }
  function _defaultTemplateId() {
    const all = readTemplates().templates;
    const active = all.find((t) => t.enabled !== false) || all[0];
    return active ? active.id : 'general';
  }

  // Which template the live form is currently rendering (set by the encounter flow).
  let _activeTemplateId = null;
  function setActiveTemplate(id) { _activeTemplateId = id || null; }
  function getActiveTemplateId() { return _activeTemplateId || _defaultTemplateId(); }

  // ---------- Template CRUD ----------
  function addTemplate(name, starterId) {
    const obj = readTemplates();
    const id = _uid('tpl_');
    obj.templates.push({ id, name: name || 'New Template', enabled: true, schema: starterId ? instantiateStarter(starterId) : { sections: [] } });
    saveTemplates(obj);
    return id;
  }
  function deleteTemplate(id) {
    const obj = readTemplates();
    if (obj.templates.length <= 1) return false; // always keep at least one
    obj.templates = obj.templates.filter((t) => t.id !== id);
    saveTemplates(obj);
    return true;
  }
  function renameTemplate(id, name) {
    const obj = readTemplates();
    const t = obj.templates.find((x) => x.id === id);
    if (t) { t.name = String(name || '').trim() || t.name; saveTemplates(obj); }
  }
  function setTemplateEnabled(id, enabled) {
    const obj = readTemplates();
    const t = obj.templates.find((x) => x.id === id);
    if (!t) return;
    if (!enabled && obj.templates.filter((x) => x.enabled !== false).length <= 1) return; // keep one enabled
    t.enabled = !!enabled;
    saveTemplates(obj);
  }
  function duplicateTemplate(id) {
    const obj = readTemplates();
    const src = obj.templates.find((x) => x.id === id);
    if (!src) return null;
    const schema = _regenIds(JSON.parse(JSON.stringify(src.schema || { sections: [] })));
    const copy = { id: _uid('tpl_'), name: src.name + ' (copy)', enabled: true, schema };
    obj.templates.push(copy);
    saveTemplates(obj);
    return copy.id;
  }

  // ---------- Per-template schema read / merge ----------
  function readRawSchema(templateId) {
    const t = getTemplate(templateId || getActiveTemplateId());
    return (t && t.schema && Array.isArray(t.schema.sections)) ? t.schema : { sections: [] };
  }
  function saveTemplateSchema(templateId, schema) {
    const obj = readTemplates();
    const t = obj.templates.find((x) => x.id === (templateId || getActiveTemplateId()));
    if (!t) return;
    t.schema = schema;
    saveTemplates(obj);
  }
  // Back-compat shim: write to the active template's schema.
  function saveFormSchema(schema) { saveTemplateSchema(getActiveTemplateId(), schema); }

  // Merge a template's stored schema over the built-in defaults so the result
  // always contains every built-in section.
  function getEffectiveSchema(templateId) {
    const raw = readRawSchema(templateId);
    const overrides = {};
    const customSections = [];
    if (raw && Array.isArray(raw.sections)) {
      for (const s of raw.sections) {
        if (!s || !s.id) continue;
        if (BUILTIN_IDS.has(s.id)) overrides[s.id] = s;
        else customSections.push(s);
      }
    }
    const builtins = BUILTIN_SECTIONS.map((b, i) => {
      const o = overrides[b.id] || {};
      return {
        id: b.id,
        title: o.title || b.title,
        required: !!b.required,
        builtin: true,
        hidden: b.required ? false : !!o.hidden,
        order: typeof o.order === 'number' ? o.order : i,
      };
    });
    const custom = customSections.map((s, i) => ({
      id: s.id,
      title: s.title || 'Custom Section',
      required: false,
      builtin: false,
      hidden: !!s.hidden,
      order: typeof s.order === 'number' ? s.order : 100 + i,
      fields: Array.isArray(s.fields) ? s.fields : [],
    }));
    return { version: 1, sections: [...builtins, ...custom].sort((a, b) => a.order - b.order) };
  }

  // ---------- Live form rendering ----------
  function tagBuiltinSections(root) {
    const cards = root.querySelectorAll('.encounter-card');
    if (cards.length !== BUILTIN_SECTIONS.length) {
      console.warn(`[form-schema] expected ${BUILTIN_SECTIONS.length} built-in cards, found ${cards.length}; section toggles may be misaligned`);
    }
    cards.forEach((card, i) => {
      const sec = BUILTIN_SECTIONS[i];
      if (sec && !card.dataset.section) card.dataset.section = sec.id;
    });
  }
  function cardTitleEl(card) {
    return card.querySelector('.card-header') || card.querySelector('.collapsible-header span:last-child');
  }
  // Render the form for a template: show/hide+rename built-ins, render custom sections.
  function applyFormSchema(root, templateId) {
    if (templateId) setActiveTemplate(templateId);
    root = root || document.getElementById('editModeContent');
    if (!root) return;
    tagBuiltinSections(root);
    const { sections } = getEffectiveSchema(getActiveTemplateId());
    for (const s of sections) {
      if (!s.builtin) continue;
      const el = root.querySelector(`[data-section="${s.id}"]`);
      if (!el) continue;
      el.style.display = s.hidden ? 'none' : '';
      const titleEl = cardTitleEl(el);
      if (titleEl && s.title) titleEl.textContent = s.title;
    }
    renderCustomSections();
  }

  // ---------- Custom section rendering (generic field types) ----------
  function fieldControl(f) {
    const fid = 'cf_' + f.id;
    const cf = h(f.id);
    switch (f.type) {
      case 'textarea': return `<textarea id="${fid}" data-cf="${cf}" rows="2" placeholder="${h(f.placeholder || '')}"></textarea>`;
      case 'number':   return `<input type="number" id="${fid}" data-cf="${cf}" inputmode="decimal" placeholder="${h(f.placeholder || '')}">`;
      case 'date':     return `<input type="date" id="${fid}" data-cf="${cf}">`;
      case 'yesno':    return singleGroup(f.id, ['Yes', 'No']);
      case 'select':   return singleGroup(f.id, f.options || []);
      case 'multiselect': return multiGroup(f.id, f.options || []);
      case 'range':    return rangeControl(f);
      case 'text':
      default:         return `<input type="text" id="${fid}" data-cf="${cf}" placeholder="${h(f.placeholder || '')}">`;
    }
  }
  function singleGroup(fieldId, options) {
    return `<div class="btn-toggle-group cf-single" data-cf="${h(fieldId)}">` +
      (options || []).map((o) => `<button type="button" class="btn-toggle" data-val="${h(o)}">${h(o)}</button>`).join('') + `</div>`;
  }
  function multiGroup(fieldId, options) {
    return `<div class="pill-row cf-multi" data-cf="${h(fieldId)}">` +
      (options || []).map((o) => `<button type="button" class="cf-pill" data-val="${h(o)}">${h(o)}</button>`).join('') + `</div>`;
  }
  function rangeControl(f) {
    const min = Number.isFinite(f.min) ? f.min : 0;
    const max = Number.isFinite(f.max) ? f.max : 10;
    return `<div class="cf-range" data-cf="${h(f.id)}">` +
      `<input type="range" min="${min}" max="${max}" step="1" value="${min}" data-touched="0" oninput="this.dataset.touched='1';this.nextElementSibling.textContent=this.value">` +
      `<span class="cf-range-val">${min}</span></div>`;
  }
  function renderFieldGroup(f) {
    const reqStar = f.required ? ' <span class="cf-req">*</span>' : '';
    return `<div class="form-group cf-field"><label>${h(f.label || 'Question')}${reqStar}</label>${fieldControl(f)}</div>`;
  }
  function renderCustomSections() {
    const el = document.getElementById('customSectionsContainer');
    if (!el) return;
    const custom = getEffectiveSchema(getActiveTemplateId()).sections.filter((s) => !s.builtin && !s.hidden);
    el.innerHTML = custom.map((s) => `
      <div class="encounter-card" data-section="${h(s.id)}">
        <div class="card-header">${h(s.title)}</div>
        ${(s.fields || []).map(renderFieldGroup).join('') || '<p class="cf-empty">No questions in this section yet.</p>'}
      </div>`).join('');
    wireCustomGroupClicks(el);
  }
  let _cfClicksWired = false;
  function wireCustomGroupClicks(container) {
    if (_cfClicksWired) return;
    _cfClicksWired = true;
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.cf-single .btn-toggle, .cf-multi .cf-pill');
      if (!btn) return;
      const group = btn.parentElement;
      if (group.classList.contains('cf-single')) {
        const wasActive = btn.classList.contains('active');
        group.querySelectorAll('.btn-toggle').forEach((b) => b.classList.remove('active'));
        if (!wasActive) btn.classList.add('active');
      } else {
        btn.classList.toggle('active');
      }
    });
  }

  function collectCustomFields() {
    const out = {};
    const el = document.getElementById('customSectionsContainer');
    if (!el) return out;
    el.querySelectorAll('[data-cf]').forEach((node) => {
      const id = node.dataset.cf;
      if (node.classList.contains('cf-single')) {
        const a = node.querySelector('.btn-toggle.active');
        if (a) out[id] = a.dataset.val;
      } else if (node.classList.contains('cf-multi')) {
        const vals = [...node.querySelectorAll('.cf-pill.active')].map((b) => b.dataset.val);
        if (vals.length) out[id] = vals;
      } else if (node.classList.contains('cf-range')) {
        const sl = node.querySelector('input[type=range]');
        if (sl && sl.dataset.touched === '1') out[id] = Number(sl.value);
      } else if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
        const v = node.value;
        if (v !== '' && v != null) out[id] = node.type === 'number' ? Number(v) : v;
      }
    });
    return out;
  }
  function populateCustomFields(values) {
    values = values || {};
    const el = document.getElementById('customSectionsContainer');
    if (!el) return;
    el.querySelectorAll('[data-cf]').forEach((node) => {
      const v = values[node.dataset.cf];
      if (node.classList.contains('cf-single')) {
        node.querySelectorAll('.btn-toggle').forEach((b) => b.classList.toggle('active', b.dataset.val === v));
      } else if (node.classList.contains('cf-multi')) {
        const arr = Array.isArray(v) ? v : [];
        node.querySelectorAll('.cf-pill').forEach((b) => b.classList.toggle('active', arr.includes(b.dataset.val)));
      } else if (node.classList.contains('cf-range')) {
        const sl = node.querySelector('input[type=range]');
        if (sl) {
          if (v != null) { sl.value = v; sl.dataset.touched = '1'; }
          else { sl.value = sl.min; sl.dataset.touched = '0'; }
          const d = node.querySelector('.cf-range-val'); if (d) d.textContent = sl.value;
        }
      } else if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
        node.value = (v != null ? v : '');
      }
    });
  }

  // ---------- Section/field mutators (operate on a given template) ----------
  function updateSection(templateId, id, patch) {
    const raw = readRawSchema(templateId);
    if (!Array.isArray(raw.sections)) raw.sections = [];
    let entry = raw.sections.find((s) => s && s.id === id);
    if (!entry) { entry = { id }; raw.sections.push(entry); }
    Object.assign(entry, patch);
    saveTemplateSchema(templateId, raw);
    return raw;
  }
  function setSectionHidden(templateId, id, hidden) { return updateSection(templateId, id, { hidden: !!hidden }); }
  function setSectionTitle(templateId, id, title) { return updateSection(templateId, id, { title: String(title || '').trim() }); }
  function addCustomSection(templateId, title) {
    const raw = readRawSchema(templateId);
    if (!Array.isArray(raw.sections)) raw.sections = [];
    const maxOrder = raw.sections.reduce((m, s) => Math.max(m, s.order || 0), 99);
    const id = _uid('custom_');
    raw.sections.push({ id, title: title || 'New Section', builtin: false, hidden: false, order: maxOrder + 1, fields: [] });
    saveTemplateSchema(templateId, raw);
    return id;
  }
  function deleteSection(templateId, id) {
    const raw = readRawSchema(templateId);
    if (!Array.isArray(raw.sections)) return;
    raw.sections = raw.sections.filter((s) => s.id !== id);
    saveTemplateSchema(templateId, raw);
  }
  function _findCustom(raw, sectionId) {
    return (raw.sections || []).find((s) => s.id === sectionId && !BUILTIN_IDS.has(s.id));
  }
  function addField(templateId, sectionId, field) {
    const raw = readRawSchema(templateId);
    const sec = _findCustom(raw, sectionId);
    if (!sec) return;
    if (!Array.isArray(sec.fields)) sec.fields = [];
    const entry = {
      id: _uid('f_'),
      label: (field && field.label) || 'Question',
      type: (field && field.type) || 'text',
      options: (field && field.options) || [],
      required: !!(field && field.required),
    };
    if (field && Number.isFinite(field.min)) entry.min = field.min;
    if (field && Number.isFinite(field.max)) entry.max = field.max;
    sec.fields.push(entry);
    saveTemplateSchema(templateId, raw);
    return entry.id;
  }
  function removeField(templateId, sectionId, fieldId) {
    const raw = readRawSchema(templateId);
    const sec = _findCustom(raw, sectionId);
    if (!sec || !Array.isArray(sec.fields)) return;
    sec.fields = sec.fields.filter((f) => f.id !== fieldId);
    saveTemplateSchema(templateId, raw);
  }

  // Ids of every custom (non-builtin) field currently in the active/effective
  // schema for a template — i.e. the fields that ARE rendered on the form. Used
  // so a resave can tell "cleared a visible field" from "field belongs to a
  // hidden/other-template section" and merge correctly.
  function getActiveCustomFieldIds(templateId) {
    try {
      const schema = getEffectiveSchema(templateId || getActiveTemplateId());
      const ids = [];
      (schema.sections || []).forEach((s) => {
        if (s.builtin) return;
        (s.fields || []).forEach((f) => { if (f && f.id) ids.push(f.id); });
      });
      return ids;
    } catch (e) { return []; }
  }

  // Public API
  window.FormSchema = {
    BUILTIN_SECTIONS,
    FIELD_TYPES,
    STARTERS,
    getActiveCustomFieldIds,
    // templates
    getTemplates,
    getActiveTemplates,
    getTemplate,
    setActiveTemplate,
    getActiveTemplateId,
    addTemplate,
    deleteTemplate,
    renameTemplate,
    setTemplateEnabled,
    duplicateTemplate,
    // schema
    getEffectiveSchema,
    readRawSchema,
    applyFormSchema,
    renderCustomSections,
    collectCustomFields,
    populateCustomFields,
    saveFormSchema,
    // section/field mutators (templateId-first)
    updateSection,
    setSectionHidden,
    setSectionTitle,
    addCustomSection,
    deleteSection,
    addField,
    removeField,
  };
})();
