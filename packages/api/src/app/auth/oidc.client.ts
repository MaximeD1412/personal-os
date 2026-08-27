import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { createHash, randomBytes } from 'node:crypto';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';

interface Metadonnees {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwks: ReturnType<typeof createRemoteJWKSet>;
  endSessionEndpoint: string | null;
}

export interface DemandeAutorisation {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface Identite {
  subject: string;
  email: string;
  displayName: string | null;
}

const SCOPES = 'openid email profile';

@Injectable()
export class OidcClient {
  private metadonnees: Promise<Metadonnees> | null = null;

  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  async construireDemande(): Promise<DemandeAutorisation> {
    const { authorizationEndpoint } = await this.decouvrir();

    const state = motAleatoire();
    const nonce = motAleatoire();
    const codeVerifier = motAleatoire();

    const url = new URL(authorizationEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', defiPkce(codeVerifier));
    url.searchParams.set('code_challenge_method', 'S256');

    return { url: url.toString(), state, nonce, codeVerifier };
  }

  async echangerCode(
    code: string,
    codeVerifier: string,
    nonce: string,
  ): Promise<Identite> {
    const metadonnees = await this.decouvrir();
    const reponse = await this.appelerPointDeJeton(
      metadonnees,
      code,
      codeVerifier,
    );

    const idToken = reponse['id_token'];
    if (typeof idToken !== 'string') {
      throw new UnauthorizedException(
        "Aucun jeton d'identité dans la réponse.",
      );
    }

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(idToken, metadonnees.jwks, {
        issuer: metadonnees.issuer,
        audience: this.config.clientId,
      }));
    } catch {
      throw new UnauthorizedException("Jeton d'identité refusé.");
    }

    if (payload['nonce'] !== nonce) {
      throw new UnauthorizedException("Jeton d'identité hors de sa demande.");
    }

    const subject = payload.sub;
    const email = payload['email'];
    if (!subject || typeof email !== 'string' || !email) {
      throw new UnauthorizedException(
        "Le fournisseur d'identité n'a rendu ni sujet ni adresse.",
      );
    }

    return {
      subject,
      email: email.toLowerCase(),
      displayName: typeof payload['name'] === 'string' ? payload['name'] : null,
    };
  }

  async urlDeDeconnexion(): Promise<string | null> {
    const { endSessionEndpoint } = await this.decouvrir();
    if (!endSessionEndpoint) {
      return null;
    }

    const url = new URL(endSessionEndpoint);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('post_logout_redirect_uri', this.config.dashboardUrl);
    return url.toString();
  }

  private async appelerPointDeJeton(
    metadonnees: Metadonnees,
    code: string,
    codeVerifier: string,
  ): Promise<Record<string, unknown>> {
    const identifiants = Buffer.from(
      `${encodeURIComponent(this.config.clientId)}:${encodeURIComponent(
        this.config.clientSecret,
      )}`,
    ).toString('base64');

    let reponse: Response;
    try {
      reponse = await fetch(metadonnees.tokenEndpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          authorization: `Basic ${identifiants}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.config.redirectUri,
          code_verifier: codeVerifier,
        }).toString(),
      });
    } catch {
      throw new ServiceUnavailableException(
        "Le fournisseur d'identité est injoignable.",
      );
    }

    if (!reponse.ok) {
      throw new UnauthorizedException("Le code d'autorisation a été refusé.");
    }

    return (await reponse.json()) as Record<string, unknown>;
  }

  private decouvrir(): Promise<Metadonnees> {
    this.metadonnees ??= this.lireMetadonnees().catch((erreur: unknown) => {
      this.metadonnees = null;
      throw erreur;
    });

    return this.metadonnees;
  }

  private async lireMetadonnees(): Promise<Metadonnees> {
    const url = `${sansBarreFinale(this.config.issuer)}/.well-known/openid-configuration`;

    let reponse: Response;
    try {
      reponse = await fetch(url);
    } catch {
      throw new ServiceUnavailableException(
        "Le fournisseur d'identité est injoignable.",
      );
    }

    if (!reponse.ok) {
      throw new ServiceUnavailableException(
        `Découverte OIDC refusée par ${url} (${reponse.status}).`,
      );
    }

    const document = (await reponse.json()) as Record<string, unknown>;
    const issuer = champ(document, 'issuer');

    if (sansBarreFinale(issuer) !== sansBarreFinale(this.config.issuer)) {
      throw new ServiceUnavailableException(
        `Découverte OIDC incohérente : ${issuer} ne désigne pas ${this.config.issuer}.`,
      );
    }

    return {
      issuer,
      authorizationEndpoint: champ(document, 'authorization_endpoint'),
      tokenEndpoint: champ(document, 'token_endpoint'),
      jwks: createRemoteJWKSet(new URL(champ(document, 'jwks_uri'))),
      endSessionEndpoint:
        typeof document['end_session_endpoint'] === 'string'
          ? document['end_session_endpoint']
          : null,
    };
  }
}

function champ(document: Record<string, unknown>, nom: string): string {
  const valeur = document[nom];
  if (typeof valeur !== 'string' || !valeur) {
    throw new ServiceUnavailableException(
      `Découverte OIDC incomplète : ${nom} manque.`,
    );
  }
  return valeur;
}

function sansBarreFinale(url: string): string {
  return url.replace(/\/+$/, '');
}

function motAleatoire(): string {
  return randomBytes(32).toString('base64url');
}

function defiPkce(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}
