// Feedback is part of the product, not a mailto afterthought: every report can
// carry a "missed / false alarm / unclear" note, stored locally first so it
// survives even when the phone is offline and the owner never sends it.
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

const KEY = 'roadproof.feedback.v1';
const CAP = 50;

async function list() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

async function log(kind, note, context) {
  const entry = {
    kind,
    note: String(note || '').slice(0, 400),
    context: context || {},
    at: new Date().toISOString(),
  };
  const all = await list();
  const next = [entry, ...all].slice(0, CAP);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    // a failed write must not break the report screen
  }
  return entry;
}

module.exports = { list, log };
