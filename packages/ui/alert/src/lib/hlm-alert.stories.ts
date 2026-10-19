import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HlmAlertImports } from '../index';
import type { AlertTone } from './hlm-alert';

// Le master `Banner` de la planche `05 Feedback` et sa galerie : info, succès,
// avertissement (avec badge), critique.

type Args = {
  tone: AlertTone;
  titre: string;
  message: string;
  badge: string;
  secondaire: string;
  principale: string;
};

const banniere = (
  tone: string,
  { titre = '{{ titre }}', message = '{{ message }}', badge = '', secondaire = '{{ secondaire }}', principale = '{{ principale }}' } = {},
) => `
  <div hlmAlert tone="${tone}">
    <hlm-alert-icon />
    <div hlmAlertContent>
      <p hlmAlertTitle>${titre}${badge ? `<span hlmBadge tone="warning">${badge}</span>` : ''}</p>
      <p hlmAlertDescription>${message}</p>
    </div>
    <div hlmAlertAction>
      <button hlmBtn variant="secondary" size="sm">${secondaire}</button>
      <button hlmBtn size="sm" hlmAlertPrimaryAction>${principale}</button>
    </div>
  </div>`;

const meta: Meta<Args> = {
  title: 'Feedback/Banner',
  decorators: [
    moduleMetadata({ imports: [HlmAlertImports, HlmButton, HlmBadge] }),
  ],
  args: {
    tone: 'warning',
    titre: 'Le planning a changé : 3 ingrédients manquent',
    message:
      'Le dîner de samedi a été révisé. Les articles manquants peuvent être ajoutés à la liste de courses.',
    badge: '+3 articles',
    secondaire: 'Ignorer',
    principale: 'Produire la liste',
  },
  argTypes: {
    tone: {
      name: 'tonalité',
      control: 'inline-radio',
      options: ['info', 'success', 'warning', 'error'],
    },
    badge: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<Args>;

export const Controles: Story = {
  name: 'Contrôles',
  render: (args) => ({
    props: args,
    template: `
      <div hlmAlert class="max-w-180" [tone]="tone">
        <hlm-alert-icon />
        <div hlmAlertContent>
          <p hlmAlertTitle>{{ titre }} @if (badge) { <span hlmBadge tone="warning">{{ badge }}</span> }</p>
          <p hlmAlertDescription>{{ message }}</p>
        </div>
        <div hlmAlertAction>
          <button hlmBtn variant="secondary" size="sm">{{ secondaire }}</button>
          <button hlmBtn size="sm" hlmAlertPrimaryAction>{{ principale }}</button>
        </div>
      </div>`,
  }),
};

export const Galerie: Story = {
  name: 'Tonalités',
  parameters: { controls: { disable: true } },
  render: () => ({
    template: `
      <div class="flex max-w-180 flex-col gap-space-md">
        ${banniere('info', { titre: 'Nouvelle version disponible', message: 'La mise à jour est planifiée ce soir à 02:00.', secondaire: 'Plus tard', principale: 'Mettre à jour' })}
        ${banniere('success', { titre: 'Synchronisation terminée', message: '42 événements fusionnés sans conflit.', secondaire: 'Fermer', principale: "Voir l'agenda" })}
        ${banniere('warning', { titre: 'Le planning a changé : 3 ingrédients manquent', message: 'Le dîner de samedi a été révisé.', badge: '+3 articles', secondaire: 'Ignorer', principale: 'Produire la liste' })}
        ${banniere('error', { titre: "La liste n'a pas pu être clôturée", message: 'La liste de courses est déjà clôturée.', secondaire: 'Fermer', principale: 'Réessayer' })}
      </div>`,
  }),
};

/** Le bandeau d'un formulaire prérempli : un titre, un message, sans action. */
export const SansAction: Story = {
  name: 'Sans action',
  parameters: { controls: { disable: true } },
  render: () => ({
    template: `
      <div hlmAlert tone="warning" class="max-w-180">
        <hlm-alert-icon />
        <div hlmAlertContent>
          <p hlmAlertTitle>Certaines valeurs du lien n'ont pas été reprises : couleur=violet, lieu=</p>
          <p hlmAlertDescription>Elles ne correspondent à aucune valeur admise : saisis-les dans le formulaire.</p>
        </div>
      </div>`,
  }),
};
