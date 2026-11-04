import {
  afterNextRender,
  Component,
  input,
  viewChild,
} from '@angular/core';
import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { navigationDeDemo } from '../storybook/navigation-de-demo';
import {
  DccmCommandBar,
  DccmCommandBarTrigger,
  type DccmCommandFailure,
} from './command-bar';

// La barre de commande (ADR 0018) : une palette où l'on écrit son intention.
// Elle prépare, n'exécute jamais : une action connue ouvre l'écran de saisie
// prérempli (l'écran navigue), sinon elle le dit franchement et propose
// l'écran le plus proche. Ni réponse en phrase, ni chiffre. Elle s'ouvre par
// son déclencheur (la `TopBar`, ou `compact` dans le `MobileHeader`) et par
// Ctrl+K / Cmd+K.

type Etat = 'vide' | 'recherche' | 'echec' | 'echec-sans-ecran' | 'erreur';

@Component({
  selector: 'dccm-command-bar-demo',
  imports: [DccmCommandBar, DccmCommandBarTrigger],
  template: `
    <div class="flex w-full max-w-180 flex-col items-center gap-space-lg">
      <button dccmCommandBarTrigger label="Que veux-tu faire ?" (click)="barre.open()"></button>
      <button
        dccmCommandBarTrigger
        compact
        label="Que veux-tu faire ?"
        (click)="barre.open()"
      ></button>
    </div>
    <dccm-command-bar
      #barre
      [pending]="etat() === 'recherche'"
      [failure]="echec()"
      [error]="
        etat() === 'erreur' ? 'Le plafond mensuel de l’IA est atteint.' : null
      "
    />
  `,
})
class StoryCommandBar {
  readonly ouverteAuDemarrage = input(false);
  readonly etat = input<Etat>('vide');
  private readonly _barre = viewChild.required(DccmCommandBar);

  constructor() {
    afterNextRender(() => {
      if (this.ouverteAuDemarrage()) this._barre().open();
    });
  }

  echec(): DccmCommandFailure | null {
    switch (this.etat()) {
      case 'echec':
        return { nearestUrl: '/calendrier/evenements/nouveau' };
      case 'echec-sans-ecran':
        return {};
      default:
        return null;
    }
  }
}

const meta: Meta<StoryCommandBar> = {
  title: 'Navigation/CommandBar',
  component: StoryCommandBar,
  decorators: [
    applicationConfig({ providers: [...navigationDeDemo()] }),
    moduleMetadata({ imports: [StoryCommandBar] }),
  ],
  parameters: { controls: { disable: true } },
};
export default meta;

type Story = StoryObj<StoryCommandBar>;

export const Declencheurs: Story = { name: 'Déclencheurs' };

// La palette ouverte, un état par story : hors de la page de documentation.

export const Ouverte: Story = {
  tags: ['!autodocs'],
  args: { ouverteAuDemarrage: true },
};

export const Recherche: Story = {
  name: 'Je cherche…',
  tags: ['!autodocs'],
  args: { ouverteAuDemarrage: true, etat: 'recherche' },
};

export const EchecFranc: Story = {
  name: 'Échec franc, écran le plus proche',
  tags: ['!autodocs'],
  args: { ouverteAuDemarrage: true, etat: 'echec' },
};

export const EchecSansEcran: Story = {
  name: 'Échec franc, sans écran proche',
  tags: ['!autodocs'],
  args: { ouverteAuDemarrage: true, etat: 'echec-sans-ecran' },
};

export const Erreur: Story = {
  name: "Erreur de l'API",
  tags: ['!autodocs'],
  args: { ouverteAuDemarrage: true, etat: 'erreur' },
};
