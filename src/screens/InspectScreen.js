import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, space, radius } from '../theme';
import { Card, Btn, Field, Toggle, statusColor } from '../ui';

const CHIPS = [
  { key: 'ok', label: 'OK', color: colors.accent },
  { key: 'defect', label: 'DEF', color: colors.fail },
  { key: 'na', label: 'N/A', color: colors.neutral },
];

export default function InspectScreen({ unit, evaluate, lastOdometer, groups, checklist, onSubmit, onNav, aiText, onAsk }) {
  const [type, setType] = useState('pre-trip');
  const [odometer, setOdometer] = useState('');
  const [results, setResults] = useState({});
  const [signature, setSignature] = useState('');
  const requiresCoupling = !!(unit && unit.tows);

  const result = useMemo(
    () =>
      evaluate({
        results,
        odometer: odometer === '' ? null : Number(odometer),
        lastOdometer,
        requiresCoupling,
        placardPsi: unit ? unit.placardPsi : null,
      }),
    [results, odometer, lastOdometer, requiresCoupling, unit, evaluate]
  );

  if (!unit) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Add a unit first.</Text>
        <Btn title="Go to truck" onPress={() => onNav('truck')} />
      </View>
    );
  }

  const mark = (id, key) => {
    setResults((r) => {
      const cur = r[id];
      if (cur && cur.state === key) {
        const next = { ...r };
        delete next[id];
        return next;
      }
      return { ...r, [id]: { state: key, value: cur ? cur.value : null } };
    });
  };

  const measure = (id, raw) => {
    const v = raw === '' ? null : Number(raw);
    setResults((r) => ({ ...r, [id]: { state: (r[id] && r[id].state) || 'ok', value: Number.isFinite(v) ? v : null } }));
  };

  const submit = () => {
    if (!signature.trim()) return;
    const stateDefects = result.items
      .filter((i) => i.status === 'warn' || i.status === 'fail')
      .map((i) => ({ itemId: i.id, label: i.label, severity: i.status === 'fail' ? 'critical' : 'minor', note: i.note || '' }));
    onSubmit({
      type,
      odometer: Number(odometer) || null,
      results,
      defects: stateDefects,
      signature: signature.trim(),
      overall: result.overall,
      criticalFails: result.counts.fail,
    });
    setResults({});
    setSignature('');
    setOdometer('');
  };

  const unitLabel = `${unit.number}${requiresCoupling ? ' + trailer' : ''}`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.title}>{unitLabel}</Text>
        <Text style={styles.hint}>
          {result.counts.pass} OK · {result.counts.warn} defect · {result.counts.fail} critical · {result.counts.notEvaluated} skipped
          {result.blockers.length ? ` · ${result.blockers[0]}` : ''}
        </Text>
        <Text style={styles.label}>Inspection type</Text>
        <Toggle options={['pre-trip', 'post-trip']} value={type} onChange={setType} />
        <Field label="Odometer (mi)" value={odometer} onChange={setOdometer} placeholder="184320" keyboard="numeric" />
        {result.odometer.status !== 'notEvaluated' ? (
          <Text style={styles.odo}>
            {result.odometer.delta === null ? result.odometer.note : `Since last inspection: ${result.odometer.delta} mi · ${result.odometer.note || 'consistent'}`}
          </Text>
        ) : null}
        <View style={styles.row}>
          <Btn title="Ask AI" onPress={onAsk} disabled={!result.items.length} />
          <Btn title="Report" kind="ghost" onPress={() => onNav('report')} />
        </View>
        {aiText ? <Text style={styles.ai}>{aiText}</Text> : null}
      </Card>

      {groups.map((g) => {
        const rows = checklist.filter((it) => it.group === g.id && (g.id !== 'coupling' || requiresCoupling));
        if (!rows.length) return null;
        return (
          <View key={g.id} style={styles.group}>
            <Text style={styles.groupLabel}>{g.label}</Text>
            {rows.map((it) => {
              const row = result.items.find((x) => x.id === it.id);
              const entry = results[it.id] || {};
              const measured = it.id === 'tread' || it.id === 'tirepressure';
              return (
                <View key={it.id} style={styles.item}>
                  <View style={styles.itemTop}>
                    <View style={[styles.dot, { backgroundColor: statusColor(row ? row.status : 'notEvaluated') }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemLabel}>{it.label}</Text>
                      <Text style={styles.cfr}>{it.cfr}{it.critical ? ' · critical' : ''}</Text>
                    </View>
                    <View style={styles.chips}>
                      {CHIPS.map((c) => {
                        const on = entry.state === c.key;
                        return (
                          <Pressable key={c.key} onPress={() => mark(it.id, c.key)} style={[styles.chip, on && { backgroundColor: c.color, borderColor: c.color }]}>
                            <Text style={[styles.chipText, on && { color: '#fff' }]}>{c.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  {measured && entry.state && entry.state !== 'na' ? (
                    <View style={styles.measureRow}>
                      <Text style={styles.measureLabel}>{it.id === 'tread' ? 'Worst tread /32 in' : 'Lowest psi'}</Text>
                      <TextInput
                        style={styles.measureInput}
                        value={entry.value === null || entry.value === undefined ? '' : String(entry.value)}
                        onChangeText={(v) => measure(it.id, v)}
                        keyboardType="numeric"
                        placeholder={it.id === 'tread' ? '6' : '105'}
                        placeholderTextColor="#9AA39E"
                      />
                      {row && row.note ? <Text style={styles.measureNote}>{row.note}</Text> : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}

      <Card>
        <Text style={styles.title}>Sign the report</Text>
        <Text style={styles.hint}>
          Typing your name locks this record: the payload is hashed and chained to the previous report, so a later edit or deletion breaks the chain.
        </Text>
        <Field label="Driver signature" value={signature} onChange={setSignature} placeholder="Type your full name" />
        <Btn
          title={result.blockers.length ? 'Sign anyway (will be flagged)' : 'Sign & save inspection'}
          onPress={submit}
          disabled={!signature.trim() || result.counts.notEvaluated + result.counts.pass + result.counts.warn + result.counts.fail === 0}
        />
        <Text style={styles.foot}>Rule set {result.ruleVersion}. This is a record of what you checked, not a roadworthiness certificate.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  emptyText: { color: colors.sub, marginBottom: space.md },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.sub, marginTop: 4, marginBottom: space.md, lineHeight: 17 },
  label: { fontSize: 11, letterSpacing: 0.6, color: colors.sub, fontWeight: '600', marginBottom: 6 },
  odo: { fontSize: 12, color: colors.sub, marginBottom: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm },
  ai: { marginTop: space.sm, fontSize: 13, lineHeight: 19, color: colors.ink },
  group: { marginBottom: space.md },
  groupLabel: { fontSize: 11, letterSpacing: 1, fontWeight: '700', color: colors.sub, marginBottom: 6 },
  item: { backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  itemTop: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10, alignSelf: 'flex-start', marginTop: 4 },
  itemLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  cfr: { fontSize: 10, color: colors.sub, marginTop: 2 },
  chips: { flexDirection: 'row' },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4, marginLeft: 4 },
  chipText: { fontSize: 10, fontWeight: '700', color: colors.sub },
  measureRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  measureLabel: { fontSize: 11, color: colors.sub, flex: 1 },
  measureInput: { width: 70, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 14, color: colors.ink, textAlign: 'right' },
  measureNote: { fontSize: 10, color: colors.fail, marginLeft: 8 },
  foot: { fontSize: 11, color: colors.sub, marginTop: space.sm, lineHeight: 16 },
});
