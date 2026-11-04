import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import {
  navigationDeDemo,
  ONGLETS_DE_DEMO,
} from '../storybook/navigation-de-demo';
import { DccmTabBar, DccmTabBarItem } from './tab-bar';

// Les masters `MobileTabBar` et `TabBarItem` : quatre onglets, puis « Plus »,
// projeté, qui ouvre le panneau de navigation.
const meta: Meta<DccmTabBar> = {
  title: 'Navigation/MobileTabBar',
  component: DccmTabBar,
  decorators: [
    applicationConfig({ providers: navigationDeDemo() }),
    moduleMetadata({ imports: [DccmTabBar, DccmTabBarItem] }),
  ],
  args: { entries: ONGLETS_DE_DEMO },
  render: (args) => ({
    props: args,
    template: `
      <dccm-tab-bar class="w-97.5" [entries]="entries">
        <button dccmTabBarItem type="button" icon="matMoreHorizOutline" label="Plus"></button>
      </dccm-tab-bar>
    `,
  }),
};
export default meta;

type Story = StoryObj<DccmTabBar>;

/** L'Agenda est l'écran affiché. */
export const BarreDOnglets: Story = { name: "Barre d'onglets" };

/** Les onglets dont l'écran n'existe pas encore sont estompés et non cliquables. */
export const AVenir: Story = {
  name: 'À venir',
  args: {
    entries: ONGLETS_DE_DEMO.map((onglet) =>
      onglet.label === 'Agenda' ? onglet : { ...onglet, comingSoon: true },
    ),
  },
};

/** La galerie de `TabBarItem` : repos, actif, pressé. */
export const Etats: Story = {
  name: 'États',
  parameters: { controls: { disable: true }, pseudo: { active: '[data-etat=pressed]' } },
  render: () => ({
    template: `
      <div class="flex gap-space-md bg-surface p-space-md">
        <a dccmTabBarItem href="#" icon="matDashboardOutline" label="Accueil"></a>
        <a dccmTabBarItem href="#" active icon="matCalendarTodayOutline" label="Agenda"></a>
        <a dccmTabBarItem href="#" data-etat="pressed" icon="matFitnessCenterOutline" label="Sport"></a>
        <span dccmTabBarItem comingSoon icon="matRestaurantOutline" label="Repas"></span>
      </div>
    `,
  }),
};
