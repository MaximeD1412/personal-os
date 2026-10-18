import { HlmFieldImports } from '@personal-os/ui/field';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HlmSwitch } from './hlm-switch';

// Le master `Switch` de la planche `02 Forms` et sa galerie d'états.

type Args = { checked: boolean; disabled: boolean; libelle: string };

const echantillon = (legende: string, contenu: string) => `
  <div class="flex flex-col items-start gap-1.5">
    ${contenu}
    <span class="text-label-micro text-outline">${legende}</span>
  </div>`;

const meta: Meta<Args> = {
  title: 'Forms/Switch',
  component: HlmSwitch,
  decorators: [moduleMetadata({ imports: [HlmSwitch, HlmFieldImports] })],
  args: { checked: true, disabled: false, libelle: 'Rappels activés' },
  argTypes: { libelle: { name: 'libellé', control: 'text' } },
};
export default meta;

type Story = StoryObj<Args>;

export const Interrupteur: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div hlmField orientation="horizontal">
        <hlm-switch inputId="interrupteur" [checked]="checked" [disabled]="disabled" />
        <label hlmFieldLabel for="interrupteur">{{ libelle }}</label>
      </div>`,
  }),
};

export const Etats: Story = {
  name: 'États',
  parameters: {
    controls: { disable: true },
    pseudo: {
      hover: '[data-etat=hover] button',
      focusVisible: '[data-etat=focus] button',
    },
  },
  render: () => ({
    template: `
      <div class="flex items-start gap-6">
        ${echantillon('on', '<hlm-switch aria-label="Rappels" checked />')}
        ${echantillon('off', '<hlm-switch aria-label="Rappels" />')}
        ${echantillon('hover', '<span data-etat="hover"><hlm-switch aria-label="Rappels" checked /></span>')}
        ${echantillon('focus', '<span data-etat="focus"><hlm-switch aria-label="Rappels" checked /></span>')}
        ${echantillon('disabled', '<hlm-switch aria-label="Rappels" checked disabled />')}
        ${echantillon('off disabled', '<hlm-switch aria-label="Rappels" disabled />')}
      </div>`,
  }),
};
