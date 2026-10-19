import { HlmDialogImports } from '@personal-os/ui/dialog';
import { HlmButton } from '@personal-os/ui/button';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HlmAlertDialogImports } from '../index';

// Le master `Modal` de la planche `05 Feedback` : titre, sous-titre, contenu
// projeté, actions, et sa variante destructive. `hlm-alert-dialog` pose une
// question (rôle `alertdialog`, un clic dehors ne la ferme pas) ;
// `hlm-dialog` porte un contenu (bouton de fermeture, Échap, clic dehors).
// Une question métier passe par `DccmConfirm` (Patterns/Confirm).

const confirmation = (
  etat: string,
  { titre = 'Clôturer la liste de courses ?', sousTitre = "Cette action figera la session d'achat active.", action = 'Clôturer la liste', variante = 'primary', contenu = true } = {},
) => `
  <hlm-alert-dialog ${etat}>
    <button hlmAlertDialogTrigger hlmBtn variant="secondary">${action}…</button>
    <hlm-alert-dialog-content *hlmAlertDialogPortal="let modale">
      <hlm-alert-dialog-header>
        <h2 hlmAlertDialogTitle>${titre}</h2>
        <p hlmAlertDialogDescription>${sousTitre}</p>
      </hlm-alert-dialog-header>
      ${contenu ? `<div hlmDialogBody><p>Les 6 articles cochés passent au stock domestique ; les 5 autres restent sur la prochaine liste.</p></div>` : ''}
      <hlm-alert-dialog-footer>
        <button hlmBtn variant="secondary" hlmAlertDialogCancel>Annuler</button>
        <button hlmBtn variant="${variante}" hlmAlertDialogAction (click)="modale.close()">${action}</button>
      </hlm-alert-dialog-footer>
    </hlm-alert-dialog-content>
  </hlm-alert-dialog>`;

const destructive = (etat: string) =>
  confirmation(etat, {
    titre: 'Supprimer la séance ?',
    sousTitre: 'Cette action est irréversible.',
    action: 'Supprimer',
    variante: 'destructive',
    contenu: false,
  });

const dialogue = (etat: string) => `
  <hlm-dialog ${etat}>
    <button hlmDialogTrigger hlmBtn variant="secondary">Renommer…</button>
    <hlm-dialog-content *hlmDialogPortal="let modale">
      <div hlmDialogHeader>
        <h2 hlmDialogTitle>Renommer la recette</h2>
        <p hlmDialogDescription>Le nouveau nom s'affiche partout où la recette apparaît.</p>
      </div>
      <div hlmDialogBody>
        <div hlmField>
          <label hlmFieldLabel for="nom">Nom</label>
          <input hlmInput id="nom" value="Gratin dauphinois" />
        </div>
      </div>
      <div hlmDialogFooter>
        <button hlmBtn variant="secondary" (click)="modale.close()">Annuler</button>
        <button hlmBtn (click)="modale.close()">Renommer</button>
      </div>
    </hlm-dialog-content>
  </hlm-dialog>`;

const meta: Meta = {
  title: 'Feedback/Modal',
  decorators: [
    moduleMetadata({
      imports: [
        HlmDialogImports,
        HlmAlertDialogImports,
        HlmButton,
        HlmFieldImports,
        HlmInput,
      ],
    }),
  ],
};
export default meta;

type Story = StoryObj;

export const Declencheurs: Story = {
  name: 'Déclencheurs',
  render: () => ({
    template: `<div class="flex flex-wrap gap-space-sm">${confirmation('')}${destructive('')}${dialogue('')}</div>`,
  }),
};

// Les modales ouvertes, une par story : hors de la page de documentation,
// où elles se superposeraient.

export const Confirmation: Story = {
  tags: ['!autodocs'],
  render: () => ({ template: confirmation('state="open"') }),
};

export const Destructive: Story = {
  tags: ['!autodocs'],
  render: () => ({ template: destructive('state="open"') }),
};

export const Contenu: Story = {
  tags: ['!autodocs'],
  render: () => ({ template: dialogue('state="open"') }),
};
