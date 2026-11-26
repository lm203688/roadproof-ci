const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../src/kernel');

// --- checklist integrity ---------------------------------------------------
test('checklist ids are unique and every row cites a rule', () => {
  const ids = K.CHECKLIST.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const row of K.CHECKLIST) {
    assert.match(row.cfr, /396\.11\(a\)\(2\)/);
    assert.ok(K.GROUPS.some((g) => g.id === row.group), `${row.id} has unknown group`);
  }
  assert.ok(K.CHECKLIST.filter((i) => i.critical).length >= 8);
});

test('threshold table is frozen and versioned', () => {
  assert.equal(K.THRESHOLDS.version, 'rp-1.0.0');
  assert.ok(Object.isFrozen(K.THRESHOLDS));
});

// --- tire maths -----------------------------------------------------------
test('tread depth: under 2/32 fails, under 4/32 warns, 6/32 passes', () => {
  assert.equal(K.tireTread(1.5), K.FAIL);
  assert.equal(K.tireTread(2), K.WARN);
  assert.equal(K.tireTread(3.9), K.WARN);
  assert.equal(K.tireTread(4), K.PASS);
  assert.equal(K.tireTread(6), K.PASS);
  assert.equal(K.tireTread(null), K.NE);
});

test('pressure: below 90% of placard fails, at placard passes', () => {
  assert.equal(K.tirePressure(90, 110), K.FAIL);
  assert.equal(K.tirePressure(99, 110), K.PASS);
  assert.equal(K.tirePressure(110, 110), K.PASS);
  assert.equal(K.tirePressure(110, null), K.NE);
});

// --- odometer -------------------------------------------------------------
test('odometer: backwards fails, big jump warns, normal passes', () => {
  assert.equal(K.odometerCheck(100, 200).status, K.FAIL);
  assert.equal(K.odometerCheck(2000, 200).status, K.WARN);
  assert.equal(K.odometerCheck(210, 200).status, K.PASS);
  assert.equal(K.odometerCheck(200, 200).status, K.PASS);
  assert.equal(K.odometerCheck(500, null).status, K.NE);
});

// --- defect ageing --------------------------------------------------------
test('defect ageing: small wait warns, long wait fails, repaired passes', () => {
  const now = '2026-11-26T00:00:00Z';
  const d = { severity: 'minor', reportedAt: '2026-11-23T00:00:00Z', repairedAt: null };
  assert.equal(K.defectStatus(d, now).status, K.WARN);
  const old = { severity: 'minor', reportedAt: '2026-11-10T00:00:00Z', repairedAt: null };
  assert.equal(K.defectStatus(old, now).status, K.FAIL);
  const fixed = { ...old, repairedAt: '2026-11-20T00:00:00Z' };
  assert.equal(K.defectStatus(fixed, now).status, K.PASS);
  const critical = { severity: 'critical', reportedAt: '2026-11-25T00:00:00Z', repairedAt: null };
  assert.equal(K.defectStatus(critical, now).status, K.FAIL);
});

// --- reminders ------------------------------------------------------------
test('reminders: overdue fails, inside 30 days warns, far out passes', () => {
  const now = '2026-11-26T00:00:00Z';
  const rows = K.reminders(
    { annualInspectionDue: '2026-11-20', registrationDue: '2026-12-10', insuranceDue: '2027-06-01' },
    now
  );
  assert.equal(rows[0].status, K.FAIL);
  assert.ok(rows[0].daysLeft < 0);
  assert.equal(rows[1].status, K.WARN);
  assert.equal(rows[2].status, K.PASS);
  assert.equal(K.reminders({}, now)[0].status, K.NE);
});

// --- inspection -----------------------------------------------------------
const allOk = () => {
  const r = {};
  for (const it of K.CHECKLIST) r[it.id] = { state: 'ok' };
  return r;
};

test('a full walk-around with no defects passes', () => {
  const res = K.evaluateInspection({ results: allOk(), odometer: 1000, lastOdometer: 900, requiresCoupling: true });
  assert.equal(res.overall, K.PASS);
  assert.equal(res.counts.fail, 0);
  assert.equal(res.completeness, 1);
  assert.deepEqual(res.blockers, []);
});

