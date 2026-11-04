import {
  booleanAttribute,
  Component,
  computed,
  input,
  model,
} from '@angular/core';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import { champsDu, type SaisieDeMesures, type Volet } from './saisie-de-seance';

let prochainId = 0;

/**
 * Les trois champs d'un volet de la Séance — distance, durée, et l'intention
 * du prévu ou les notes du réalisé. Le prévu et le réalisé se saisissent avec
 * les mêmes champs, dans les mêmes unités : c'est ce qui les rend comparables.
 *
 * Chaque erreur s'affiche sous son champ, d'après le chemin du contrat qu'il
 * remplit (`plannedDistanceM`…).
 */
@Component({
  selector: 'pos-champs-de-mesures',
  imports: [HlmFieldImports, HlmInput],
  host: {
    class: 'grid gap-gutter',
    '[class.md:grid-cols-3]': '!stacked()',
  },
  template: `
    <div hlmField>
      <label hlmFieldLabel [for]="id + '-distance'">Distance (km)</label>
      <input
        hlmInput
        inputmode="decimal"
        placeholder="10,5"
        [id]="id + '-distance'"
        [attr.data-test]="volet() + '-distance'"
        [value]="saisie().distance"
        [forceInvalid]="!!erreurs()[champs().distance]"
        (input)="saisir('distance', $event)"
      />
      @if (erreurs()[champs().distance]; as message) {
        <hlm-field-error forceShow>{{ message }}</hlm-field-error>
      }
    </div>

    <div hlmField>
      <label hlmFieldLabel [for]="id + '-duree'">Durée</label>
      <input
        hlmInput
        placeholder="45 ou 1:04:30"
        [id]="id + '-duree'"
        [attr.data-test]="volet() + '-duree'"
        [value]="saisie().duree"
        [forceInvalid]="!!erreurs()[champs().duree]"
        (input)="saisir('duree', $event)"
      />
      @if (erreurs()[champs().duree]; as message) {
        <hlm-field-error forceShow>{{ message }}</hlm-field-error>
      }
    </div>

    <div hlmField>
      <label hlmFieldLabel [for]="id + '-texte'">{{
        volet() === 'planned' ? 'Intention' : 'Notes'
      }}</label>
      <input
        hlmInput
        [placeholder]="
          volet() === 'planned'
            ? 'Footing, fractionné…'
            : 'Sensations, conditions…'
        "
        [id]="id + '-texte'"
        [attr.data-test]="volet() + '-texte'"
        [value]="saisie().texte"
        [forceInvalid]="!!erreurs()[champs().texte]"
        (input)="saisir('texte', $event)"
      />
      @if (erreurs()[champs().texte]; as message) {
        <hlm-field-error forceShow>{{ message }}</hlm-field-error>
      }
    </div>
  `,
})
export class ChampsDeMesures {
  readonly volet = input.required<Volet>();
  readonly saisie = model.required<SaisieDeMesures>();
  readonly erreurs = input<Record<string, string>>({});
  /** Les champs l'un sous l'autre, dans un panneau étroit. */
  readonly stacked = input(false, { transform: booleanAttribute });

  protected readonly id = `pos-mesures-${prochainId++}`;
  protected readonly champs = computed(() => champsDu(this.volet()));

  protected saisir(champ: keyof SaisieDeMesures, evenement: Event): void {
    const valeur = (evenement.target as HTMLInputElement).value;
    this.saisie.update((saisie) => ({ ...saisie, [champ]: valeur }));
  }
}
