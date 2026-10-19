import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import type { CurrentUser, Scope } from '@personal-os/contracts';
import { HlmButton } from '@personal-os/ui/button';
import {
  DccmMobileHeader,
  DccmShell,
  DccmSidebar,
  DccmTabBar,
  DccmTabBarItem,
  DccmTopBar,
  type DccmScopeOption,
  type DccmStatus,
} from '@personal-os/ui/dccm';
import { HlmSheetImports } from '@personal-os/ui/sheet';
import { HlmToaster } from '@personal-os/ui/sonner';
import { HlmToggleGroupImports } from '@personal-os/ui/toggle-group';
import { NgIcon } from '@ng-icons/core';
import { matLogoutOutline } from '@ng-icons/material-symbols/outline';
import { AuthService } from './auth.service';
import { EspaceCourant } from './espace-courant';
import { HealthService } from './health.service';
import {
  groupesSelonLesEcrans,
  ICONES_DE_NAVIGATION,
  NAVIGATION,
  ONGLETS,
  PIED_DE_NAVIGATION,
  selonLesEcrans,
} from './navigation';
import { Redirection } from './redirection';

/** Le nom d'un Espace dans le sélecteur. */
const NOMS_D_ESPACE: Readonly<Record<Scope['kind'], string>> = {
  PERSONAL: 'Mon espace',
  HOUSEHOLD: 'Foyer',
};

@Component({
  imports: [
    RouterOutlet,
    NgIcon,
    HlmButton,
    HlmSheetImports,
    HlmToggleGroupImports,
    HlmToaster,
    DccmMobileHeader,
    DccmShell,
    DccmSidebar,
    DccmTabBar,
    DccmTabBarItem,
    DccmTopBar,
  ],
  providers: [provideIcons({ ...ICONES_DE_NAVIGATION, matLogoutOutline })],
  selector: 'pos-root',
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly health = inject(HealthService);
  private readonly redirection = inject(Redirection);
  protected readonly espaceCourant = inject(EspaceCourant);

  private readonly routes = inject(Router).config;

  protected readonly groupes = groupesSelonLesEcrans(NAVIGATION, this.routes);
  protected readonly pied = selonLesEcrans(PIED_DE_NAVIGATION, this.routes);
  protected readonly onglets = selonLesEcrans(ONGLETS, this.routes);

  protected readonly utilisateur = signal<CurrentUser | null>(null);
  private readonly apiJoignable = signal<boolean | null>(null);

  protected readonly nom = computed(() => {
    const compte = this.utilisateur();
    return compte ? (compte.displayName ?? compte.email) : null;
  });

  /** La pastille d'état : ce que dit la sonde de santé de l'API. */
  protected readonly etat = computed((): DccmStatus => {
    switch (this.apiJoignable()) {
      case true:
        return { label: 'API joignable', tone: 'success' };
      case false:
        return { label: 'API injoignable', tone: 'error' };
      default:
        return { label: "Lecture de l'état de l'API…", tone: 'neutral' };
    }
  });

  /** Les Espaces de l'API, Espace personnel d'abord. */
  protected readonly optionsDEspace = computed((): DccmScopeOption[] =>
    [...this.espaceCourant.espaces()]
      .sort(
        (a, b) => Number(b.kind === 'PERSONAL') - Number(a.kind === 'PERSONAL'),
      )
      .map((espace) => ({
        value: espace.id,
        label: NOMS_D_ESPACE[espace.kind] ?? espace.label,
      })),
  );

  protected readonly espaceChoisi = computed(
    () => this.espaceCourant.espace()?.id ?? null,
  );

  constructor() {
    this.auth.moi().subscribe({
      next: (compte) => this.utilisateur.set(compte),
      error: () => undefined,
    });

    this.health.read().subscribe({
      next: () => this.apiJoignable.set(true),
      error: () => this.apiJoignable.set(false),
    });

    this.espaceCourant.charger();
  }

  protected choisirLEspace(id: string | null): void {
    this.espaceCourant.choisir(id);
  }

  protected seDeconnecter(): void {
    this.auth.seDeconnecter().subscribe({
      next: ({ endSessionUrl }) => this.redirection.vers(endSessionUrl ?? '/'),
      error: () => this.redirection.vers('/'),
    });
  }
}
