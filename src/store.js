// Local-first store. No account, no sync, no network. One AsyncStorage key holds
// the whole book, so "export my records" is one JSON string the driver can keep.
const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const K = require('./kernel');

const KEY = 'roadproof.state.v1';
const EMPTY = { units: [], inspections: [], defects: [], activeUnitId: null };

const uid = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const today = () => new Date().toISOString().slice(0, 10);

async function load() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...EMPTY };
  try {
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch (e) {
    return { ...EMPTY };
  }
}

async function save(state) {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

async function addUnit(state, input) {
  const unit = {
    id: uid('unit'),
    number: (input.number || '').trim().toUpperCase() || 'UNIT 1',
    plate: (input.plate || '').trim().toUpperCase(),
    plateState: (input.plateState || '').trim().toUpperCase(),
    vin: (input.vin || '').trim().toUpperCase(),
    type: input.type || 'tractor',
    tows: input.tows === true,
    placardPsi: Number(input.placardPsi) || null,
    annualInspectionDue: input.annualInspectionDue || null,
    registrationDue: input.registrationDue || null,
    insuranceDue: input.insuranceDue || null,
    createdAt: new Date().toISOString(),
  };
  const next = { ...state, units: [...state.units, unit], activeUnitId: unit.id };
  return save(next);
}

async function selectUnit(state, id) {
  return save({ ...state, activeUnitId: id });
}

function lastOdometer(state, unitId) {
  const rows = state.inspections.filter((x) => x.unitId === unitId && Number.isFinite(x.odometer));
  if (!rows.length) return null;
  return rows.reduce((a, b) => (a.at > b.at ? a : b)).odometer;
}

// A signed inspection is immutable: the payload is hashed against the previous
// hash, so later edits to an older record break the chain visibly.
async function addInspection(state, input) {
  const unit = state.units.find((u) => u.id === input.unitId) || {};
  const prev = state.inspections.filter((x) => x.unitId === input.unitId);
  const prevHash = prev.length ? prev[prev.length - 1].hash : null;

  const payload = {
    unit: unit.number || '',
    type: input.type || 'pre-trip',
    at: input.at || new Date().toISOString(),
    odometer: Number(input.odometer) || null,
    results: input.results || {},
    defects: input.defects || [],
    signature: input.signature || '',
  };
  const hash = K.recordHash(payload, prevHash);

  const inspection = {
    id: uid('insp'),
    unitId: input.unitId,
    type: payload.type,
    at: payload.at,
    odometer: payload.odometer,
    overall: input.overall || null,
    criticalFails: Number(input.criticalFails) || 0,
    results: payload.results,
    signature: payload.signature,
    prevHash,
    hash,
    payload,
  };

  const newDefects = (input.defects || []).map((d) => ({
    id: uid('def'),
    unitId: input.unitId,
    inspectionId: inspection.id,
    itemId: d.itemId,
    label: d.label,
    severity: d.severity || 'minor',
    note: d.note || '',
    reportedAt: payload.at,
    repairedAt: null,
    repairNote: '',
  }));

  const next = {
    ...state,
    inspections: [...state.inspections, inspection],
    defects: [...state.defects, ...newDefects],
  };
  return save(next);
}

async function repairDefect(state, defectId, repairNote) {
  const at = new Date().toISOString();
  const defects = state.defects.map((d) =>
    d.id === defectId ? { ...d, repairedAt: at, repairNote: (repairNote || '').trim() } : d
  );
  return save({ ...state, defects });
}

async function reset() {
  await AsyncStorage.removeItem(KEY);
  return { ...EMPTY };
}

module.exports = {
  KEY, EMPTY, load, save, addUnit, selectUnit, addInspection, repairDefect, lastOdometer, reset, today,
};
