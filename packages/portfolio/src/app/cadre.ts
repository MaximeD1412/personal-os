import { Component, computed, DOCUMENT, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { HlmToggleGroupImports } from '@personal-os/ui/toggle-group';
import { ContenuPublic } from './contenu-public';
import { ChoixDeLangue, estUneLangue, type Langue } from './langue';

interface LienDeSection {
  readonly ancre: string;
  readonly libelle: string;
}

/**
 * Le cadre d'une langue du portfolio (`/fr/…`, `/en/…`) : l'en-tête, avec
 * ses sections et le sélecteur de langue toujours visible, puis la page.
 * Une section absente de cette langue n'a pas de lien.
 */
@Component({
  selector: 'pos-cadre',
  imports: [RouterLink, RouterOutlet, HlmToggleGroupImports],
  providers: [ContenuPublic],
  templateUrl: './cadre.html',
})
export class Cadre {
  private readonly router = inject(Router);
  private readonly choix = inject(ChoixDeLangue);
  private readonly document = inject(DOCUMENT);

  protected readonly contenu = inject(ContenuPublic);
  protected readonly langue = this.contenu.langue;
  protected readonly textes = this.contenu.textes;

  protected readonly liens = computed<readonly LienDeSection[]>(() => {
    const { sections } = this.textes();
    const liens: LienDeSection[] = [];
    if (this.contenu.experience().etat === 'present') {
      liens.push({ ancre: 'experiences', libelle: sections.experience });
    }
    if (this.contenu.competences().etat === 'present') {
      liens.push({ ancre: 'competences', libelle: sections.skills });
    }
    liens.push({ ancre: 'projets', libelle: sections.projets });
    if (this.contenu.cv().etat === 'present') {
      liens.push({ ancre: 'cv', libelle: sections.cv });
    }
    return liens;
  });

  constructor() {
    effect(() => {
      this.document.documentElement.lang = this.langue();
    });
  }

  /** La même page dans l'autre langue ; le choix est retenu pour la suite. */
  protected changer(langue: Langue | Langue[] | null | undefined): void {
    if (!estUneLangue(langue) || langue === this.langue()) {
      return;
    }
    this.choix.memoriser(langue);
    void this.router.navigateByUrl(
      this.router.url.replace(/^\/[^/?#]+/, `/${langue}`),
    );
  }
}
