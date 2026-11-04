import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, type UrlTree } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matArrowForwardOutline,
  matBoltOutline,
  matCloudSyncOutline,
  matCalendarViewDayOutline,
  matEventBusyOutline,
  matMonitoringOutline,
  matShoppingCartOutline,
  matTaskAltOutline,
} from '@ng-icons/material-symbols/outline';
import {
  aujourdhui,
  INDICATEUR_DERNIERE_SAUVEGARDE,
  instantDans,
  MODULE_SAUVEGARDES,
  type ModuleSummary,
  type Todo,
} from '@personal-os/contracts';
import { HlmBadge, type BadgeTone } from '@personal-os/ui/badge';
import { HlmCardImports } from '@personal-os/ui/card';
import {
  DccmKpiTile,
  DccmListRow,
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmKpiTileTone,
} from '@personal-os/ui/dccm';
import { AgendaService } from './agenda.service';
import { DashboardService } from './dashboard.service';
import { decaler, formaterInstant, formaterJour } from './dates';
import { vueDEntree, type VueDEntree } from './entree-d-agenda';
import { moduleNomme } from './modules-d-origine';

/** Combien de jours « ce qui m'attend » couvre, aujourd'hui compris. */
const JOURS = 7;

interface Journee {
  jour: string;
  estAujourdhui: boolean;
  /** « mercredi 16 septembre », précédé de « Aujourd'hui · » le jour même. */
  titre: string;
  entrees: VueDEntree[];
}

/** Un À faire tel que l'écran le montre : un lien vers l'écran qui le résout. */
interface VueDAFaire {
  cle: string;
  libelle: string;
  module: string;
  lien: UrlTree;
  echeance: { libelle: string; ton: BadgeTone } | null;
}

/** Un indicateur d'un Résumé de module, rendu en tuile. */
interface Tuile {
  cle: string;
  icone: string;
  surTitre: string;
  valeur: string;
  meta: string;
  ton: DccmKpiTileTone;
  /** L'écran du module, et le libellé du pied ; aucun pour un indicateur inconnu. */
  lien: { chemin: string; libelle: string } | null;
  /** Le statut du pied, en badge, quand le widget en donne un. */
  statut: Statut | null;
}

interface Statut {
  libelle: string;
  ton: BadgeTone;
}

/** Ce que l'écran sait d'un indicateur, par sa clé (`SummaryIndicator.key`). */
interface Widget {
  icone: string;
  surTitre: string;
  ton: DccmKpiTileTone;
  /** L'écran du module ; aucun quand rien ne s'y résout depuis l'application. */
  lien?: { chemin: string; libelle: string };
  /** La valeur écrite pour l'écran ; telle que l'API la donne, sinon. */
  valeur?: (valeur: string | number) => string;
  /** Le statut que le pied affiche, tiré du Résumé de son module. */
  statut?: (resume: ModuleSummary) => Statut;
}

/**
 * Le nom des modules qui se résument au tableau de bord sans rien porter à
 * l'Agenda : le registre des modules d'origine ne les connaît pas.
 */
const AUTRES_MODULES: Readonly<Record<string, string>> = {
  [MODULE_SAUVEGARDES]: 'Sauvegardes',
};

/**
 * Les widgets connus. Un indicateur dont la clé n'est pas ici s'affiche quand
 * même, sous le nom de son module et sans lien : un module peut se résumer à
 * l'API avant que l'écran ne sache où le mener (ADR 0011).
 */
