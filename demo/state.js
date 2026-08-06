// ==========================================
// DATA & STATE
// ==========================================
let currentDeviceId = null;
let records = [];
let editingRecordId = null;
let panelMode = 'new';
let editingFormularyId = null;
let editingProviderId = null;
let editingSiteId = null;
let editingRxPresetId = null;
let selectedDxPresets = new Set();
let selectedRxPresets = new Set();
let selectedComplaints = new Set();
let dobUnknown = false;
let selectedTemp = '';
let selectedWeight = '';
let selectedProvider = '';
let editingProcedureId = null;
let selectedProcedures = [];
let dxSortMode = 'popular';

// ==========================================
// ACCESS TO CARE STATE
// ==========================================
let accessCareLocations = new Set();   // multi-select: Clinic, Hospital, Pharmacy, etc.
let accessCareBarriers = new Set();    // multi-select: Cost, Distance, etc.
let accessPainLevel = null;            // 0-10 or null

// Access to Care option lists (mirror SwiftUI app)
const CARE_LOCATION_OPTIONS = ['Clinic', 'Hospital', 'Pharmacy', 'Traditional healer', 'Other'];
const CARE_BARRIER_OPTIONS = ['Cost', 'Distance', 'Transportation', 'Time away from work/family', 'Did not know where to go', 'Other'];
const TRAVEL_DISTANCE_OPTIONS = ['<5 km', '5-10 km', '>10 km', "Don't Know"];
const TRAVEL_TIME_OPTIONS = ['<30 min', '30-60 min', '>60 min'];
const TRANSPORT_TYPE_OPTIONS = ['Walking', 'Bicycle', 'Motorcycle', 'Car', 'Public transport', 'Other'];

const DEFAULT_COMPLAINTS = [
  'Abdominal Pain', 'Dysuria', 'Fever', 'Cough', 'Headache',
  'Skin Rash/Itching', 'Diarrhea', 'Body/Joint Pain', 'Wound/Injury', 'Eye Problem'
];
let _cachedComplaints = null;
function getComplaints() { return _cachedComplaints || [...DEFAULT_COMPLAINTS]; }
function saveComplaints(c) { _cachedComplaints = c; window.electronAPI.saveComplaints(c); }
// Alias for backward compat — complaint buttons read from this
let COMMON_COMPLAINTS = DEFAULT_COMPLAINTS;

const WEIGHT_RANGES = {
  infant: [[2,4],[4,6],[6,8],[8,10]],
  toddler: [[8,12],[12,16],[16,20],[20,25]],
  child: [[15,20],[20,30],[30,40],[40,50]],
  teen: [[30,40],[40,50],[50,60],[60,70]],
  adult: [[40,50],[50,60],[60,70],[70,80],[80,100]]
};

const DEFAULT_SITES = ['Site A'];

// In-memory config cache — loaded at startup via loadConfig()
let _cachedSites = null;
let _cachedProviders = null;
let _cachedFormulary = null;
let _cachedRxPresets = null;
let _cachedProcedures = null;
let _cachedReferralTypes = null;
let _cachedCustomDxPresets = null;
let _cachedLastSite = '';
let _deviceRole = 'standard';

// Standalone mode flag
let _standaloneMode = false;

function isStandaloneMode() { return _standaloneMode; }
function setStandaloneMode(val) { _standaloneMode = val; }

// Section visibility removed — all sections always visible

async function loadConfig() {
  // Load standalone mode flag
  const sm = await window.electronAPI.getSetting('standaloneMode');
  _standaloneMode = (sm === 'true');

  _cachedSites = await window.electronAPI.getSites();
  _cachedProviders = await window.electronAPI.getProviders();
  _cachedFormulary = await window.electronAPI.getFormulary();
  _cachedRxPresets = await window.electronAPI.getRxPresets();
  _cachedProcedures = await window.electronAPI.getProcedures();
  _cachedReferralTypes = await window.electronAPI.getReferralTypes();
  _cachedComplaints = await window.electronAPI.getComplaints();
  COMMON_COMPLAINTS = getComplaints();
  _cachedCustomDxPresets = await window.electronAPI.getCustomDxPresets();
  _cachedCustomLabTests = await window.electronAPI.getCustomLabTests() || [];
  _cachedLastSite = (await window.electronAPI.getSetting('lastSite')) || '';
  _deviceRole = await window.electronAPI.getDeviceRole() || 'standard';
  const hp = await window.electronAPI.getHiddenPresets();
  if (hp) _hiddenPresets = hp;
  // Section visibility loading removed — all sections always visible
}

