import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HlmButton } from '@personal-os/ui/button';
import { DccmEmptyState } from '@personal-os/ui/dccm';
import { map } from 'rxjs';
import { ContenuPublic } from './contenu-public';
import { lire } from './lecture';
import { PublicService } from './public.service';
import { TextePublie } from './texte-publie';

/**
 * La page d'un Projet publié, dans la langue de l'URL. Un Projet que cette
 * langue n'a pas publié est absent, même s'il l'est dans l'autre.
 */
@Component({
  selector: 'pos-projet',
  imports: [RouterLink, HlmButton, DccmEmptyState, TextePublie],
  templateUrl: './projet.html',
})
export class Projet {
  private readonly contenu = inject(ContenuPublic);
  protected readonly langue = this.contenu.langue;
  protected readonly textes = this.contenu.textes;

  private readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((parametres) => parametres.get('id') ?? ''),
    ),
    { requireSync: true },
  );

  protected readonly projet = lire(
    inject(PublicService).projet(this.contenu.lang, this.id),
  );

  protected readonly publieLe = computed(() => {
    const lecture = this.projet();
    if (lecture.etat !== 'present') {
      return '';
    }
    const textes = this.textes();
    return textes.publieLe(
      new Intl.DateTimeFormat(textes.locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Paris',
      }).format(new Date(lecture.valeur.publishedAt)),
    );
  });
}
