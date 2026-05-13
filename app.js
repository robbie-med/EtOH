/* ===========================================================
   EtOH Withdrawal Bedside Tool
   Single-file app: state, scores, recommendation engine, views.
   All clinical content is evidence-linked. See README for sources.
   =========================================================== */

(() => {
'use strict';

if (typeof structuredClone !== 'function') {
  window.structuredClone = (v) => JSON.parse(JSON.stringify(v));
}

/* ---------- Citations (canonical links) ---------- */
const CITE = {
  AUDIT: { text: 'Saunders JB et al. AUDIT (WHO, 2nd ed., 2001).', url: 'https://www.who.int/publications/i/item/audit-the-alcohol-use-disorders-identification-test-guidelines-for-use-in-primary-health-care' },
  AUDITC: { text: 'Bush K et al. The AUDIT-C. Arch Intern Med. 1998;158:1789-95.', url: 'https://pubmed.ncbi.nlm.nih.gov/9738608/' },
  CAGE: { text: 'Ewing JA. Detecting alcoholism: the CAGE questionnaire. JAMA. 1984;252:1905-7.', url: 'https://pubmed.ncbi.nlm.nih.gov/6471323/' },
  DSM5: { text: 'NIAAA. Alcohol Use Disorder: A comparison between DSM-IV and DSM-5.', url: 'https://www.niaaa.nih.gov/publications/brochures-and-fact-sheets/alcohol-use-disorder-comparison-between-dsm' },
  PAWSS: { text: 'Maldonado JR et al. PAWSS validation. Alcohol. 2014;48:375-90; Alcohol Alcohol. 2015;50:509-18.', url: 'https://pubmed.ncbi.nlm.nih.gov/25956618/' },
  CIWA: { text: 'Sullivan JT et al. CIWA-Ar. Br J Addict. 1989;84:1353-7.', url: 'https://pubmed.ncbi.nlm.nih.gov/2597811/' },
  GMAWS: { text: 'McPherson A et al. GMAWS. Alcohol Alcohol. 2012. NHS GG&C protocol.', url: 'https://www.clinicalguidelines.scot.nhs.uk/ggc-paediatric-clinical-guidelines/ggc-guidelines/emergency-medicine/alcohol-withdrawal-management-of/' },
  MINDS: { text: 'DeCarolis DD et al. MINDS for alcohol withdrawal. Pharmacotherapy. 2007;27:510-8.', url: 'https://pubmed.ncbi.nlm.nih.gov/17381378/' },
  RASS: { text: 'Sessler CN et al. RASS. Am J Respir Crit Care Med. 2002;166:1338-44.', url: 'https://pubmed.ncbi.nlm.nih.gov/12421743/' },
  SAS: { text: 'Riker RR et al. SAS. Crit Care Med. 1999;27:1325-9.', url: 'https://pubmed.ncbi.nlm.nih.gov/10446827/' },
  CAMICU: { text: 'Ely EW et al. CAM-ICU. JAMA. 2001;286:2703-10. (icudelirium.org)', url: 'https://www.icudelirium.org/medical-professionals/delirium/monitoring-delirium-in-the-icu' },
  GCS: { text: 'Teasdale G, Jennett B. Glasgow Coma Scale. Lancet. 1974;2:81-4.', url: 'https://pubmed.ncbi.nlm.nih.gov/4136544/' },
  ASAM2020: { text: 'ASAM Clinical Practice Guideline on Alcohol Withdrawal Management (2020).', url: 'https://www.asam.org/quality-care/clinical-guidelines/alcohol-withdrawal-management-guideline' },
  ROSENSON: { text: 'Rosenson J et al. Phenobarbital for acute alcohol withdrawal — RCT. J Emerg Med. 2013;44:592-8.', url: 'https://pubmed.ncbi.nlm.nih.gov/22999778/' },
  MUELLER: { text: 'Mueller SW et al. Dexmedetomidine for alcohol withdrawal. Crit Care Med. 2014;42:1131-9.', url: 'https://pubmed.ncbi.nlm.nih.gov/24351375/' },
  WERNICKE: { text: 'Royal College / EFNS guidance on thiamine in suspected Wernicke encephalopathy.', url: 'https://onlinelibrary.wiley.com/doi/10.1111/j.1468-1331.2010.03153.x' },
  NALTREXONE: { text: 'VA/DoD Substance Use Disorder Guideline 2021 (naltrexone, acamprosate).', url: 'https://www.healthquality.va.gov/guidelines/MH/sud/' },
  MAT: { text: 'SAMHSA TIP 49 — Incorporating Alcohol Pharmacotherapies Into Medical Practice.', url: 'https://store.samhsa.gov/product/TIP-49-Incorporating-Alcohol-Pharmacotherapies-Into-Medical-Practice/SMA13-4380' }
};

/* ============================================================
   STATE  (ephemeral, single active patient, localStorage cache)
   ============================================================ */
const LS_KEY = 'etoh-wd-state-v1';
const STATE_DEFAULT = {
  // patient context — entered manually
  ageBand: null,           // 'lt65' | 'ge65'
  setting: null,           // 'outpt' | 'floor' | 'icu'
  cooperative: null,       // true | false | null
  liverDisease: null,      // boolean | null
  pregnant: null,          // boolean | null
  opioidCoUse: null,       // boolean | null
  benzoCoUse: null,        // boolean | null
  // results
  results: {},             // id -> {score, tier, time, items}
  history: [],             // ordered list of {id, name, score, tier, time, items?}
  notes: ''                // free-text addendum
};
let S = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return structuredClone(STATE_DEFAULT);
    return Object.assign(structuredClone(STATE_DEFAULT), JSON.parse(raw));
  } catch (e) { return structuredClone(STATE_DEFAULT); }
}
function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {}
}
function resetState() {
  if (!confirm('Clear all entered data for this patient?')) return;
  S = structuredClone(STATE_DEFAULT);
  saveState();
  renderAll();
}

/* ============================================================
   DOM HELPERS
   ============================================================ */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
function el(tag, attrs={}, children=[]) {
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) e.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null) return;
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  });
  return e;
}
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

/* ============================================================
   SCORE DEFINITIONS
   ============================================================ */

// Helper to build 0-N row of integer options
function rowOpts(min, max, labels = null) {
  const arr = [];
  for (let i = min; i <= max; i++) arr.push({ label: labels ? labels[i-min] : String(i), value: i });
  return arr;
}

