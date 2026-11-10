/**
 * Sensor an Büro versenden — 4-Schritt-Wizard.
 * Steps: 1) Sensor-ID eingeben → 2) Kundendienstbüro wählen → 3) Versanddatum festlegen → 4) Prüfen & speichern.
 * Reads: kundendienstbueros. Writes: sensoren (Status „Noch verfügbar“ setzt der Ablauf selbst).
 * Composes: IntentWizardShell, Bound, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, todayIso } from '@/lib/journey';
import { useSensorVersendenFlow } from '@/lib/journey/flows/SensorVersenden';
import { tx } from '@/i18n';

export default function SensorVersendenPage() {
  const [step, setStep] = useState(1);
  const flow = useSensorVersendenFlow({
    steps: { sensor_id: 1, kundendienstbuero: 2, versanddatum: 3 },
    items: {
      kundendienstbuero: r => ({
        id: r.id,
        title: fieldText(r, 'bezeichnung'),
        subtitle: fieldText(r, 'ort'),
      }),
    },
    initial: { versanddatum: todayIso() },
  });

  return (
    <IntentWizardShell
      title={tx('Sensor an Büro versenden')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Erfasse einen neuen Sensor und ordne ihn einem Kundendienstbüro zu.'),
        needs: [tx('Sensor-ID'), tx('Das Kundendienstbüro'), tx('Das Versanddatum')],
      }}
    >
      <WizardStep label={tx('Sensor-ID')} description={tx('Gib die ID des Sensors ein, der versendet wird.')}>
        <div className="space-y-4">
          <Bound form={flow.forms.sensoren} name="sensor_id" placeholder={tx('z. B. SN-10234')} />
          <StepNav hideBack onNext={() => flow.validateStep(1)} nextStepLabel={tx('Kundendienstbüro')} />
        </div>
      </WizardStep>

      <WizardStep
        label={tx('Kundendienstbüro')}
        description={tx('Wähle das Büro, an das der Sensor geht.')}
        needs={['sensor_id']}
      >
        <EntitySelectStep
          {...flow.picks.kundendienstbuero.select}
          {...flow.pick('kundendienstbuero')}
          searchPlaceholder={tx('Bezeichnung oder Ort …')}
          avatar="none"
        />
      </WizardStep>

      <WizardStep
        label={tx('Versanddatum')}
        description={tx('Wann geht der Sensor raus?')}
        needs={['sensor_id', 'kundendienstbuero']}
      >
        <div className="space-y-4">
          <Bound form={flow.forms.sensoren} name="versanddatum" />
          <StepNav onBack={() => setStep(2)} onNext={() => flow.validateStep(3)} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status'), value: tx('Noch verfügbar') }]}
            whatHappensNext={tx('Der Sensor wird als „Noch verfügbar“ gespeichert und kann danach gepairt werden.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Sensor pairen'), href: '#/intents/sensor-pairen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Sobald ein Partner den Sensor erhält, kannst du ihn pairen.')}
        />
      )}
    </IntentWizardShell>
  );
}
