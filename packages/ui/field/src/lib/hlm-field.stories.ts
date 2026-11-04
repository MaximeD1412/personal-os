import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { HlmInput } from '@personal-os/ui/input';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HlmFieldImports } from '../index';

// Le master `FormField` de la planche `02 Forms` : libellé, champ, aide ou
// erreur. L'erreur s'affiche quand le contrôle est invalide et touché ; elle
// remplace l'aide.

type Args = { libelle: string; aide: string; erreur: string; enErreur: boolean };

const champ = (
  id: string,
  controle: string,
  { aide = true, erreur = true } = {},
) => `
  <div hlmField class="w-60">
    <label hlmFieldLabel for="${id}">{{ libelle }}</label>
    <input hlmInput id="${id}" [formControl]="${controle}" placeholder="Saisir un titre…" />
    ${aide ? '<p hlmFieldDescription>{{ aide }}</p>' : ''}
    ${erreur ? '<hlm-field-error>{{ erreur }}</hlm-field-error>' : ''}
  </div>`;

const controles = (enErreur = false) => {
  const enErreurControle = new FormControl('', Validators.required);
  if (enErreur) enErreurControle.markAsTouched();
  return {
    vide: new FormControl(''),
    enErreurControle,
    desactive: new FormControl({ value: 'Contrôle annuel', disabled: true }),
  };
};

const meta: Meta<Args> = {
  title: 'Forms/FormField',
  decorators: [
    moduleMetadata({ imports: [HlmFieldImports, HlmInput, ReactiveFormsModule] }),
  ],
  args: {
    libelle: "Titre de l'événement",
    aide: "Texte d'aide",
    erreur: 'Saisir un titre.',
    enErreur: false,
  },
  argTypes: {
    libelle: { name: 'libellé', control: 'text' },
    aide: { control: 'text' },
    erreur: { control: 'text' },
    enErreur: { name: 'en erreur', control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<Args>;

export const Champ: Story = {
  render: (args) => ({
    props: { ...args, ...controles(args.enErreur) },
    template: champ('champ', 'enErreurControle'),
  }),
};

export const Etats: Story = {
  name: 'États',
  parameters: { controls: { disable: true } },
  render: (args) => ({
    props: { ...args, ...controles(true) },
    template: `
      <div class="flex flex-wrap items-start gap-6">
        ${champ('champ-defaut', 'vide', { aide: false, erreur: false })}
        ${champ('champ-aide', 'vide', { erreur: false })}
        ${champ('champ-erreur', 'enErreurControle')}
        ${champ('champ-desactive', 'desactive', { erreur: false })}
      </div>`,
  }),
};
