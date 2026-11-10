import type { Kundendienstbueros, Sensoren } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface KundendienstbuerosDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Kundendienstbueros;
  /** 1:N „Sensoren" (kundendienstbuero): VOLLE Liste — der Block filtert auf diesen Record. */
  sensorenList: Sensoren[];
  /** Zeilen-Klick → overlay.push auf das Sensoren-Detail (nie der Edit-Dialog). */
  onOpenSensoren: (record: Sensoren) => void;
  /** Kontextuelles „+": öffnet den Sensoren-Dialog mit diesem Record vorgesetzt. */
  onAddSensoren?: () => void;
}

export function KundendienstbuerosDetails({
  record,
  sensorenList,
  onOpenSensoren,
  onAddSensoren,
}: KundendienstbuerosDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('kundendienstbueros', 'bezeichnung')} value={record.fields.bezeichnung} format="text" />
        <RecordField label={fieldLabel('kundendienstbueros', 'strasse')} value={record.fields.strasse} format="text" />
        <RecordField label={fieldLabel('kundendienstbueros', 'hausnummer')} value={record.fields.hausnummer} format="text" />
        <RecordField label={fieldLabel('kundendienstbueros', 'postleitzahl')} value={record.fields.postleitzahl} format="text" />
        <RecordField label={fieldLabel('kundendienstbueros', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('kundendienstbueros', 'ansprechpartner_vorname')} value={record.fields.ansprechpartner_vorname} format="text" />
        <RecordField label={fieldLabel('kundendienstbueros', 'ansprechpartner_nachname')} value={record.fields.ansprechpartner_nachname} format="text" />
        <RecordField label={fieldLabel('kundendienstbueros', 'telefon')} value={record.fields.telefon} format="text" />
        <RecordField label={fieldLabel('kundendienstbueros', 'email')} value={record.fields.email} format="email" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('sensoren')}
        items={sensorenList.filter(r => extractRecordId(r.fields.kundendienstbuero) === record.record_id)}
        map={r => ({ name: r.fields.sensor_id ?? appLabel('sensoren'), meta: r.fields.versanddatum })}
        onOpen={onOpenSensoren}
        onAdd={onAddSensoren}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.KUNDENDIENSTBUEROS} recordId={record.record_id} readOnly={!perms.canWrite('kundendienstbueros')} />
    </>
  );
}
