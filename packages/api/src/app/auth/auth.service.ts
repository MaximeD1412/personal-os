import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';
import { AuthRepository, type UserRecord } from './auth.repository';
import { OidcClient } from './oidc.client';

/** Ce que le contrôleur doit poser pour que le retour soit reconnaissable. */
export interface DepartConnexion {
  url: string;
  transactionId: string;
}

/** Une session fraîchement émise : le jeton en clair, et sa durée de vie. */
export interface SessionEmise {
  token: string;
  maxAgeMs: number;
  user: UserRecord;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly oidc: OidcClient,
    private readonly repository: AuthRepository,
  ) {}

  /**
   * Ouvre un aller-retour OIDC et rend l'adresse où envoyer le navigateur.
   *
   * L'état, le nonce et le vérificateur PKCE restent en base : ce sont eux qui
   * feront la preuve, au retour, que ce navigateur-là est bien celui qui est
   * parti. Les confier au navigateur les priverait de tout intérêt.
   */
  async commencerConnexion(): Promise<DepartConnexion> {
    const maintenant = new Date();
    await this.repository.purgerTransactionsExpirees(maintenant);

    const demande = await this.oidc.construireDemande();
    const transactionId = await this.repository.ouvrirTransaction({
      state: demande.state,
      nonce: demande.nonce,
      codeVerifier: demande.codeVerifier,
      expiresAt: new Date(
        maintenant.getTime() + this.config.loginTtlSeconds * 1000,
      ),
    });

    return { url: demande.url, transactionId };
  }

  /**
   * Termine le flux : échange le code, admet l'identité, émet la session.
   *
   * Le jeton d'identité d'Authentik meurt ici. Ce qui repart vers le
   * navigateur est un jeton **à nous**, opaque, dont seule l'empreinte est
   * conservée.
   */
  async terminerConnexion(
    transactionId: string | null,
    code: string,
    state: string,
  ): Promise<SessionEmise> {
    if (!transactionId) {
      throw new UnauthorizedException(
        'Aucune connexion en cours pour ce navigateur.',
      );
    }

    const transaction =
      await this.repository.consommerTransaction(transactionId);
    if (!transaction || transaction.expiresAt <= new Date()) {
      throw new UnauthorizedException('Connexion expirée — recommencer.');
    }

    if (!memeMot(transaction.state, state)) {
      throw new UnauthorizedException("L'état ne correspond pas à la demande.");
    }

    const identite = await this.oidc.echangerCode(
      code,
      transaction.codeVerifier,
      transaction.nonce,
    );

    // Toute la politique d'admission tient ici. Une identité valide chez
    // Authentik mais absente de la liste n'ouvre rien et ne crée rien : il n'y
    // a pas de parcours d'inscription, même involontaire (ADR 0015).
    if (!this.config.allowedEmails.includes(identite.email)) {
      throw new ForbiddenException("Ce compte n'a pas accès à Personal OS.");
    }

    const user = await this.repository.apparier(identite);
    return this.ouvrirSession(user);
  }

  /** Le porteur d'une session, si elle est encore valide. */
  async porteurDeSession(token: string): Promise<UserRecord | null> {
    return this.repository.lireSession(empreinte(token), new Date());
  }

  /** Invalide la session côté serveur, et rend où finir de se déconnecter. */
  async terminerSession(token: string | null): Promise<string | null> {
    const maintenant = new Date();
    if (token) {
      await this.repository.revoquerSession(empreinte(token), maintenant);
    }
    await this.repository.purgerSessionsExpirees(maintenant);

    // Ne pas passer par Authentik laisserait sa propre session ouverte : le
    // clic suivant sur « se connecter » rouvrirait sans rien demander, ce qui
    // ne ressemble pas à une déconnexion.
    return this.oidc.urlDeDeconnexion().catch(() => null);
  }

  private async ouvrirSession(user: UserRecord): Promise<SessionEmise> {
    const maintenant = new Date();
    await this.repository.purgerSessionsExpirees(maintenant);

    const token = randomBytes(32).toString('base64url');
    const maxAgeMs = this.config.sessionTtlSeconds * 1000;

    await this.repository.ouvrirSession(
      empreinte(token),
      user.id,
      new Date(maintenant.getTime() + maxAgeMs),
    );

    return { token, maxAgeMs, user };
  }
}

/**
 * Seule l'empreinte du jeton est conservée.
 *
 * Le jeton fait 256 bits d'aléa : il n'y a rien à deviner, donc rien à saler
 * ni à ralentir. Ce que l'empreinte protège, c'est la lecture de la base —
 * une sauvegarde restaurée ne rend aucune session utilisable.
 */
function empreinte(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparaison à durée constante — l'état est un secret partagé. */
function memeMot(attendu: string, presente: string): boolean {
  const a = Buffer.from(attendu);
  const b = Buffer.from(presente);
  return a.length === b.length && timingSafeEqual(a, b);
}
