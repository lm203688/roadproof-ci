import React, { useState } from 'react';
import { View, Text, ScrollView, Share, StyleSheet } from 'react-native';
import { colors, space } from '../theme';
import { Card, Btn, Pill } from '../ui';

function asText(unit, inspections) {
  const head = `${unit.number} · ${unit.plate || 'no plate'} · ${unit.type}`;
  const rows = inspections
    .slice(-10)
    .reverse()
    .map((i) => `${i.at.slice(0, 16).replace('T', ' ')} ${i.type} · ${i.overall} · ${i.odometer || '-'} mi · ${i.hash}`);
  return ['TripProof driver vehicle inspection record', head, '', ...rows, '', 'Record only. Not a roadworthiness certificate.'].join('\n');
}

export default function ReportScreen({ unit, inspections, chain, onNav }) {
  const [shared, setShared] = useState(false);

  if (!unit) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Add a unit first.</Text>
        <Btn title="Go to truck" onPress={() => onNav('truck')} />
      </View>
    );
  }

  const rows = inspections.filter((i) => i.unitId === unit.id);
  const latest = rows[rows.length - 1];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}>
      <Card>
        <Text style={styles.title}>Record · {unit.number}</Text>
        <Text style={styles.hint}>
          {rows.length} signed inspection{rows.length === 1 ? '' : 's'} · chain {chain.ok ? 'verified' : `broken at #${chain.at + 1}`}
        </Text>
        {latest ? (
          <View style={styles.latest}>
            <Pill status={latest.overall} />
            <Text style={styles.latestText}>
              {latest.type} · {latest.at.slice(0, 16).replace('T', ' ')} · {latest.odometer || '-'} mi
            </Text>
            <Text style={styles.hash}>hash {latest.hash}</Text>
          </View>
        ) : (
          <Text style={styles.none}>No signed inspection yet.</Text>
        )}
        <Btn
          title="Share record as text"
          onPress={async () => {
            await Share.share({ message: asText(unit, rows) });
            setShared(true);
          }}
          disabled={!rows.length}
        />
        {shared ? <Text style={styles.none}>Record handed to the share sheet.</Text> : null}
      </Card>

      {rows.length ? (
        <Card>
          <Text style={styles.label}>All signed records</Text>
          {rows.slice().reverse().map((i, idx) => (
            <View key={i.id} style={styles.row}>
              <Text style={styles.rowNo}>#{rows.length - idx}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{i.type} · {i.overall}</Text>
                <Text style={styles.rowMeta}>{i.at.slice(0, 16).replace('T', ' ')} · {i.odometer || '-'} mi · {i.signature}</Text>
              </View>
              <Text style={styles.rowHash}>{i.hash.slice(0, 6)}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Text style={styles.foot}>
        Each record is hashed with the one before it. Editing or deleting an older record breaks the chain, which is visible above.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  emptyText: { color: colors.sub, marginBottom: space.md },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.sub, marginTop: 4, lineHeight: 17 },
  latest: { marginVertical: space.md, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  latestText: { fontSize: 13, color: colors.ink, marginTop: 6 },
  hash: { fontSize: 10, color: colors.sub, marginTop: 4 },
  none: { fontSize: 12, color: colors.sub, marginTop: space.sm },
  label: { fontSize: 11, letterSpacing: 0.6, color: colors.sub, fontWeight: '600', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowNo: { width: 28, fontSize: 12, color: colors.sub },
  rowLabel: { fontSize: 13, fontWeight: '600', color: colors.ink },
  rowMeta: { fontSize: 11, color: colors.sub, marginTop: 2 },
  rowHash: { fontSize: 10, color: colors.accent },
  foot: { fontSize: 11, color: colors.sub, lineHeight: 16, marginTop: space.md },
});
