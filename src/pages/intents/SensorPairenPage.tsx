/**
 * Sensor pairen — 3-Schritt-Wizard.
 * Steps: 1) Noch verfügbaren Sensor wählen → 2) Partner-ID eingeben → 3) Prüfen & speichern (Status wird „Gepaired“).
 * Reads: sensoren (nur noch_verfuegbar). Writes: sensoren (update — status, partner_id) via useSensorPairenFlow.
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText } from '@/lib/journey';
import { useSensorPairenFlow } from '@/lib/journey/flows/SensorPairen';
import { tx } from '@/i18n';

export default function SensorPairenPage() {
  const [step, setStep] = useState(1);
  const flow = useSensorPairenFlow({
    steps: { sensoren: 1, partner_id: 2 },
    items: {
      sensoren: (r, ctx) => ({
        id: r.id,
        title: fieldText(r, 'sensor_id'),
        subtitle: ctx.ref('kundendienstbuero'),
      }),
    },
    messages: { partner_id: tx('Beim Pairen muss eine Partner-ID eingetragen werden.') },
  });

  return (
    <IntentWizardShell
      title={tx('Sensor pairen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Einen verfügbaren Sensor auswählen und mit einer Partner-ID pairen.'),
        needs: [tx('Sensor-ID'), tx('Partner-ID')],
      }}
    >
      <WizardStep label={tx('Sensor')} description={tx('Welchen noch verfügbaren Sensor möchtest du pairen?')}>
        <EntitySelectStep
          {...flow.picks.sensoren.select}
          {...flow.pick('sensoren')}
          avatar="none"
          searchPlaceholder={tx('Sensor-ID suchen …')}
          emptyText={tx('Es ist kein Sensor mehr verfügbar.')}
        />
      </WizardStep>
      <WizardStep
        label={tx('Partner-ID')}
        description={tx('Trage die Partner-ID ein, mit der der Sensor gepaired wird.')}
        needs={['sensoren']}
      >
        <div className="space-y-4">
          <Bound form={flow.forms.sensoren} name="partner_id" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status'), value: tx('Gepaired') }]}
            whatHappensNext={tx('Der Sensor wird auf „Gepaired“ gesetzt und die Partner-ID gespeichert.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          whatHappensNext={tx('Der Sensor ist jetzt gepaired.')}
          next={[
            { label: tx('Weiteren Sensor pairen'), onClick: () => flow.reset() },
            { label: tx('Sensor an Büro versenden'), href: '#/intents/sensor-versenden' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
