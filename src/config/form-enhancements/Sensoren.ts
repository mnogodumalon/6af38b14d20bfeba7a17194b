// Auto-generated. Per-entity form-enhancements config for "Sensoren".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["sensor_id", "kundendienstbuero", {"row": ["status", "versanddatum"], "cols": "1fr 1fr"}, "partner_id"],
  defaults: {
    'status': { kind: 'lookup', key: 'noch_verfuegbar', label: 'Noch verfügbar' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
