import { Component } from '@angular/core';
import {
  matDoneAllOutline,
  matRefreshOutline,
} from '@ng-icons/material-symbols/outline';
import { HlmButton } from '@personal-os/ui/button';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HlmToast, showToast, type ToastTone } from './hlm-toast';
import { HlmToaster } from './hlm-toaster';

// Le master `Toast` de la planche `05 Feedback` et sa galerie : succès,
// erreur, neutre. Un toast confirme une action réussie ; il ne porte jamais
// seul une erreur qui empêche d'avancer.

type Args = { tone: ToastTone; message: string };

@Component({
  selector: 'hlm-toasts-demo',
  imports: [HlmToaster, HlmButton],
  template: `
    <div class="flex gap-space-sm">
      <button hlmBtn variant="secondary" (click)="succes()">Succès</button>
      <button hlmBtn variant="secondary" (click)="erreur()">Erreur</button>
      <button hlmBtn variant="secondary" (click)="neutre()">Neutre</button>
    </div>
    <hlm-toaster />
  `,
})
class Toasts {
  succes() {
    showToast({
      message: '3 articles ajoutés à la liste de courses',
      action: { icon: matDoneAllOutline, label: 'Voir la liste' },
    });
  }
  erreur() {
    showToast({
      tone: 'error',
      message: "L'export n'a pas abouti",
      action: { icon: matRefreshOutline, label: 'Réessayer' },
    });
  }
  neutre() {
    showToast({ tone: 'neutral', message: 'Brouillon enregistré' });
  }
}

const meta: Meta<Args> = {
  title: 'Feedback/Toast',
  decorators: [moduleMetadata({ imports: [HlmToast, Toasts] })],
  args: { tone: 'success', message: '3 articles ajoutés à la liste de courses' },
  argTypes: {
    tone: {
      name: 'tonalité',
      control: 'inline-radio',
      options: ['success', 'error', 'neutral'],
    },
  },
};
export default meta;

type Story = StoryObj<Args>;

export const Controles: Story = {
  name: 'Contrôles',
  render: (args) => ({
    props: { ...args, action: { icon: matDoneAllOutline, label: 'Voir la liste' } },
    template: `<hlm-toast class="w-90" [tone]="tone" [message]="message" [action]="action" />`,
  }),
};

export const Galerie: Story = {
  name: 'Tonalités',
  parameters: { controls: { disable: true } },
  render: () => ({
    props: {
      voir: { icon: matDoneAllOutline, label: 'Voir la liste' },
      reessayer: { icon: matRefreshOutline, label: 'Réessayer' },
    },
    template: `
      <div class="flex w-90 flex-col gap-space-sm">
        <hlm-toast tone="success" message="3 articles ajoutés à la liste de courses" [action]="voir" />
        <hlm-toast tone="error" message="L'export n'a pas abouti" [action]="reessayer" />
        <hlm-toast tone="neutral" message="Brouillon enregistré" />
      </div>`,
  }),
};

/** Les toasts dans leur conteneur, en bas à droite, par `showToast()`. */
export const Conteneur: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({ template: `<hlm-toasts-demo />` }),
};
