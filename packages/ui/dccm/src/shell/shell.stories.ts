import { HlmSheetImports } from '@personal-os/ui/sheet';
import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { DccmMobileHeader } from '../mobile-header/mobile-header';
import { DccmPageHeader } from '../page-header/page-header';
import { DccmSidebar } from '../sidebar/sidebar';
import {
  GROUPES_DE_DEMO,
  navigationDeDemo,
  ONGLETS_DE_DEMO,
  PIED_DE_DEMO,
} from '../storybook/navigation-de-demo';
import { DccmTabBar, DccmTabBarItem } from '../tab-bar/tab-bar';
import { DccmTopBar } from '../top-bar/top-bar';
import { DccmShell } from './shell';

// Les masters `AppShell/Desktop`, `/Tablet` et `/Mobile` : un seul composant,
// qui range selon la largeur ce qu'on lui projette. Changer de viewport (barre
// d'outils) fait passer de l'un à l'autre.
const VIEWPORTS = {
  mobile: { name: 'Mobile 390', styles: { width: '390px', height: '844px' }, type: 'mobile' },
  tablette: { name: 'Tablette 1024', styles: { width: '1024px', height: '768px' }, type: 'tablet' },
  bureau: { name: 'Bureau 1280', styles: { width: '1280px', height: '800px' }, type: 'desktop' },
};

const meta: Meta<DccmShell> = {
  title: 'Layout/AppShell',
  component: DccmShell,
  decorators: [
    applicationConfig({ providers: navigationDeDemo() }),
    moduleMetadata({
      imports: [
        DccmShell,
        DccmTopBar,
        DccmSidebar,
        DccmMobileHeader,
        DccmTabBar,
        DccmTabBarItem,
        DccmPageHeader,
        HlmSheetImports,
      ],
    }),
  ],
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
  render: () => ({
    props: {
      groupes: GROUPES_DE_DEMO,
      pied: PIED_DE_DEMO,
      onglets: ONGLETS_DE_DEMO,
      etat: { label: 'API joignable', tone: 'success' },
      espaces: [
        { value: 'perso', label: 'Mon espace' },
        { value: 'foyer', label: 'Foyer' },
      ],
      espace: 'perso',
    },
    template: `
      <dccm-shell>
        <dccm-top-bar [scopes]="espaces" [(scope)]="espace" userName="Personne Admise" />
        <dccm-sidebar [groups]="groupes" [footer]="pied" [status]="etat" />
        <dccm-sidebar variant="rail" [groups]="groupes" [footer]="pied" [status]="etat" />
        <dccm-mobile-header [status]="etat" />
        <dccm-tab-bar [entries]="onglets">
          <hlm-sheet side="left" class="contents">
            <button hlmSheetTrigger dccmTabBarItem icon="matMoreHorizOutline" label="Plus"></button>
            <hlm-sheet-content *hlmSheetPortal="let panneau" class="w-72 gap-0 overflow-y-auto p-0">
              <div hlmSheetHeader class="pe-14"><h2 hlmSheetTitle>Navigation</h2></div>
              <dccm-sidebar class="h-auto w-full flex-1" [groups]="groupes" [footer]="pied"
                [status]="etat" (navigate)="panneau.close()" />
            </hlm-sheet-content>
          </hlm-sheet>
        </dccm-tab-bar>

        <div class="flex flex-col gap-margin">
          <dccm-page-header heading="Agenda" subtitle="Vue consolidée en lecture seule"
            [breadcrumb]="[{ label: 'Organisation' }, { label: 'Agenda' }]" />
          <p class="text-body-dense text-outline">Le contenu de l'écran.</p>
        </div>
      </dccm-shell>
    `,
  }),
};
export default meta;

type Story = StoryObj<DccmShell>;

/** À partir de 1280 px : TopBar et Sidebar. */
export const Bureau: Story = { globals: { viewport: { value: 'bureau', isRotated: false } } };

/** De 768 à 1279 px : TopBar et Rail. */
export const Tablette: Story = { globals: { viewport: { value: 'tablette', isRotated: false } } };

/** Sous 768 px : MobileHeader et barre d'onglets ; « Plus » ouvre toute la navigation. */
export const Mobile: Story = { globals: { viewport: { value: 'mobile', isRotated: false } } };
