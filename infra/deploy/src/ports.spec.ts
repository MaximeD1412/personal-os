import { createServer, type Server } from 'node:net';

import { portsPris } from './livraison';

/**
 * La campagne de déploiement s'approprie Docker : noms de conteneurs fixes,
 * projet compose fixe, ports fixes. Deux exécutions simultanées se détruisent
 * mutuellement, et la première victime est un port que Docker refuse — sous
 * une erreur illisible, quarante secondes trop tard.
 *
 * Ce qui suit vérifie la garde qui le dit tout de suite.
 */
describe('portsPris', () => {
  const ouverts: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      ouverts
        .splice(0)
        .map((serveur) => new Promise((fini) => serveur.close(fini))),
    );
  });

  function occuper(port: number): Promise<void> {
    return new Promise((pret, echec) => {
      const serveur = createServer();
      ouverts.push(serveur);
      serveur.once('error', echec);
      serveur.once('listening', () => pret());
      serveur.listen(port, '127.0.0.1');
    });
  }

  /** Un port qu'on vient de relâcher : personne ne l'écoute. */
  async function portLibre(): Promise<number> {
    const serveur = createServer();
    await new Promise((pret) =>
      serveur.listen(0, '127.0.0.1', () => pret(null)),
    );
    const { port } = serveur.address() as { port: number };
    await new Promise((fini) => serveur.close(fini));
    return port;
  }

  it('ne signale rien quand tous les ports sont libres', async () => {
    const libre = await portLibre();

    expect(await portsPris([{ port: libre, role: 'le registre' }])).toEqual([]);
  });

  it("signale le port occupé, avec le rôle qu'il devait tenir", async () => {
    const pris = await portLibre();
    await occuper(pris);

    expect(await portsPris([{ port: pris, role: 'le registre' }])).toEqual([
      { port: pris, role: 'le registre' },
    ]);
  });

  it('ne rend que ceux qui sont pris, et garde leur ordre', async () => {
    const premier = await portLibre();
    const libre = await portLibre();
    const dernier = await portLibre();
    await occuper(premier);
    await occuper(dernier);

    expect(
      await portsPris([
        { port: premier, role: 'le registre' },
        { port: libre, role: "l'API" },
        { port: dernier, role: 'la répétition' },
      ]),
    ).toEqual([
      { port: premier, role: 'le registre' },
      { port: dernier, role: 'la répétition' },
    ]);
  });

  it("ne laisse derrière lui aucun port qu'il aurait ouvert pour regarder", async () => {
    const libre = await portLibre();

    await portsPris([{ port: libre, role: 'le registre' }]);

    // Si la sonde avait gardé sa prise, ce second appel le verrait occupé.
    expect(await portsPris([{ port: libre, role: 'le registre' }])).toEqual([]);
  });
});
