import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { navigationDeDemo } from '../storybook/navigation-de-demo';
import { DccmFormPage } from './form-page';

// Le motif « formulaire prérempli » : ouvert par un lien
// (`/sport/seances/nouvelle?title=…&color=violet`), il reprend ce que le
// contrat accepte, signale le reste en bandeau, et affiche sous chaque champ
// l'erreur que l'API renvoie pour lui. Trois présentations, une seule route.

type Args = {
  presentation: 'page' | 'panel' | 'sheet';
  ignores: string[];
  refusSansChamp: boolean;
  envoi: boolean;
};

const champs = `
  <div class="grid gap-gutter md:grid-cols-3">
    <div hlmField>
      <label hlmFieldLabel for="titre">Titre de la séance</label>
      <input hlmInput id="titre" value="Haltérophilie et gainage" />
      <p hlmFieldDescription>Repris du lien.</p>
    </div>
    <div hlmField>
      <label hlmFieldLabel for="date">Date</label>
      <input hlmInput id="date" type="date" value="2026-06-02" />
    </div>
    <div hlmField>
      <label hlmFieldLabel for="debut">Heure de début</label>
      <input hlmInput id="debut" value="25:00" forceInvalid />
      <hlm-field-error forceShow>L'heure doit être comprise entre 00:00 et 23:59.</hlm-field-error>
    </div>
    <div hlmField>
      <label hlmFieldLabel for="lieu">Lieu</label>
      <input hlmInput id="lieu" placeholder="Salle, parc…" />
    </div>
  </div>`;

const formulaire = (presentation: string, grille = champs) => `
  <dccm-form-page
    heading="Nouvelle séance"
    subtitle="Sport"
    [breadcrumb]="fil"
    ${presentation}
    submitLabel="Enregistrer la séance"
    [ignored]="ignores"
    [error]="refusSansChamp ? refus : null"
    [pending]="envoi"
  >${grille}</dccm-form-page>`;

const meta: Meta<Args> = {
  title: 'Patterns/FormPage',
  decorators: [
    applicationConfig({ providers: [...navigationDeDemo()] }),
    moduleMetadata({ imports: [DccmFormPage, HlmFieldImports, HlmInput] }),
  ],
  args: {
    presentation: 'page',
    ignores: ['color=violet', 'location='],
    refusSansChamp: false,
    envoi: false,
  },
  argTypes: {
    presentation: {
      name: 'présentation',
      control: 'inline-radio',
      options: ['page', 'panel', 'sheet'],
    },
    ignores: { name: 'paramètres écartés', control: 'object' },
    refusSansChamp: { name: 'refus sans champ (422)', control: 'boolean' },
    envoi: { name: 'envoi en cours', control: 'boolean' },
  },
  render: (args) => ({
    props: {
      ...args,
      fil: [{ label: 'Sport', link: '/sport' }, { label: 'Nouvelle séance' }],
      refus: { message: 'Une séance est déjà planifiée sur ce créneau.' },
    },
    template: `<div class="max-w-280">${formulaire('[presentation]="presentation"')}</div>`,
  }),
};
export default meta;

type Story = StoryObj<Args>;

export const Page: Story = {};

export const RefusDeLApi: Story = {
  name: "Refus de l'API sans champ",
  args: { ignores: [], refusSansChamp: true },
};

export const EnvoiEnCours: Story = {
  name: 'Envoi en cours',
  args: { ignores: [], envoi: true },
};

/** À droite d'une liste, comme le formulaire du Calendrier à 1424. */
export const Panneau: Story = {
  args: { presentation: 'panel' },
  render: (args) => ({
    props: { ...args, fil: [], refus: { message: '' } },
    template: `
      <div class="grid gap-gutter xl:grid-cols-[1fr_24rem]">
        <div class="min-h-96 rounded-md border border-surface-container-highest bg-surface-container"></div>
        ${formulaire('presentation="panel"', champs.replace('md:grid-cols-3', ''))}
      </div>`,
  }),
};

/** Une feuille qui monte du bas, comme le formulaire du Calendrier à 390. */
export const Feuille: Story = {
  tags: ['!autodocs'],
  args: { presentation: 'sheet' },
  parameters: {
    viewport: {
      options: {
        mobile: { name: 'Mobile 390', styles: { width: '390px', height: '844px' }, type: 'mobile' },
      },
    },
  },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  render: (args) => ({
    props: { ...args, fil: [], refus: { message: '' } },
    template: formulaire('presentation="sheet"', champs.replace('md:grid-cols-3', '')),
  }),
};
