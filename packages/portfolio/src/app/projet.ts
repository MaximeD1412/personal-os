import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matArrowBackOutline,
  matCalendarTodayOutline,
  matDeployedCodeOutline,
} from '@ng-icons/material-symbols/outline';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCard } from '@personal-os/ui/card';
import { DccmEmptyState } from '@personal-os/ui/dccm';
import { map } from 'rxjs';
import { ContenuPublic } from './contenu-public';
import { Intitule } from './intitule';
import { LANGUES, versLang, type Langue } from './langue';
import { lire } from './lecture';
import { Metadonnees } from './metadonnees';
import { PublicService } from './public.service';
import { TextePublie } from './texte-publie';

/**
 * La page d'un Projet publié, dans la langue de l'URL. Un Projet que cette
 * langue n'a pas publié est absent, même s'il l'est dans l'autre.
 */
@Component({
  selector: 'pos-projet',
  imports: [
    RouterLink,
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmCard,
    DccmEmptyState,
    Intitule,
    TextePublie,
  ],
  providers: [
    provideIcons({
      matArrowBackOutline,
      matCalendarTodayOutline,
      matDeployedCodeOutline,
    }),
  ],
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

  private readonly transport = inject(PublicService);

  protected readonly projet = lire(
    this.transport.projet(this.contenu.lang, this.id),
  );

  /**
   * L'autre langue du portfolio, et si le Projet y est publié aussi : elle
   * n'est demandée qu'une fois le Projet trouvé dans celle-ci, et n'entre
   * que dans les métadonnées. La page n'en montre rien.
   */
  private readonly autreLangue = computed(
    () => LANGUES.find((langue) => langue !== this.langue()) as Langue,
  );
  private readonly publieDansLAutreLangue = this.transport.projetPublie(
    () => versLang(this.autreLangue()),
    () => (this.projet().etat === 'present' ? this.id() : undefined),
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

  constructor() {
    const metadonnees = inject(Metadonnees);
    effect(() => {
      const lecture = this.projet();
      const langue = this.langue();
      const versions: Partial<Record<Langue, string>> = {};
      if (lecture.etat !== 'absent') {
        versions[langue] = `/${langue}/projets/${this.id()}`;
      }
      const autre = this.publieDansLAutreLangue;
      if (lecture.etat === 'present' && autre.hasValue() && !autre.error()) {
        versions[this.autreLangue()] =
          `/${this.autreLangue()}/projets/${this.id()}`;
      }
      metadonnees.poser({
        langue,
        titre: lecture.etat === 'present' ? lecture.valeur.title : undefined,
        description:
          lecture.etat === 'present' ? lecture.valeur.summary : undefined,
        type: 'article',
        versions,
      });
    });
  }
}
