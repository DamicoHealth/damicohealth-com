// ==========================================
// DEMO MODE - safe, self-contained sample clinic
// ==========================================
// Loaded ONLY in builds made with `node build.js --demo`. It seeds a set of
// fictional patients so anyone can try the EMR in a browser.
//
// SAFETY RULES (this file caused a critical incident in a previous form, so the
// constraints are deliberate and must be preserved):
//   1. It refuses to run unless the build set window.DH_DEMO.
//   2. Demo builds also set window.DH_STORAGE_SUFFIX, so every key and the
//      IndexedDB database itself are namespaced. Nothing here can read or write
//      a real deployment's patient data, even on a shared origin.
//   3. It NEVER enumerates-and-deletes storage keys. The old version cleared
//      every dhemr_* key on load, which wiped real config and records.
//   4. It forces standalone mode, so the demo can never sync to any cloud.
//   5. All patients below are fictional. No real patient data, ever.
(function () {
  if (!window.DH_DEMO) return;

  var DEMO_DEVICE_ID = 'demo-device';
  var SEED_FLAG = 'demoSeedVersion';
  var SEED_VERSION = '1';

  // ---------- helpers ----------
  function iso(d) { return d.toISOString().slice(0, 10); }
  function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return iso(d); }
  function dob(y, m, d) { return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }

  // Mirrors generateBaseMRN() in helpers.js: 2 letters of each name + DDMMYYYY.
  function mrnFor(given, family, dobIso) {
    var g = given.replace(/[^a-zA-Z]/g, '').substring(0, 2).toUpperCase();
    var f = family.replace(/[^a-zA-Z]/g, '').substring(0, 2).toUpperCase();
    var p = dobIso.split('-');
    return g + f + p[2] + p[1] + p[0];
  }

  function toggleLab(name, positive) {
    var o = {};
    o[name] = { ordered: true, result: positive ? 'POS' : 'NEG', type: 'toggle' };
    return o;
  }

  function numericLab(name, value, unit, interp) {
    var o = {};
    o[name] = { ordered: true, value: String(value), unit: unit, interpretation: interp || '', type: 'numeric' };
    return o;
  }

  function med(name, dose, freq, duration) {
    return { id: 'demo-med-' + Math.abs(hash(name + dose + freq)), medId: name, dose: dose, freq: freq, duration: duration, qty: null, qtyUnit: null };
  }

  // Stable pseudo-id so repeated seeds produce identical records (no Math.random).
  var _seq = 0;
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return h; }
  function id(label) { _seq++; return 'demo-' + _seq + '-' + Math.abs(hash(label)).toString(36); }

  var SITES = ['Kabale Community Clinic', 'Rukungiri Outreach', 'Mobile Unit A'];
  var PROVIDERS = ['Dr. A. Mensah', 'Dr. L. Okot', 'NP J. Carter'];

  // ---------- fictional patients ----------
  function buildRecords() {
    function rec(o) {
      var m = mrnFor(o.givenName, o.familyName, o.dob);
      return Object.assign({
        id: id(o.givenName + o.familyName + o.date),
        mrn: m,
        name: o.givenName + ' ' + o.familyName,
        phone: '',
        pregnant: '', breastfeeding: '',
        allergies: 'NKDA', currentMeds: '', pmh: '',
        labs: {}, labComments: '', urinalysis: null,
        diagnosisCodes: [], medications: [], procedures: [],
        imaging: null, surgery: null,
        referralType: 'None', referralDate: '', referralStatus: '',
        treatmentNotes: '', treatment: '', notes: '',
        accessToCare: null, transport: '', travelTime: '',
        bloodGlucose: '', ageEstimated: false,
        templateId: null, templateName: '', customFields: {},
        deviceId: DEMO_DEVICE_ID,
        sync_version: 1, synced_version: 1,
        savedAt: new Date(o.date + 'T09:00:00Z').toISOString()
      }, o);
    }

    var R = [];

    // --- returning patient with 3 visits (shows the visit timeline + vitals trend)
    var amara = { givenName: 'Amara', familyName: 'Nakato', sex: 'F', dob: dob(1989, 4, 12) };
    R.push(rec(Object.assign({}, amara, {
      date: daysAgo(61), site: SITES[0], provider: PROVIDERS[0],
      temp: '38.9', bp: '118/76', weight: '58',
      chiefConcern: 'Fever and headache for 3 days',
      labs: toggleLab('Malaria RDT', true),
      diagnosis: 'Uncomplicated malaria',
      medications: [med('Artemether-Lumefantrine', '80/480 mg', 'BID', '3 days'), med('Paracetamol', '1 g', 'TID', '3 days')],
      treatment: 'Artemether-Lumefantrine 80/480 mg BID x 3 days; Paracetamol 1 g TID x 3 days',
      notes: 'Advised to return if fever persists beyond 48 hours.'
    })));
    R.push(rec(Object.assign({}, amara, {
      date: daysAgo(30), site: SITES[0], provider: PROVIDERS[0],
      temp: '37.1', bp: '116/74', weight: '59',
      chiefConcern: 'Follow-up after malaria treatment',
      labs: toggleLab('Malaria RDT', false),
      diagnosis: 'Malaria, resolved',
      notes: 'Symptoms resolved. Repeat RDT negative.'
    })));
    R.push(rec(Object.assign({}, amara, {
      date: daysAgo(4), site: SITES[0], provider: PROVIDERS[2],
      temp: '36.8', bp: '122/78', weight: '60', pregnant: 'Yes',
      chiefConcern: 'Missed period, possible pregnancy',
      labs: toggleLab('HCG/Pregnancy', true),
      diagnosis: 'Pregnancy, first trimester',
      currentMeds: 'Folic acid',
      medications: [med('Folic Acid', '5 mg', 'OD', '30 days')],
      treatment: 'Folic Acid 5 mg OD x 30 days',
      referralType: 'Antenatal care', referralDate: daysAgo(-10), referralStatus: 'Pending',
      notes: 'Referred to antenatal clinic. Estimated 8 weeks by dates.'
    })));

    // --- returning patient with 2 visits (chronic disease)
    var joseph = { givenName: 'Joseph', familyName: 'Okello', sex: 'M', dob: dob(1962, 9, 3) };
    R.push(rec(Object.assign({}, joseph, {
      date: daysAgo(45), site: SITES[1], provider: PROVIDERS[1],
      temp: '36.6', bp: '168/98', weight: '81',
      chiefConcern: 'Headache and dizziness',
      pmh: 'Hypertension, diagnosed 2019', currentMeds: 'None (ran out 2 months ago)',
      labs: numericLab('Blood Glucose', 104, 'mg/dL', 'Normal'),
      diagnosis: 'Hypertension, uncontrolled',
      medications: [med('Amlodipine', '5 mg', 'OD', '30 days')],
      treatment: 'Amlodipine 5 mg OD x 30 days',
      notes: 'Counselled on medication adherence and salt reduction.'
    })));
    R.push(rec(Object.assign({}, joseph, {
      date: daysAgo(7), site: SITES[1], provider: PROVIDERS[1],
      temp: '36.5', bp: '142/88', weight: '80',
      chiefConcern: 'Blood pressure recheck',
      pmh: 'Hypertension, diagnosed 2019', currentMeds: 'Amlodipine 5 mg daily',
      diagnosis: 'Hypertension, improving',
      medications: [med('Amlodipine', '10 mg', 'OD', '60 days')],
      treatment: 'Amlodipine 10 mg OD x 60 days',
      notes: 'Improved on treatment. Dose increased. Recheck in 8 weeks.'
    })));

    // --- single-visit patients
    var singles = [
      { givenName: 'Grace', familyName: 'Auma', sex: 'F', dob: dob(2018, 6, 21), date: daysAgo(3), site: SITES[0], provider: PROVIDERS[2],
        temp: '39.4', bp: '', weight: '17', chiefConcern: 'Cough and fever for 2 days',
        labs: toggleLab('Malaria RDT', false), diagnosis: 'Lower respiratory tract infection',
        medications: [med('Amoxicillin', '250 mg', 'TID', '5 days')],
        treatment: 'Amoxicillin 250 mg TID x 5 days', notes: 'Chest clear of crackles. Mother advised on danger signs.' },
      { givenName: 'Samuel', familyName: 'Ochieng', sex: 'M', dob: dob(1995, 1, 30), date: daysAgo(3), site: SITES[0], provider: PROVIDERS[0],
        temp: '36.9', bp: '124/80', weight: '68', chiefConcern: 'Laceration to left forearm',
        diagnosis: 'Laceration, left forearm', procedures: ['Wound suturing'],
        medications: [med('Ibuprofen', '400 mg', 'TID', '3 days')],
        treatment: 'Ibuprofen 400 mg TID x 3 days', notes: '4 cm laceration closed with 5 sutures. Tetanus up to date. Review in 7 days.' },
      { givenName: 'Miriam', familyName: 'Adeke', sex: 'F', dob: dob(1977, 11, 8), date: daysAgo(10), site: SITES[2], provider: PROVIDERS[1],
        temp: '36.7', bp: '132/84', weight: '64', chiefConcern: 'Burning on urination',
        labs: toggleLab('Typhoid (Widal/RDT)', false),
        urinalysis: { leukocytes: '2+', nitrite: 'POS', protein: 'Trace', blood: 'Trace', ph: '6.0', sg: '1.020', ketones: 'NEG', bilirubin: 'NEG', glucose: 'NEG', urobilinogen: 'Normal' },
        diagnosis: 'Urinary tract infection',
        medications: [med('Nitrofurantoin', '100 mg', 'BID', '5 days')],
        treatment: 'Nitrofurantoin 100 mg BID x 5 days' },
      { givenName: 'Daniel', familyName: 'Kirya', sex: 'M', dob: dob(2011, 3, 17), date: daysAgo(10), site: SITES[2], provider: PROVIDERS[2],
        temp: '37.0', bp: '', weight: '31', chiefConcern: 'Itchy rash on both arms',
        diagnosis: 'Scabies', medications: [med('Permethrin 5% cream', 'Apply', 'Nightly', '2 nights')],
        treatment: 'Permethrin 5% cream nightly x 2 nights', notes: 'Whole household advised to treat simultaneously.' },
      { givenName: 'Esther', familyName: 'Nabirye', sex: 'F', dob: dob(1954, 7, 2), date: daysAgo(11), site: SITES[1], provider: PROVIDERS[0],
        temp: '36.4', bp: '150/92', weight: '55', chiefConcern: 'Blurred vision and increased thirst',
        pmh: 'No prior diagnosis', labs: numericLab('Blood Glucose', 268, 'mg/dL', 'High'), bloodGlucose: '268',
        diagnosis: 'Type 2 diabetes mellitus, new diagnosis',
        medications: [med('Metformin', '500 mg', 'BID', '30 days')],
        treatment: 'Metformin 500 mg BID x 30 days',
        referralType: 'Chronic disease clinic', referralDate: daysAgo(-14), referralStatus: 'Pending',
        notes: 'New diagnosis. Referred for structured follow-up and education.' },
      { givenName: 'Peter', familyName: 'Wanyama', sex: 'M', dob: dob(1983, 12, 25), date: daysAgo(17), site: SITES[0], provider: PROVIDERS[1],
        temp: '38.2', bp: '128/82', weight: '72', chiefConcern: 'Abdominal pain and diarrhoea',
        labs: Object.assign({}, toggleLab('Typhoid (Widal/RDT)', true), toggleLab('Malaria RDT', false)),
        diagnosis: 'Typhoid fever',
        medications: [med('Ciprofloxacin', '500 mg', 'BID', '7 days'), med('ORS', '1 sachet', 'PRN', '5 days')],
        treatment: 'Ciprofloxacin 500 mg BID x 7 days; ORS PRN', notes: 'Hydration advice given.' },
      { givenName: 'Rebecca', familyName: 'Achieng', sex: 'F', dob: dob(2001, 5, 14), date: daysAgo(17), site: SITES[0], provider: PROVIDERS[2],
        temp: '36.8', bp: '110/70', weight: '52', breastfeeding: 'Yes',
        chiefConcern: 'Breast pain while breastfeeding', diagnosis: 'Mastitis',
        medications: [med('Flucloxacillin', '500 mg', 'QID', '7 days')],
        treatment: 'Flucloxacillin 500 mg QID x 7 days', notes: 'Advised to continue breastfeeding.' },
      { givenName: 'Michael', familyName: 'Tumwine', sex: 'M', dob: dob(1969, 2, 9), date: daysAgo(24), site: SITES[1], provider: PROVIDERS[0],
        temp: '36.6', bp: '138/86', weight: '77', chiefConcern: 'Chronic cough for 4 weeks',
        labs: toggleLab('TB (AFB Smear)', false),
        diagnosis: 'Chronic cough, TB screening negative',
        referralType: 'District hospital', referralDate: daysAgo(-3), referralStatus: 'Completed',
        notes: 'AFB negative. Referred for chest imaging.' },
      { givenName: 'Sarah', familyName: 'Namuli', sex: 'F', dob: dob(2016, 8, 30), date: daysAgo(24), site: SITES[2], provider: PROVIDERS[2],
        temp: '37.8', bp: '', weight: '20', chiefConcern: 'Ear pain, left side',
        diagnosis: 'Acute otitis media',
        medications: [med('Amoxicillin', '250 mg', 'TID', '7 days')],
        treatment: 'Amoxicillin 250 mg TID x 7 days' },
      { givenName: 'Isaac', familyName: 'Mugisha', sex: 'M', dob: dob(1990, 10, 5), date: daysAgo(31), site: SITES[0], provider: PROVIDERS[1],
        temp: '36.9', bp: '126/78', weight: '70', chiefConcern: 'Routine HIV testing',
        labs: Object.assign({}, toggleLab('HIV Rapid Test', false), toggleLab('RPR/Syphilis', false)),
        diagnosis: 'Routine screening, negative', notes: 'Counselling provided.' },
      { givenName: 'Florence', familyName: 'Akello', sex: 'F', dob: dob(1948, 3, 19), date: daysAgo(38), site: SITES[1], provider: PROVIDERS[0],
        temp: '36.3', bp: '158/94', weight: '49', chiefConcern: 'Joint pain in both knees',
        pmh: 'Osteoarthritis', diagnosis: 'Osteoarthritis, bilateral knees',
        medications: [med('Paracetamol', '1 g', 'TID', '14 days')],
        treatment: 'Paracetamol 1 g TID x 14 days', notes: 'Advised on joint protection exercises.' },
      { givenName: 'David', familyName: 'Ssemakula', sex: 'M', dob: dob(2005, 6, 11), date: daysAgo(38), site: SITES[0], provider: PROVIDERS[2],
        temp: '36.7', bp: '118/72', weight: '58', chiefConcern: 'Ankle injury playing football',
        diagnosis: 'Ankle sprain, grade 1',
        medications: [med('Ibuprofen', '400 mg', 'TID', '5 days')],
        treatment: 'Ibuprofen 400 mg TID x 5 days', notes: 'RICE advice. No bony tenderness.' },
      { givenName: 'Hannah', familyName: 'Kembabazi', sex: 'F', dob: dob(1998, 9, 27), date: daysAgo(52), site: SITES[2], provider: PROVIDERS[1],
        temp: '37.2', bp: '114/72', weight: '55', chiefConcern: 'Epigastric pain after meals',
        labs: toggleLab('H. pylori', true), diagnosis: 'H. pylori associated gastritis',
        medications: [med('Omeprazole', '20 mg', 'BID', '14 days'), med('Amoxicillin', '1 g', 'BID', '14 days'), med('Clarithromycin', '500 mg', 'BID', '14 days')],
        treatment: 'Triple therapy x 14 days', notes: 'Eradication therapy started.' },
      { givenName: 'Emmanuel', familyName: 'Byaruhanga', sex: 'M', dob: dob(1974, 4, 4), date: daysAgo(52), site: SITES[1], provider: PROVIDERS[0],
        temp: '36.5', bp: '144/90', weight: '85', chiefConcern: 'Medication refill and blood pressure check',
        pmh: 'Hypertension', currentMeds: 'Hydrochlorothiazide 25 mg daily',
        diagnosis: 'Hypertension, on treatment',
        medications: [med('Hydrochlorothiazide', '25 mg', 'OD', '60 days')],
        treatment: 'Hydrochlorothiazide 25 mg OD x 60 days' }
    ];
    singles.forEach(function (s) { R.push(rec(s)); });
    return R;
  }

  // ---------- seeding ----------
  async function seed(force) {
    var already = await pwaSync.idbSettingGet(SEED_FLAG);
    if (already === SEED_VERSION && !force) return;

    // Standalone mode: the demo can never reach a cloud database.
    await pwaSync.idbSettingSet('standaloneMode', 'true');
    await pwaSync.idbSettingSet('deviceId', DEMO_DEVICE_ID);
    await pwaSync.idbSettingSet('deviceName', 'Demo iPad');
    await pwaSync.idbSettingSet('deviceRole', 'admin');
    await pwaSync.idbSettingSet('supabaseUrl', null);
    await pwaSync.idbSettingSet('supabaseKey', null);

    // Seed just enough config for the form to feel populated. Everything else
    // falls back to the app's built-in defaults.
    try {
      window.electronAPI.saveSites(SITES);
      window.electronAPI.saveProviders(PROVIDERS);
    } catch (e) {}

    await window.platformRecords.setAll(buildRecords());
    await pwaSync.idbSettingSet(SEED_FLAG, SEED_VERSION);
  }

  async function resetDemo() {
    if (!window.confirm('Reset the demo back to its original sample patients? Anything you added here will be removed.')) return;
    await seed(true);
    window.location.reload();
  }
  window.resetDemoData = resetDemo;

  // ---------- demo banner ----------
  function renderBanner() {
    if (document.getElementById('demoBanner')) return;
    var bar = document.createElement('div');
    bar.id = 'demoBanner';
    bar.setAttribute('role', 'note');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:96;background:#1f2937;color:#fff;' +
      'padding:8px 14px;font-size:12.5px;line-height:1.45;display:flex;align-items:center;gap:12px;' +
      'box-shadow:0 -2px 10px rgba(0,0,0,0.18);';
    bar.innerHTML =
      '<span style="background:#F68630;color:#fff;font-weight:700;padding:2px 8px;border-radius:999px;font-size:11px;letter-spacing:.04em;flex:none;">DEMO</span>' +
      '<span style="flex:1;min-width:0;">Sample patients only. Everything stays in this browser and nothing syncs to a cloud. Add, edit and explore freely.</span>' +
      '<a href="/guides/getting-started/" style="color:#fff;text-decoration:underline;font-weight:600;white-space:nowrap;flex:none;">Set up your own</a>' +
      '<button id="demoResetBtn" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:6px;padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">Reset demo</button>' +
      '<button id="demoHideBtn" aria-label="Hide demo notice" style="background:transparent;color:#fff;border:none;font-size:18px;line-height:1;cursor:pointer;padding:0 4px;flex:none;">&times;</button>';
    document.body.appendChild(bar);
    document.getElementById('demoResetBtn').addEventListener('click', resetDemo);
    document.getElementById('demoHideBtn').addEventListener('click', function () { bar.remove(); });
  }

  // app.js awaits this before reading any settings, so the demo is fully seeded
  // before the app decides whether to show the setup wizard.
  window.__demoReady = seed(false)
    .catch(function (e) { console.error('[demo] seeding failed', e); })
    .then(function () {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderBanner);
      } else {
        renderBanner();
      }
    });
})();
