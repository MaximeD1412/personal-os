import { Component, computed, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { zEventInput, type ApiError } from '@personal-os/contracts';
import { DccmFormPage } from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import { erreursDeChamp, prefillDepuisRequete } from './formulaire';

// Le motif « formulaire prérempli » de docs/design-system.md, composé comme
// un écran le compose : le lien remplit ce qu'il peut, le reste est signalé,
// et le refus de l'API s'affiche sous le champ qu'il vise.

@Component({
  imports: [DccmFormPage, HlmFieldImports, HlmInput],
  template: `
    <dccm-form-page
      heading="Nouvel événement"
      submitLabel="Créer l'événement"
      [ignored]="prefill.ignores"
      [error]="refus()"
      (submitted)="refus.set(refusDeLApi)"
    >
      <div hlmField>
        <label hlmFieldLabel for="titre">Intitulé</label>
        <input
          hlmInput
          id="titre"
          [value]="prefill.valeurs.title ?? ''"
          [forceInvalid]="!!erreurs()['title']"
        />
        @if (erreurs()['title']; as message) {
          <hlm-field-error forceShow>{{ message }}</hlm-field-error>
        }
      </div>
    </dccm-form-page>
  `,
})
class NouvelEvenement {
  readonly prefill = prefillDepuisRequete(
    zEventInput,
    inject(ActivatedRoute).snapshot.queryParamMap,
  );
  readonly refus = signal<ApiError | null>(null);
  readonly erreurs = computed(() => erreursDeChamp(this.refus()));
  readonly refusDeLApi: ApiError = {
    status: 400,
    code: 'validation',
    message: 'La requête est invalide.',
    fields: [
      { path: 'title', code: 'too_big', message: 'Intitulé trop long.' },
    ],
  };
}

async function ouvrir(requete: Record<string, string>) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(requete) } },
      },
    ],
  });
  const fixture = TestBed.createComponent(NouvelEvenement);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('le formulaire prérempli', () => {
  it('reprend les valeurs du lien et signale celles qui ont été écartées', async () => {
    const { el } = await ouvrir({ title: 'Dentiste', category: 'FOO' });

    expect((el.querySelector('#titre') as HTMLInputElement).value).toBe(
      'Dentiste',
    );
    expect(el.querySelector('[data-test="ignores"]')?.textContent).toContain(
      "Certaines valeurs du lien n'ont pas été reprises : category=FOO",
    );
  });

  it("affiche sous le champ l'erreur que l'API renvoie pour lui", async () => {
    const { fixture, el } = await ouvrir({});

    (el.querySelector('form') as HTMLFormElement).requestSubmit();
    await fixture.whenStable();

    const champ = el.querySelector('#titre') as HTMLInputElement;
    const erreur = el.querySelector('hlm-field-error') as HTMLElement;
    expect(erreur.textContent).toContain('Intitulé trop long.');
    expect(champ.getAttribute('aria-invalid')).toBe('true');
    expect(champ.getAttribute('aria-describedby')).toContain(erreur.id);
    // Un refus qui vise un champ ne s'affiche pas aussi en bandeau.
    expect(el.querySelector('[data-test="refus"]')).toBeNull();
  });
});