function getSites() { return _cachedSites || [...DEFAULT_SITES]; }
function saveSites(s) { _cachedSites = s; window.electronAPI.saveSites(s); }
function getLastSite() { return _cachedLastSite || ''; }
function setLastSite(s) { _cachedLastSite = s; window.electronAPI.setSetting('lastSite', s); }

function getDeviceRole() { return _deviceRole; }
function setDeviceRoleLocal(r) { _deviceRole = r; }

// getSectionVisibility, isSectionVisible, saveSectionVisibility removed

// Expanded configurable lab test library
const DEFAULT_LAB_TESTS = [
  // Infectious Disease
  { id: 'malaria_rdt', name: 'Malaria RDT', type: 'toggle', enabledByDefault: true },
  { id: 'hiv_rapid', name: 'HIV Rapid Test', type: 'toggle', enabledByDefault: true },
  { id: 'typhoid', name: 'Typhoid (Widal/RDT)', type: 'toggle', enabledByDefault: true },
  { id: 'hep_b', name: 'Hepatitis B (HBsAg)', type: 'toggle', enabledByDefault: true },
  { id: 'hep_c', name: 'Hepatitis C (Anti-HCV)', type: 'toggle', enabledByDefault: false },
  { id: 'rpr_syphilis', name: 'RPR/Syphilis', type: 'toggle', enabledByDefault: true },
  { id: 'h_pylori', name: 'H. pylori', type: 'toggle', enabledByDefault: true },
  { id: 'covid19_rapid', name: 'COVID-19 Rapid', type: 'toggle', enabledByDefault: false },
  { id: 'tb_afb', name: 'TB (AFB Smear)', type: 'toggle', enabledByDefault: false },
  // Women's Health
  { id: 'hcg_pregnancy', name: 'HCG/Pregnancy', type: 'toggle', enabledByDefault: true },
  // Blood Chemistry
  { id: 'blood_glucose', name: 'Blood Glucose', type: 'numeric', unit: 'mg/dL', enabledByDefault: true,
    ranges: [
      { label: 'Low', max: 70, color: 'var(--amber)' },
      { label: 'Normal', min: 70, max: 140, color: 'var(--green)' },
      { label: 'Elevated', min: 140, max: 200, color: 'var(--amber)' },
      { label: 'High', min: 200, color: 'var(--red)' }
    ]
  },
  { id: 'hemoglobin', name: 'Hemoglobin', type: 'numeric', unit: 'g/dL', enabledByDefault: true,
    ranges: [
      { label: 'Severe Anemia', max: 7, color: 'var(--red)' },
      { label: 'Moderate Anemia', min: 7, max: 10, color: 'var(--amber)' },
      { label: 'Mild Anemia', min: 10, max: 12, color: 'var(--amber)' },
      { label: 'Normal', min: 12, color: 'var(--green)' }
    ]
  }
];

// Custom lab tests — merged with defaults
let _cachedCustomLabTests = null;

function getCustomLabTests() { return _cachedCustomLabTests || []; }
function saveCustomLabTests(tests) {
  _cachedCustomLabTests = tests;
  window.electronAPI.saveCustomLabTests(tests);
}

function getMergedLabTests() {
  return [...DEFAULT_LAB_TESTS, ...getCustomLabTests()];
}

// Backward-compatible: list of lab test names for the old LAB_TESTS references
const LAB_TESTS = DEFAULT_LAB_TESTS.map(t => t.name);

function getLabTests() {
  return getMergedLabTests().filter(t => !isPresetHidden('labTests', t.name));
}

function getAllLabTests() {
  return getMergedLabTests();
}

function getLabTestById(id) {
  return getMergedLabTests().find(t => t.id === id);
}

