import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { DccmStepper } from './stepper';

// Le master `Stepper` de la planche `02 Forms` : 28 px, avec unité, 36 px
// sur mobile ; les boutons se désactivent aux bornes.

type Args = {
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  size: 'sm' | 'md';
  disabled: boolean;
};

const echantillon = (legende: string, contenu: string) => `
  <div class="flex flex-col items-start gap-1.5">
    ${contenu}
    <span class="text-label-micro text-outline">${legende}</span>
  </div>`;

const meta: Meta<Args> = {
  title: 'Forms/Stepper',
  component: DccmStepper,
  decorators: [moduleMetadata({ imports: [DccmStepper, ReactiveFormsModule] })],
  args: { value: 2, unit: '', min: 0, max: 10, step: 1, size: 'sm', disabled: false },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    unit: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<Args>;

export const Compteur: Story = {
  render: (args) => ({
    props: args,
    template: `
      <dccm-stepper aria-label="Portions" [(value)]="value" [unit]="unit || null"
        [min]="min" [max]="max" [step]="step" [size]="size" [disabled]="disabled" />`,
  }),
};

export const Galerie: Story = {
  parameters: {
    controls: { disable: true },
    pseudo: { focusVisible: '[data-etat=focus] [role=spinbutton]' },
  },
  render: () => ({
    props: { quantite: new FormControl(850) },
    template: `
      <div class="flex items-start gap-6">
        ${echantillon('default', '<dccm-stepper aria-label="Portions" [value]="2" />')}
        ${echantillon('unit', '<dccm-stepper aria-label="Quantité" unit="g" [step]="50" [formControl]="quantite" />')}
        ${echantillon('mobile 36', '<dccm-stepper aria-label="Portions" size="md" [value]="2" />')}
        ${echantillon('min atteint', '<dccm-stepper aria-label="Portions" [min]="1" [value]="1" />')}
        ${echantillon('max atteint', '<dccm-stepper aria-label="Portions" [max]="8" [value]="8" />')}
        ${echantillon('focus', '<span data-etat="focus"><dccm-stepper aria-label="Portions" [value]="2" /></span>')}
        ${echantillon('disabled', '<dccm-stepper aria-label="Portions" [value]="2" [disabled]="true" />')}
      </div>`,
  }),
};
