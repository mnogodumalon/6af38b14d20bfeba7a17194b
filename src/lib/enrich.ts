import type { EnrichedSensoren } from '@/types/enriched';
import type { Kundendienstbueros, Sensoren } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface SensorenMaps {
  kundendienstbuerosMap: Map<string, Kundendienstbueros>;
}

export function enrichSensoren(
  sensoren: Sensoren[],
  maps: SensorenMaps
): EnrichedSensoren[] {
  return sensoren.map(r => ({
    ...r,
    kundendienstbueroName: resolveDisplay(r.fields.kundendienstbuero, maps.kundendienstbuerosMap, 'bezeichnung'),
  }));
}