function getLabTestByName(name) {
  return getMergedLabTests().find(t => t.name === name);
}

function interpretNumericLab(test, value) {
  if (!test.ranges || !value || isNaN(value)) return null;
  const v = parseFloat(value);
  for (const r of test.ranges) {
    const aboveMin = r.min === undefined || v >= r.min;
    const belowMax = r.max === undefined || v < r.max;
    if (aboveMin && belowMax) return { label: r.label, color: r.color };
  }
  return null;
}

const UA_PARAMS = ['leukocytes','nitrite','urobilinogen','protein','ph','blood','sg','ketones','bilirubin','glucose'];
const UA_FIELD_IDS = { leukocytes:'ua-leukocytes', nitrite:'ua-nitrite', urobilinogen:'ua-urobilinogen', protein:'ua-protein', ph:'ua-ph', blood:'ua-blood', sg:'ua-sg', ketones:'ua-ketones', bilirubin:'ua-bilirubin', glucose:'ua-glucose' };

const FREQUENCIES = [
  { value: 'once', label: 'Once (single dose)' },
  { value: 'q24h', label: 'Once daily q24h' },
  { value: 'q12h', label: 'Twice daily q12h' },
  { value: 'q8h', label: 'Three times daily q8h' },
  { value: 'q6h', label: 'Four times daily q6h' },
  { value: 'qhs', label: 'At bedtime qhs' },
  { value: 'bid-topical', label: 'Twice daily topical' },
  { value: 'prn', label: 'As needed PRN' }
];
const DURATIONS = ['Single dose', '3d', '5d', '7d', '10d', '14d', '21d', '28d', '4 weeks', '6 weeks', 'Ongoing'];

const DEFAULT_PHYSICIANS = ['Physician A'];
function getProviders() { return _cachedProviders || [...DEFAULT_PHYSICIANS]; }
function saveProviders(p) { _cachedProviders = p; window.electronAPI.saveProviders(p); }

