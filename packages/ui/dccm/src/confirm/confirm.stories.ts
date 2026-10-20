import { afterNextRender, Component, inject, input, signal } from '@angular/core';
import { HlmButton } from '@personal-os/ui/button';
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { DccmConfirm } from './confirm';

// Le motif de confirmation : `DccmConfirm` ouvre l'`alert-dialog` et renvoie
// le choix, ou `null` à l'annulation. Une transition métier (clôturer,
// arrêter, déclarer, publier, fusionner, supprimer) passe toujours par lui ;
// une création ou une modification simple, jamais.

type Forme = 'cloture' | 'suppression' | 'portee' | 'choix';

@Component({
  selector: 'dccm-confirm-demo',
  imports: [HlmButton],
  template: `
    <div class="flex flex-col items-start gap-space-md">
      <div class="flex flex-wrap gap-space-sm">
        <button hlmBtn variant="secondary" (click)="ouvrir('cloture')">Clôturer la liste…</button>
        <button hlmBtn variant="secondary" (click)="ouvrir('suppression')">Supprimer la séance…</button>
        <button hlmBtn variant="secondary" (click)="ouvrir('portee')">Modifier l'occurrence…</button>
        <button hlmBtn variant="secondary" (click)="ouvrir('choix')">Départager deux occurrences…</button>
      </div>
      <p class="text-body-dense text-on-surface-variant" role="status">
        Choix renvoyé : <code class="font-mono text-code-mono text-on-surface">{{ choix() }}</code>
      </p>
    </div>
  `,
})
class StoryConfirm {
  private readonly _confirm = inject(DccmConfirm);
  readonly ouvertAuDemarrage = input<Forme>();
  readonly choix = signal('—');

  constructor() {
    afterNextRender(() => {
      const forme = this.ouvertAuDemarrage();
      if (forme) this.ouvrir(forme);
    });
  }

  async ouvrir(forme: Forme) {
    const choix =
      forme === 'portee'
        ? await this._confirm.chooseScope({
            title: "Modifier l'événement récurrent",
            description:
              'Cette séance fait partie d’une série hebdomadaire (tous les mardis à 18:30). Que veux-tu mettre à jour ?',
            confirmLabel: 'Valider la modification',
            occurrenceDescription:
              'Modifie uniquement la séance du mardi 3 juin. Les autres occurrences restent intactes.',
            seriesDescription:
              'Applique la modification à cette séance et à toutes les occurrences de la série.',
          })
        : forme === 'choix'
          ? await this._confirm.choose({
              title: 'Quelle occurrence de « Piscine » ?',
              description: 'Deux occurrences de la série tombent le lundi 5 octobre à 18:00.',
              confirmLabel: 'Continuer',
              choicesLabel: 'Occurrences',
              choices: [
                { value: '2026-10-05', label: 'Piscine', description: 'Prévue le lundi 5 octobre.' },
                {
                  value: '2026-10-12',
                  label: 'Piscine déplacée',
                  description: 'Prévue le lundi 12 octobre, déplacée au 5.',
                },
              ],
            })
        : forme === 'suppression'
          ? await this._confirm.confirm({
              title: 'Supprimer la séance ?',
              description: 'Cette action est irréversible.',
              confirmLabel: 'Supprimer',
              destructive: true,
            })
          : await this._confirm.confirm({
              title: 'Clôturer la liste de courses ?',
              description:
                'Les 6 articles cochés passent au stock domestique ; les 5 autres restent sur la prochaine liste.',
              confirmLabel: 'Clôturer la liste',
            });
    this.choix.set(JSON.stringify(choix));
  }
}

const meta: Meta<StoryConfirm> = {
  title: 'Patterns/Confirm',
  component: StoryConfirm,
  decorators: [moduleMetadata({ imports: [StoryConfirm] })],
  parameters: { controls: { disable: true } },
};
export default meta;

type Story = StoryObj<StoryConfirm>;

export const Declencheurs: Story = { name: 'Déclencheurs' };

// Les dialogues ouverts, une par story : hors de la page de documentation.

export const ConfirmationSimple: Story = {
  name: 'Confirmation simple',
  tags: ['!autodocs'],
  args: { ouvertAuDemarrage: 'cloture' },
};

export const Suppression: Story = {
  tags: ['!autodocs'],
  args: { ouvertAuDemarrage: 'suppression' },
};

export const ChoixDePortee: Story = {
  name: 'Choix de portée',
  tags: ['!autodocs'],
  args: { ouvertAuDemarrage: 'portee' },
};

export const Choix: Story = {
  name: 'Choix parmi plusieurs options',
  tags: ['!autodocs'],
  args: { ouvertAuDemarrage: 'choix' },
};
