// RoadProof core — deterministic driver vehicle inspection math only.
// No I/O, no randomness, no network. The checklist mirrors the parts named in
// 49 CFR 396.11(a)(2); every judgement here is arithmetic on values the driver
// entered, so a sign-off can be replayed against the rule version that made it.
// See docs/D2-内核与来源.md for every constant and its source status.

const THRESHOLDS = Object.freeze({
  version: 'rp-1.0.0',
  effective: '2026-11-26',
  tire: Object.freeze({ warn32: 4, fail32: 2, minPsiRatioWarn: 0.90 }),
  odometer: Object.freeze({ rollbackToleranceMi: 1, jumpWarnMi: 1200 }),
  defect: Object.freeze({ openWarnDays: 7, openFailDays: 14 }),
  reminder: Object.freeze({ annualWarnDays: 30, registrationWarnDays: 30, insuranceWarnDays: 14 }),
  completeness: Object.freeze({ requireCriticalAnswered: true }),
});

const PASS = 'pass';
const WARN = 'warn';
const FAIL = 'fail';
const NE = 'notEvaluated';

// --- Checklist ------------------------------------------------------------
// criticalFlag: a defect here puts the unit out of service until it is
// repaired and signed off, which is what "out of service" means in practice.
const GROUPS = [
  { id: 'walk', label: 'Walk-around' },
  { id: 'lights', label: 'Lights & reflectors' },
  { id: 'tires', label: 'Tires, wheels, hubs' },
  { id: 'brakes', label: 'Brakes & air' },
  { id: 'steer', label: 'Steering & suspension' },
  { id: 'engine', label: 'Engine & fluids' },
  { id: 'cab', label: 'Cab & safety gear' },
  { id: 'body', label: 'Body & cargo' },
  { id: 'coupling', label: 'Coupling (if towing)' },
  { id: 'emergency', label: 'Emergency equipment' },
];

const CHECKLIST = [
  { id: 'leaks', group: 'walk', label: 'Fluid leaks under the unit', cfr: '396.11(a)(2)(i)', critical: true },
  { id: 'damage', group: 'walk', label: 'Body damage or loose parts', cfr: '396.11(a)(2)(i)', critical: false },
  { id: 'clearance', group: 'walk', label: 'Ride height and clearance normal', cfr: '396.11(a)(2)(i)', critical: false },

  { id: 'headlights', group: 'lights', label: 'Headlights, high beams', cfr: '396.11(a)(2)(ii)', critical: true },
  { id: 'marker', group: 'lights', label: 'Marker and clearance lamps', cfr: '396.11(a)(2)(ii)', critical: false },
  { id: 'turnstop', group: 'lights', label: 'Turn signals and stop lamps', cfr: '396.11(a)(2)(ii)', critical: true },
  { id: 'reflectors', group: 'lights', label: 'Reflectors and conspicuity tape', cfr: '396.11(a)(2)(ii)', critical: false },

  { id: 'tread', group: 'tires', label: 'Tread depth (32nds)', cfr: '396.11(a)(2)(iii)', critical: true },
  { id: 'tirepressure', group: 'tires', label: 'Tire pressure vs placard', cfr: '396.11(a)(2)(iii)', critical: false },
  { id: 'tirecondition', group: 'tires', label: 'Cuts, bulges, sidewall damage', cfr: '396.11(a)(2)(iii)', critical: true },
  { id: 'lugnut', group: 'tires', label: 'Lug nuts, hub oil seals', cfr: '396.11(a)(2)(iii)', critical: true },

  { id: 'servicebrake', group: 'brakes', label: 'Service brakes respond and hold', cfr: '396.11(a)(2)(iv)', critical: true },
  { id: 'parkingbrake', group: 'brakes', label: 'Parking brake holds on grade', cfr: '396.11(a)(2)(iv)', critical: true },
  { id: 'airpressure', group: 'brakes', label: 'Air pressure builds and holds', cfr: '396.11(a)(2)(iv)', critical: true },
  { id: 'brakewarning', group: 'brakes', label: 'Low-pressure warning works', cfr: '396.11(a)(2)(iv)', critical: false },

  { id: 'steering', group: 'steer', label: 'Steering play within limit', cfr: '396.11(a)(2)(v)', critical: true },
  { id: 'suspension', group: 'steer', label: 'Springs, shocks, air bags', cfr: '396.11(a)(2)(v)', critical: false },

  { id: 'fluidlevel', group: 'engine', label: 'Oil, coolant, DEF levels', cfr: '396.11(a)(2)(vi)', critical: false },
  { id: 'belts', group: 'engine', label: 'Belts and hoses', cfr: '396.11(a)(2)(vi)', critical: false },
  { id: 'exhaust', group: 'engine', label: 'Exhaust and DEF system', cfr: '396.11(a)(2)(vi)', critical: false },

  { id: 'seatbelt', group: 'cab', label: 'Seat belt and mirror adjustment', cfr: '396.11(a)(2)(vii)', critical: false },
  { id: 'warningdevices', group: 'cab', label: 'Horn, wipers, gauges', cfr: '396.11(a)(2)(vii)', critical: false },

  { id: 'cargo', group: 'body', label: 'Cargo secured, doors latched', cfr: '396.11(a)(2)(viii)', critical: true },
  { id: 'fifthwheel', group: 'coupling', label: 'Fifth wheel or hitch locked', cfr: '396.11(a)(2)(ix)', critical: true },
  { id: 'airlines', group: 'coupling', label: 'Air lines and electrical cord', cfr: '396.11(a)(2)(ix)', critical: false },

  { id: 'extinguisher', group: 'emergency', label: 'Fire extinguisher charged', cfr: '396.11(a)(2)(x)', critical: false },
  { id: 'triangles', group: 'emergency', label: 'Warning triangles and fuses', cfr: '396.11(a)(2)(x)', critical: false },
];