const DEFAULT_FORMULARY = [
  { id: 'abx-amox500', name: 'Amoxicillin 500mg', dose: '500mg', unit: 'caps', category: 'Antibiotics', controlled: false },
  { id: 'abx-amox250', name: 'Amoxicillin 250mg', dose: '250mg', unit: 'caps', category: 'Antibiotics', controlled: false },
  { id: 'abx-azithro250', name: 'Azithromycin 250mg', dose: '500mg', unit: 'tabs', category: 'Antibiotics', controlled: false },
  { id: 'abx-azithro1g', name: 'Azithromycin 1g single dose', dose: '1g', unit: 'tabs', category: 'Antibiotics', controlled: false },
  { id: 'abx-cipro', name: 'Ciprofloxacin 500mg', dose: '500mg', unit: 'tabs', category: 'Antibiotics', controlled: false },
  { id: 'abx-doxy', name: 'Doxycycline 100mg', dose: '100mg', unit: 'caps', category: 'Antibiotics', controlled: false },
  { id: 'abx-metro', name: 'Metronidazole 200mg', dose: '400mg', unit: 'tabs', category: 'Antibiotics', controlled: false },
  { id: 'abx-ceph', name: 'Cephalexin 250mg', dose: '500mg', unit: 'caps', category: 'Antibiotics', controlled: false },
  { id: 'abx-levo', name: 'Levofloxacin 500mg', dose: '500mg', unit: 'tabs', category: 'Antibiotics', controlled: false },
  { id: 'abx-nitro', name: 'Nitrofurantoin 100mg', dose: '100mg', unit: 'tabs', category: 'Antibiotics', controlled: false },
  { id: 'abx-ceftri', name: 'Ceftriaxone 500mg IM', dose: '500mg', unit: 'vial', category: 'Antibiotics', controlled: false },
  { id: 'abx-benza', name: 'Benzathine Penicillin 2.4MU IM', dose: '2.4MU', unit: 'vial', category: 'Antibiotics', controlled: false },
  { id: 'am-artefan', name: 'Artemether-Lumefantrine 20/120mg Artefan', dose: '4 tabs', unit: 'tabs', category: 'Antimalarials', controlled: false },
  { id: 'am-artesunate', name: 'Artesunate Inj 60mg', dose: '60mg', unit: 'vial', category: 'Antimalarials', controlled: false },
  { id: 'af-griseo', name: 'Griseofulvin 500mg', dose: '500mg', unit: 'tabs', category: 'Antifungals', controlled: false },
  { id: 'af-fluco', name: 'Fluconazole 200mg', dose: '150mg', unit: 'caps', category: 'Antifungals', controlled: false },
  { id: 'af-clotrim', name: 'Clotrimazole cream 1%', dose: 'apply', unit: 'cream', category: 'Antifungals', controlled: false },
  { id: 'af-nystatin', name: 'Nystatin suspension 500k IU', dose: '1ml', unit: 'drops', category: 'Antifungals', controlled: false },
  { id: 'ap-alben', name: 'Albendazole 400mg', dose: '400mg', unit: 'tabs', category: 'Antiparasitic', controlled: false },
  { id: 'ap-iverm', name: 'Ivermectin 3mg', dose: '200mcg/kg', unit: 'tabs', category: 'Antiparasitic', controlled: false },
  { id: 'ap-prazi', name: 'Praziquantel 600mg', dose: '600mg', unit: 'tabs', category: 'Antiparasitic', controlled: false },
  { id: 'an-ibu', name: 'Ibuprofen 200mg', dose: '400mg', unit: 'tabs', category: 'Analgesics', controlled: false },
  { id: 'an-para500', name: 'Paracetamol 500mg', dose: '1g', unit: 'tabs', category: 'Analgesics', controlled: false },
  { id: 'an-parasyr', name: 'Paracetamol 120mg/5ml syrup', dose: '5ml', unit: 'ml', category: 'Analgesics', controlled: false },
  { id: 'gi-omep', name: 'Omeprazole 20mg', dose: '20mg', unit: 'caps', category: 'GI', controlled: false },
  { id: 'gi-loper', name: 'Loperamide 2mg', dose: '4mg', unit: 'caps', category: 'GI', controlled: false },
  { id: 'gi-ors', name: 'ORS 1L sachet', dose: '1', unit: 'sachet', category: 'GI', controlled: false },
  { id: 'as-cetir', name: 'Cetirizine 10mg', dose: '10mg', unit: 'tabs', category: 'Allergy/Steroid', controlled: false },
  { id: 'as-pred', name: 'Prednisolone 5mg', dose: '40mg', unit: 'tabs', category: 'Allergy/Steroid', controlled: false },
  { id: 'as-dexa', name: 'Dexamethasone 8mg Inj', dose: '8mg', unit: 'vial', category: 'Allergy/Steroid', controlled: false },
  { id: 'av-acyclo', name: 'Acyclovir 200mg', dose: '400mg', unit: 'tabs', category: 'Antiviral', controlled: false },
  { id: 'vit-prenatal', name: 'Prenatal Vitamins', dose: '1 tab', unit: 'tabs', category: 'Vitamins', controlled: false },
  { id: 'vit-multi', name: 'Multivitamin', dose: '1 tab', unit: 'tabs', category: 'Vitamins', controlled: false },
  { id: 'sp-ketamine', name: 'Ketamine Inj 50mg/ml', dose: '1-2mg/kg', unit: 'vial', category: 'Surgical/Procedural', controlled: true },
  { id: 'sp-lido', name: 'Lidocaine 2% 30ml', dose: '2ml', unit: 'vial', category: 'Surgical/Procedural', controlled: false },
  { id: 'sp-adrenaline', name: 'Adrenaline Inj', dose: '0.5ml', unit: 'vial', category: 'Surgical/Procedural', controlled: false },
  { id: 'sp-diaz', name: 'Diazepam Inj', dose: '10mg', unit: 'vial', category: 'Surgical/Procedural', controlled: true },
  { id: 'sp-ns', name: 'Normal Saline 500ml', dose: '500ml', unit: 'vial', category: 'Surgical/Procedural', controlled: false }
];

function getFormulary() { return _cachedFormulary || [...DEFAULT_FORMULARY]; }
function saveFormulary(f) { _cachedFormulary = f; window.electronAPI.saveFormulary(f); }

