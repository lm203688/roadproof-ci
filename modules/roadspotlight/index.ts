import { requireNativeModule } from 'expo';

type RoadSpotlightShape = {
  indexUnit: (id: string, number: string, status: string, plate: string) => Promise<boolean>;
  indexReport: (id: string, title: string, subtitle: string) => Promise<boolean>;
  clear: () => Promise<boolean>;
  setWidgetSnapshot: (json: string) => Promise<boolean> | boolean;
};

let mod: RoadSpotlightShape | null = null;
try {
  mod = requireNativeModule<RoadSpotlightShape>('RoadSpotlight');
} catch {
  mod = null;
}

/** Null when the native module is absent (e.g. Expo Go). */
export function spotlightModule() {
  return mod;
}