import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { IconPlus, IconSearch, IconCircleCheck, IconPackage, IconPlugConnected, IconTruckDelivery } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor } from '@/config/plan';
import type { EnrichedSensoren } from '@/types/enriched';
import { lookupKey, formatDate } from '@/lib/formatters';
import { tx, appLabel, fieldLabel } from '@/i18n';
import { useClock, gruss, namen } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatCard, StatCardRow } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChartWidget, type ChartRow, type ChartSegment } from '@/components/widgets/ChartWidget';

type StatusFilter = 'all' | 'noch_verfuegbar' | 'gepaired' | 'ohne_datum';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const crud = useEntityCrud(data);
  const sensoren: EnrichedSensoren[] = crud.enriched.sensoren;
  const clock = useClock();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<ChartSegment<EnrichedSensoren> | null>(null);

  const verfuegbar = useMemo(() => sensoren.filter(s => lookupKey(s.fields.status) === 'noch_verfuegbar'), [sensoren]);
  const gepaired = useMemo(() => sensoren.filter(s => lookupKey(s.fields.status) === 'gepaired'), [sensoren]);
  const ohneDatum = useMemo(() => sensoren.filter(s => !s.fields.versanddatum), [sensoren]);

  const rows = useMemo<ChartRow<EnrichedSensoren>[]>(
    () => sensoren.map(s => ({ id: `sensoren:${s.record_id}`, data: s })),
    [sensoren],
  );

  const recent = useMemo(
    () => sensoren.filter(s => s.fields.versanddatum)
      .sort((a, b) => (b.fields.versanddatum ?? '').localeCompare(a.fields.versanddatum ?? '')),
    [sensoren],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sensoren
      .filter(s => {
        if (filter === 'noch_verfuegbar' || filter === 'gepaired') return lookupKey(s.fields.status) === filter;
        if (filter === 'ohne_datum') return !s.fields.versanddatum;
        return true;
      })
      .filter(s => !sel || sel.test({ id: `sensoren:${s.record_id}`, data: s }))
      .filter(s => !q || [s.fields.sensor_id, s.kundendienstbueroName, s.fields.partner_id]
        .some(v => (v ?? '').toLowerCase().includes(q)))
      .sort((a, b) => (b.fields.versanddatum ?? '').localeCompare(a.fields.versanddatum ?? ''));
  }, [sensoren, filter, search, sel]);

  const toggle = (f: StatusFilter) => setFilter(cur => (cur === f ? 'all' : f));

  const statusWord = (s: EnrichedSensoren) =>
    lookupKey(s.fields.status) === 'gepaired'
      ? <span className="font-medium text-emerald-600">{s.fields.status?.label}</span>
      : <span className="font-medium text-amber-600">{s.fields.status?.label ?? tx('Ohne Status')}</span>;

  const pairAction = (s: EnrichedSensoren) => {
    if (lookupKey(s.fields.status) === 'gepaired') return undefined;
    const go = flowActionFor('sensoren', 'status', s.record_id, 'gepaired');
    return go ? { label: tx('Pairen'), onClick: go } : undefined;
  };

  const last = recent[0];
  const contextLine = sensoren.length === 0
    ? tx('Noch keine Sensoren im Bestand — erfasse den ersten.')
    : last
      ? tx`${verfuegbar.length} Sensoren warten auf ihren Einsatz — zuletzt ging ${last.fields.sensor_id ?? ''} an ${last.kundendienstbueroName || tx('ein Büro')}.`
      : tx`${verfuegbar.length} Sensoren warten auf ihren Einsatz — noch keiner wurde versendet.`;

  const openRecord = (id: string) => {
    const rec = data.sensoren.find(s => s.record_id === id);
    if (rec) crud.sensoren.openDetail(rec);
  };

  const hero = sensoren.length === 0 && crud.sensoren.canWrite ? (
    <div className="rounded-[27px] bg-card p-8 shadow-lg flex flex-col items-center gap-3 text-center">
      <IconPackage size={48} className="text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{tx('Lege deinen ersten Sensor an und ordne ihn einem Kundendienstbüro zu.')}</p>
      <Button onClick={() => crud.sensoren.openCreate({ status: 'noch_verfuegbar' })}>
        <IconPlus size={16} className="mr-1 shrink-0" />{tx('Ersten Sensor erfassen')}
      </Button>
    </div>
  ) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{contextLine}</p>
          <p className="text-xs text-muted-foreground mt-1">{format(clock, 'dd.MM.yyyy')}</p>
        </div>
        {crud.sensoren.canWrite && (
          <Button onClick={() => crud.sensoren.openCreate({ status: 'noch_verfuegbar' })}>
            <IconPlus size={16} className="mr-1 shrink-0" />{tx('Sensor erfassen')}
          </Button>
        )}
      </div>

      <DashboardGrid
        variant="split"
        hero={hero}
        kpis={sensoren.length > 0 ? (
          <StatCardRow>
            <StatCard
              title={tx('Noch verfügbar')}
              value={verfuegbar.length}
              description={verfuegbar.length > 0 ? tx('Bereit zum Versand') : tx('Bestand aufgebraucht')}
              icon={<IconPackage size={18} className="text-muted-foreground" />}
              tone={verfuegbar.length > 0 ? 'primary' : 'warning'}
              onClick={() => toggle('noch_verfuegbar')}
              active={filter === 'noch_verfuegbar'}
            />
            <StatCard
              title={tx('Gepaired')}
              value={gepaired.length}
              description={tx`${Math.round((gepaired.length / sensoren.length) * 100)} % des Bestands im Einsatz`}
              icon={<IconPlugConnected size={18} className="text-muted-foreground" />}
              tone={gepaired.length > 0 ? 'success' : 'default'}
              onClick={() => toggle('gepaired')}
              active={filter === 'gepaired'}
            />
            <StatCard
              title={tx('Ohne Versanddatum')}
              value={ohneDatum.length}
              description={ohneDatum.length > 0 ? tx('Versanddatum nachtragen') : tx('Alles dokumentiert')}
              icon={<IconTruckDelivery size={18} className="text-muted-foreground" />}
              tone={ohneDatum.length > 0 ? 'warning' : 'default'}
              onClick={() => toggle('ohne_datum')}
              active={filter === 'ohne_datum'}
            />
          </StatCardRow>
        ) : undefined}
        aside={sensoren.length > 0 ? (
          <>
            <WorkList
              title={tx('Zuletzt versendet')}
              max={5}
              items={recent.map(s => ({
                id: s.record_id,
                title: s.fields.sensor_id ?? '—',
                secondLine: (
                  <>
                    {statusWord(s)}
                    <span className="text-muted-foreground"> · {s.kundendienstbueroName || '—'} · {formatDate(s.fields.versanddatum)}</span>
                  </>
                ),
                action: pairAction(s),
              }))}
              onItemClick={openRecord}
              empty={{ text: tx('Noch kein Sensor versendet.'), action: crud.sensoren.canWrite ? { label: tx('Sensor erfassen'), onClick: () => crud.sensoren.openCreate({ status: 'noch_verfuegbar' }) } : undefined }}
            />
            <ChartWidget<EnrichedSensoren>
              title={tx('Sensoren je Kundendienstbüro')}
              rows={rows}
              dimension={{ kind: 'category', accessor: r => r.data.kundendienstbueroName, label: appLabel('kundendienstbueros') }}
              interaction={{ mode: 'filter', selectedKey: sel?.key ?? null, onSelect: setSel }}
            />
          </>
        ) : undefined}
        primary={
          <div className="rounded-[27px] bg-card shadow-lg overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{appLabel('sensoren')}</h2>
              <div className="relative w-full sm:w-64">
                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder={tx('Sensor-ID, Büro oder Partner suchen')} />
              </div>
            </div>
            {visible.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">{tx('Keine Sensoren für diese Auswahl.')}</p>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto px-3 pb-4 pt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-medium">{fieldLabel('sensoren', 'sensor_id')}</th>
                        <th className="px-3 py-2 font-medium">{appLabel('kundendienstbueros')}</th>
                        <th className="px-3 py-2 font-medium">{fieldLabel('sensoren', 'versanddatum')}</th>
                        <th className="px-3 py-2 font-medium">{fieldLabel('sensoren', 'status')}</th>
                        <th className="px-3 py-2 font-medium">{fieldLabel('sensoren', 'partner_id')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.slice(0, 50).map(s => (
                        <tr key={s.record_id} className="cursor-pointer border-t border-border hover:bg-muted/50" onClick={() => openRecord(s.record_id)}>
                          <td className="px-3 py-2.5 font-medium">{s.fields.sensor_id ?? '—'}</td>
                          <td className="px-3 py-2.5 truncate max-w-[220px]">{s.kundendienstbueroName || '—'}</td>
                          <td className="px-3 py-2.5">{formatDate(s.fields.versanddatum)}</td>
                          <td className="px-3 py-2.5">{statusWord(s)}</td>
                          <td className="px-3 py-2.5">{s.fields.partner_id || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="md:hidden divide-y divide-border px-3 pb-3">
                  {visible.slice(0, 50).map(s => (
                    <li key={s.record_id}>
                      <button type="button" className="w-full min-w-0 py-3 text-left" onClick={() => openRecord(s.record_id)}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{s.fields.sensor_id ?? '—'}</span>
                          <span className="shrink-0 text-xs">{statusWord(s)}</span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {s.kundendienstbueroName || '—'} · {formatDate(s.fields.versanddatum)}{s.fields.partner_id ? ` · ${s.fields.partner_id}` : ''}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                {visible.length > 50 && (
                  <p className="px-6 pb-4 text-xs text-muted-foreground">{tx`+${visible.length - 50} weitere — Suche verfeinern`}</p>
                )}
              </>
            )}
            {filter === 'gepaired' && gepaired.length > 0 && (
              <p className="flex items-center gap-1 px-6 pb-4 text-xs text-muted-foreground">
                <IconCircleCheck size={14} className="shrink-0" />{tx('Gepairte Sensoren mit Partner-ID')}
              </p>
            )}
          </div>
        }
      />
      {crud.surfaces}
    </div>
  );
}