const WIDGETS: Readonly<Record<string, Widget>> = {
  shopping_list_remaining_items: {
    icone: 'matShoppingCartOutline',
    surTitre: 'Courses',
    ton: 'tertiary',
    lien: { chemin: '/courses', libelle: 'Voir la liste' },
  },
  // Les sauvegardes se règlent sur la machine, pas dans l'application : la
  // tuile ne mène nulle part. Le module signale une sauvegarde de plus de
  // 26 heures, et c'est ce signal qui la dit en retard (DASH-3).
  [INDICATEUR_DERNIERE_SAUVEGARDE]: {
    icone: 'matCloudSyncOutline',
    surTitre: 'Sauvegardes',
    ton: 'outline',
    valeur: (valeur) =>
      formaterInstant(String(valeur), {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    statut: ({ signals }) =>
      signals.length > 0
        ? { libelle: 'En retard', ton: 'error' }
        : { libelle: 'À jour', ton: 'success' },
  },
};

/**
 * L'Accueil : ce qui m'attend dans les sept prochains jours, ce qui requiert
 * mon attention, et le résumé de chaque module.
 *
 * Il ne fait que lire, et c'est la décision : rien ne s'y coche ni ne s'y
 * enregistre. Chaque élément mène à l'écran de son module, où la situation se
 * résout ; un À faire disparaît quand elle a changé (ADR 0017).
 */
@Component({
  selector: 'pos-accueil',
  templateUrl: './accueil.html',
  imports: [
    RouterLink,
    NgIcon,
    HlmBadge,
    HlmCardImports,
    DccmKpiTile,
    DccmListRow,
    DccmPageHeader,
    DccmState,
  ],
  providers: [
    provideIcons({
      matShoppingCartOutline,
      matCloudSyncOutline,
      matMonitoringOutline,
    }),
  ],
})
export class Accueil {
  private readonly router = inject(Router);
  private readonly tableauDeBord = inject(DashboardService);

  private readonly aujourdhui = aujourdhui();

  /** Les sept jours, aujourd'hui d'abord. */
  private readonly jours = Array.from({ length: JOURS }, (_, i) =>
    decaler(this.aujourdhui, i),
  );

  protected readonly sousTitre = premiereEnCapitale(
    formaterJour(this.aujourdhui, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );

  /** « 16 sept. – 22 sept. » */
  protected readonly periode = `${formaterJour(this.jours[0], {
    day: 'numeric',
    month: 'short',
  })} – ${formaterJour(this.jours[JOURS - 1], {
    day: 'numeric',
    month: 'short',
  })}`;

  // De minuit, aujourd'hui, à la dernière milliseconde du septième jour, à
  // Paris (ADR 0030).
  protected readonly agenda = inject(AgendaService).lecture(() => ({
    from: instantDans(this.aujourdhui, 0, 0),
    to: new Date(
      Date.parse(instantDans(decaler(this.aujourdhui, JOURS), 0, 0)) - 1,
    ).toISOString(),
  }));

  protected readonly etatDeLAgenda = computed(() =>
    stateOf(this.agenda, (entrees) => entrees.length === 0),
  );

  /**
   * Chaque jour avec les entrées qui y commencent, à Paris ; ce qui a
   * commencé avant et dure encore ouvre aujourd'hui. L'API rend une suite
   * triée : l'ordre se garde.
   */
  private readonly journees = computed((): Journee[] => {
    const entrees = (this.agenda.hasValue() ? this.agenda.value() : []).map(
      (entree) => vueDEntree(entree, this.aujourdhui),
    );

    return this.jours.map((jour) => {
      const estAujourdhui = jour === this.aujourdhui;
      const date = formaterJour(jour, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      return {
        jour,
        estAujourdhui,
        titre: estAujourdhui ? `Aujourd'hui · ${date}` : date,
        entrees: entrees.filter((entree) => entree.jour === jour),
      };
    });
  });

  /** Le bandeau : les sept jours, chacun dit avec ce qu'il porte. */
  protected readonly bandeau = computed(() =>
    this.journees().map((journee) => ({
      jour: journee.jour,
      estAujourdhui: journee.estAujourdhui,
      abrege: journee.estAujourdhui
        ? 'Auj.'
        : formaterJour(journee.jour, { weekday: 'short' }),
      numero: formaterJour(journee.jour, { day: 'numeric' }),
      occupe: journee.entrees.length > 0,
      libelle: `${formaterJour(journee.jour, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}${journee.estAujourdhui ? ", aujourd'hui" : ''} : ${
        journee.entrees.length
          ? nombreDEntrees(journee.entrees.length)
          : 'aucune entrée'
      }`,
    })),
  );

  protected readonly journeesOccupees = computed(() =>
    this.journees().filter((journee) => journee.entrees.length > 0),
  );

  protected readonly todos = this.tableauDeBord.aFaire();

  protected readonly etatDesAFaire = computed(() =>
    stateOf(this.todos, (todos) => todos.length === 0),
  );

  protected readonly aFaire = computed((): VueDAFaire[] =>
    (this.todos.hasValue() ? this.todos.value() : []).map((todo) =>
      this.vueDAFaire(todo),
    ),
  );

  protected readonly resumes = this.tableauDeBord.resumes();

  protected readonly etatDesResumes = computed(() =>
    stateOf(this.resumes, (resumes) => tuilesDe(resumes).length === 0),
  );

  protected readonly tuiles = computed(() =>
    tuilesDe(this.resumes.hasValue() ? this.resumes.value() : []),
  );

  protected readonly icones = {
    agenda: matCalendarViewDayOutline,
    aFaire: matBoltOutline,
    indicateurs: matMonitoringOutline,
    vide: matEventBusyOutline,
    rienAFaire: matTaskAltOutline,
    ouvrir: matArrowForwardOutline,
  };

  protected readonly nombreDEntrees = nombreDEntrees;

  /**
   * Le lien du module est un chemin avec sa requête
   * (`/repas/planning?semaine=…`) : le routeur le lit tel quel, sans que
   * l'écran ait à le comprendre.
   */
  private vueDAFaire(todo: Todo): VueDAFaire {
    return {
      cle: `${todo.kind}:${todo.ref}`,
      libelle: todo.label,
      module:
        moduleNomme(todo.module)?.libelle ??
        AUTRES_MODULES[todo.module] ??
        todo.module,
      lien: this.router.parseUrl(todo.link),
      echeance: todo.dueOn ? this.echeance(todo.dueOn) : null,
    };
  }

  /** « Aujourd'hui », « Demain », « J-3 », ou la date passée, en alerte. */
  private echeance(jour: string): { libelle: string; ton: BadgeTone } {
    if (jour < this.aujourdhui) {
      return {
        libelle: `Depuis le ${formaterJour(jour, { day: 'numeric', month: 'short' })}`,
        ton: 'error',
      };
    }
    const ecart = Math.round(
      (Date.parse(jour) - Date.parse(this.aujourdhui)) / 86_400_000,
    );
    if (ecart === 0) {
      return { libelle: "Aujourd'hui", ton: 'warning' };
    }
    if (ecart === 1) {
      return { libelle: 'Demain', ton: 'warning' };
    }
    return { libelle: `J-${ecart}`, ton: 'neutral' };
  }
}

function tuilesDe(resumes: readonly ModuleSummary[]): Tuile[] {
  return resumes.flatMap((resume) =>
    resume.indicators.map((indicateur): Tuile => {
      const { module } = resume;
      const widget = WIDGETS[indicateur.key];
      return {
        cle: `${module}:${indicateur.key}`,
        icone: widget?.icone ?? 'matMonitoringOutline',
        surTitre: widget?.surTitre ?? moduleNomme(module)?.libelle ?? module,
        valeur: widget?.valeur?.(indicateur.value) ?? String(indicateur.value),
        meta: indicateur.label,
        ton: widget?.ton ?? moduleNomme(module)?.ton ?? 'outline',
        lien: widget?.lien ?? null,
        statut: widget?.statut?.(resume) ?? null,
      };
    }),
  );
}

function nombreDEntrees(n: number): string {
  return `${n} ${n > 1 ? 'entrées' : 'entrée'}`;
}

function premiereEnCapitale(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}