const ITEM_BY_ID = Object.freeze(CHECKLIST.reduce((m, it) => ({ ...m, [it.id]: it }), {}));

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round = (v, d) => {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
};

// --- helpers --------------------------------------------------------------
function daysBetween(fromISO, toISO) {
  const from = Date.parse(fromISO);
  const to = Date.parse(toISO);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return (to - from) / (1000 * 60 * 60 * 24);
}

function tireTread(tread32) {
  if (!isNum(tread32) || tread32 < 0) return NE;
  if (tread32 < THRESHOLDS.tire.fail32) return FAIL;
  if (tread32 < THRESHOLDS.tire.warn32) return WARN;
  return PASS;
}

function tirePressure(psi, placardPsi) {
  if (!isNum(psi) || !isNum(placardPsi) || placardPsi <= 0) return NE;
  const ratio = psi / placardPsi;
  if (ratio < THRESHOLDS.tire.minPsiRatioWarn) return FAIL;
  return PASS;
}

// A DVIR is only worth anything if the odometer on it cannot move backwards.
function odometerCheck(current, last) {
  if (!isNum(current) || current <= 0) return { status: NE, delta: null, note: 'No odometer entered' };
  if (!isNum(last) || last <= 0) return { status: NE, delta: null, note: 'First reading for this unit' };
  const delta = current - last;
  if (delta < -THRESHOLDS.odometer.rollbackToleranceMi) {
    return { status: FAIL, delta, note: 'Odometer went backwards' };
  }
  if (delta > THRESHOLDS.odometer.jumpWarnMi) {
    return { status: WARN, delta, note: 'Large jump since last inspection' };
  }
  return { status: PASS, delta, note: null };
}

function defectAge(defect, now) {
  if (!defect || !defect.reportedAt) return null;
  const end = defect.repairedAt || now;
  return daysBetween(defect.reportedAt, end);
}

function defectStatus(defect, now) {
  if (!defect) return { status: NE, days: null };
  if (defect.repairedAt) return { status: PASS, days: round(defectAge(defect, now), 1) };
  const days = defectAge(defect, now);
  if (days === null) return { status: NE, days: null };
  if (defect.severity === 'critical' || days > THRESHOLDS.defect.openFailDays) return { status: FAIL, days: round(days, 1) };
  if (days > THRESHOLDS.defect.openWarnDays) return { status: WARN, days: round(days, 1) };
  return { status: WARN, days: round(days, 1) };
}

function reminders(vehicle = {}, now = new Date().toISOString()) {
  const rows = [
    { id: 'annual', label: 'Annual inspection', dueISO: vehicle.annualInspectionDue, warnDays: THRESHOLDS.reminder.annualWarnDays },
    { id: 'registration', label: 'Registration', dueISO: vehicle.registrationDue, warnDays: THRESHOLDS.reminder.registrationWarnDays },
    { id: 'insurance', label: 'Insurance', dueISO: vehicle.insuranceDue, warnDays: THRESHOLDS.reminder.insuranceWarnDays },
  ];
  return rows.map((r) => {
    const left = daysBetween(now, r.dueISO);
    if (left === null) return { id: r.id, label: r.label, status: NE, daysLeft: null, dueISO: r.dueISO || null };
    const status = left < 0 ? FAIL : left <= r.warnDays ? WARN : PASS;
    return { id: r.id, label: r.label, status, daysLeft: Math.round(left), dueISO: r.dueISO };
  });
}

