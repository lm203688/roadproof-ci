import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, space, radius } from '../theme';
import { Card, Btn, Pill, statusColor } from '../ui';

export default function DefectsScreen({ unit, defects, onRepair, onNav }) {
  const [note, setNote] = useState({});

  if (!unit) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Add a unit first.</Text>
        <Btn title="Go to truck" onPress={() => onNav('truck')} />
      </View>
    );
  }

  const open = defects.filter((d) => !d.repairedAt);
  const closed = defects.filter((d) => d.repairedAt);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.title}>Defects · {unit.number}</Text>
        <Text style={styles.hint}>
          {open.length} open · {closed.length} repaired. An open critical defect keeps the unit flagged out of service until the shop signs it off here.
        </Text>
      </Card>

      {open.map((d) => {
        const days = Math.max(0, Math.floor((Date.now() - Date.parse(d.reportedAt)) / 86400000));
        const label = d.severity === 'critical' ? 'critical' : 'minor';
        return (
          <View key={d.id} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.label}>{d.label}</Text>
              <Pill status={d.severity === 'critical' ? 'fail' : 'warn'} />
            </View>
            <Text style={styles.meta}>
              {label} · reported {d.reportedAt.slice(0, 10)} · {days} d open{d.note ? ` · ${d.note}` : ''}
            </Text>
            <View style={styles.repairRow}>
              <TextInput
                style={styles.input}
                value={note[d.id] || ''}
                onChangeText={(v) => setNote((n) => ({ ...n, [d.id]: v }))}
                placeholder="Repair note / sign-off"
                placeholderTextColor="#9AA39E"
              />
              <Btn title="Signed off" onPress={() => { onRepair(d.id, note[d.id] || ''); setNote((n) => ({ ...n, [d.id]: '' })); }} />
            </View>
          </View>
        );
      })}

      {!open.length ? <Text style={styles.none}>No open defects on this unit.</Text> : null}

      {closed.length ? (
        <Card>
          <Text style={styles.label}>Repaired history</Text>
          {closed.slice(-8).reverse().map((d) => (
            <View key={d.id} style={styles.closedRow}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text style={styles.closedLabel}>{d.label}</Text>
              <Text style={styles.closedMeta}>{String(d.repairedAt).slice(0, 10)}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  emptyText: { color: colors.sub, marginBottom: space.md },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.sub, marginTop: 4, lineHeight: 17 },
  row: { backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink, flex: 1, paddingRight: 8 },
  meta: { fontSize: 11, color: colors.sub, marginTop: 4 },
  repairRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  input: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, color: colors.ink, marginRight: 8 },
  none: { fontSize: 13, color: colors.sub, textAlign: 'center', marginVertical: space.lg },
  closedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  closedLabel: { flex: 1, fontSize: 13, color: colors.ink },
  closedMeta: { fontSize: 11, color: colors.sub },
});