// DX PRESETS
const DX_PRESETS = [
  'Malaria', 'URTI', 'Pneumonia', 'UTI', 'PUD/GERD', 'Typhoid', 'Cellulitis', 'MSK Pain',
  'Allergic Reaction', 'H. pylori', 'Scabies', 'Tinea/Fungal', 'Candidiasis', 'Viral URTI',
  'GC/Chlamydia', 'Syphilis', 'HIV', 'Hypertension',
  'Diabetes', 'Pregnancy', 'Helminth Infection', 'Nutritional Deficiency',
  'Dental Pain', 'Mental Health', 'Conjunctivitis', 'Otitis Media', 'PID',
  'Gastroenteritis', 'Dehydration', 'Asthma/Wheeze', 'Abscess'
];
const DX_SYSTEMS = {
  'Infectious': ['Malaria', 'Typhoid', 'Helminth Infection'],
  'Respiratory': ['URTI', 'Viral URTI', 'Pneumonia', 'Asthma/Wheeze'],
  'GI': ['PUD/GERD', 'H. pylori', 'Gastroenteritis', 'Dehydration'],
  'Skin': ['Cellulitis', 'Scabies', 'Tinea/Fungal', 'Candidiasis', 'Abscess'],
  'GU/STI': ['UTI', 'GC/Chlamydia', 'Syphilis', 'PID'],
  'MSK': ['MSK Pain'],
  'Allergy': ['Allergic Reaction'],
  'ENT/Eye': ['Conjunctivitis', 'Otitis Media', 'Dental Pain'],
  'Chronic': ['HIV', 'Hypertension', 'Diabetes'],
  'OB/GYN': ['Pregnancy'],
  'Other': ['Nutritional Deficiency', 'Mental Health']
};

const DX_TO_RX_MAP = {
  'Malaria': ['Malaria'],
  'URTI': ['URTI/Pneumonia', 'Viral URTI'],
  'Pneumonia': ['URTI/Pneumonia'],
  'UTI': ['UTI'],
  'PUD/GERD': ['PUD/GERD', 'H. pylori Triple Therapy'],
  'H. pylori': ['H. pylori Triple Therapy'],
  'Cellulitis': ['Skin/Cellulitis'],
  'Abscess': ['Skin/Cellulitis'],
  'MSK Pain': ['MSK Pain'],
  'Allergic Reaction': ['Allergic Reaction'],
  'Tinea/Fungal': ['Tinea/Fungal'],
  'Candidiasis': ['Candidiasis'],
  'Viral URTI': ['Viral URTI'],
  'GC/Chlamydia': ['GC/Chlamydia'],
  'PID': ['GC/Chlamydia'],
  'Syphilis': ['Syphilis RPR+'],
  'Typhoid': ['Typhoid'],
  'Pregnancy': ['Pregnancy Pack'],
  'Helminth Infection': ['Anti-helminthic'],
  'Gastroenteritis': ['Anti-helminthic'],
  'Dehydration': ['Vitamin Therapy']
};

