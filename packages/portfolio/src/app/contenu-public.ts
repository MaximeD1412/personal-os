import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { lire } from './lecture';
import {
  estUneLangue,
  LANGUE_PAR_DEFAUT,
  versLang,
  type Langue,
} from './langue';
import { PublicService } from './public.service';
import { TEXTES } from './textes';

/**
 * Ce que le portfolio lit dans la langue de son URL : ses trois Pages de
 * contenu, ses Projets publiés et l'existence de son CV. Fourni par le cadre
 * de la langue, il est lu une fois pour l'accueil et l'en-tête, et relu quand
 * la langue change.
 */
@Injectable()
export class ContenuPublic {
  private readonly transport = inject(PublicService);

  readonly langue = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((parametres): Langue => {
        const langue = parametres.get('lang');
        return estUneLangue(langue) ? langue : LANGUE_PAR_DEFAUT;
      }),
    ),
    { requireSync: true },
  );
  readonly lang = computed(() => versLang(this.langue()));
  readonly textes = computed(() => TEXTES[this.langue()]);

  readonly presentation = lire(this.transport.page(this.lang, 'about'));
  readonly experience = lire(this.transport.page(this.lang, 'experience'));
  readonly competences = lire(this.transport.page(this.lang, 'skills'));
  readonly projets = lire(this.transport.projets(this.lang));
  readonly cv = lire(this.transport.cv(this.lang));
  readonly urlDuCv = computed(() => this.transport.urlDuCv(this.lang()));
}
