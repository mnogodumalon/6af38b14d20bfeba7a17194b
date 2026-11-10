/**
 * useSensorPairenFlow — the plumbing of the flow « Sensor pairen », generated from the plan.
 *
 * Changes `sensoren`: the record to change is picked (`flow.pick('sensoren')`), the form is prefilled with its values; asks `partner_id`; sets `status` itself.
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 3)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *
 *   const flow = useSensorPairenFlow({
 *     steps: { sensoren: 1, partner_id: 2 },
 *     items: { sensoren: r => ({ id: r.id, title: fieldText(r, 'sensor_id') }) },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     // the record this flow changes: <EntitySelectStep {...flow.picks.sensoren.select} {...flow.pick('sensoren')} />
 *     <Bound form={flow.forms.sensoren} name="partner_id" />
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} />}
 *   </IntentWizardShell>
 */
import { useEffect, useState } from 'react';
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,
  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep, type SummaryItem,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { pickHint, whereSentence, type PickWhere } from '@/lib/journey/policy';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
import { entityLabel } from '@/lib/journey/rules';
export type SensorPairenFieldKey = 'partner_id' | 'sensoren';

export interface SensorPairenForms {
  sensoren: StepForm<'sensoren'>;
}

// Alias so the option generics stay readable.
type Key = SensorPairenFieldKey;

export interface SensorPairenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    sensoren?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
}

const DEFAULT_STEPS: Record<string, number> = {"partner_id": 2, "sensoren": 1};
export const SENSORPAIREN_REVIEW_STEP = 3;

function fromPick<T>(pick: { recordOf(id: string): JourneyRecord | undefined }, form: StepForm, field: string, read: (r: JourneyRecord) => T): T | undefined {
  const id = form.get(field);
  const rec = typeof id === 'string' && id ? pick.recordOf(id) : undefined;
  return rec ? read(rec) : undefined;
}
function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns T, not Partial<T>: a Record's index signature is already "maybe
// absent", and Partial<Record<string, string>> does not assign to the
// Record<string, string> useStepForm wants (tsc, live 23.09.2026 — eight
// errors, one per hook, caught only in the sandbox build).
function only<T extends Record<string, unknown>>(obj: T | undefined, keys: string[]): T | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out as T;
}

function hasValues(form: StepForm): boolean {
  return form.keys.some(k => !isEmptyValue(form.values[k]));
}

