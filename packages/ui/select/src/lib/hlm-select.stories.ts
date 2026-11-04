import { HlmLabel } from '@personal-os/ui/label';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HlmSelectImports } from '../index';

// Le Select n'a pas de master : il reprend l'apparence de `Input`, avec
// l'icône de fin `keyboard_arrow_down` (galerie « select » de `02 Forms`).

const CATEGORIES = [
  { valeur: 'rendez-vous', libelle: 'Rendez-vous' },
  { valeur: 'echeance', libelle: 'Échéance' },
  { valeur: 'rappel', libelle: 'Rappel' },
];

const select = (
  id: string,
  { declencheur = '', valeur = 'null', select = '', legende = '' } = {},
) => `
  <div class="flex flex-col gap-1.5">
    <label hlmLabel for="${id}">Catégorie</label>
    <hlm-select [value]="${valeur}" [itemToString]="libelle" ${select}>
      <hlm-select-trigger buttonId="${id}" class="w-60" ${declencheur}>
        <hlm-select-value placeholder="Choisir une catégorie" />
      </hlm-select-trigger>
      <hlm-select-content *hlmSelectPortal>
        @for (categorie of categories; track categorie.valeur) {
          <hlm-select-item [value]="categorie.valeur">{{ categorie.libelle }}</hlm-select-item>
        }
      </hlm-select-content>
    </hlm-select>
    <span class="text-label-micro text-outline">${legende}</span>
  </div>`;

const props = {
  categories: CATEGORIES,
  libelle: (valeur: string | null | undefined) =>
    CATEGORIES.find((categorie) => categorie.valeur === valeur)?.libelle ?? '',
};

const meta: Meta = {
  title: 'Forms/Select',
  decorators: [moduleMetadata({ imports: [HlmSelectImports, HlmLabel] })],
  parameters: { controls: { disable: true } },
};
export default meta;

type Story = StoryObj;

export const Selecteur: Story = {
  name: 'Sélecteur',
  render: () => ({ props, template: select('select-categorie') }),
};

export const Etats: Story = {
  name: 'États',
  parameters: {
    pseudo: {
      hover: '[data-etat=hover] button',
      focusVisible: '[data-etat=focus] button',
    },
  },
  render: () => ({
    props,
    template: `
      <div class="flex flex-wrap items-start gap-6">
        ${select('select-defaut', { legende: 'default' })}
        <div data-etat="hover">${select('select-survol', { legende: 'hover' })}</div>
        <div data-etat="focus">${select('select-focus', { legende: 'focus' })}</div>
        ${select('select-rempli', { valeur: "'echeance'", legende: 'filled' })}
        ${select('select-erreur', { declencheur: 'forceInvalid', legende: 'error' })}
        ${select('select-desactive', { select: '[disabled]="true"', legende: 'disabled' })}
        ${select('select-taille', { declencheur: 'size="lg"', legende: 'lg · 40' })}
      </div>`,
  }),
};
