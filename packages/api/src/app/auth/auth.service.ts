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

export interface DepartConnexion {
  url: string;
  transactionId: string;
}

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

    if (!this.config.allowedEmails.includes(identite.email)) {
      throw new ForbiddenException("Ce compte n'a pas accès à Personal OS.");
    }

    const user = await this.repository.apparier(identite);
    return this.ouvrirSession(user);
  }

  async porteurDeSession(token: string): Promise<UserRecord | null> {
    return this.repository.lireSession(empreinte(token), new Date());
  }

  async terminerSession(token: string | null): Promise<string | null> {
    const maintenant = new Date();
    if (token) {
      await this.repository.revoquerSession(empreinte(token), maintenant);
    }
    await this.repository.purgerSessionsExpirees(maintenant);

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

function empreinte(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function memeMot(attendu: string, presente: string): boolean {
  const a = Buffer.from(attendu);
  const b = Buffer.from(presente);
  return a.length === b.length && timingSafeEqual(a, b);
}
