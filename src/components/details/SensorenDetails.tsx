import type { Sensoren, Kundendienstbueros } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { usePermissions } from '@/lib/permissions';

export interface SensorenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Sensoren;
  /** N:1-Ziel „Kundendienstbueros": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  kundendienstbuerosList: Kundendienstbueros[];
  /** Klick auf die Kundendienstbueros-Relation → overlay.push auf dessen Detail. */
  onOpenKundendienstbueros?: (record: Kundendienstbueros) => void;
}

export function SensorenDetails({
  record,
  kundendienstbuerosList,
  onOpenKundendienstbueros,
}: SensorenDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const kundendienstbueroTarget = kundendienstbuerosList.find(r => r.record_id === extractRecordId(record.fields.kundendienstbuero));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('sensoren', 'sensor_id')} value={record.fields.sensor_id} format="text" />
        <RecordField label={fieldLabel('sensoren', 'versanddatum')} value={record.fields.versanddatum} format="date" />
        <RecordField label={fieldLabel('sensoren', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('sensoren', 'partner_id')} value={record.fields.partner_id} format="text" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('sensoren', 'kundendienstbuero')}
          name={kundendienstbueroTarget?.fields.bezeichnung ?? '—'}
          meta={[kundendienstbueroTarget?.fields.telefon, kundendienstbueroTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={kundendienstbueroTarget && onOpenKundendienstbueros ? () => onOpenKundendienstbueros!(kundendienstbueroTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.SENSOREN} recordId={record.record_id} readOnly={!perms.canWrite('sensoren')} />
    </>
  );
}