// RX PRESETS
const RX_PRESETS = [
  { name: 'H. pylori Triple Therapy', rx: 'Amoxicillin 1g q12h 14d + Metronidazole 400mg q12h 14d + Omeprazole 20mg q12h 14d', meds: [
    { medId: 'abx-amox500', dose: '1g', freq: 'q12h', duration: '14d' },
    { medId: 'abx-metro', dose: '400mg', freq: 'q12h', duration: '14d' },
    { medId: 'gi-omep', dose: '20mg', freq: 'q12h', duration: '14d' }
  ]},
  { name: 'Malaria >35kg', rx: 'Artefan 4 tabs PO q12h \u00d7 3d', meds: [
    { medId: 'am-artefan', dose: '4 tabs', freq: 'q12h', duration: '3d' }
  ]},
  { name: 'Malaria 25-35kg', rx: 'Artefan 3 tabs PO q12h \u00d7 3d', meds: [
    { medId: 'am-artefan', dose: '3 tabs', freq: 'q12h', duration: '3d' }
  ]},
  { name: 'Malaria 15-25kg', rx: 'Artefan 2 tabs PO q12h \u00d7 3d', meds: [
    { medId: 'am-artefan', dose: '2 tabs', freq: 'q12h', duration: '3d' }
  ]},
  { name: 'Malaria 5-15kg', rx: 'Artefan 1 tab PO q12h \u00d7 3d', meds: [
    { medId: 'am-artefan', dose: '1 tab', freq: 'q12h', duration: '3d' }
  ]},
  { name: 'GC/Chlamydia', rx: 'Ceftriaxone 500mg IM once + Azithromycin 1g PO once', meds: [
    { medId: 'abx-ceftri', dose: '500mg', freq: 'once', duration: 'Single dose' },
    { medId: 'abx-azithro1g', dose: '1g', freq: 'once', duration: 'Single dose' }
  ]},
  { name: 'Syphilis RPR+', rx: 'Benzathine Penicillin 2.4MU IM once + Doxycycline 100mg q12h 14d', meds: [
    { medId: 'abx-benza', dose: '2.4MU', freq: 'once', duration: 'Single dose' },
    { medId: 'abx-doxy', dose: '100mg', freq: 'q12h', duration: '14d' }
  ]},
  { name: 'Anti-helminthic', rx: 'Albendazole 400mg PO once', meds: [
    { medId: 'ap-alben', dose: '400mg', freq: 'once', duration: 'Single dose' }
  ]},
  { name: 'Vitamin Therapy', rx: 'Multivitamin 1 tab PO q24h \u00d7 14d', meds: [
    { medId: 'vit-multi', dose: '1 tab', freq: 'q24h', duration: '14d' }
  ]},
  { name: 'Corticosteroid Joint Injection', rx: 'Lidocaine 2% 2ml + Dexamethasone 8mg', meds: [
    { medId: 'sp-lido', dose: '2ml', freq: 'once', duration: 'Single dose' },
    { medId: 'as-dexa', dose: '8mg', freq: 'once', duration: 'Single dose' }
  ], notes: 'Corticosteroid joint injection performed' },
  { name: 'Pregnancy Pack', rx: 'Prenatal Vitamins 1 tab PO q24h ongoing', meds: [
    { medId: 'vit-prenatal', dose: '1 tab', freq: 'q24h', duration: 'Ongoing' }
  ]},
  { name: 'PUD/GERD', rx: 'Omeprazole 20mg PO q12h \u00d7 14d', meds: [
    { medId: 'gi-omep', dose: '20mg', freq: 'q12h', duration: '14d' }
  ]},
  { name: 'UTI', rx: 'Nitrofurantoin 100mg PO q12h \u00d7 7d', meds: [
    { medId: 'abx-nitro', dose: '100mg', freq: 'q12h', duration: '7d' }
  ]},
  { name: 'URTI/Pneumonia', rx: 'Amoxicillin 500mg PO q8h \u00d7 7d', meds: [
    { medId: 'abx-amox500', dose: '500mg', freq: 'q8h', duration: '7d' }
  ]},
  { name: 'Skin/Cellulitis', rx: 'Cephalexin 250mg PO q8h \u00d7 7d', meds: [
    { medId: 'abx-ceph', dose: '250mg', freq: 'q8h', duration: '7d' }
  ]},
  { name: 'Tinea/Fungal', rx: 'Griseofulvin 500mg PO q24h \u00d7 14d', meds: [
    { medId: 'af-griseo', dose: '500mg', freq: 'q24h', duration: '14d' }
  ]},
  { name: 'Candidiasis', rx: 'Fluconazole 150mg PO once', meds: [
    { medId: 'af-fluco', dose: '150mg', freq: 'once', duration: 'Single dose' }
  ]},
  { name: 'Typhoid', rx: 'Ciprofloxacin 500mg PO q12h \u00d7 7d', meds: [
    { medId: 'abx-cipro', dose: '500mg', freq: 'q12h', duration: '7d' }
  ]},
  { name: 'Allergic Reaction', rx: 'Cetirizine 10mg PO q24h 7d + Prednisolone 5mg PO q24h 5d', meds: [
    { medId: 'as-cetir', dose: '10mg', freq: 'q24h', duration: '7d' },
    { medId: 'as-pred', dose: '5mg', freq: 'q24h', duration: '5d' }
  ]},
  { name: 'Viral URTI', rx: 'Paracetamol 500mg PO q8h 5d + Cetirizine 10mg PO q24h 5d', meds: [
    { medId: 'an-para500', dose: '500mg', freq: 'q8h', duration: '5d' },
    { medId: 'as-cetir', dose: '10mg', freq: 'q24h', duration: '5d' }
  ]},
  { name: 'MSK Pain', rx: 'Ibuprofen 400mg PO q8h \u00d7 5d', meds: [
    { medId: 'an-ibu', dose: '400mg', freq: 'q8h', duration: '5d' }
  ]}
];