test('one critical defect stops the inspection', () => {
  const r = allOk();
  r.servicebrake = { state: 'defect' };
  const res = K.evaluateInspection({ results: r, odometer: 1000, lastOdometer: 900, requiresCoupling: true });
  assert.equal(res.overall, K.FAIL);
  assert.equal(res.counts.fail, 1);
});

test('a non-critical defect only warns', () => {
  const r = allOk();
  r.damage = { state: 'defect' };
  const res = K.evaluateInspection({ results: r, odometer: 1000, lastOdometer: 900, requiresCoupling: true });
  assert.equal(res.overall, K.WARN);
  assert.equal(res.counts.warn, 1);
});

test('a skipped item is never a pass', () => {
  const r = allOk();
  r.headlights = { state: 'na' };
  const res = K.evaluateInspection({ results: r, odometer: 1000, lastOdometer: 900, requiresCoupling: true });
  assert.equal(res.overall, K.WARN);
  assert.equal(res.unansweredRequired, 1);
  assert.equal(res.items.find((i) => i.id === 'headlights').status, K.NE);
});

test('coupling rows are hidden when the unit does not tow', () => {
  const res = K.evaluateInspection({ results: allOk(), requiresCoupling: false });
  assert.ok(!res.items.some((i) => i.group === 'coupling'));
  const res2 = K.evaluateInspection({ results: allOk(), requiresCoupling: true });
  assert.ok(res2.items.some((i) => i.group === 'coupling'));
});

test('tread entered as a number overrides a bare OK tap', () => {
  const r = allOk();
  r.tread = { state: 'ok', value: 3 };
  const res = K.evaluateInspection({ results: r, requiresCoupling: false });
  assert.equal(res.items.find((i) => i.id === 'tread').status, K.WARN);
  assert.equal(res.overall, K.WARN);
});

test('low tire pressure against the placard fails', () => {
  const r = allOk();
  r.tirepressure = { state: 'ok', value: 80 };
  const res = K.evaluateInspection({ results: r, placardPsi: 110, requiresCoupling: false });
  assert.equal(res.items.find((i) => i.id === 'tirepressure').status, K.FAIL);
  assert.equal(res.overall, K.FAIL);
});

test('an open critical defect fails even when every item was tapped OK', () => {
  const res = K.evaluateInspection({
    results: allOk(),
    requiresCoupling: false,
    defects: [{ severity: 'critical', reportedAt: '2026-11-25T00:00:00Z', repairedAt: null }],
  });
  assert.equal(res.overall, K.FAIL);
  assert.ok(res.blockers.join(' ').includes('critical'));
});

test('nothing answered is not a pass', () => {
  const res = K.evaluateInspection({ results: {} });
  assert.equal(res.overall, K.NE);
  assert.equal(res.completeness, 0);
});

// --- record chain ---------------------------------------------------------
test('hash is stable for the same payload and changes on any edit', () => {
  const payload = { unit: 'UNIT 1', type: 'pre-trip', at: '2026-11-26T05:00:00Z', odometer: 1200, results: { brakes: { state: 'ok' } }, defects: [], signature: 'Xing Li' };
  const a = K.recordHash(payload, null);
  const b = K.recordHash(payload, null);
  assert.equal(a, b);
  const edited = { ...payload, odometer: 1201 };
  assert.notEqual(K.recordHash(edited, null), a);
  const chained = K.recordHash(payload, 'deadbeef');
  assert.notEqual(chained, a);
});

test('chain verifies when intact and breaks when a record is edited', () => {
  const p1 = { unit: 'U', type: 'pre-trip', at: '2026-11-24T05:00:00Z', odometer: 900, results: {}, defects: [], signature: 'A' };
  const p2 = { unit: 'U', type: 'post-trip', at: '2026-11-24T18:00:00Z', odometer: 1010, results: {}, defects: [], signature: 'A' };
  const h1 = K.recordHash(p1, null);
  const h2 = K.recordHash(p2, h1);
  const chain = [{ payload: p1, hash: h1 }, { payload: p2, hash: h2 }];
  assert.equal(K.verifyChain(chain).ok, true);
  const tampered = [{ payload: { ...p1, odometer: 950 }, hash: h1 }, { payload: p2, hash: h2 }];
  const v = K.verifyChain(tampered);
  assert.equal(v.ok, false);
  assert.equal(v.at, 0);
});