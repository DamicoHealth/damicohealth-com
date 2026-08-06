// ==========================================
// ICD-10 — curated offline subset + diagnosis picker
// ==========================================
// A focused, field-clinic-oriented set of ICD-10 codes (not the full 70k) so
// search stays fast and fully offline. Expandable. Lets clinicians attach one
// or more coded diagnoses to an encounter ALONGSIDE the free-text diagnosis,
// which makes exports research-grade and is the basis for FHIR/DHIS2 mapping.
//
// Wires to #icd10Search / #icd10Results / #icd10Selected in the Diagnosis card.
// Selected codes are read via window.ICD10.get() and saved to record.diagnosisCodes.

(function () {
  const LIST = [
    // Infectious & parasitic
    { code: 'B54', term: 'Malaria, unspecified' },
    { code: 'B50', term: 'Plasmodium falciparum malaria' },
    { code: 'A09', term: 'Diarrhoea & gastroenteritis, infectious' },
    { code: 'A01.0', term: 'Typhoid fever' },
    { code: 'A06', term: 'Amoebiasis' },
    { code: 'A03', term: 'Shigellosis' },
    { code: 'A08', term: 'Viral gastroenteritis' },
    { code: 'B20', term: 'HIV disease' },
    { code: 'A15', term: 'Respiratory tuberculosis' },
    { code: 'B19', term: 'Viral hepatitis, unspecified' },
    { code: 'A53.9', term: 'Syphilis, unspecified' },
    { code: 'A59', term: 'Trichomoniasis' },
    { code: 'B35', term: 'Dermatophytosis (tinea)' },
    { code: 'B37.3', term: 'Candidiasis, vulvovaginal' },
    { code: 'B86', term: 'Scabies' },
    { code: 'B76', term: 'Hookworm disease' },
    { code: 'B82', term: 'Intestinal parasitism, unspecified' },
    { code: 'B02', term: 'Herpes zoster (shingles)' },
    { code: 'B07', term: 'Viral warts' },
    { code: 'A90', term: 'Dengue fever' },
    { code: 'A75', term: 'Typhus fever' },
    // Respiratory
    { code: 'J00', term: 'Common cold (acute nasopharyngitis)' },
    { code: 'J06.9', term: 'Upper respiratory infection, acute' },
    { code: 'J18.9', term: 'Pneumonia, unspecified' },
    { code: 'J20', term: 'Acute bronchitis' },
    { code: 'J45', term: 'Asthma' },
    { code: 'J44', term: 'COPD' },
    { code: 'J02', term: 'Acute pharyngitis' },
    { code: 'J03', term: 'Acute tonsillitis' },
    { code: 'J32', term: 'Chronic sinusitis' },
    { code: 'H66', term: 'Otitis media (suppurative)' },
    { code: 'H65', term: 'Otitis media, non-suppurative' },
    // Gastrointestinal & dental
    { code: 'K29', term: 'Gastritis & duodenitis' },
    { code: 'K21', term: 'Gastro-oesophageal reflux (GERD)' },
    { code: 'K30', term: 'Functional dyspepsia' },
    { code: 'K59.0', term: 'Constipation' },
    { code: 'K92.2', term: 'Gastrointestinal haemorrhage' },
    { code: 'K02', term: 'Dental caries' },
    { code: 'K05', term: 'Gingivitis & periodontal disease' },
    { code: 'K04', term: 'Dental pulp / periapical disease' },
    { code: 'B37.0', term: 'Oral candidiasis (thrush)' },
    { code: 'K80', term: 'Cholelithiasis (gallstones)' },
    // Cardiovascular & blood
    { code: 'I10', term: 'Essential hypertension' },
    { code: 'I50', term: 'Heart failure' },
    { code: 'I25', term: 'Chronic ischaemic heart disease' },
    { code: 'I63', term: 'Cerebral infarction (stroke)' },
    { code: 'I83', term: 'Varicose veins of lower limb' },
    { code: 'D50', term: 'Iron deficiency anaemia' },
    { code: 'D64', term: 'Anaemia, unspecified' },
    { code: 'D57', term: 'Sickle-cell disorder' },
    // Endocrine / metabolic / nutrition
    { code: 'E11', term: 'Type 2 diabetes mellitus' },
    { code: 'E10', term: 'Type 1 diabetes mellitus' },
    { code: 'E05', term: 'Thyrotoxicosis (hyperthyroidism)' },
    { code: 'E03', term: 'Hypothyroidism' },
    { code: 'E66', term: 'Obesity' },
    { code: 'E43', term: 'Severe acute malnutrition' },
    { code: 'E44', term: 'Moderate protein-energy malnutrition' },
    { code: 'E46', term: 'Protein-energy malnutrition, unspecified' },
    { code: 'E50', term: 'Vitamin A deficiency' },
    { code: 'E86', term: 'Volume depletion (dehydration)' },
    // Genitourinary & reproductive
    { code: 'N39.0', term: 'Urinary tract infection' },
    { code: 'N30', term: 'Cystitis' },
    { code: 'N18', term: 'Chronic kidney disease' },
    { code: 'N73', term: 'Pelvic inflammatory disease' },
    { code: 'N76', term: 'Vaginitis / vulvovaginitis' },
    { code: 'N91', term: 'Absent / scanty menstruation' },
    { code: 'N94', term: 'Pelvic & menstrual pain' },
    { code: 'N40', term: 'Benign prostatic hyperplasia' },
    // Pregnancy & postpartum
    { code: 'Z34', term: 'Supervision of normal pregnancy' },
    { code: 'O26', term: 'Pregnancy-related condition' },
    { code: 'O80', term: 'Single spontaneous delivery' },
    { code: 'Z39', term: 'Postpartum care' },
    { code: 'O03', term: 'Spontaneous abortion (miscarriage)' },
    // Musculoskeletal & injury
    { code: 'M54', term: 'Back pain (dorsalgia)' },
    { code: 'M25.5', term: 'Joint pain (arthralgia)' },
    { code: 'M79.1', term: 'Myalgia' },
    { code: 'M06', term: 'Rheumatoid arthritis' },
    { code: 'M17', term: 'Osteoarthritis of knee' },
    { code: 'S52', term: 'Fracture of forearm' },
    { code: 'S61', term: 'Open wound of wrist/hand' },
    { code: 'S01', term: 'Open wound of head' },
    { code: 'T14.9', term: 'Injury, unspecified' },
    { code: 'T30', term: 'Burn, unspecified site' },
    { code: 'W57', term: 'Bitten/stung by insect (non-venomous)' },
    { code: 'T63', term: 'Venom (snake/insect) toxic effect' },
    // Neuro / mental health
    { code: 'R51', term: 'Headache' },
    { code: 'G43', term: 'Migraine' },
    { code: 'G40', term: 'Epilepsy' },
    { code: 'F32', term: 'Depressive episode' },
    { code: 'F41', term: 'Anxiety disorder' },
    { code: 'F29', term: 'Psychosis, unspecified' },
    { code: 'F10', term: 'Alcohol use disorder' },
    // Skin
    { code: 'L30', term: 'Dermatitis, unspecified' },
    { code: 'L23', term: 'Allergic contact dermatitis' },
    { code: 'L03', term: 'Cellulitis' },
    { code: 'L02', term: 'Cutaneous abscess / boil' },
    { code: 'L08', term: 'Local skin infection' },
    { code: 'L50', term: 'Urticaria (hives)' },
    { code: 'L70', term: 'Acne' },
    { code: 'L20', term: 'Atopic dermatitis (eczema)' },
    // Eye / ENT
    { code: 'H10', term: 'Conjunctivitis' },
    { code: 'H57', term: 'Eye / adnexa disorder' },
    { code: 'H92', term: 'Earache / ear discharge' },
    { code: 'J34', term: 'Nasal disorder' },
    // Symptoms & signs (when no specific diagnosis)
    { code: 'R50', term: 'Fever, unspecified' },
    { code: 'R05', term: 'Cough' },
    { code: 'R10', term: 'Abdominal & pelvic pain' },
    { code: 'R11', term: 'Nausea & vomiting' },
    { code: 'R42', term: 'Dizziness & giddiness' },
    { code: 'R53', term: 'Malaise & fatigue' },
    { code: 'R60', term: 'Oedema (swelling)' },
    { code: 'R07', term: 'Chest pain' },
    { code: 'R21', term: 'Rash & skin eruption' },
    { code: 'R63.4', term: 'Abnormal weight loss' },
    // General / preventive
    { code: 'Z00', term: 'General medical examination' },
    { code: 'Z23', term: 'Immunization encounter' },
    { code: 'Z01', term: 'Special examination' },
    { code: 'R69', term: 'Illness, unspecified / unknown' },
  ];

  let selected = []; // [{code, term}]

  function norm(s) { return (s || '').toString().toLowerCase(); }
  function search(q) {
    q = norm(q).trim();
    if (!q) return [];
    const starts = [], contains = [];
    for (const e of LIST) {
      if (selected.find((s) => s.code === e.code)) continue;
      const code = norm(e.code), term = norm(e.term);
      if (code.startsWith(q) || term.startsWith(q)) starts.push(e);
      else if (code.includes(q) || term.includes(q)) contains.push(e);
    }
    return starts.concat(contains).slice(0, 12);
  }

  function h(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s); }

  function renderResults(q) {
    const box = document.getElementById('icd10Results');
    if (!box) return;
    const matches = search(q);
    if (!q || !matches.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
    box.innerHTML = matches.map((e) => `<div class="icd10-result" data-code="${h(e.code)}"><span class="icd10-code">${h(e.code)}</span> ${h(e.term)}</div>`).join('');
    box.style.display = 'block';
  }
  function renderChips() {
    const box = document.getElementById('icd10Selected');
    if (!box) return;
    box.innerHTML = selected.map((e) => `<span class="icd10-chip" data-code="${h(e.code)}"><span class="icd10-code">${h(e.code)}</span> ${h(e.term)} <button type="button" class="icd10-chip-x" data-code="${h(e.code)}" title="Remove">✕</button></span>`).join('');
  }
  function add(code) {
    const e = LIST.find((x) => x.code === code);
    if (e && !selected.find((s) => s.code === code)) { selected.push({ code: e.code, term: e.term }); renderChips(); }
  }
  function remove(code) { selected = selected.filter((s) => s.code !== code); renderChips(); }

  let _wired = false;
  function init() {
    if (_wired) return;
    const input = document.getElementById('icd10Search');
    const results = document.getElementById('icd10Results');
    const chips = document.getElementById('icd10Selected');
    if (!input || !results || !chips) return; // not on this screen yet
    _wired = true;
    input.addEventListener('input', () => renderResults(input.value));
    input.addEventListener('focus', () => renderResults(input.value));
    input.addEventListener('blur', () => setTimeout(() => { results.style.display = 'none'; }, 150));
    results.addEventListener('mousedown', (e) => {
      const row = e.target.closest('.icd10-result'); if (!row) return;
      e.preventDefault(); add(row.dataset.code); input.value = ''; renderResults('');
    });
    chips.addEventListener('click', (e) => {
      const x = e.target.closest('.icd10-chip-x'); if (x) remove(x.dataset.code);
    });
  }

  window.ICD10 = {
    LIST,
    search,
    init,
    get: () => selected.slice(),
    set: (arr) => { selected = Array.isArray(arr) ? arr.filter((x) => x && x.code).map((x) => ({ code: x.code, term: x.term || '' })) : []; renderChips(); },
    reset: () => { selected = []; renderChips(); const i = document.getElementById('icd10Search'); if (i) i.value = ''; },
  };
})();
