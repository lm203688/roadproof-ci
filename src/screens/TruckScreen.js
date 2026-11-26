import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, space, radius } from '../theme';
import { Card, Btn, Field, Toggle, Divider, Pill, statusColor } from '../ui';

const blank = {
  number: '', plate: '', plateState: '', type: 'tractor', tows: 'no',
  placardPsi: '', annualInspectionDue: '', registrationDue: '', insuranceDue: '',
};

export default function TruckScreen({ unit, units, reminders, onAdd, onSelect, onNav }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.number.trim()) return;
    onAdd({ ...form, tows: form.tows === 'yes' });
    setForm(blank);
    setShowForm(false);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}>
      {!units.length || showForm ? (
        <Card>
          <Text style={styles.title}>Add a unit</Text>
          <Text style={styles.hint}>One tractor, one straight truck, one unit number. Nothing leaves the phone.</Text>
          <Field label="Unit number" value={form.number} onChange={set('number')} placeholder="UNIT 104" />
          <View style={styles.two}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field label="Plate" value={form.plate} onChange={set('plate')} placeholder="ABC1234" />
            </View>
            <View style={{ width: 90 }}>
              <Field label="State" value={form.plateState} onChange={set('plateState')} placeholder="TX" />
            </View>
          </View>
          <Text style={styles.label}>Type</Text>
          <Toggle options={['tractor', 'straight', 'van']} value={form.type} onChange={set('type')} />
          <Text style={styles.label}>Tows a trailer?</Text>
          <Toggle options={['yes', 'no']} value={form.tows} onChange={set('tows')} />
          <Field label="Tire placard psi" value={form.placardPsi} onChange={set('placardPsi')} placeholder="110" keyboard="numeric" />
          <Field label="Annual inspection due (YYYY-MM-DD)" value={form.annualInspectionDue} onChange={set('annualInspectionDue')} placeholder="2027-03-31" />
          <Field label="Registration due" value={form.registrationDue} onChange={set('registrationDue')} placeholder="2027-01-31" />
          <Field label="Insurance due" value={form.insuranceDue} onChange={set('insuranceDue')} placeholder="2026-12-31" />
          <View style={styles.row}>
            <Btn title="Save unit" onPress={submit} disabled={!form.number.trim()} />
            {units.length ? <Btn title="Cancel" kind="ghost" onPress={() => setShowForm(false)} /> : null}
          </View>
        </Card>
      ) : null}

      {units.length && !showForm ? (
        <Card>
          <Text style={styles.title}>{unit ? unit.number : 'Units'}</Text>
          <Text style={styles.hint}>{unit ? `${unit.type}${unit.tows ? ' + trailer' : ''}${unit.plate ? ` · ${unit.plate} ${unit.plateState}` : ''}` : 'Select a unit'}</Text>
          <Divider />
          {reminders.map((r) => (
            <View key={r.id} style={styles.remRow}>
              <View style={[styles.dot, { backgroundColor: statusColor(r.status) }]} />
              <Text style={styles.remLabel}>{r.label}</Text>
              <Text style={styles.remValue}>{r.daysLeft === null ? 'not set' : r.daysLeft < 0 ? `${Math.abs(r.daysLeft)} d overdue` : `${r.daysLeft} d left`}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Btn title="Start inspection" onPress={() => onNav('inspect')} />
            <Btn title="Defects" kind="ghost" onPress={() => onNav('defects')} />
          </View>
        </Card>
      ) : null}

      {units.length ? (
        <Card>
          <Text style={styles.label}>All units</Text>
          {units.map((u) => {
            const on = unit && u.id === unit.id;
            return (
              <Pressable key={u.id} onPress={() => onSelect(u.id)} style={[styles.unitRow, on && styles.unitOn]}>
                <Text style={[styles.unitName, on && { color: colors.accent }]}>{u.number}</Text>
                <Text style={styles.unitMeta}>{u.plate || 'no plate'} · {u.type}{u.tows ? ' + trailer' : ''}</Text>
              </Pressable>
            );
          })}
          {!showForm ? <Btn title="Add another unit" kind="ghost" onPress={() => setShowForm(true)} /> : null}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.sub, marginTop: 4, marginBottom: space.md, lineHeight: 17 },
  label: { fontSize: 11, letterSpacing: 0.6, color: colors.sub, fontWeight: '600', marginBottom: 6 },
  two: { flexDirection: 'row' },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm },
  remRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  remLabel: { flex: 1, fontSize: 14, color: colors.ink },
  remValue: { fontSize: 12, color: colors.sub },
  unitRow: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: radius.sm, marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  unitOn: { borderColor: colors.accent, backgroundColor: '#F2F7F4' },
  unitName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  unitMeta: { fontSize: 12, color: colors.sub, marginTop: 2 },
});
