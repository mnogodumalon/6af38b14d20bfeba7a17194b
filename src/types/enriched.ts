import type { Sensoren } from './app';

export type EnrichedSensoren = Sensoren & {
  kundendienstbueroName: string;
};
