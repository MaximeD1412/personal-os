import type { INestApplication } from '@nestjs/common';
import type { Scope } from '@personal-os/contracts';
import request from 'supertest';
import type { FauxAuthentik } from './faux-authentik';

/**
 * Le jeu de données qui couvre les trois Espaces : celui de chacun des deux
 * Comptes, et celui du Foyer. Il est posé par l'API elle-même — connexion,
 * puis lecture des Espaces — plutôt qu'en écrivant en base : ce qu'il installe
 * est donc exactement ce que l'application installe.
 *
 * Les tranches suivantes s'en servent pour vérifier leur propre cloisonnement,
 * sans avoir à réinventer deux comptes et un foyer.
 */
export interface CompteDeTest {
  email: string;
  /** Le cookie de session, prêt à être posé sur une requête. */
  session: string;
  espacePersonnel: string;
}

export interface JeuDEspaces {
  a: CompteDeTest;
  b: CompteDeTest;
  espaceFoyer: string;
}

export async function poserLeJeuDEspaces(
  app: INestApplication,
  authentik: FauxAuthentik,
  emails: readonly [string, string],
): Promise<JeuDEspaces> {
  const a = await ouvrirUnCompte(app, authentik, 'sujet-a', emails[0]);
  const b = await ouvrirUnCompte(app, authentik, 'sujet-b', emails[1]);

  const espaceFoyer = a.espaces.find(({ kind }) => kind === 'HOUSEHOLD');
  if (!espaceFoyer) {
    throw new Error("Le Foyer n'a pas d'Espace : la migration ne l'a pas posé.");
  }

  return {
    a: { email: a.email, session: a.session, espacePersonnel: a.personnel.id },
    b: { email: b.email, session: b.session, espacePersonnel: b.personnel.id },
    espaceFoyer: espaceFoyer.id,
  };
}

async function ouvrirUnCompte(
  app: INestApplication,
  authentik: FauxAuthentik,
  sujet: string,
  email: string,
): Promise<{
  email: string;
  session: string;
  espaces: Scope[];
  personnel: Scope;
}> {
  const depart = await request(app.getHttpServer())
    .get('/api/auth/login')
    .expect(302);

  const destination = new URL(depart.headers['location']);
  const code = `code-${sujet}`;

  authentik.autoriserCode(code, {
    nonce: destination.searchParams.get('nonce') ?? '',
    codeChallenge: destination.searchParams.get('code_challenge') ?? '',
    identite: { sub: sujet, email },
  });

  const retour = await request(app.getHttpServer())
    .get(
      `/api/auth/callback?code=${code}&state=${destination.searchParams.get('state')}`,
    )
    .set('Cookie', cookie(depart, 'pos_login'))
    .expect(302);

  const session = cookie(retour, 'pos_session');
  const espaces = await request(app.getHttpServer())
    .get('/api/espaces')
    .set('Cookie', session)
    .expect(200);

  const personnel = (espaces.body as Scope[]).find(
    ({ kind }) => kind === 'PERSONAL',
  );
  if (!personnel) {
    throw new Error(`${email} n'a pas reçu d'Espace personnel.`);
  }

  return { email, session, espaces: espaces.body, personnel };
}

function cookie(reponse: request.Response, nom: string): string {
  const cookies = (reponse.headers['set-cookie'] ?? []) as unknown as string[];
  const trouve = cookies.find((candidat) => candidat.startsWith(`${nom}=`));

  if (!trouve) {
    throw new Error(`aucun cookie ${nom} dans la réponse`);
  }
  return trouve.split(';')[0];
}
