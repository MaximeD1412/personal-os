import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { createHash, randomBytes } from 'node:crypto';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';

/** Ce qu'Authentik dit de lui-même. Seul ce qu'on utilise est retenu. */
interface Metadonnees {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwks: ReturnType<typeof createRemoteJWKSet>;
  endSessionEndpoint: string | null;
}

/** Un aller-retour prêt à partir : l'URL, et ce qu'il faut garder au chaud. */
export interface DemandeAutorisation {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

/** Ce que le fournisseur d'identité répond à « qui es-tu ». */
export interface Identite {
  subject: string;
  email: string;
  displayName: string | null;
}

const SCOPES = 'openid email profile';

/**
 * Client OIDC de l'API.
 *
 * L'API est un client OIDC **ordinaire** (ADR 0015) : elle échange le code,
 * lit l'identité, et s'arrête là. Les jetons d'Authentik ne sortent jamais de
 * cet objet — ni vers le navigateur, ni vers la base. C'est ce qui rend
 * l'interface si étroite : on entre un code, on ressort une identité.
 */
@Injectable()
export class OidcClient {
  private metadonnees: Promise<Metadonnees> | null = null;

  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  /**
   * Prépare le départ du flux authorization code, avec PKCE.
   *
   * `state` déjoue la CSRF de connexion, `nonce` interdit qu'un jeton
   * d'identité obtenu ailleurs soit rejoué ici, et le vérificateur PKCE rend
   * un code intercepté inutilisable sans lui.
   */
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

  /**
   * Échange le code contre un jeton d'identité, et n'en rend que l'identité.
   *
   * La signature est vérifiée contre le jeu de clés publié par Authentik, pas
   * seulement contre le fait que le jeton vient d'arriver par TLS : le jour où
   * un intermédiaire terminera le TLS à notre place, la vérification tiendra
   * toujours.
   */
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

    // Le nonce relie ce jeton à *cette* demande. Sans lui, un jeton d'identité
    // obtenu ailleurs pour le même client passerait pour une connexion.
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

  /** Adresse de déconnexion chez Authentik, si l'IdP en publie une. */
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
    // Le secret voyage dans l'en-tête d'autorisation plutôt que dans le corps :
    // c'est la méthode qu'Authentik configure par défaut pour un client
    // confidentiel, et elle tient le secret hors des journaux de requête.
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
      // Le corps de l'erreur reste ici : il peut porter le code d'autorisation
      // présenté, et il n'a rien à faire dans une réponse au navigateur.
      throw new UnauthorizedException("Le code d'autorisation a été refusé.");
    }

    return (await reponse.json()) as Record<string, unknown>;
  }

  /**
   * Interroge `.well-known`, une fois, et retient la réponse.
   *
   * La découverte est paresseuse pour que l'API démarre même si Authentik est
   * momentanément absent : l'indisponibilité de l'IdP empêche de se connecter,
   * elle ne doit pas empêcher la pile de se lever ni la sonde de santé de
   * répondre. Un échec efface le cache — sinon la première tentative ratée
   * condamnerait la connexion jusqu'au prochain redémarrage.
   */
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

    // L'émetteur publié fait foi pour la vérification des jetons, mais il doit
    // désigner celui qu'on a configuré : un document de découverte qui
    // annonce un autre émetteur signale une configuration branchée ailleurs.
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

/** 256 bits d'aléa, en base64url — la forme qu'attend PKCE. */
function motAleatoire(): string {
  return randomBytes(32).toString('base64url');
}

function defiPkce(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}
