import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors, space } from './src/theme';
import * as store from './src/store';
import * as ai from './src/ai';
import K from './src/kernel';
import TruckScreen from './src/screens/TruckScreen';
import InspectScreen from './src/screens/InspectScreen';
import DefectsScreen from './src/screens/DefectsScreen';
import RecordScreen from './src/screens/RecordScreen';

const TABS = [
  { key: 'truck', label: 'Truck' },
  { key: 'inspect', label: 'Inspect' },
  { key: 'defects', label: 'Defects' },
  { key: 'record', label: 'Record' },
];

export default function App() {
  const [state, setState] = useState(store.EMPTY);
  const [tab, setTab] = useState('truck');
  const [aiStatus, setAiStatus] = useState(null);
  const [aiText, setAiText] = useState('');

  useEffect(() => {
    store.load().then(setState);
    ai.availability().then(setAiStatus);
  }, []);

  const unit = useMemo(() => {
    return state.units.find((x) => x.id === state.activeUnitId) || state.units[0] || null;
  }, [state]);

  const unitInspections = useMemo(
    () => (unit ? state.inspections.filter((i) => i.unitId === unit.id) : []),
    [unit, state.inspections]
  );

  const unitDefects = useMemo(
    () => (unit ? state.defects.filter((d) => d.unitId === unit.id) : []),
    [unit, state.defects]
  );

  const reminders = useMemo(
    () => (unit ? K.reminders(unit, new Date().toISOString()) : []),
    [unit]
  );

  const chain = useMemo(() => K.verifyChain(unitInspections), [unitInspections]);

  const lastOdometer = useMemo(
    () => (unit ? store.lastOdometer(state, unit.id) : null),
    [unit, state]
  );

  const latest = unitInspections[unitInspections.length - 1];

  // Platform surfaces follow the record: widget snapshot and Spotlight both
  // refresh on every signed inspection, and both fail silently without the
  // native side present.
  useEffect(() => {
    if (!unit) return;
    const openDefects = unitDefects.filter((d) => !d.repairedAt).length;
    ai.syncWidget(unit, latest ? { counts: { pass: 0, warn: 0, fail: 0 }, overall: latest.overall } : null, {
      openDefects,
      checkedToday: !!(latest && latest.at.slice(0, 10) === new Date().toISOString().slice(0, 10)),
    });
    ai.indexUnit(
      unit,
      latest ? { overall: latest.overall, counts: { pass: 0, warn: 0, fail: 0 }, items: [] } : { overall: 'notEvaluated', counts: { pass: 0, warn: 0, fail: 0 }, items: [] }
    );
  }, [unit, unitDefects, latest]);

  const addUnit = async (form) => {
    setState(await store.addUnit(state, form));
    setAiText('');
    setTab('inspect');
  };

  const selectUnit = async (id) => {
    setState(await store.selectUnit(state, id));
  };

  const submitInspection = async (payload) => {
    setState(await store.addInspection(state, { ...payload, unitId: unit.id }));
    setAiText('');
    setTab('record');
  };

  const repair = async (id, note) => {
    setState(await store.repairDefect(state, id, note));
  };

  const ask = async () => {
    if (!unit) return;
    const r = await ai.explain(
      { overall: latest ? latest.overall : 'notEvaluated', counts: { pass: 0, warn: 0, fail: 0 }, items: [], blockers: [] }, 
      unit
    );
    setAiText(r.text);
  };

  const common = { unit, onNav: setTab };

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.brand}>TripProof</Text>
          <Text style={styles.tag}>one-time · offline · no account</Text>
        </View>

        <View style={{ flex: 1 }}>
          {tab === 'truck' ? (
            <TruckScreen {...common} units={state.units} reminders={reminders} onAdd={addUnit} onSelect={selectUnit} />
          ) : null}
          {tab === 'inspect' ? (
            <InspectScreen
              {...common}
              evaluate={K.evaluateInspection}
              lastOdometer={lastOdometer}
              groups={K.GROUPS}
              checklist={K.CHECKLIST}
              aiText={aiText}
              onAsk={ask}
              onSubmit={submitInspection}
            />
          ) : null}
          {tab === 'defects' ? <DefectsScreen {...common} defects={unitDefects} onRepair={repair} /> : null}
          {tab === 'record' ? <RecordScreen {...common} inspections={unitInspections} chain={chain} /> : null}
        </View>

        <View style={styles.tabs}>
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tab}>
                <Text style={[styles.tabText, on && styles.tabOn]}>{t.label}</Text>
                {on ? <View style={styles.tabMark} /> : null}
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  brand: { fontSize: 13, fontWeight: '700', letterSpacing: 1.2, color: colors.ink, textTransform: 'uppercase' },
  tag: { fontSize: 10, color: colors.sub, letterSpacing: 0.4 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.card },
  tab: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 16 },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.sub },
  tabOn: { color: colors.accent },
  tabMark: { width: 16, height: 2, backgroundColor: colors.accent, marginTop: 6, borderRadius: 1 },
});