const SCORES = {

/* ---------- AUDIT ---------- */
AUDIT: {
  id:'AUDIT', name:'AUDIT', full:'Alcohol Use Disorders Identification Test (10 items)',
  category:'screening', cite: CITE.AUDIT,
  intro:'Past-year alcohol use screen. WHO-validated. Best for outpatient/ED longitudinal use.',
  items: [
    { q:'1. How often do you have a drink containing alcohol?', opts:[
      {label:'Never', value:0},{label:'Monthly or less', value:1},
      {label:'2–4 times a month', value:2},{label:'2–3 times a week', value:3},
      {label:'4+ times a week', value:4}]},
    { q:'2. How many drinks containing alcohol do you have on a typical day when you are drinking?', opts:[
      {label:'1 or 2', value:0},{label:'3 or 4', value:1},{label:'5 or 6', value:2},
      {label:'7 to 9', value:3},{label:'10 or more', value:4}]},
    { q:'3. How often do you have six or more drinks on one occasion?', opts:[
      {label:'Never', value:0},{label:'Less than monthly', value:1},
      {label:'Monthly', value:2},{label:'Weekly', value:3},{label:'Daily or almost daily', value:4}]},
    { q:'4. How often during the last year have you found that you were not able to stop drinking once you had started?', opts:[
      {label:'Never', value:0},{label:'Less than monthly', value:1},
      {label:'Monthly', value:2},{label:'Weekly', value:3},{label:'Daily or almost daily', value:4}]},
    { q:'5. How often during the last year have you failed to do what was normally expected from you because of drinking?', opts:[
      {label:'Never', value:0},{label:'Less than monthly', value:1},
      {label:'Monthly', value:2},{label:'Weekly', value:3},{label:'Daily or almost daily', value:4}]},
    { q:'6. How often during the last year have you needed a first drink in the morning to get yourself going after a heavy drinking session?', opts:[
      {label:'Never', value:0},{label:'Less than monthly', value:1},
      {label:'Monthly', value:2},{label:'Weekly', value:3},{label:'Daily or almost daily', value:4}]},
    { q:'7. How often during the last year have you had a feeling of guilt or remorse after drinking?', opts:[
      {label:'Never', value:0},{label:'Less than monthly', value:1},
      {label:'Monthly', value:2},{label:'Weekly', value:3},{label:'Daily or almost daily', value:4}]},
    { q:'8. How often during the last year have you been unable to remember what happened the night before because you had been drinking?', opts:[
      {label:'Never', value:0},{label:'Less than monthly', value:1},
      {label:'Monthly', value:2},{label:'Weekly', value:3},{label:'Daily or almost daily', value:4}]},
    { q:'9. Have you or someone else been injured as a result of your drinking?', opts:[
      {label:'No', value:0},{label:'Yes, but not in the last year', value:2},{label:'Yes, during the last year', value:4}]},
    { q:'10. Has a relative, friend, doctor, or other health worker been concerned about your drinking or suggested you cut down?', opts:[
      {label:'No', value:0},{label:'Yes, but not in the last year', value:2},{label:'Yes, during the last year', value:4}]},
  ],
  interpret(score) {
    if (score <= 7)  return { tier:'low', pill:'ok',     text:'Low-risk drinking',    notes:['Brief education; rescreen.'] };
    if (score <= 15) return { tier:'mod', pill:'warn',   text:'Hazardous / harmful (Zone II)',
                              notes:['Brief intervention.', 'Consider AUDIT-C for ongoing monitoring.'] };
    if (score <= 19) return { tier:'high',pill:'danger', text:'Likely dependence (Zone III)',
                              notes:['Brief intervention + continued monitoring; refer for assessment.'] };
    return                    { tier:'very-high', pill:'danger', text:'Severe dependence (Zone IV)',
                              notes:['Refer to specialist treatment; consider MAT (naltrexone / acamprosate).'] };
  }
},

/* ---------- AUDIT-C ---------- */
AUDITC: {
  id:'AUDITC', name:'AUDIT-C', full:'Brief 3-item alcohol screen',
  category:'screening', cite: CITE.AUDITC,
  intro:'Three first items of AUDIT. Sensitive for hazardous use and AUD. Cutoff ≥4 men / ≥3 women.',
  items: [
    { q:'1. How often do you have a drink containing alcohol?', opts:[
      {label:'Never', value:0},{label:'Monthly or less', value:1},
      {label:'2–4 times a month', value:2},{label:'2–3 times a week', value:3},
      {label:'4+ times a week', value:4}]},
    { q:'2. How many drinks containing alcohol do you have on a typical day when drinking?', opts:[
      {label:'1 or 2', value:0},{label:'3 or 4', value:1},{label:'5 or 6', value:2},
      {label:'7 to 9', value:3},{label:'10 or more', value:4}]},
    { q:'3. How often do you have six or more drinks on one occasion?', opts:[
      {label:'Never', value:0},{label:'Less than monthly', value:1},
      {label:'Monthly', value:2},{label:'Weekly', value:3},{label:'Daily or almost daily', value:4}]},
  ],
  interpret(score) {
    if (score >= 4)  return { tier:'high', pill:'danger', text:'Positive screen (≥4)',
                              notes:['Sensitive for AUD; pursue AUDIT-10 or DSM-5 criteria.','Consider PAWSS if hospitalized.'] };
    return                    { tier:'low', pill:'ok', text:'Negative screen (<4)',
                              notes:['Re-screen periodically; lower threshold (≥3) for women.'] };
  }
},

/* ---------- CAGE ---------- */
CAGE: {
  id:'CAGE', name:'CAGE', full:'Rapid 4-item dependence screen',
  category:'screening', cite: CITE.CAGE,
  intro:'Lifetime screen. Cutoff ≥2 clinically significant. Less sensitive than AUDIT for hazardous (not dependent) use.',
  items: [
    { q:'C — Have you ever felt you should Cut down on your drinking?', opts:[{label:'No', value:0},{label:'Yes', value:1}] },
    { q:'A — Have people Annoyed you by criticizing your drinking?', opts:[{label:'No', value:0},{label:'Yes', value:1}] },
    { q:'G — Have you ever felt bad or Guilty about your drinking?', opts:[{label:'No', value:0},{label:'Yes', value:1}] },
    { q:'E — Have you ever had a drink first thing in the morning to steady your nerves or get rid of a hangover (Eye-opener)?', opts:[{label:'No', value:0},{label:'Yes', value:1}] },
  ],
  interpret(score) {
    if (score >= 2) return { tier:'high', pill:'danger', text:'Positive (≥2)',
                             notes:['Further evaluation with DSM-5 AUD criteria.','Consider treatment referral.'] };
    return                   { tier:'low', pill:'ok', text:'Negative (<2)',
                             notes:['Does not rule out hazardous use; consider AUDIT-C if concern persists.'] };
  }
},

/* ---------- DSM-5 AUD ---------- */
DSM5: {
  id:'DSM5', name:'DSM-5 AUD', full:'DSM-5 Alcohol Use Disorder criteria (past 12 months)',
  category:'screening', cite: CITE.DSM5,
  intro:'Diagnostic criteria, not a screen. 2–3 mild, 4–5 moderate, ≥6 severe.',
  items: [
    {q:'1. Drank more or longer than intended', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'2. Persistent desire or unsuccessful efforts to cut down or control use', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'3. A great deal of time spent obtaining, using, or recovering from alcohol', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'4. Craving — strong desire or urge to use', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'5. Recurrent use resulting in failure to fulfill major role obligations', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'6. Continued use despite recurrent social/interpersonal problems', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'7. Important social, occupational, or recreational activities given up', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'8. Recurrent use in physically hazardous situations', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'9. Continued use despite physical or psychological problem caused/worsened by alcohol', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'10. Tolerance (need for markedly increased amounts or diminished effect)', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'11. Withdrawal (characteristic syndrome, or alcohol/benzo used to relieve/avoid)', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
  ],
  interpret(score) {
    if (score >= 6) return { tier:'severe',   pill:'danger', text:'Severe AUD (≥6)',
                             notes:['Pharmacotherapy strongly indicated.','Likely benefit from intensive outpatient or residential level of care.'] };
    if (score >= 4) return { tier:'moderate', pill:'warn',   text:'Moderate AUD (4–5)',
                             notes:['Offer pharmacotherapy (naltrexone or acamprosate).','Counseling / mutual support.'] };
    if (score >= 2) return { tier:'mild',     pill:'warn',   text:'Mild AUD (2–3)',
                             notes:['Offer brief intervention and consider pharmacotherapy.'] };
    return                   { tier:'none',     pill:'ok',     text:'No DSM-5 AUD',
                             notes:['Screen periodically; revisit if circumstances change.'] };
  }
},

/* ---------- PAWSS ---------- */
PAWSS: {
  id:'PAWSS', name:'PAWSS', full:'Prediction of Alcohol Withdrawal Severity Scale',
  category:'screening', cite: CITE.PAWSS,
  intro:'Predicts risk of moderate–severe withdrawal in hospitalized patients. Threshold ≥4 = high risk. Skip if no alcohol in last 30 days AND BAL = 0.',
  items: [
    {q:'Have you consumed alcohol in the last 30 days OR BAL > 0 on admission?', opts:[{label:'No', value:0},{label:'Yes', value:1}], helper:'Threshold item — if "No", PAWSS is 0 and further items are not applicable.'},
    {q:'Previous episodes of alcohol withdrawal (any severity)?', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'Previous alcohol withdrawal seizures?', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'Previous delirium tremens?', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'Previous alcohol rehab treatment (any setting)?', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'History of blackouts?', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'Combined alcohol with sedatives/benzodiazepines/barbiturates in last 90 days?', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'Combined alcohol with other recreational drugs in last 90 days?', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'BAL on presentation ≥ 200 mg/dL?', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
    {q:'Evidence of autonomic hyperactivity (HR>120, tremor, sweat, agitation, N/V)?', opts:[{label:'No', value:0},{label:'Yes', value:1}]},
  ],
  interpret(score) {
    if (score >= 4) return { tier:'high', pill:'danger', text:'HIGH RISK of severe withdrawal (≥4)',
                             notes:['Initiate prophylaxis (front-load benzodiazepine or phenobarbital protocol).',
                                    'Plan for higher-acuity monitoring (step-down/ICU).',
                                    'Order frequent CIWA-Ar or GMAWS; CAM-ICU if confused.'] };
    return                    { tier:'low',  pill:'ok',     text:'Lower risk (<4)',
                             notes:['Standard symptom-triggered monitoring on floor is reasonable.','Reassess if clinical picture changes.'] };
  }
},

/* ---------- CIWA-Ar ---------- */
CIWA: {
  id:'CIWA', name:'CIWA-Ar', full:'Clinical Institute Withdrawal Assessment for Alcohol, Revised',
  category:'active', cite: CITE.CIWA,
  intro:'10 items. Requires cooperative, verbal patient. Range 0–67. Drives symptom-triggered benzodiazepine dosing.',
  items: [
    { q:'1. Nausea / vomiting', helper:'"Do you feel sick to your stomach? Have you vomited?"', type:'row',
      opts: [
        {value:0, label:'0', lbl:'no nausea/vomit'},
        {value:1, label:'1', lbl:'mild nausea, no vomit'},
        {value:2, label:'2'}, {value:3, label:'3'},
        {value:4, label:'4', lbl:'intermittent nausea + dry heaves'},
        {value:5, label:'5'}, {value:6, label:'6'},
        {value:7, label:'7', lbl:'constant N/V + dry heaves + vomiting'} ] },
    { q:'2. Tremor', helper:'Arms extended, fingers spread.', type:'row',
      opts: [
        {value:0, label:'0', lbl:'none'},
        {value:1, label:'1', lbl:'not visible but felt fingertip-to-fingertip'},
        {value:2, label:'2'},{value:3, label:'3'},
        {value:4, label:'4', lbl:'moderate, with arms extended'},
        {value:5, label:'5'},{value:6, label:'6'},
        {value:7, label:'7', lbl:'severe, even with arms not extended'} ] },
    { q:'3. Paroxysmal sweats', type:'row',
      opts: [
        {value:0, label:'0', lbl:'no sweat'},
        {value:1, label:'1', lbl:'barely perceptible / moist palms'},
        {value:2, label:'2'},{value:3, label:'3'},
        {value:4, label:'4', lbl:'beads of sweat on forehead'},
        {value:5, label:'5'},{value:6, label:'6'},
        {value:7, label:'7', lbl:'drenching sweats'} ] },
    { q:'4. Anxiety', helper:'"Do you feel nervous?"', type:'row',
      opts: [
        {value:0, label:'0', lbl:'no anxiety, at ease'},
        {value:1, label:'1', lbl:'mildly anxious'},
        {value:2, label:'2'},{value:3, label:'3'},
        {value:4, label:'4', lbl:'moderately anxious / guarded'},
        {value:5, label:'5'},{value:6, label:'6'},
        {value:7, label:'7', lbl:'acute panic state'} ] },
    { q:'5. Agitation', type:'row',
      opts: [
        {value:0, label:'0', lbl:'normal activity'},
        {value:1, label:'1', lbl:'somewhat more than normal'},
        {value:2, label:'2'},{value:3, label:'3'},
        {value:4, label:'4', lbl:'moderately fidgety / restless'},
        {value:5, label:'5'},{value:6, label:'6'},
        {value:7, label:'7', lbl:'paces back & forth or thrashes'} ] },
    { q:'6. Tactile disturbances', helper:'"Itching, pins-and-needles, burning, numbness, bugs on/under skin?"', type:'row',
      opts: [
        {value:0, label:'0', lbl:'none'},
        {value:1, label:'1', lbl:'very mild itch/pins-needles/burn/numb'},
        {value:2, label:'2', lbl:'mild'},
        {value:3, label:'3', lbl:'moderate'},
        {value:4, label:'4', lbl:'moderately severe hallucinations'},
        {value:5, label:'5', lbl:'severe hallucinations'},
        {value:6, label:'6', lbl:'extremely severe hallucinations'},
        {value:7, label:'7', lbl:'continuous hallucinations'} ] },
    { q:'7. Auditory disturbances', helper:'"Are you more aware of sounds? Anything frightening you?"', type:'row',
      opts: [
        {value:0, label:'0', lbl:'not present'},
        {value:1, label:'1', lbl:'very mild harshness / startle'},
        {value:2, label:'2', lbl:'mild'},
        {value:3, label:'3', lbl:'moderate'},
        {value:4, label:'4', lbl:'moderately severe hallucinations'},
        {value:5, label:'5', lbl:'severe hallucinations'},
        {value:6, label:'6', lbl:'extremely severe hallucinations'},
        {value:7, label:'7', lbl:'continuous hallucinations'} ] },
    { q:'8. Visual disturbances', helper:'"Does the light look too bright? Are you seeing anything that\'s disturbing you?"', type:'row',
      opts: [
        {value:0, label:'0', lbl:'not present'},
        {value:1, label:'1', lbl:'very mild sensitivity'},
        {value:2, label:'2', lbl:'mild'},
        {value:3, label:'3', lbl:'moderate'},
        {value:4, label:'4', lbl:'moderately severe hallucinations'},
        {value:5, label:'5', lbl:'severe hallucinations'},
        {value:6, label:'6', lbl:'extremely severe hallucinations'},
        {value:7, label:'7', lbl:'continuous hallucinations'} ] },
    { q:'9. Headache / fullness in head', helper:'Do NOT rate dizziness or light-headedness here.', type:'row',
      opts: [
        {value:0, label:'0', lbl:'not present'},
        {value:1, label:'1', lbl:'very mild'},
        {value:2, label:'2', lbl:'mild'},
        {value:3, label:'3', lbl:'moderate'},
        {value:4, label:'4', lbl:'moderately severe'},
        {value:5, label:'5', lbl:'severe'},
        {value:6, label:'6', lbl:'very severe'},
        {value:7, label:'7', lbl:'extremely severe'} ] },
    { q:'10. Orientation and clouding of sensorium', helper:'"What day is this? Where are you? Who am I?"', type:'row5',
      opts: [
        {value:0, label:'0', lbl:'oriented and can do serial additions'},
        {value:1, label:'1', lbl:'cannot do serial additions or unsure of date'},
        {value:2, label:'2', lbl:'disoriented to date by ≤2 days'},
        {value:3, label:'3', lbl:'disoriented to date by >2 days'},
        {value:4, label:'4', lbl:'disoriented to place / person'} ] }
  ],
  interpret(score) {
    if (score >= 20) return { tier:'very-severe', pill:'danger', text:'Very severe (≥20)',
                              notes:['Consider ICU / phenobarbital pathway.','Frequent reassessment (q1h or continuous).','Airway risk if escalating.'] };
    if (score >= 16) return { tier:'severe', pill:'danger', text:'Severe (16–19)',
                              notes:['Higher-acuity bed; consider front-loaded benzodiazepine or phenobarbital adjunct.'] };
    if (score >= 10) return { tier:'moderate', pill:'warn', text:'Moderate (10–15)',
                              notes:['Symptom-triggered benzodiazepine (typically lorazepam 2 mg or diazepam 10 mg).','Reassess q1–2h until <8.'] };
    if (score >= 8)  return { tier:'mild-mod', pill:'warn', text:'Mild–moderate (8–9)',
                              notes:['Single dose of benzodiazepine (e.g., lorazepam 1 mg) per protocol.','Reassess q1–2h.'] };
    return                    { tier:'mild', pill:'ok', text:'Mild (<8)',
                              notes:['Supportive care; routine reassessment q4h.','Continue thiamine, fluids, electrolytes.'] };
  }
},

/* ---------- GMAWS ---------- */
GMAWS: {
  id:'GMAWS', name:'GMAWS', full:'Glasgow Modified Alcohol Withdrawal Scale',
  category:'active', cite: CITE.GMAWS,
  intro:'5 items, each 0–2 (max 10). Validated alternative to CIWA, simpler to administer.',
  items: [
    { q:'Tremor', opts:[
      {value:0, label:'0 — none'},{value:1, label:'1 — on movement'},{value:2, label:'2 — at rest'}]},
    { q:'Sweating', opts:[
      {value:0, label:'0 — none'},{value:1, label:'1 — moist'},{value:2, label:'2 — drenching'}]},
    { q:'Hallucinations', opts:[
      {value:0, label:'0 — none'},{value:1, label:'1 — suggestible / disturbed perception'},{value:2, label:'2 — present (auditory/visual/tactile)'}]},
    { q:'Orientation', opts:[
      {value:0, label:'0 — oriented'},{value:1, label:'1 — uncertain'},{value:2, label:'2 — no concept of time/place'}]},
    { q:'Agitation', opts:[
      {value:0, label:'0 — settled'},{value:1, label:'1 — anxious / restless'},{value:2, label:'2 — distressed / pacing'}]},
  ],
  interpret(score) {
    if (score >= 7) return { tier:'severe',  pill:'danger', text:'Severe withdrawal (≥7)',
                             notes:['Consider higher acuity / phenobarbital pathway per local protocol.'] };
    if (score >= 4) return { tier:'moderate',pill:'warn',  text:'Moderate withdrawal (4–6)',
                             notes:['Symptom-triggered benzodiazepine; reassess q1–2h.'] };
    if (score >= 1) return { tier:'mild',    pill:'warn',  text:'Mild withdrawal (1–3)',
                             notes:['Supportive care; rescore in 1–2h.'] };
    return                   { tier:'none',    pill:'ok',    text:'No withdrawal (0)',
                             notes:['Continue routine monitoring.'] };
  }
},

/* ---------- MINDS ---------- */
MINDS: {
  id:'MINDS', name:'MINDS', full:'Minnesota Detoxification Scale',
  category:'active', cite: CITE.MINDS,
  intro:'Objective scale for severe / non-verbal / ICU patients. 10 items, max 40. Score ≥20 = severe.',
  items: [
    { q:'1. Pulse (bpm)', opts:[
      {value:0,label:'0 — <90'},{value:1,label:'1 — 90–100'},{value:2,label:'2 — 101–110'},
      {value:3,label:'3 — 111–120'},{value:4,label:'4 — >120'} ]},
    { q:'2. Diastolic BP (mmHg)', opts:[
      {value:0,label:'0 — <95'},{value:1,label:'1 — 95–100'},{value:2,label:'2 — 101–105'},
      {value:3,label:'3 — 106–110'},{value:4,label:'4 — >110'} ]},
    { q:'3. Tremor', opts:[
      {value:0,label:'0 — none'},{value:1,label:'1 — barely elicited'},
      {value:2,label:'2 — visible at rest, fades'},{value:3,label:'3 — moderate at rest'},
      {value:4,label:'4 — severe at rest'} ]},
    { q:'4. Sweat', opts:[
      {value:0,label:'0 — none'},{value:1,label:'1 — palms moist'},
      {value:2,label:'2 — beads on forehead'},{value:3,label:'3 — head/trunk diaphoretic'},
      {value:4,label:'4 — whole body diaphoretic'} ]},
    { q:'5. Hallucinations', opts:[
      {value:0,label:'0 — none'},{value:1,label:'1 — mild auditory/visual/tactile'},
      {value:2,label:'2 — moderate'},{value:3,label:'3 — severe'},
      {value:4,label:'4 — continuous'} ]},
    { q:'6. Agitation', opts:[
      {value:0,label:'0 — none'},{value:1,label:'1 — restless'},
      {value:2,label:'2 — moderately fidgety'},{value:3,label:'3 — requiring restraint'},
      {value:4,label:'4 — combative'} ]},
    { q:'7. Orientation', opts:[
      {value:0,label:'0 — oriented x4'},{value:1,label:'1 — disoriented to time'},
      {value:2,label:'2 — disoriented to place'},{value:3,label:'3 — disoriented to person'},
      {value:4,label:'4 — disoriented to self'} ]},
    { q:'8. Delusions', opts:[
      {value:0,label:'0 — none'},{value:1,label:'1 — fears about fictitious events'},
      {value:2,label:'2 — delusional but reorients'},{value:3,label:'3 — delusional, cannot reorient'},
      {value:4,label:'4 — fixed delusions / paranoid'} ]},
    { q:'9. Seizures', opts:[
      {value:0,label:'0 — none ever'},{value:1,label:'1 — history of WD seizures'},
      {value:2,label:'2 — seizure in last 24 h'},{value:3,label:'3 — seizure this admission'},
      {value:4,label:'4 — current status epilepticus'} ]},
    { q:'10. Hot / cold flashes', opts:[
      {value:0,label:'0 — none'},{value:1,label:'1 — mild'},
      {value:2,label:'2 — moderate'},{value:3,label:'3 — severe'},
      {value:4,label:'4 — continuous severe'} ]},
  ],
  interpret(score) {
    if (score >= 20) return { tier:'very-severe', pill:'danger', text:'Severe withdrawal (≥20)',
                              notes:['ICU care; consider phenobarbital protocol +/− dexmedetomidine.'] };
    if (score >= 10) return { tier:'moderate',    pill:'warn', text:'Moderate withdrawal (10–19)',
                              notes:['Symptom-triggered benzodiazepines q1h; escalate if persists.'] };
    if (score >= 5)  return { tier:'mild',        pill:'warn', text:'Mild withdrawal (5–9)',
                              notes:['Treat per protocol; reassess q2h.'] };
    return                    { tier:'none',        pill:'ok',   text:'Minimal / none (<5)',
                              notes:['Continue routine monitoring.'] };
  }
},

/* ---------- RASS ---------- */
RASS: {
  id:'RASS', name:'RASS', full:'Richmond Agitation–Sedation Scale',
  category:'icu', cite: CITE.RASS,
  intro:'Single observation. Target typically 0 to −1 (non-intubated) or −1 to −3 (intubated).',
  items: [
    { q:'Choose the description that best fits the patient right now', type:'pickone',
      opts:[
        {value:4,  label:'+4 Combative — overtly combative or violent; immediate danger'},
        {value:3,  label:'+3 Very agitated — pulls/removes tubes or catheters; aggressive'},
        {value:2,  label:'+2 Agitated — frequent non-purposeful movement; ventilator dyssynchrony'},
        {value:1,  label:'+1 Restless — anxious or apprehensive but not aggressive'},
        {value:0,  label:' 0 Alert and calm'},
        {value:-1, label:'−1 Drowsy — not fully alert, sustained awakening to voice (>10s)'},
        {value:-2, label:'−2 Light sedation — brief awakening to voice (<10s)'},
        {value:-3, label:'−3 Moderate sedation — movement or eye-opening to voice, no eye contact'},
        {value:-4, label:'−4 Deep sedation — no response to voice, movement to physical stimulation'},
        {value:-5, label:'−5 Unarousable — no response to voice or physical stimulation'} ]}
  ],
  singleItem: true,
  interpret(score) {
    if (score >= 2)  return { tier:'agitated',   pill:'danger', text:'Significant agitation (+2 to +4)',
                              notes:['Address withdrawal severity (CIWA/MINDS) and pain/delirium.','Consider escalation: front-load benzo or phenobarbital; safety.'] };
    if (score === 1) return { tier:'restless',   pill:'warn',   text:'Restless (+1)',
                              notes:['Reassess withdrawal score and modifiable causes (pain, full bladder, drug effects).'] };
    if (score === 0) return { tier:'target',     pill:'ok',     text:'Alert and calm (0) — usual target',
                              notes:['Maintain; reassess q4h or with change.'] };
    if (score >= -3) return { tier:'lightSed',   pill:'info',   text:'Light to moderate sedation (−1 to −3)',
                              notes:['Often acceptable target if intubated; verify patient can be roused for assessment.'] };
    return                     { tier:'deepSed',    pill:'warn',   text:'Deep sedation / unarousable (−4 to −5)',
                              notes:['Risk of oversedation; consider sedation interruption; rule out new neurologic event.'] };
  }
},

/* ---------- SAS ---------- */
SAS: {
  id:'SAS', name:'SAS', full:'Riker Sedation–Agitation Scale',
  category:'icu', cite: CITE.SAS,
  intro:'Single observation alternative to RASS.',
  items: [
    { q:'Choose the description that best fits right now', type:'pickone',
      opts:[
        {value:7, label:'7 Dangerous agitation — pulling at ET tube, climbing out, striking'},
        {value:6, label:'6 Very agitated — bites tube, requires restraint and frequent reminders'},
        {value:5, label:'5 Agitated — anxious or mildly agitated, attempts to sit up, calms with reminder'},
        {value:4, label:'4 Calm and cooperative — calm, easily roused, follows commands'},
        {value:3, label:'3 Sedated — difficult to rouse, awakens to voice/shake, drifts back'},
        {value:2, label:'2 Very sedated — rouses to physical stimuli, does not follow commands'},
        {value:1, label:'1 Unarousable — minimal or no response to noxious stimuli'} ]}
  ],
  singleItem: true,
  interpret(score) {
    if (score >= 5) return { tier:'agitated', pill:'danger', text:'Agitated (≥5)',
                             notes:['Reassess withdrawal severity; escalate per protocol.'] };
    if (score === 4) return { tier:'target', pill:'ok', text:'Calm & cooperative (4)', notes:['Maintain.'] };
    if (score === 3) return { tier:'lightSed', pill:'info', text:'Sedated (3)', notes:['Often acceptable if intubated.'] };
    return                    { tier:'deepSed', pill:'warn', text:'Very sedated / unarousable (≤2)',
                             notes:['Consider sedation lightening; rule out other causes.'] };
  }
},

/* ---------- CAM-ICU ---------- */
CAMICU: {
  id:'CAMICU', name:'CAM-ICU', full:'Confusion Assessment Method for ICU',
  category:'icu', cite: CITE.CAMICU,
  intro:'Delirium screen in ICU/non-verbal patients. Positive: Feature 1 AND 2 AND (3 OR 4). Requires RASS ≥ −3.',
  items: [
    { q:'Feature 1 — Acute change OR fluctuating course of mental status (vs baseline) in last 24h?', opts:[
      {value:0,label:'Absent'},{value:1,label:'Present'}]},
    { q:'Feature 2 — Inattention (≥2 errors on Letters or Pictures test, e.g., "SAVEAHAART")', opts:[
      {value:0,label:'Absent (0–1 errors)'},{value:1,label:'Present (≥2 errors)'}]},
    { q:'Feature 3 — Altered level of consciousness (RASS ≠ 0 currently)', opts:[
      {value:0,label:'No (RASS = 0)'},{value:1,label:'Yes (RASS ≠ 0)'}]},
    { q:'Feature 4 — Disorganized thinking (yes/no questions + commands, ≥2 errors)', opts:[
      {value:0,label:'Absent'},{value:1,label:'Present'}]},
  ],
  customScore: (items) => {
    const [f1, f2, f3, f4] = items.map(x => x === null ? 0 : x);
    const positive = f1 && f2 && (f3 || f4);
    return { score: positive ? 1 : 0, raw: items };
  },
  interpret(score) {
    if (score === 1) return { tier:'positive', pill:'danger', text:'CAM-ICU POSITIVE — Delirium',
                              notes:['Treat reversible causes (pain, hypoxia, infection, electrolytes, drugs).','Re-orient frequently; family presence; preserve sleep–wake cycle.','Avoid deliriogenic drugs if possible; avoid routine antipsychotics — use sparingly for distress/safety.'] };
    return                     { tier:'negative', pill:'ok',     text:'CAM-ICU negative',
                              notes:['Continue routine monitoring; reassess each shift and with any change.'] };
  }
},

/* ---------- GCS ---------- */
GCS: {
  id:'GCS', name:'GCS', full:'Glasgow Coma Scale',
  category:'icu', cite: CITE.GCS,
  intro:'Range 3–15. Severe ≤8, moderate 9–12, mild 13–15. Useful adjunct in encephalopathic / intoxicated patients.',
  items: [
    { q:'Eye opening (E)', opts:[
      {value:4,label:'4 — spontaneous'},{value:3,label:'3 — to sound'},
      {value:2,label:'2 — to pressure'},{value:1,label:'1 — none / not testable'} ]},
    { q:'Verbal response (V)', opts:[
      {value:5,label:'5 — oriented'},{value:4,label:'4 — confused'},
      {value:3,label:'3 — words (inappropriate)'},{value:2,label:'2 — sounds'},{value:1,label:'1 — none'} ]},
    { q:'Motor response (M)', opts:[
      {value:6,label:'6 — obeys commands'},{value:5,label:'5 — localizing'},
      {value:4,label:'4 — normal flexion (withdraws)'},{value:3,label:'3 — abnormal flexion'},
      {value:2,label:'2 — extension'},{value:1,label:'1 — none'} ]},
  ],
  interpret(score) {
    if (score <= 8)  return { tier:'severe',  pill:'danger', text:'Severe coma (≤8)', notes:['Strongly consider definitive airway.'] };
    if (score <= 12) return { tier:'moderate',pill:'warn',   text:'Moderate impairment (9–12)', notes:['Monitor closely; reassess frequently.'] };
    return                    { tier:'mild',    pill:'ok',     text:'Mild impairment (13–15)', notes:[] };
  }
},

};

/* ============================================================
   RECOMMENDATION ENGINE
   "Next best" score / action with reasoning.
   ============================================================ */
function recommend() {
  const r = S.results;
  const setting = S.setting;
  const coop = S.cooperative;

  // 1) Need to establish setting / cooperation first
  if (!setting) {
    return { id:'CONTEXT', title:'Set patient context first',
      why:'Choose setting (outpatient/floor/ICU) and cooperation so the tool can surface the right scores.',
      action:{ label:'Set context', run: openContextEditor } };
  }

  // 2) Outpatient / ED longitudinal: screen
  if (setting === 'outpt') {
    if (!r.AUDITC && !r.AUDIT && !r.CAGE) {
      return { id:'AUDITC', title:'AUDIT-C — 1-minute screen',
        why:'No screening completed yet. AUDIT-C is the highest-yield, fastest hazardous-use screen.',
        action:{ label:'Start AUDIT-C', run:()=> openScore('AUDITC') },
        alt:{ label:'AUDIT (full)', run:()=> openScore('AUDIT') } };
    }
    const positive = (r.AUDITC && r.AUDITC.score >= 3) || (r.AUDIT && r.AUDIT.score >= 8) || (r.CAGE && r.CAGE.score >= 2);
    if (positive && !r.DSM5) {
      return { id:'DSM5', title:'DSM-5 AUD criteria',
        why:'Positive screen — confirm diagnosis with DSM-5 criteria to guide pharmacotherapy & level of care.',
        action:{ label:'Open DSM-5', run:()=> openScore('DSM5') } };
    }
    if (r.DSM5 && r.DSM5.score >= 2) {
      return { id:'MAT', title:'Offer medication for AUD',
        why:'DSM-5 AUD diagnosed. First-line: naltrexone or acamprosate. Counseling + mutual support.',
        action:{ label:'See MAT options', run:()=> showView('meds') } };
    }
    return { id:'DONE', title:'Re-screen periodically',
      why:'No current evidence of harmful use; document and re-screen at routine intervals.',
      action:{ label:'Build note', run:()=> showView('note') } };
  }

  // 3) Hospitalized: PAWSS first to predict severe WD
  if (setting === 'floor' || setting === 'icu') {
    if (!r.PAWSS) {
      return { id:'PAWSS', title:'PAWSS — predict severe withdrawal',
        why:'Hospitalized patient; run PAWSS first to risk-stratify before withdrawal develops.',
        action:{ label:'Start PAWSS', run:()=> openScore('PAWSS') } };
    }

    // After PAWSS — decide active withdrawal scoring
    if (coop === null) {
      return { id:'COOP', title:'Specify whether patient is cooperative / verbal',
        why:'Determines whether CIWA-Ar (cooperative) or MINDS (ICU/non-verbal) is appropriate.',
        action:{ label:'Set cooperation', run: openContextEditor } };
    }

    const lastActive = mostRecent(['CIWA','GMAWS','MINDS']);
    if (!lastActive) {
      if (coop) {
        return { id:'CIWA', title:'CIWA-Ar — active withdrawal assessment',
          why:`Cooperative, verbal patient — CIWA-Ar drives symptom-triggered dosing.${ r.PAWSS && r.PAWSS.score>=4 ? ' PAWSS is high-risk, so reassess frequently.' : '' }`,
          action:{ label:'Open CIWA-Ar', run:()=> openScore('CIWA') },
          alt:{ label:'Use GMAWS instead', run:()=> openScore('GMAWS') } };
      } else {
        return { id:'MINDS', title:'MINDS — objective ICU withdrawal scale',
          why:'Non-cooperative / intubated / delirious patient — CIWA is invalid; use objective MINDS.',
          action:{ label:'Open MINDS', run:()=> openScore('MINDS') } };
      }
    }

    // Have an active-withdrawal score — what's next?
    const tier = lastActive.tier;
    if (['very-severe','severe'].includes(tier)) {
      if (!recent('RASS')) {
        return { id:'RASS', title:'RASS — agitation depth',
          why:'Severe withdrawal — track sedation/agitation alongside escalating therapy.',
          action:{ label:'Open RASS', run:()=> openScore('RASS') },
          alt:{ label:'See ICU meds', run:()=> showView('meds') } };
      }
      if (!recent('CAMICU') && setting === 'icu') {
        return { id:'CAMICU', title:'CAM-ICU — delirium check',
          why:'Severe withdrawal with ICU acuity — confirm/screen for delirium to guide management.',
          action:{ label:'Open CAM-ICU', run:()=> openScore('CAMICU') } };
      }
      return { id:'MEDS-ICU', title:'Escalate / phenobarbital pathway',
        why:'Severe withdrawal. Consider phenobarbital protocol; ICU bed; airway readiness.',
        action:{ label:'See phenobarb dosing', run:()=> showView('meds') } };
    }

    if (['moderate','mild-mod'].includes(tier)) {
      return { id:'REASSESS', title:'Symptom-triggered benzo + reassess in 1–2 h',
        why:`Last ${lastActive.name} ${lastActive.score} (${lastActive.tierText || tier}). Treat per protocol and rescore.`,
        action:{ label:`Repeat ${lastActive.name}`, run:()=> openScore(lastActive.id) },
        alt:{ label:'See dosing', run:()=> showView('meds') } };
    }

    if (tier === 'mild' || tier === 'none') {
      if (r.PAWSS && r.PAWSS.score >= 4) {
        return { id:'REASSESS-PROPHY', title:'Continue prophylactic monitoring',
          why:'Low current score but PAWSS high-risk — keep frequent reassessment for ≥72h after last drink.',
          action:{ label:`Repeat ${lastActive.name}`, run:()=> openScore(lastActive.id) } };
      }
      return { id:'DISCH-PREP', title:'Plan AUD pharmacotherapy + discharge',
        why:'Withdrawal stable. Pivot toward long-term management: MAT, counseling, follow-up.',
        action:{ label:'See MAT options', run:()=> showView('meds') },
        alt:{ label:'Build chart note', run:()=> showView('note') } };
    }
  }

  return { id:'GENERIC', title:'Pick a score',
    why:'No specific recommendation right now — choose the score that matches the current clinical question.',
    action:{ label:'Open Don\'t-forget', run:()=> showView('forget') } };
}

function recent(id) {
  const r = S.results[id]; if (!r) return false;
  // "recent" = within the last 4 hours
  return (Date.now() - r.time) < 4*60*60*1000;
}
function mostRecent(ids) {
  let best = null;
  for (const id of ids) {
    const r = S.results[id];
    if (r && (!best || r.time > best.time)) best = Object.assign({ id }, r);
  }
  return best;
}

/* ============================================================
   MODAL — score entry
   ============================================================ */
let currentScore = null;
let currentValues = []; // per-item picks

function openScore(id) {
  const def = SCORES[id]; if (!def) return;
  currentScore = def;
  currentValues = new Array(def.items.length).fill(null);

  $('#modal-title').textContent = def.full;
  const body = $('#modal-body');
  body.innerHTML = '';

  body.appendChild(el('div', { class:'muted tiny', style:'margin-bottom:8px' }, def.intro));

  def.items.forEach((it, idx) => {
    body.appendChild(renderItem(def, it, idx));
  });

  // citation
  body.appendChild(el('div', { class:'interp' }, [
    el('div', { class:'cite' }, [
      'Reference: ',
      el('a', { href: def.cite.url, target:'_blank', rel:'noopener' }, def.cite.text)
    ])
  ]));

  // foot — live score + save
  renderFoot();
  $('#modal-back').classList.add('open');
}

function renderItem(def, item, idx) {
  const wrapper = el('div', { class:'item' });
  wrapper.appendChild(el('div', { class:'q' }, [
    item.q,
    item.helper ? el('div', {}, el('small', {}, item.helper)) : null
  ]));

  const type = item.type || 'pickone'; // pickone | row | row5
  const opts = el('div', { class:'opts ' + (type==='row'?'row':type==='row5'?'row5':'') });

  item.opts.forEach((op) => {
    const id = `it-${idx}-${op.value}`;
    const label = el('label', { for: id });
    label.appendChild(el('input', { type:'radio', name:`item-${idx}`, id, value:op.value,
      onchange: () => { currentValues[idx] = op.value; renderFoot(); } }));
    if (type === 'row' || type === 'row5') {
      label.appendChild(el('span', {}, op.label));
      if (op.lbl) label.appendChild(el('span', { class:'lbl' }, op.lbl));
    } else {
      label.appendChild(el('span', {}, op.label));
      label.appendChild(el('span', { class:'pts' }, '+' + Math.abs(op.value)));
    }
    opts.appendChild(label);
  });
  wrapper.appendChild(opts);

  // helper text for row-style (small list of bottom labels)
  if ((type === 'row' || type === 'row5')) {
    const used = item.opts.filter(o => o.lbl);
    if (used.length) {
      const lines = used.map(o => `${o.value} — ${o.lbl}`).join(' · ');
      wrapper.appendChild(el('div', { class:'helper' }, lines));
    }
  }
  return wrapper;
}

function renderFoot() {
  const def = currentScore;
  const foot = $('#modal-foot');
  foot.innerHTML = '';

  let score, interp;
  if (def.customScore) {
    const cs = def.customScore(currentValues);
    score = cs.score;
  } else {
    score = currentValues.reduce((a,b)=> a + (b||0), 0);
  }
  const allFilled = currentValues.every(v => v !== null);
  interp = def.interpret(score);

  const out = el('div', { class:'score-out' }, [
    el('div', {}, [
      el('span', { class:'big' }, allFilled ? String(score) : '—'),
      ' ',
      el('span', { class:'muted tiny' }, allFilled ? (interp.text || '') : 'complete all items')
    ])
  ]);
  foot.appendChild(out);

  foot.appendChild(el('button', { class:'secondary', onclick: closeModal }, 'Cancel'));
  const saveBtn = el('button', { onclick: () => saveCurrentScore(score, interp) }, 'Save');
  if (!allFilled) saveBtn.setAttribute('disabled','true');
  foot.appendChild(saveBtn);
}

function saveCurrentScore(score, interp) {
  const def = currentScore;
  const entry = {
    id: def.id, name: def.name, score, tier: interp.tier, tierText: interp.text,
    pill: interp.pill, notes: interp.notes, time: Date.now(),
    items: currentValues.slice(), cite: def.cite
  };
  S.results[def.id] = entry;
  S.history.unshift(entry);
  saveState();
  closeModal();
  showInterpretation(entry);
  renderAll();
}

function closeModal() {
  $('#modal-back').classList.remove('open');
  currentScore = null;
  currentValues = [];
}

function showInterpretation(entry) {
  $('#modal-title').textContent = `${entry.name}: ${entry.score}`;
  const body = $('#modal-body');
  body.innerHTML = '';
  const card = el('div', { class:'interp' }, [
    el('h4', {}, 'Result'),
    el('div', { class:'row' }, [
      el('div', { class:'pill ' + entry.pill }, entry.tierText),
    ]),
    entry.notes && entry.notes.length ? el('ul', {}, entry.notes.map(n => el('li', {}, n))) : null,
    el('div', { class:'cite' }, [
      'Reference: ',
      el('a', { href: entry.cite.url, target:'_blank', rel:'noopener' }, entry.cite.text)
    ])
  ]);
  body.appendChild(card);

  // contextual next-step from new recommendation
  const next = recommend();
  body.appendChild(el('div', { class:'reco', style:'margin:14px 0 0' }, [
    el('div', { class:'label' }, 'Next best'),
    el('div', { class:'title' }, next.title),
    el('div', { class:'why' }, next.why),
    el('div', { class:'actions' }, [
      next.action ? el('button', { onclick: () => { closeModal(); next.action.run(); } }, next.action.label) : null,
      next.alt ? el('button', { class:'secondary', onclick: () => { closeModal(); next.alt.run(); } }, next.alt.label) : null
    ])
  ]));

  $('#modal-foot').innerHTML = '';
  $('#modal-foot').appendChild(el('div', { class:'score-out muted tiny' }, 'Saved to timeline.'));
  $('#modal-foot').appendChild(el('button', { onclick: closeModal }, 'Done'));
  $('#modal-back').classList.add('open');
}

/* ============================================================
   PATIENT CONTEXT EDITOR (sets setting/cooperation/etc.)
   ============================================================ */
function openContextEditor() {
  $('#modal-title').textContent = 'Patient context';
  const body = $('#modal-body');
  body.innerHTML = '';

  body.appendChild(el('div', { class:'muted tiny', style:'margin-bottom:10px' },
    'These flags drive the "next best" recommendation and dose adjustments.'));

  body.appendChild(fieldRadio('Setting', 'setting', [
    {label:'Outpatient / ED longitudinal', value:'outpt'},
    {label:'Hospitalized — floor', value:'floor'},
    {label:'Hospitalized — ICU', value:'icu'},
  ]));
  body.appendChild(fieldRadio('Patient cooperative / verbal?', 'cooperative', [
    {label:'Yes', value:true},{label:'No / intubated / delirious', value:false}
  ]));
  body.appendChild(fieldRadio('Age band', 'ageBand', [
    {label:'<65 yrs', value:'lt65'},{label:'≥65 yrs', value:'ge65'}
  ]));
  body.appendChild(fieldRadio('Significant liver disease (cirrhosis, hepatitis, INR↑)?', 'liverDisease', [
    {label:'Yes', value:true},{label:'No', value:false}
  ]));
  body.appendChild(fieldRadio('Pregnant?', 'pregnant', [
    {label:'Yes', value:true},{label:'No', value:false}
  ]));
  body.appendChild(fieldRadio('Concurrent opioid use?', 'opioidCoUse', [
    {label:'Yes', value:true},{label:'No', value:false}
  ]));
  body.appendChild(fieldRadio('Concurrent benzo / sedative use?', 'benzoCoUse', [
    {label:'Yes', value:true},{label:'No', value:false}
  ]));

  $('#modal-foot').innerHTML = '';
  $('#modal-foot').appendChild(el('div', { class:'score-out muted tiny' }, 'Changes save automatically.'));
  $('#modal-foot').appendChild(el('button', { onclick: closeModal }, 'Done'));
  $('#modal-back').classList.add('open');
}
function fieldRadio(title, key, opts) {
  const wrap = el('div', { class:'item' });
  wrap.appendChild(el('div', { class:'q' }, title));
  const grp = el('div', { class:'opts' });
  opts.forEach((op, i) => {
    const id = `ctx-${key}-${i}`;
    const label = el('label', { for:id });
    const input = el('input', { type:'radio', name:`ctx-${key}`, id,
      onchange: () => { S[key] = op.value; saveState(); renderAll(); }
    });
    if (S[key] === op.value) input.setAttribute('checked', 'true');
    label.appendChild(input);
    label.appendChild(el('span', {}, op.label));
    grp.appendChild(label);
  });
  wrap.appendChild(grp);
  return wrap;
}

/* ============================================================
   VIEWS
   ============================================================ */
function showView(name) {
  // close any open modal first
  if ($('#modal-back').classList.contains('open')) closeModal();
  ['main','meds','note','forget','history'].forEach(v => {
    $('#view-' + v).hidden = (v !== name);
  });
  $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $('#reco').style.display = (name === 'main') ? '' : 'none';
  $('#context').style.display = (name === 'main') ? '' : 'none';
  if (name === 'meds')    renderMeds();
  if (name === 'note')    renderNote();
  if (name === 'forget')  renderForget();
  if (name === 'history') renderHistory();
}

/* ---------- main tiles ---------- */
function renderTiles() {
  const groups = {
    screening: ['AUDITC','AUDIT','CAGE','DSM5','PAWSS'],
    active:    ['CIWA','GMAWS','MINDS'],
    icu:       ['RASS','SAS','CAMICU','GCS'],
    other:     [] // reserved
  };
  const rec = recommend();
  for (const [grp, ids] of Object.entries(groups)) {
    const host = $('#tiles-' + grp);
    if (!host) continue;
    host.innerHTML = '';
    ids.forEach(id => {
      const def = SCORES[id]; if (!def) return;
      const res = S.results[id];
      const recommended = rec.id === id;
      const tile = el('button', { class: 'tile' + (recommended ? ' recommended' : ''),
        onclick: () => openScore(id) }, [
        el('div', { class:'name' }, def.name),
        el('div', { class:'sub' }, def.full),
        res ? el('div', { class:'last' }, `${res.score} · ${fmtTime(res.time)}`) : null
      ]);
      host.appendChild(tile);
    });
  }
  // hide "other" if empty
  $('#block-other').style.display = 'none';
}

/* ---------- context bar ---------- */
function renderContext() {
  const c = $('#context'); c.innerHTML = '';
  const items = [
    ['Setting',  S.setting ? labelFor('setting', S.setting) : 'set',  'setting'],
    ['Coop',     S.cooperative === null ? 'set' : (S.cooperative ? 'yes' : 'no'), 'cooperative'],
    ['Age',      S.ageBand ? (S.ageBand === 'lt65' ? '<65' : '≥65') : 'set', 'ageBand'],
    ['Liver',    S.liverDisease === null ? 'set' : (S.liverDisease ? 'yes' : 'no'), 'liverDisease']
  ];
  items.forEach(([k,v]) => {
    const p = el('div', { class:'ctx-pill' }, [
      el('span', { class:'muted tiny' }, k),
      el('b', {}, String(v))
    ]);
    p.appendChild(el('button', { onclick: openContextEditor }, 'edit'));
    c.appendChild(p);
  });
}
function labelFor(key, value) {
  if (key === 'setting') return { outpt:'outpt/ED', floor:'floor', icu:'ICU' }[value] || value;
  return String(value);
}

/* ---------- recommendation card ---------- */
function renderReco() {
  const host = $('#reco'); host.innerHTML = '';
  const r = recommend();
  const card = el('div', { class:'reco' }, [
    el('div', { class:'label' }, 'Next best'),
    el('div', { class:'title' }, r.title),
    el('div', { class:'why' }, r.why),
    el('div', { class:'actions' }, [
      r.action ? el('button', { onclick: r.action.run }, r.action.label) : null,
      r.alt ? el('button', { class:'secondary', onclick: r.alt.run }, r.alt.label) : null
    ])
  ]);
  host.appendChild(card);
}

/* ============================================================
   MEDS VIEW — ASAM 2020 primary + alternatives
   ============================================================ */
function renderMeds() {
  const root = $('#view-meds'); root.innerHTML = '';

  // ---- Acute withdrawal treatment section ----
  const secAcute = el('section', { class:'block' }, [
    el('h2', {}, 'Acute Withdrawal — Treatment')
  ]);
  secAcute.appendChild(medCard({
    title:'Symptom-triggered benzodiazepine (CIWA-driven)',
    scope:'Floor patient, cooperative, no severe liver disease',
    cite: CITE.ASAM2020,
    rows: [
      ['CIWA 8–10', 'Lorazepam 1 mg PO/IV  ·  or Diazepam 5 mg PO/IV  ·  or Chlordiazepoxide 25–50 mg PO'],
      ['CIWA 10–15','Lorazepam 2 mg PO/IV  ·  Diazepam 10 mg PO/IV  ·  Chlordiazepoxide 50–100 mg PO'],
      ['CIWA 15–20','Lorazepam 2–4 mg PO/IV  ·  Diazepam 10–20 mg PO/IV'],
      ['CIWA >20', 'Lorazepam 4 mg IV  ·  Diazepam 20 mg IV  —  reassess q1h, consider front-loading / phenobarb'],
    ],
    note:'Reassess q1–2h. Hold for somnolence / RR<10. Diazepam preferred (long-acting auto-taper) UNLESS liver disease, elderly, or unstable — then lorazepam.',
    altTitle:'Phenobarbital monotherapy (Rosenson ED protocol)',
    altCite: CITE.ROSENSON,
    altBody:'Single load 10 mg/kg IBW IV in 100 mL NS over 30 min. Or graded boluses 130–260 mg IV q15–30 min. Avoid additional benzodiazepines; monitor RR / RASS.'
  }));
  secAcute.appendChild(medCard({
    title:'Front-loading benzodiazepine (high PAWSS / moderate–severe presentation)',
    scope:'Established or anticipated moderate–severe withdrawal',
    cite: CITE.ASAM2020,
    rows: [
      ['Diazepam', '10–20 mg PO/IV q1–2h until CIWA <8 (or RASS 0); typically 60–80 mg in first 24h'],
      ['Chlordiazepoxide', '50–100 mg PO q1–2h until light sedation; total often 200–400 mg/24h'],
      ['Lorazepam (preferred cirrhosis/elderly)', '2–4 mg PO/IV q15–30 min until controlled'],
    ],
    note:'Front-loading shortens course and reduces escalations.',
    altTitle:'Dexmedetomidine adjunct',
    altCite: CITE.MUELLER,
    altBody:'0.2–1.5 µg/kg/h infusion; do not bolus. Adjunct only — does NOT treat seizure / DT pathway. Useful for refractory autonomic / agitation.'
  }));
  secAcute.appendChild(medCard({
    title:'Severe / refractory — phenobarbital, ICU',
    scope:'Escalating benzo needs, DT, seizures, MINDS ≥20, CIWA >20',
    cite: CITE.ASAM2020,
    rows: [
      ['Phenobarbital load', '10 mg/kg IBW IV over 30 min'],
      ['Phenobarbital re-bolus', '65–130 mg IV q30 min × 2 PRN'],
      ['Dexmedetomidine', '0.2–1.5 µg/kg/h; adjunct, not monotherapy'],
      ['Ketamine (refractory)', '0.15–0.3 mg/kg/h infusion — limited evidence; specialist'],
      ['Propofol (intubated)', 'Titrate to RASS target; high-dose may be needed'],
    ],
    note:'Anticipate airway needs. Continue thiamine. Do NOT use antipsychotics alone — they lower seizure threshold and do not treat WD.'
  }));
  root.appendChild(secAcute);

  // ---- Adjuncts ----
  const secAdj = el('section', { class:'block' }, [ el('h2', {}, 'Adjuncts (give to all)') ]);
  secAdj.appendChild(medCard({
    title:'Thiamine and vitamins',
    scope:'Wernicke prevention / treatment',
    cite: CITE.WERNICKE,
    rows: [
      ['Prophylaxis', 'Thiamine 100 mg IV/IM daily × 3–5 days, then 100 mg PO daily'],
      ['Suspected Wernicke', 'Thiamine 500 mg IV TID × 2–3 days, then 250 mg IM/IV daily × 5 d, then PO'],
      ['Folate', '1 mg PO daily'],
      ['Multivitamin', '1 tab PO daily'],
      ['Magnesium', 'Replete to >2.0 mg/dL'],
      ['Potassium / Phos', 'Replete; expect refeeding-type derangements'],
    ],
    note:'Give thiamine BEFORE glucose — but never delay glucose for severe hypoglycemia.'
  }));
  root.appendChild(secAdj);

  // ---- Long-term AUD pharmacotherapy ----
  const secLT = el('section', { class:'block' }, [ el('h2', {}, 'Long-Term AUD Pharmacotherapy') ]);
  secLT.appendChild(medCard({
    title:'First-line — Naltrexone',
    scope:'Moderate–severe AUD without acute hepatitis / hepatic failure / current opioid use',
    cite: CITE.NALTREXONE,
    rows: [
      ['Oral', '50 mg PO daily (some start 25 mg × 3–7 d)'],
      ['IM depot (XR)', '380 mg IM gluteal q4 weeks'],
    ],
    note:'Confirm opioid-free 7–10 days (precipitated WD). Monitor LFTs; avoid in acute hepatitis.'
  }));
  secLT.appendChild(medCard({
    title:'First-line — Acamprosate',
    scope:'Preferred if liver disease or opioid use',
    cite: CITE.NALTREXONE,
    rows: [
      ['Standard', '666 mg PO TID (two 333 mg tabs three times daily)'],
      ['Renal dosing', 'CrCl 30–50: 333 mg TID; CrCl <30: avoid'],
    ],
    note:'Best started after abstinence achieved; supports maintenance.'
  }));
  secLT.appendChild(medCard({
    title:'Second-line / specialist',
    scope:'When first-line not tolerated or appropriate',
    cite: CITE.MAT,
    rows: [
      ['Disulfiram', '250–500 mg PO daily — only with supervised adherence; aversive'],
      ['Topiramate (off-label)', '25 mg PO HS, titrate to 200–300 mg/day divided'],
      ['Gabapentin (off-label)', '600 mg PO TID; useful if anxiety/insomnia component'],
      ['Baclofen (off-label)', '5–20 mg PO TID; particularly considered in cirrhosis'],
    ],
    note:'Pair pharmacotherapy with counseling (MET, CBT, 12-step facilitation) and mutual support (AA, SMART Recovery).'
  }));
  root.appendChild(secLT);

  // ---- Patient-specific modifiers ----
  const mods = [];
  if (S.liverDisease) mods.push('Cirrhosis present — prefer lorazepam (no active metabolites). Avoid disulfiram. Consider baclofen long-term.');
  if (S.opioidCoUse)  mods.push('Concurrent opioid use — naltrexone contraindicated; choose acamprosate. Co-treat OUD (consider buprenorphine).');
  if (S.benzoCoUse)   mods.push('Concurrent benzodiazepine use — phenobarbital pathway often preferred; benzo dose-response may be unreliable.');
  if (S.pregnant)     mods.push('Pregnancy — benzodiazepines remain first-line for acute WD (untreated WD harmful to fetus). Long-term pharmacotherapy individualized with OB/MFM.');
  if (S.ageBand === 'ge65') mods.push('Age ≥65 — start at lower benzo doses; prefer lorazepam; aspiration & fall precautions.');

  if (mods.length) {
    const secMod = el('section', { class:'block' }, [
      el('h2', {}, 'Patient-Specific Modifiers'),
      el('div', { class:'med-card' }, [
        el('ul', { style:'margin:0;padding-left:18px' },
          mods.map(m => el('li', { style:'margin-bottom:6px;font-size:13px' }, m)))
      ])
    ]);
    root.appendChild(secMod);
  }
}

function medCard({ title, scope, cite, rows, note, altTitle, altCite, altBody }) {
  const card = el('div', { class:'med-card' });
  card.appendChild(el('h3', {}, title));
  card.appendChild(el('div', { class:'scope' }, scope));
  if (rows && rows.length) {
    const tbl = el('table', {});
    tbl.appendChild(el('thead', {}, el('tr', {}, [el('th', {}, 'When'), el('th', {}, 'Dose')])));
    const tb = el('tbody', {});
    rows.forEach(r => tb.appendChild(el('tr', {}, [el('td', {}, r[0]), el('td', {}, r[1])])));
    tbl.appendChild(tb);
    card.appendChild(tbl);
  }
  if (note) card.appendChild(el('div', { class:'muted tiny', style:'margin-top:6px' }, note));
  if (altTitle) {
    const alt = el('div', { class:'alt' }, [
      el('h4', {}, 'Alternative — ' + altTitle.replace(/^Alternative — /, '')),
      el('div', { class:'tiny' }, altBody)
    ]);
    if (altCite) alt.appendChild(el('div', { class:'cite' }, [ 'Ref: ', el('a', { href:altCite.url, target:'_blank', rel:'noopener' }, altCite.text) ]));
    card.appendChild(alt);
  }
  if (cite) card.appendChild(el('div', { class:'cite' }, [
    'Primary ref: ',
    el('a', { href:cite.url, target:'_blank', rel:'noopener' }, cite.text)
  ]));
  return card;
}

/* ============================================================
   ASCII NOTE BUILDER — copy-pastable EMR blocks
   ============================================================ */
function renderNote() {
  const root = $('#view-note'); root.innerHTML = '';
  root.appendChild(el('section', { class:'block' }, [
    el('h2', {}, 'Copy-paste chart block'),
    el('div', { class:'muted tiny', style:'margin-bottom:8px' },
      'ASCII-framed summary of context, scores, and current plan. Tap "Copy" to paste into the EMR.'),
  ]));

  const note = buildAsciiNote();
  const pre = el('pre', { class:'ascii' }, note);
  root.appendChild(pre);

  const actions = el('div', { style:'display:flex;gap:8px;padding:0 12px 12px' });
  actions.appendChild(el('button', {
    style:'flex:1;background:var(--accent);color:#062c25;border:0;border-radius:8px;padding:12px;font-weight:700;font-size:14px',
    onclick: () => copyText(note, 'note')
  }, 'Copy note'));
  actions.appendChild(el('button', {
    style:'flex:1;background:transparent;color:var(--accent);border:1px solid var(--accent);border-radius:8px;padding:12px;font-weight:700;font-size:14px',
    onclick: () => copyText(buildAsciiTrend(), 'trend')
  }, 'Copy trend only'));
  root.appendChild(actions);

  root.appendChild(el('section', { class:'block' }, [
    el('h2', {}, 'Score trend (ASCII)'),
    el('pre', { class:'ascii' }, buildAsciiTrend())
  ]));
}

function copyText(text, kind='note') {
  const done = () => {
    const t = el('div', { class:'reco', style:'position:fixed;bottom:80px;left:12px;right:12px;z-index:50;text-align:center' },
      el('div', { class:'title' }, `${kind === 'note' ? 'Chart note' : 'Trend'} copied to clipboard`));
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1400);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea'); ta.value = text;
  ta.style.position='fixed'; ta.style.left='-9999px';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch(e) {}
  ta.remove();
}

function box(title, lines, width = 60) {
  const w = width;
  const bar = '+' + '-'.repeat(w-2) + '+';
  const pad = (s) => '| ' + s.padEnd(w-4) + ' |';
  const titleLine = '| ' + title.toUpperCase().padEnd(w-4) + ' |';
  return [bar, titleLine, bar, ...lines.map(pad), bar].join('\n');
}

function buildAsciiNote() {
  const W = 60;
  const dt = new Date().toLocaleString();
  const lines = [];

  // Header
  lines.push(box('EtOH Withdrawal — Bedside Summary', [
    `Generated: ${dt}`,
    `Setting:   ${S.setting || '—'}     Cooperative: ${S.cooperative === null ? '—' : (S.cooperative ? 'yes' : 'no')}`,
    `Age band:  ${S.ageBand || '—'}     Liver dz:    ${flag(S.liverDisease)}`,
    `Opioid:    ${flag(S.opioidCoUse)}      Benzo:       ${flag(S.benzoCoUse)}      Pregnant: ${flag(S.pregnant)}`,
  ], W));
  lines.push('');

  // Scores summary
  const scoreLines = [];
  ['AUDITC','AUDIT','CAGE','DSM5','PAWSS','CIWA','GMAWS','MINDS','RASS','SAS','CAMICU','GCS'].forEach(id => {
    const r = S.results[id]; if (!r) return;
    scoreLines.push(`${pad(id, 8)} ${pad(String(r.score), 4)} ${pad(r.tierText || '', 32)} ${fmtTime(r.time)}`);
  });
  if (scoreLines.length === 0) scoreLines.push('(no scores recorded yet)');
  lines.push(box('Scores', scoreLines, W));
  lines.push('');

  // Plan from recommendation engine
  const rec = recommend();
  lines.push(box('Plan / Next Best', [
    rec.title,
    ...wrap(rec.why, W - 4)
  ], W));
  lines.push('');

  // Don't-forget panel (condensed)
  const must = collectMustDo();
  lines.push(box('Don\'t forget', must.slice(0,8), W));

  lines.push('');
  lines.push('— Generated by EtOH WD bedside tool. Evidence-linked; verify against local protocol. —');
  return lines.join('\n');
}

function buildAsciiTrend() {
  // sparkline of CIWA / GMAWS / MINDS / RASS over time, oldest -> newest
  const W = 60;
  const tracks = [
    { id:'CIWA',  range:[0,30] },
    { id:'GMAWS', range:[0,10] },
    { id:'MINDS', range:[0,30] },
    { id:'RASS',  range:[-5,4] },
  ];
  const lines = [];
  tracks.forEach(t => {
    const series = S.history.filter(h => h.id === t.id).reverse();
    if (!series.length) return;
    const cells = series.slice(-20).map(h => spark(h.score, t.range[0], t.range[1])).join('');
    const last = series[series.length-1];
    lines.push(`${t.id.padEnd(6)} ${cells.padEnd(20)}  last ${last.score} @ ${fmtTime(last.time)}`);
  });
  if (!lines.length) lines.push('(no withdrawal/sedation scores yet)');
  return box('Trend', lines, W);
}
function spark(v, lo, hi) {
  const chars = ' ▁▂▃▄▅▆▇█';
  const pct = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return chars[Math.round(pct * (chars.length - 1))];
}

function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
function flag(b) { return b === null || b === undefined ? '—' : (b ? 'yes' : 'no'); }
function wrap(text, n) {
  const words = text.split(/\s+/); const out=[]; let line='';
  words.forEach(w => {
    if ((line + ' ' + w).trim().length > n) { out.push(line); line = w; }
    else line = (line ? line + ' ' : '') + w;
  });
  if (line) out.push(line);
  return out;
}

/* ============================================================
   DON'T-FORGET PANEL
   ============================================================ */
function collectMustDo() {
  const out = ['Thiamine 100 mg IV/IM (consider 500 mg TID if Wernicke risk) BEFORE glucose',
               'Folate 1 mg PO; multivitamin; replete Mg / K / Phos',
               'Seizure & fall precautions; bed alarm; CIWA/MINDS schedule on orders',
               'Screen for co-use: opioids, benzos, stimulants — modify dosing'];
  if (S.pregnant)    out.push('Pregnancy — involve OB; benzos still first-line for severe WD');
  if (S.opioidCoUse) out.push('Opioid co-use — naloxone Rx at discharge; assess for OUD / buprenorphine');
  if (S.liverDisease)out.push('Cirrhosis — switch to lorazepam; avoid disulfiram');
  if (S.benzoCoUse)  out.push('Benzo dependence — consider phenobarb pathway; do not abrupt-stop benzos');
  out.push('Address Hep C / HIV / Hep B testing & vaccination');
  out.push('Connect to AA / SMART Recovery; warm hand-off to outpatient addiction medicine');
  out.push('Document AUD diagnosis; offer MAT (naltrexone / acamprosate) BEFORE discharge');
  return out;
}

function renderForget() {
  const root = $('#view-forget'); root.innerHTML = '';
  const groups = [
    { title:'On admission / first hour', items: [
      'Confirm last drink time; quantify use (drinks/day, duration)',
      'Check BAL, BMP, Mg, Phos, CBC, LFTs, lipase, INR, UA, β-hCG if applicable',
      'Thiamine 100 mg IV/IM BEFORE glucose (500 mg TID if Wernicke risk)',
      'Capillary glucose; do not delay if hypoglycemic',
      'PAWSS to risk-stratify',
      'Order CIWA-Ar or GMAWS frequency (q1–4h based on PAWSS)',
      'CAM-ICU on the ICU/intubated patient',
    ]},
    { title:'Pharmacotherapy reminders', items: [
      'Symptom-triggered ≥ fixed-schedule dosing for most patients (less benzo overall)',
      'Front-load if PAWSS ≥ 4, history of DT/seizure, or rapid escalation',
      'Lorazepam if cirrhosis, advanced age, or unstable (no active metabolites)',
      'Phenobarbital adjunct or monotherapy if escalating benzo needs',
      'Dexmedetomidine — adjunct only; does not prevent seizures/DTs',
      'Avoid antipsychotic monotherapy — lowers seizure threshold',
    ]},
    { title:'Co-morbidities to actively screen / treat', items: [
      'Wernicke–Korsakoff (confusion, oculomotor, ataxia — even one feature)',
      'Hepatitis C and B; HIV; vaccinate Hep A/B if not immune',
      'Pancreatitis; alcoholic hepatitis',
      'Cardiomyopathy; arrhythmia (holiday heart)',
      'Anemia, thrombocytopenia, coagulopathy',
      'Trauma / falls / subdural hematoma (low threshold for CT)',
      'Pneumonia (aspiration) / TB',
      'Co-occurring psychiatric disease — depression, PTSD, suicidality',
      'Co-occurring substance use — opioid, benzo, stimulant, tobacco',
      'Nutrition: re-feeding risk; protein-energy malnutrition',
      'Pregnancy considerations; intimate partner violence',
    ]},
    { title:'Before discharge', items: [
      'Confirm DSM-5 AUD diagnosis documented',
      'Offer pharmacotherapy: naltrexone (PO/IM XR) or acamprosate',
      'Counseling referral (CBT / MET); AA or SMART Recovery hand-off',
      'Naloxone Rx if any opioid co-use',
      'Address housing / transportation / food insecurity',
      'Warm hand-off + 7-day follow-up appointment',
      'Family/social support engaged with consent',
      'Safety plan if suicidality has been present',
    ]}
  ];
  const host = el('div', { class:'dontforget' });
  groups.forEach(g => {
    const grp = el('div', { class:'grp' });
    grp.appendChild(el('h3', {}, g.title));
    grp.appendChild(el('ul', {}, g.items.map(i => el('li', {}, i))));
    host.appendChild(grp);
  });
  host.appendChild(el('div', { class:'tiny muted', style:'padding:8px 4px' }, [
    'References: ',
    el('a', { href:CITE.ASAM2020.url, target:'_blank', rel:'noopener' }, 'ASAM 2020'),
    ' · ',
    el('a', { href:CITE.MAT.url, target:'_blank', rel:'noopener' }, 'SAMHSA TIP 49'),
    ' · ',
    el('a', { href:CITE.NALTREXONE.url, target:'_blank', rel:'noopener' }, 'VA/DoD SUD CPG'),
    ' · ',
    el('a', { href:CITE.WERNICKE.url, target:'_blank', rel:'noopener' }, 'EFNS Wernicke'),
  ]));
  root.appendChild(host);
}

/* ============================================================
   HISTORY / TIMELINE
   ============================================================ */
function renderHistory() {
  const root = $('#view-history'); root.innerHTML = '';
  root.appendChild(el('section', { class:'block' }, [
    el('h2', {}, 'Timeline'),
    el('div', { class:'muted tiny', style:'margin-bottom:6px' }, 'Most recent first. Cleared with "New pt".')
  ]));

  const list = el('div', { class:'timeline' });
  if (!S.history.length) {
    list.appendChild(el('div', { class:'muted' }, 'No scores recorded yet.'));
  } else {
    S.history.forEach(h => {
      list.appendChild(el('div', { class:'entry' }, [
        el('div', { class:'time' }, fmtTime(h.time)),
        el('div', {}, [
          el('span', { class:'score' }, `${h.name} ${h.score}`),
          ' · ',
          el('span', { class:'pill ' + h.pill }, h.tierText)
        ]),
      ]));
    });
  }
  root.appendChild(list);

  root.appendChild(el('section', { class:'block' }, [
    el('h2', {}, 'Trend (ASCII)'),
    el('pre', { class:'ascii' }, buildAsciiTrend())
  ]));
}

/* ============================================================
   FLOW DIAGRAM (on-screen reference)
   ============================================================ */
function openFlow() {
  $('#modal-title').textContent = 'Evaluation Flow';
  const body = $('#modal-body'); body.innerHTML = '';
  body.appendChild(el('pre', { class:'ascii flow-pre' }, FLOW));
  $('#modal-foot').innerHTML = '';
  $('#modal-foot').appendChild(el('div', { class:'score-out muted tiny' }, 'Tap a score tile to begin.'));
  $('#modal-foot').appendChild(el('button', { onclick: closeModal }, 'Close'));
  $('#modal-back').classList.add('open');
}

const FLOW =
`ALCOHOL USE / WITHDRAWAL EVALUATION

  +----------------------+
  | Suspected EtOH use   |
  +----------+-----------+
             |
             v
  +-------------------------+
  | Screen for harmful use  |
  +-------------------------+
        |              |
        v              v
  OUTPATIENT/ED   HOSPITALIZED
    AUDIT(-C)       PAWSS
    CAGE          (predict
    DSM-5          severe WD
                   BEFORE it)
        |              |
        |        PAWSS >= 4 ?
        |              |
        |       +------+------+
        |       |             |
        |     YES            NO
        |   high risk      floor
        |  front-load    symptom-
        |  consider     triggered
        |  phenobarb/
        |     ICU
        v
   LONG-TERM AUD MANAGEMENT
    naltrexone / acamprosate
    counseling / AA / SMART


  ACTIVE WITHDRAWAL ASSESSMENT
  +---------------------------+
  | Withdrawing now?          |
  +-------------+-------------+
                |
                v
  +-----------------------------+
  | Cooperative? verbal?        |
  +-------+---------------+-----+
          |               |
         YES              NO / ICU
       floor pt           intubated / delirious
       +---------+        +---------+
       | CIWA-Ar |        | MINDS   |
       | GMAWS   |        +---------+
       +---------+
          |
          v
   severity --> medication needs


  CIWA-Ar  0-7 mild · 8-15 moderate · >15 severe · >20 very severe / ICU
  MINDS    high score OR DT / seizure / autonomic instability => ICU


  SEDATION / ICU MONITORING
   RASS  +4 combative  ... 0 calm  ... -5 unarousable
   target 0 to -1 (non-intubated)  /  -1 to -3 (intubated)
   CAM-ICU for delirium (RASS >= -3)


  OTHER
   GCS (encephalopathic / intoxicated)
   SAS (alternative to RASS)
   SOFA / APACHE (ICU severity, not WD-specific)
`;

/* ============================================================
   BOOT
   ============================================================ */
function renderAll() {
  renderContext();
  renderReco();
  renderTiles();
}

function openAbout() {
  $('#modal-title').textContent = 'EtOH WD — About';
  const body = $('#modal-body'); body.innerHTML = '';
  body.appendChild(el('div', { class:'interp' }, [
    el('h4', {}, 'Decision-support, not authority'),
    el('div', { class:'tiny' },
      'This tool reproduces standard published scoring instruments and consensus dosing ranges. ' +
      'It assists, but does not replace, clinical judgement and local protocol. Verify every dose. ' +
      'No patient identifiers are intended to live on this device.')
  ]));
  const sources = el('div', { class:'interp', style:'margin-top:10px' }, [ el('h4', {}, 'Primary sources') ]);
  const ul = el('ul', {});
  Object.entries(CITE).forEach(([k, c]) => {
    ul.appendChild(el('li', {}, [
      el('b', {}, k + ' — '),
      el('a', { href:c.url, target:'_blank', rel:'noopener' }, c.text)
    ]));
  });
  sources.appendChild(ul);
  body.appendChild(sources);
  body.appendChild(el('div', { class:'tiny muted', style:'margin-top:10px' },
    'Open source · runs offline once loaded · all state is local to this device.'));
  $('#modal-foot').innerHTML = '';
  $('#modal-foot').appendChild(el('div', { class:'score-out muted tiny' },
    'PWA — install via "Add to Home Screen" for full-screen offline use.'));
  $('#modal-foot').appendChild(el('button', { onclick: closeModal }, 'Close'));
  $('#modal-back').classList.add('open');
}

function bind() {
  $('#btn-new').addEventListener('click', resetState);
  $('#btn-flow').addEventListener('click', openFlow);
  $('#btn-about').addEventListener('click', openAbout);
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-back').addEventListener('click', (e) => { if (e.target.id === 'modal-back') closeModal(); });
  $$('#nav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  // open context on first run if blank
  if (!S.setting) setTimeout(openContextEditor, 250);
}

document.addEventListener('DOMContentLoaded', () => {
  bind();
  renderAll();
});

})();
