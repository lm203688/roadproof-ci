import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, space, radius } from './theme';

const STATUS = {
  pass: { label: 'OK', color: colors.accent },
  warn: { label: 'WATCH', color: colors.warn },
  fail: { label: 'STOP', color: colors.fail },
  notEvaluated: { label: 'NO DATA', color: colors.neutral },
};

export function statusLabel(s) {
  return (STATUS[s] || STATUS.notEvaluated).label;
}
export function statusColor(s) {
  return (STATUS[s] || STATUS.notEvaluated).color;
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Pill({ status }) {
  const c = statusColor(status);
  return (
    <View style={[styles.pill, { borderColor: c }]}>
      <Text style={[styles.pillText, { color: c }]}>{statusLabel(status)}</Text>
    </View>
  );
}

export function Field({ label, value, onChange, placeholder, keyboard = 'default' }) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9AA39E"
        keyboardType={keyboard}
        autoCapitalize="characters"
      />
    </View>
  );
}

export function Btn({ title, onPress, kind = 'solid', disabled }) {
  const solid = kind === 'solid';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        solid ? styles.btnSolid : styles.btnGhost,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={solid ? styles.btnText : styles.btnGhostText}>{title}</Text>
    </Pressable>
  );
}

export function Toggle({ options, value, onChange }) {
  return (
    <View style={styles.toggle}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={[styles.toggleItem, on && styles.toggleOn]}>
            <Text style={[styles.toggleText, on && { color: '#fff' }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    marginBottom: space.md,
  },
  label: { fontSize: 11, letterSpacing: 0.6, color: colors.sub, fontWeight: '600', marginBottom: 6 },
  pill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  field: { marginBottom: space.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: '#FBFCFB',
  },
  btn: { borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', marginRight: 8, marginBottom: 8 },
  btnSolid: { backgroundColor: colors.accent },
  btnGhost: { borderWidth: 1, borderColor: colors.accent },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnGhostText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  toggle: { flexDirection: 'row', marginBottom: space.md },
  toggleItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, marginRight: 6 },
  toggleOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleText: { fontSize: 12, fontWeight: '600', color: colors.sub },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: space.sm },
});
