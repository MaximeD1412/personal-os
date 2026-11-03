import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HlmButton } from '@personal-os/ui/button';
import { HlmSheetImports } from '../index';

// Le panneau latéral, sans master : le « Plus » de la barre d'onglets mobile
// l'ouvre sur toute la navigation. Il piège le focus et se ferme par Échap.
const meta: Meta = {
  title: 'Layout/Sheet',
  decorators: [moduleMetadata({ imports: [HlmSheetImports, HlmButton] })],
};
export default meta;

type Story = StoryObj;

export const Panneau: Story = {
  render: () => ({
    template: `
      <hlm-sheet side="left">
        <button hlmSheetTrigger hlmBtn variant="secondary">Ouvrir le panneau</button>
        <hlm-sheet-content *hlmSheetPortal="let panneau" class="w-72">
          <div hlmSheetHeader class="pe-14">
            <h2 hlmSheetTitle>Navigation</h2>
            <p hlmSheetDescription>Toute la navigation du tableau de bord.</p>
          </div>
          <div hlmSheetFooter>
            <button hlmBtn variant="secondary" (click)="panneau.close()">Fermer</button>
          </div>
        </hlm-sheet-content>
      </hlm-sheet>
    `,
  }),
};