export function useSensorPairenFlow(options: SensorPairenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const [sensorenTargetId, setSensorenTargetId] = useState<string | null>(null);
  const sensoren = useStepForm('sensoren', {
    fields: ["partner_id"],
    steps: only(steps, ["partner_id"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["partner_id"]),
    messages: only(options.messages as Record<string, string> | undefined, ["partner_id"]),
  });
  const forms: SensorPairenForms = { sensoren };
  // the editor of a list is not a record of its own: the review and the success
  // page read the entries (PlanStep.review), never the half-filled editor
  const formList: StepForm[] = [sensoren];
  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    sensoren: useRecordSearch(servicePort, 'sensoren', withPickPolicy('sensoren', {
      searchFields: ["sensor_id"] as never,
      filter: "r.v_status == 'noch_verfuegbar'",
      where: (r: JourneyRecord) => (fieldLookup(r, "status")?.key ?? null) === "noch_verfuegbar",
      toItem: options.items?.sensoren as never,
    })),
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // what the person sees under the search field: the rule that narrows the
  // pick (the owner's, else the plan's) — and the link that changes it
  const hintFor = (key: string, entity: EntityKey, planned: PickWhere | null) => pickHint(key, planned,
    w => whereSentence(w, f => labelOf(entity, f), (f, v) => optionsOf(entity, f).find(o => o.key === String(v))?.label ?? String(v)),
    `#/verwaltung/anwendung?line=intent:sensor-pairen:read:${entity}`);
  // a fixed value the flow sets itself, as a review row with the link that changes it
  const setting = (entity: EntityKey, field: string, value: unknown): SummaryItem => ({
    key: `setting:${entity}.${field}`, label: labelOf(entity, field),
    value: optionsOf(entity, field).find(o => o.key === String(value))?.label ?? String(value ?? ''),
    href: `#/verwaltung/anwendung?line=intent:sensor-pairen:write:${entity}.${field}`,
  });
  const picks = {
    sensoren: { ...searches.sensoren, select: { ...searches.sensoren.select, create: false as boolean, hint: hintFor('sensoren', 'sensoren', {"conditions": [{"field": "status", "op": "eq", "value": "noch_verfuegbar"}], "mode": "all"} as PickWhere | null) } },
  };

  const plan: PlanStep[] = [
    {
      key: 'sensoren', entity: 'sensoren', form: sensoren, primary: true,
      updates: () => sensorenTargetId ?? undefined,
      // the review names the record this step changes; "Ändern" leads back to its pick
      target: () => sensorenTargetId
        ? { key: 'target:sensoren', label: entityLabel('sensoren'), value: picks.sensoren.labelOf(sensorenTargetId) ?? sensorenTargetId, step: steps.sensoren }
        : undefined,
      values: (): FormValues => ({
        status: policyFixedValue('sensoren', 'status') ?? "gepaired",
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('sensoren', 'status', policyFixedValue('sensoren', 'status') ?? "gepaired")],

      // the planner's assumptions that first act here — shown once with „Passt“ / „ändern“
      notices: () => [{"assumed": "nur beim Pairen", "id": "partner-id-nur-gepaired", "question": "Partner-ID nur bei Status gepaired erfassen"}],
    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'sensor-pairen' });

  /** The record(s) this flow CHANGES: picked through {...flow.picks.<entity>.select} {...flow.pick('<entity>')};
   *  picking prefills the form with the record's current values, and the plan step updates that record. */
  const targets = {
    sensoren: {
      selectedId: sensorenTargetId,
      onSelect: (id: string) => {
        setSensorenTargetId(id);
        const rec = picks.sensoren.recordOf(id);
        if (rec) sensoren.reset({ partner_id: fieldText(rec, "partner_id"), });
      },
      get record(): JourneyRecord | undefined { return sensorenTargetId ? picks.sensoren.recordOf(sensorenTargetId) : undefined; },
    },
  };
  // Opened for one record — `#/intents/sensor-pairen?record=<id>`, the dashboard's
  // flowActionFor(): that record is the one to change. Loaded, taken into the
  // pick and selected — when this flow may change it at all (the pick's rule).
  const [linkedId] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('record'));
  useEffect(() => {
    if (!linkedId) return;
    let on = true;
    void servicePort.get('sensoren', linkedId).then(rec => {
      if (!on || !rec || !((r: JourneyRecord) => (fieldLookup(r, "status")?.key ?? null) === "noch_verfuegbar")(rec)) return;
      picks.sensoren.adopt(rec);
      targets.sensoren.onSelect(rec.id);
    }).catch(() => undefined);
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link
  }, [linkedId]);
  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: SensorPairenFieldKey) => {
    if (field in targets) {
      const t = targets[field as keyof typeof targets];
      return { selectedId: t.selectedId, onSelect: t.onSelect };
    }
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return {
      selectedId: (typeof owner.get(field) === 'string' ? (owner.get(field) as string) : null) || null,
      // `field as never` collapsed the conditional SetArgs<E, never> to never and
      // no argument was assignable any more (tsc, live 23.09.2026); widen `set`
      // itself instead — the label stays a required third argument.
      onSelect: (id: string) => (owner.set as (k: string, v: unknown, l?: string) => void)(field, id, search?.labelOf(id)),
    };
  };
  /** Props for a multi-record pick step: {...flow.picks.x.select} {...flow.pickMany('x')} */
  const pickMany = (field: SensorPairenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)))    && Object.entries(targets).every(([k, t]) => steps[k] !== n || !!t.selectedId);
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); setSensorenTargetId(null); };

  return {
    slug: 'sensor-pairen' as const,
    draftKey: 'sensor-pairen' as const,
    entity: 'sensoren' as const,
    form: sensoren,
    forms, formList, picks, submit, steps, targets,    reviewStep: SENSORPAIREN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type SensorPairenFlow = ReturnType<typeof useSensorPairenFlow>;
