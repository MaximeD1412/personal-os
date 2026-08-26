import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** L'identité qu'Authentik rendra pour un code donné. */
export interface IdentiteFournie {
  sub: string;
  email?: string;
  name?: string;
}

interface CodeAutorise {
  nonce: string;
  codeChallenge: string;
  identite: IdentiteFournie;
  /** Fabrique un jeton d'identité que l'API doit refuser. */
  jetonInvalide?: 'signature' | 'audience' | 'expire';
}

/**
 * Un fournisseur d'identité de laboratoire, en tout point conforme à ce
 * qu'Authentik expose : découverte, jeu de clés, point de jeton.
 *
 * Il existe pour que le flux soit exercé **entier** — redirection, échange du
 * code contre un jeton, vérification de la signature contre le jeu de clés —
 * sans dépendre d'un service extérieur. Remplacer le client OIDC par un
 * mensonge reviendrait à tester le mensonge, et c'est précisément la partie
 * qu'on ne peut pas se permettre de croire sur parole.
 */
export interface FauxAuthentik {
  issuer: string;
  clientId: string;
  clientSecret: string;
  /**
   * Joue l'étape que le navigateur ferait : l'utilisateur s'authentifie, et
   * Authentik retient le code, le nonce et le défi PKCE de la demande.
   */
  autoriserCode(code: string, autorisation: CodeAutorise): void;
  /** Le dernier jeton d'identité émis — celui qui ne doit jamais ressortir. */
  dernierJetonEmis(): string | null;
  /** Ce que le point de jeton a reçu au dernier échange. */
  dernierEchange(): URLSearchParams | null;
  close(): Promise<void>;
}

const CLIENT_ID = 'personal-os';
const CLIENT_SECRET = 'secret-de-test';

export async function demarrerFauxAuthentik(): Promise<FauxAuthentik> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', {
    extractable: true,
  });
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test', alg: 'RS256' };

  const codes = new Map<string, CodeAutorise>();
  let racine = '';
  let dernierJeton: string | null = null;
  let dernierEchange: URLSearchParams | null = null;

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://interne.invalide');

    const repondre = (code: number, corps: unknown): void => {
      response.writeHead(code, { 'content-type': 'application/json' });
      response.end(JSON.stringify(corps));
    };

    if (
      url.pathname ===
      '/application/o/personal-os/.well-known/openid-configuration'
    ) {
      repondre(200, {
        issuer: `${racine}/application/o/personal-os/`,
        authorization_endpoint: `${racine}/application/o/authorize/`,
        token_endpoint: `${racine}/application/o/token/`,
        jwks_uri: `${racine}/application/o/personal-os/jwks/`,
        end_session_endpoint: `${racine}/application/o/personal-os/end-session/`,
      });
      return;
    }

    if (url.pathname === '/application/o/personal-os/jwks/') {
      repondre(200, { keys: [jwk] });
      return;
    }

    if (url.pathname === '/application/o/token/' && request.method === 'POST') {
      void (async () => {
        const parametres = new URLSearchParams(await lireCorps(request));
        dernierEchange = parametres;

        const identifiants = identifiantsClient(request, parametres);
        if (
          identifiants.clientId !== CLIENT_ID ||
          identifiants.clientSecret !== CLIENT_SECRET
        ) {
          repondre(401, { error: 'invalid_client' });
          return;
        }

        const autorisation = codes.get(parametres.get('code') ?? '');
        if (!autorisation) {
          repondre(400, { error: 'invalid_grant' });
          return;
        }

        const verificateur = parametres.get('code_verifier') ?? '';
        if (defiPkce(verificateur) !== autorisation.codeChallenge) {
          repondre(400, { error: 'invalid_grant', hint: 'pkce' });
          return;
        }

        // Un code d'autorisation ne s'échange qu'une fois.
        codes.delete(parametres.get('code') ?? '');

        dernierJeton = await signerJetonIdentite(autorisation);
        repondre(200, {
          access_token: `acces-${autorisation.identite.sub}`,
          id_token: dernierJeton,
          token_type: 'Bearer',
          expires_in: 300,
        });
      })();
      return;
    }

    response.writeHead(404).end();
  });

  async function signerJetonIdentite(
    autorisation: CodeAutorise,
  ): Promise<string> {
    const maintenant = Math.floor(Date.now() / 1000);
    const jeton = new SignJWT({
      email: autorisation.identite.email,
      name: autorisation.identite.name,
      nonce: autorisation.nonce,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuer(`${racine}/application/o/personal-os/`)
      .setAudience(
        autorisation.jetonInvalide === 'audience'
          ? 'un-autre-client'
          : CLIENT_ID,
      )
      .setSubject(autorisation.identite.sub)
      .setIssuedAt(maintenant)
      .setExpirationTime(
        autorisation.jetonInvalide === 'expire'
          ? maintenant - 60
          : maintenant + 300,
      );

    if (autorisation.jetonInvalide === 'signature') {
      // Signé par une clé que le jeu de clés publié ne contient pas.
      const { privateKey: autreCle } = await generateKeyPair('RS256', {
        extractable: true,
      });
      return jeton.sign(autreCle);
    }

    return jeton.sign(privateKey);
  }

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  racine = `http://127.0.0.1:${port}`;

  return {
    issuer: `${racine}/application/o/personal-os/`,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    autoriserCode: (code, autorisation) => codes.set(code, autorisation),
    dernierJetonEmis: () => dernierJeton,
    dernierEchange: () => dernierEchange,
    close: () => fermer(server),
  };
}

function identifiantsClient(
  request: IncomingMessage,
  parametres: URLSearchParams,
): { clientId: string | null; clientSecret: string | null } {
  const entete = request.headers.authorization;
  if (entete?.startsWith('Basic ')) {
    const [clientId, clientSecret] = Buffer.from(entete.slice(6), 'base64')
      .toString('utf8')
      .split(':')
      .map((partie) => decodeURIComponent(partie));
    return { clientId: clientId ?? null, clientSecret: clientSecret ?? null };
  }

  return {
    clientId: parametres.get('client_id'),
    clientSecret: parametres.get('client_secret'),
  };
}

function lireCorps(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let corps = '';
    request.on('data', (morceau) => (corps += morceau));
    request.on('end', () => resolve(corps));
    request.on('error', reject);
  });
}

function defiPkce(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

function fermer(server: Server): Promise<void> {
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
