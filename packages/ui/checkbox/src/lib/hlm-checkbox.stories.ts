import { HlmFieldImports } from '@personal-os/ui/field';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HlmCheckbox } from './hlm-checkbox';

// Le master `Checkbox` de la planche `02 Forms` et sa galerie d'états.

type Args = { checked: boolean; disabled: boolean; libelle: string };

const echantillon = (legende: string, contenu: string) => `
  <div class="flex flex-col items-start gap-1.5">
    ${contenu}
    <span class="text-label-micro text-outline">${legende}</span>
  </div>`;

const meta: Meta<Args> = {
  title: 'Forms/Checkbox',
  component: HlmCheckbox,
  decorators: [moduleMetadata({ imports: [HlmCheckbox, HlmFieldImports] })],
  args: { checked: false, disabled: false, libelle: 'Lait demi-écrémé' },
  argTypes: { libelle: { name: 'libellé', control: 'text' } },
};
export default meta;

type Story = StoryObj<Args>;

export const Case: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div hlmField orientation="horizontal">
        <hlm-checkbox inputId="case" [checked]="checked" [disabled]="disabled" />
        <label hlmFieldLabel for="case">{{ libelle }}</label>
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
        ${echantillon('unchecked', '<hlm-checkbox aria-label="Article" />')}
        ${echantillon('hover', '<span data-etat="hover"><hlm-checkbox aria-label="Article" /></span>')}
        ${echantillon('checked', '<hlm-checkbox aria-label="Article" checked />')}
        ${echantillon('focus', '<span data-etat="focus"><hlm-checkbox aria-label="Article" /></span>')}
        ${echantillon('disabled', '<hlm-checkbox aria-label="Article" disabled />')}
        ${echantillon('checked disabled', '<hlm-checkbox aria-label="Article" checked disabled />')}
        ${echantillon('error', '<hlm-checkbox aria-label="Article" forceInvalid />')}
      </div>`,
  }),
};
