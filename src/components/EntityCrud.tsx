/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'kundendienstbueros'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.kundendienstbueros.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.kundendienstbueros.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.kundendienstbueros.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.kundendienstbueros              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled; list-field back-references additionally get a
 * "choose existing" picker that links an EXISTING record — built in, do not
 * re-roll). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   kundendienstbueros: bezeichnung, strasse, hausnummer, postleitzahl, ort, ansprechpartner_vorname, ansprechpartner_nachname, telefon, …  ·  ← sensoren (list + contextual +)
 *   sensoren: sensor_id, kundendienstbuero, versanddatum, status, partner_id  ·  → kundendienstbueros
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Kundendienstbueros, Sensoren } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichSensoren } from '@/lib/enrich';
import type { EnrichedSensoren } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { KundendienstbuerosDialog, type KundendienstbuerosDialogDefaults } from '@/components/dialogs/KundendienstbuerosDialog';
import { KundendienstbuerosDetails } from '@/components/details/KundendienstbuerosDetails';
import { SensorenDialog, type SensorenDialogDefaults } from '@/components/dialogs/SensorenDialog';
import { SensorenDetails } from '@/components/details/SensorenDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { usePermissions } from '@/lib/permissions';
import { toast } from 'sonner';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'kundendienstbueros'; record: Kundendienstbueros }
  | { type: 'sensoren'; record: EnrichedSensoren };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
  /** May the signed-in user create/change records of this list? (the
   *  platform's rights — show a „+ Neu“ only when true; openCreate/openEdit
   *  refuse with a notice otherwise). */
  canWrite: boolean;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  kundendienstbueros: EntityCrudApi<Kundendienstbueros, KundendienstbuerosDialogDefaults>;
  sensoren: EntityCrudApi<Sensoren, SensorenDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { kundendienstbueros: Kundendienstbueros[]; sensoren: EnrichedSensoren[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  // the platform's rights of the signed-in user (lib/permissions.ts) — unknown = allowed
  const perms = usePermissions();
  const refuse = () => { toast.error(t('perm_denied_title'), { description: t('perm_denied_desc') }); };
  const [kundendienstbuerosDialog, setKundendienstbuerosDialog] = useState<{ defaults?: KundendienstbuerosDialogDefaults; editing?: Kundendienstbueros } | null>(null);
  const [sensorenDialog, setSensorenDialog] = useState<{ defaults?: SensorenDialogDefaults; editing?: Sensoren } | null>(null);
  const enrichedSensoren = useMemo(() => enrichSensoren(data.sensoren, { kundendienstbuerosMap: data.kundendienstbuerosMap }), [data.sensoren, data.kundendienstbuerosMap]);

  function detailKundendienstbueros(record: Kundendienstbueros, push = false) {
    const item: OverlayItem = { type: 'kundendienstbueros', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitKundendienstbueros(fields: Kundendienstbueros['fields']) {
    const editing = kundendienstbuerosDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setKundendienstbueros(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateKundendienstbuero(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('kundendienstbueros')} — ${t('crud_updated')}`, async () => {
        data.setKundendienstbueros(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateKundendienstbuero(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createKundendienstbuero(fields);
      undoToast(`${appLabel('kundendienstbueros')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailSensoren(record: Sensoren, push = false) {
    const rec = enrichedSensoren.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'sensoren', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitSensoren(fields: Sensoren['fields']) {
    const editing = sensorenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setSensoren(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateSensorenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('sensoren')} — ${t('crud_updated')}`, async () => {
        data.setSensoren(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateSensorenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createSensorenEntry(fields);
      undoToast(`${appLabel('sensoren')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <KundendienstbuerosDialog
        open={kundendienstbuerosDialog !== null}
        onClose={() => setKundendienstbuerosDialog(null)}
        onSubmit={submitKundendienstbueros}
        defaultValues={kundendienstbuerosDialog?.defaults}
        recordId={kundendienstbuerosDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Kundendienstbueros']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Kundendienstbueros']}
      />
      <SensorenDialog
        open={sensorenDialog !== null}
        onClose={() => setSensorenDialog(null)}
        onSubmit={submitSensoren}
        defaultValues={sensorenDialog?.defaults}
        recordId={sensorenDialog?.editing?.record_id}
        kundendienstbuerosList={data.kundendienstbueros}
        enablePhotoScan={AI_PHOTO_SCAN['Sensoren']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Sensoren']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'kundendienstbueros') {
            return (
              <>
                <RecordHeader title={top.record.fields.bezeichnung ?? appLabel('kundendienstbueros')} subtitle={undefined} />
                <KundendienstbuerosDetails
                  record={top.record}
                  sensorenList={data.sensoren}
                  onOpenSensoren={(r) => detailSensoren(r, true)}
                  onAddSensoren={perms.canWrite('sensoren') ? () => setSensorenDialog({ defaults: { kundendienstbuero: createRecordUrl(APP_IDS.KUNDENDIENSTBUEROS, top.record.record_id) } }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'sensoren') {
            return (
              <>
                <RecordHeader title={top.record.fields.sensor_id ?? appLabel('sensoren')} subtitle={top.record.fields.versanddatum ? formatDate(top.record.fields.versanddatum) : undefined} />
                <SensorenDetails
                  record={top.record}
                  kundendienstbuerosList={data.kundendienstbueros}
                  onOpenKundendienstbueros={(r) => detailKundendienstbueros(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        canEdit={(top) => {
          if (top.type === 'kundendienstbueros') return perms.canWrite('kundendienstbueros');
          if (top.type === 'sensoren') return perms.canWrite('sensoren');
          return true;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'kundendienstbueros') setKundendienstbuerosDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'sensoren') setSensorenDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    kundendienstbueros: {
      openCreate: (defaults?: KundendienstbuerosDialogDefaults) => (perms.canWrite('kundendienstbueros') ? setKundendienstbuerosDialog({ defaults }) : refuse()),
      openEdit: (record: Kundendienstbueros) => (perms.canWrite('kundendienstbueros') ? setKundendienstbuerosDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Kundendienstbueros) => detailKundendienstbueros(record, false),
      canWrite: perms.canWrite('kundendienstbueros'),
    },
    sensoren: {
      openCreate: (defaults?: SensorenDialogDefaults) => (perms.canWrite('sensoren') ? setSensorenDialog({ defaults }) : refuse()),
      openEdit: (record: Sensoren) => (perms.canWrite('sensoren') ? setSensorenDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Sensoren) => detailSensoren(record, false),
      canWrite: perms.canWrite('sensoren'),
    },
    enriched: { kundendienstbueros: data.kundendienstbueros, sensoren: enrichedSensoren },
  };
}