// Rx Presets persistence
function getRxPresetsData() { return _cachedRxPresets || [...RX_PRESETS]; }
function saveRxPresetsData(p) { _cachedRxPresets = p; window.electronAPI.saveRxPresets(p); }

// Procedures persistence
const DEFAULT_PROCEDURES = ['I&D (Incision & Drainage)', 'Wound Closure/Sutures', 'Wound Debridement', 'Joint Injection', 'Foreign Body Removal', 'Splinting/Casting'];
function getProcedures() { return _cachedProcedures || [...DEFAULT_PROCEDURES]; }
function saveProceduresData(p) { _cachedProcedures = p; window.electronAPI.saveProcedures(p); }

const DEFAULT_REFERRAL_TYPES = ['None', 'Surgery', 'Follow-up', 'Specialist', 'Hospital', 'Lab Work'];
function getCustomDxPresets() { return _cachedCustomDxPresets || [...DX_PRESETS]; }
function getReferralTypes() { return _cachedReferralTypes || [...DEFAULT_REFERRAL_TYPES]; }
function saveReferralTypes(t) { _cachedReferralTypes = t; window.electronAPI.saveReferralTypes(t); }

// ==========================================
// HIDDEN PRESETS — show/hide toggle system
// ==========================================
let _hiddenPresets = {
  diagnoses: [],
  procedures: [],
  complaints: [],
  referralTypes: [],
  rxPresets: [],
  labTests: DEFAULT_LAB_TESTS.filter(t => !t.enabledByDefault).map(t => t.name)
};

function getHiddenPresets() { return _hiddenPresets; }

function saveHiddenPresets(obj) {
  _hiddenPresets = obj;
  window.electronAPI.saveHiddenPresets(obj);
}

function isPresetHidden(category, name) {
  return _hiddenPresets[category] && _hiddenPresets[category].includes(name);
}

function togglePresetVisibility(category, name) {
  if (!_hiddenPresets[category]) _hiddenPresets[category] = [];
  const idx = _hiddenPresets[category].indexOf(name);
  if (idx >= 0) {
    _hiddenPresets[category].splice(idx, 1);
  } else {
    _hiddenPresets[category].push(name);
  }
  saveHiddenPresets(_hiddenPresets);
}

const DISEASE_CATEGORIES = {
  'malaria': /malaria/i, 'RTI/URTI': /rti|urti|pneumonia|respiratory|cough|bronchit/i,
  'skin': /skin|cellulitis|dermat|rash|wound|abscess|boil/i, 'UTI/PID': /uti|urinary|pid|pelvic inflammatory/i,
  'MSK': /msk|musculoskeletal|joint|back pain|arthri/i, 'PUD/GI': /pud|gerd|gastri|gi |diarr|stomach|abdom|ulcer/i,
  'HTN': /htn|hypertens|high blood/i, 'STI': /sti|gonor|chlamyd|syphil|gc\//i,
  'typhoid': /typhoid/i, 'diabetes': /diabet|dm |glucose/i, 'pregnancy': /pregnan/i,
  'allergy': /allerg/i, 'parasites': /parasit|helminth|worm|schisto/i,
  'candidiasis': /candid|thrush|yeast/i, 'nutritional': /nutrit|vitamin|anemia|anaemia/i,
  'mental health': /mental|depress|anxiety|psych/i, 'dental': /dental|tooth|teeth|oral/i
};
