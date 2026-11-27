// The AI layer is a facade, not a dependency: every capability degrades to a
// deterministic local path when the native module or the model is absent.
// Nothing here sends data anywhere unless Foundation Models itself is running.
const { requireNativeModule } = require('expo-modules-core');

function native(name) {
  try {
    return requireNativeModule(name);
  } catch (e) {
    return null;
  }
}

const FM = native('AppleFM');
const SPOT = native('RoadSpotlight');

const INSTRUCTIONS =
  'You are a commercial vehicle inspection assistant. You never certify a truck roadworthy, ' +
  'you never interpret a regulation, and you never promise that a defect is harmless. ' +
  'Use only the values given. Two short sentences, plain English, no bullet lists.';

async function availability() {
  if (!FM || !FM.availability) return { available: false, reason: 'module-missing', backend: 'none' };
  try {
    return await FM.availability();
  } catch (e) {
    return { available: false, reason: 'probe-failed', backend: 'none' };
  }
}

function promptFor(result, unit) {
  const bad = result.items.filter((i) => i.status === 'warn' || i.status === 'fail');
  const rows = bad.map((i) => `${i.label}: ${i.status}${i.measured !== null ? ` (${i.measured})` : ''}`).join('; ') || 'none';
  return [
    `Unit: ${(unit && unit.number) || 'unnamed'}.`,
    `Overall: ${result.overall}.`,
    `Flagged: ${rows}.`,
    `Open blockers: ${result.blockers.join('; ') || 'none'}.`,
    'What should the driver do before moving this unit, and what must they not conclude from this record?',
  ].join(' ');
}

async function explain(result, unit) {
  const fallback = localExplain(result, unit);
  if (!FM || !FM.respond) return { text: fallback, backend: 'local' };
  try {
    const r = await FM.respond(promptFor(result, unit), INSTRUCTIONS);
    if (r && r.ok && r.text) return { text: r.text, backend: r.backend };
    return { text: fallback, backend: 'local', error: r && r.error };
  } catch (e) {
    return { text: fallback, backend: 'local', error: String(e && e.message) };
  }
}

// Deterministic wording used offline and as the model's fallback. It must never
// sound like a clearance: the record says what was found, not what is safe.
function localExplain(result, unit) {
  const name = (unit && unit.number) || 'This unit';
  if (result.overall === 'notEvaluated') {
    return `${name} has no items answered yet. Walk the unit, mark each item, then sign the report.`;
  }
  if (result.blockers && result.blockers.length) {
    return `${name}: ${result.blockers[0]}. Do not move the unit until that is resolved and a repair sign-off is recorded.`;
  }
  const bad = result.items.filter((i) => i.status === 'warn' || i.status === 'fail');
  if (!bad.length) {
    return `All ${result.counts.pass} answered items came back OK. This records what you checked; it does not certify the vehicle roadworthy.`;
  }
  const first = bad[0];
  return `${first.label}: ${first.note || 'marked as a defect'}. Note it, keep the unit where it is until the shop signs it off, and inspect it again before departure.`;
}

async function indexUnit(unit, result) {
  if (!SPOT || !SPOT.indexUnit) return false;
  try {
    return await SPOT.indexUnit(unit.id, unit.number, result.overall, unit.plate || '');
  } catch (e) {
    return false;
  }
}

async function indexReport(reportId, title, subtitle) {
  if (!SPOT || !SPOT.indexReport) return false;
  try {
    return await SPOT.indexReport(reportId, title, subtitle);
  } catch (e) {
    return false;
  }
}

async function clearIndex() {
  if (!SPOT || !SPOT.clear) return false;
  try {
    return await SPOT.clear();
  } catch (e) {
    return false;
  }
}

// Widget / Control share one small snapshot through the App Group. Writing it is
// best-effort: the app works whether or not the extension is installed.
async function syncWidget(unit, result, extra) {
  if (!SPOT || !SPOT.setWidgetSnapshot) return false;
  const snapshot = {
    unitId: unit ? unit.id : '',
    number: unit ? unit.number : 'TripProof',
    overall: result ? result.overall : 'notEvaluated',
    pass: result ? result.counts.pass : 0,
    warn: result ? result.counts.warn : 0,
    fail: result ? result.counts.fail : 0,
    openDefects: (extra && extra.openDefects) || 0,
    checkedToday: (extra && extra.checkedToday) || false,
    updatedAt: new Date().toISOString(),
  };
  try {
    return await SPOT.setWidgetSnapshot(JSON.stringify(snapshot));
  } catch (e) {
    return false;
  }
}

module.exports = { availability, explain, localExplain, indexUnit, indexReport, clearIndex, syncWidget };
