import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { navigationDeDemo } from '../storybook/navigation-de-demo';
import { DccmNavItem } from './nav-item';

// Les masters `NavItem` (Sidebar) et `RailItem` (`compact`). Sur un lien, il
// mène à un écran ; « À venir », il n'est ni un lien ni dans la tabulation.
const meta: Meta<DccmNavItem> = {
  title: 'Navigation/NavItem',
  component: DccmNavItem,
  decorators: [
    applicationConfig({ providers: navigationDeDemo() }),
    moduleMetadata({ imports: [DccmNavItem] }),
  ],
  args: {
    label: 'Agenda',
    icon: 'matCalendarViewDayOutline',
    active: false,
    comingSoon: false,
    compact: false,
  },
  argTypes: {
    icon: {
      control: 'select',
      options: ['matCalendarViewDayOutline', 'matHomeOutline', 'matAccountBalanceWalletOutline'],
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="w-56 bg-surface-container-lowest p-space-sm">
        @if (comingSoon) {
          <span dccmNavItem comingSoon [label]="label" [icon]="icon" [compact]="compact"></span>
        } @else {
          <a dccmNavItem href="#" [label]="label" [icon]="icon" [active]="active" [compact]="compact"></a>
        }
      </div>
    `,
  }),
};
export default meta;

type Story = StoryObj<DccmNavItem>;

export const Controles: Story = { name: 'Contrôles' };

const echantillon = (legende: string, contenu: string) => `
  <div class="flex flex-col gap-1.5">
    ${contenu}
    <span class="text-label-micro text-outline">${legende}</span>
  </div>`;

/** La galerie de `NavItem` : repos, survol, actif, focus, à venir. */
export const Etats: Story = {
  name: 'États',
  parameters: {
    controls: { disable: true },
    pseudo: { hover: '[data-etat=hover]', focusVisible: '[data-etat=focus]' },
  },
  render: () => ({
    template: `
      <div class="flex w-56 flex-col gap-space-md bg-surface-container-lowest p-space-sm">
        ${echantillon('Repos', '<a dccmNavItem href="#" icon="matHomeOutline" label="Accueil"></a>')}
        ${echantillon('Survol', '<a dccmNavItem href="#" data-etat="hover" icon="matHomeOutline" label="Accueil"></a>')}
        ${echantillon('Actif', '<a dccmNavItem href="#" active icon="matCalendarViewDayOutline" label="Agenda"></a>')}
        ${echantillon('Focus', '<a dccmNavItem href="#" data-etat="focus" icon="matHomeOutline" label="Accueil"></a>')}
        ${echantillon('À venir', '<span dccmNavItem comingSoon icon="matAccountBalanceWalletOutline" label="Finances"></span>')}
      </div>
    `,
  }),
};

/** La galerie de `RailItem` : repos, survol, actif, à venir (estompé). */
export const Rail: Story = {
  parameters: { controls: { disable: true }, pseudo: { hover: '[data-etat=hover]' } },
  render: () => ({
    template: `
      <div class="flex gap-space-md bg-surface-container-lowest p-space-md">
        ${echantillon('Repos', '<a dccmNavItem compact href="#" icon="matHomeOutline" label="Accueil"></a>')}
        ${echantillon('Survol', '<a dccmNavItem compact href="#" data-etat="hover" icon="matHomeOutline" label="Accueil"></a>')}
        ${echantillon('Actif', '<a dccmNavItem compact href="#" active icon="matCalendarViewDayOutline" label="Agenda"></a>')}
        ${echantillon('À venir', '<span dccmNavItem compact comingSoon icon="matAccountBalanceWalletOutline" label="Finances"></span>')}
      </div>
    `,
  }),
};