// --- inspection ----------------------------------------------------------
function itemStatus(entry, critical) {
  if (!entry || !entry.state) return NE;
  if (entry.state === 'ok') return PASS;
  if (entry.state === 'na') return NE;
  if (entry.state === 'defect') return critical || entry.severity === 'critical' ? FAIL : WARN;
  return NE;
}

function evaluateInspection(input = {}) {
  const results = input.results || {};
  const requireCoupling = input.requiresCoupling === true;

  const items = CHECKLIST.filter((it) => it.group !== 'coupling' || requireCoupling).map((it) => {
    const entry = results[it.id];
    const status = itemStatus(entry, it.critical);
    return {
      ...it,
      status,
      note: entry && entry.note ? entry.note : null,
      measured: entry && isNum(entry.value) ? entry.value : null,
    };
  });

  // Rule-based overrides where a raw "OK" tap is not enough.
  const treads = results.tread;
  if (treads && treads.state === 'ok' && isNum(treads.value)) {
    const s = tireTread(treads.value);
    const row = items.find((i) => i.id === 'tread');
    if (row) {
      row.status = s === PASS ? PASS : s;
      if (s !== PASS) row.note = `Entered ${treads.value} /32 in`;
    }
  }
  const press = results.tirepressure;
  if (press && press.state === 'ok' && isNum(press.value) && isNum(input.placardPsi)) {
    const s = tirePressure(press.value, input.placardPsi);
    const row = items.find((i) => i.id === 'tirepressure');
    if (row) {
      row.status = s;
      if (s !== PASS) row.note = `${press.value} psi vs ${input.placardPsi} placard`;
    }
  }

  const odo = odometerCheck(input.odometer, input.lastOdometer);

  const required = items.filter((i) => i.critical || i.group !== 'coupling');
  const answered = required.filter((i) => i.status !== NE).length;
  const unansweredCritical = required.filter((i) => i.status === NE).length;
  const completeness = required.length ? answered / required.length : 0;

  const counts = {
    fail: items.filter((i) => i.status === FAIL).length,
    warn: items.filter((i) => i.status === WARN).length,
    pass: items.filter((i) => i.status === PASS).length,
    notEvaluated: items.filter((i) => i.status === NE).length,
  };

  const openCritical = (input.defects || []).filter((d) => !d.repairedAt && d.severity === 'critical');

  let overall = PASS;
  if (counts.fail > 0 || openCritical.length > 0 || odo.status === FAIL) overall = FAIL;
  else if (counts.warn > 0 || odo.status === WARN || unansweredCritical > 0) overall = WARN;
  if (answered === 0) overall = NE;

  const blockers = [];
  if (openCritical.length) blockers.push(`${openCritical.length} open critical defect(s)`);
  if (odo.status === FAIL) blockers.push('Odometer moved backwards');
  if (unansweredCritical > 0) blockers.push(`${unansweredCritical} required item(s) not answered`);

  return {
    ruleVersion: THRESHOLDS.version,
    overall,
    counts,
    items,
    odometer: odo,
    completeness: round(completeness, 3),
    unansweredRequired: unansweredCritical,
    blockers,
  };
}

// FNV-1a over a canonical string: cheap, deterministic, dependency-free.
// It chains each signed report to the previous one, so a deleted or edited
// report in the middle shows up as a broken chain at verification time.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function recordHash(payload, prevHash) {
  const canon = JSON.stringify({
    unit: payload.unit || '',
    type: payload.type || '',
    at: payload.at || '',
    odometer: payload.odometer ?? null,
    results: payload.results || {},
    defects: payload.defects || [],
    signature: payload.signature || '',
  });
  return fnv1a(`${prevHash || 'genesis'}|${canon}`);
}

function verifyChain(records = []) {
  let prev = null;
  for (let i = 0; i < records.length; i += 1) {
    const r = records[i];
    const expect = recordHash(r.payload || r, prev);
    if (expect !== r.hash) return { ok: false, at: i, expected: expect, found: r.hash };
    prev = r.hash;
  }
  return { ok: true, at: -1, expected: null, found: null };
}

module.exports = {
  THRESHOLDS, GROUPS, CHECKLIST, ITEM_BY_ID, PASS, WARN, FAIL, NE,
  daysBetween, tireTread, tirePressure, odometerCheck, defectAge, defectStatus,
  reminders, evaluateInspection, itemStatus, fnv1a, recordHash, verifyChain,
};
