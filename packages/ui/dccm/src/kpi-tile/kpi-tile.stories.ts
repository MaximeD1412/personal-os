import { provideIcons } from '@ng-icons/core';
import {
  matFitnessCenterOutline,
  matInventory2Outline,
  matRestaurantOutline,
  matRocketLaunchOutline,
  matShoppingCartOutline,
} from '@ng-icons/material-symbols/outline';
import { HlmBadge } from '@personal-os/ui/badge';
import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { DccmKpiTile } from './kpi-tile';

// Le master `KpiTile`, la rangée de tuiles de l'Accueil. Posée sur un lien,
// la tuile mène au module ; le statut est un texte ou un `hlmBadge` projeté.
const meta: Meta<DccmKpiTile> = {
  title: 'Data Display/KpiTile',
  component: DccmKpiTile,
  decorators: [
    applicationConfig({
      providers: [
        provideIcons({
          matFitnessCenterOutline,
          matInventory2Outline,
          matRestaurantOutline,
          matRocketLaunchOutline,
          matShoppingCartOutline,
        }),
      ],
    }),
    moduleMetadata({ imports: [DccmKpiTile, HlmBadge] }),
  ],
  args: {
    icon: 'matShoppingCartOutline',
    eyebrow: 'Courses',
    value: '12 articles restants',
    meta: 'Rayon frais & épicerie',
    status: 'Liste active',
    link: 'Voir liste',
    tone: 'primary',
  },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'tertiary', 'outline'],
    },
    icon: {
      control: 'select',
      options: [
        'matShoppingCartOutline',
        'matFitnessCenterOutline',
        'matRestaurantOutline',
        'matInventory2Outline',
        'matRocketLaunchOutline',
      ],
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <a dccmKpiTile href="#" class="w-46"
        [icon]="icon" [eyebrow]="eyebrow" [value]="value" [meta]="meta"
        [status]="status" [link]="link" [tone]="tone"></a>
    `,
  }),
};
export default meta;

type Story = StoryObj<DccmKpiTile>;

/** Une tuile qui mène à son module : flèche en haut, survol `surface-container-high`. */
export const Controles: Story = { name: 'Contrôles' };

/** Une tuile par pilier, comme la galerie. */
export const Piliers: Story = {
  render: () => ({
    template: `
      <div class="grid grid-cols-[repeat(4,11.5rem)] gap-gutter">
        <a dccmKpiTile href="#" tone="secondary" icon="matFitnessCenterOutline" eyebrow="Sport"
          value="Séance du jour : 1" meta="Semaine : 3 faites" status="Cycle PPL" link="Voir"></a>
        <a dccmKpiTile href="#" tone="tertiary" icon="matRestaurantOutline" eyebrow="Repas"
          value="Repas de ce soir" meta="Planning : 11 approuvés sur 14" status="Foyer" link="Voir"></a>
        <a dccmKpiTile href="#" tone="tertiary" icon="matInventory2Outline" eyebrow="Stock"
          value="2 ingrédients" meta="périment bientôt" status="Frigo & garde-manger" link="Inventaire"></a>
        <a dccmKpiTile href="#" tone="primary" icon="matRocketLaunchOutline" eyebrow="Projets"
          value="2 en cours" meta="Dashboard DCCM & Infra" status="Sprint 42" link="Backlog"></a>
      </div>
    `,
  }),
};

/** Un statut qui a un sens passe par un badge projeté. */
export const StatutEnBadge: Story = {
  name: 'Statut en badge',
  render: () => ({
    template: `
      <a dccmKpiTile href="#" class="w-46" tone="tertiary" icon="matInventory2Outline" eyebrow="Stock"
        value="2 ingrédients" meta="périment bientôt" link="Inventaire">
        <span hlmBadge tone="warning" dot>À consommer</span>
      </a>
    `,
  }),
};

/** Une tuile qui ne mène nulle part : ni flèche ni survol. */
export const SansLien: Story = {
  name: 'Sans lien',
  render: () => ({
    template: `
      <dccm-kpi-tile class="w-46" icon="matShoppingCartOutline" eyebrow="Courses"
        value="12 articles restants" meta="Rayon frais & épicerie" status="Liste active" />
    `,
  }),
};
