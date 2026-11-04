import { createHash, randomBytes } from 'node:crypto';
import { ID_FOYER } from '../lib/espace/foyer';
import { PrismaService } from '../lib/prisma.service';
import { fermerLaSessionDeCapture, ouvrirLaSessionDeCapture } from './session';

const ENV = { DEMO_ACCOUNT_EMAILS: 'a@demo.test,b@demo.test' };
const MAINTENANT = new Date('2026-11-03T10:00:00.000Z');

function jeton(): string {
  return randomBytes(32).toString('base64url');
}

/** L'empreinte que la garde de l'API calcule sur le cookie (`auth.service.ts`). */
function empreinte(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('La Session de capture', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    for (const email of ['a@demo.test', 'b@demo.test']) {
      await prisma.user.upsert({
        where: { email },
        create: { subject: `demo:${email}`, email, householdId: ID_FOYER },
        update: {},
      });
    }
  });

  afterEach(async () => {
    await prisma.session.deleteMany({});
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("ouvre, pour le premier Compte de démo, une Session que l'API reconnaît", async () => {
    const token = jeton();
    await ouvrirLaSessionDeCapture(prisma, ENV, token, MAINTENANT);

    const session = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: empreinte(token) },
      select: { revokedAt: true, expiresAt: true, user: true },
    });
    expect(session.user.email).toBe('a@demo.test');
    expect(session.revokedAt).toBeNull();
    expect(session.expiresAt.getTime()).toBeGreaterThan(MAINTENANT.getTime());
  });

  it("ne vit qu'une demi-heure, si sa suppression n'a pas lieu", async () => {
    const token = jeton();
    await ouvrirLaSessionDeCapture(prisma, ENV, token, MAINTENANT);

    const { expiresAt } = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: empreinte(token) },
    });
    expect(expiresAt.getTime() - MAINTENANT.getTime()).toBeLessThanOrEqual(
      30 * 60 * 1000,
    );
  });

  it('est supprimée par sa fermeture, sans toucher aux autres Sessions', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'a@demo.test' },
    });
    await prisma.session.create({
      data: {
        tokenHash: 'empreinte-de-la-session-du-navigateur',
        userId: user.id,
        expiresAt: new Date(MAINTENANT.getTime() + 60 * 60 * 1000),
      },
    });
    const token = jeton();
    await ouvrirLaSessionDeCapture(prisma, ENV, token, MAINTENANT);

    await fermerLaSessionDeCapture(prisma, token);

    expect(
      await prisma.session.findMany({ select: { tokenHash: true } }),
    ).toEqual([{ tokenHash: 'empreinte-de-la-session-du-navigateur' }]);
  });

  it('se ferme sans erreur si elle a déjà disparu', async () => {
    const token = jeton();
    await ouvrirLaSessionDeCapture(prisma, ENV, token, MAINTENANT);
    await fermerLaSessionDeCapture(prisma, token);

    await expect(
      fermerLaSessionDeCapture(prisma, token),
    ).resolves.toBeUndefined();
  });

  it("demande le semis quand le Compte de démo n'existe pas encore", async () => {
    await expect(
      ouvrirLaSessionDeCapture(
        prisma,
        { DEMO_ACCOUNT_EMAILS: 'inconnu@demo.test,b@demo.test' },
        jeton(),
        MAINTENANT,
      ),
    ).rejects.toThrow(/pnpm demo:seed/);
    expect(await prisma.session.count()).toBe(0);
  });

  it('refuse de tourner en production, sans rien écrire', async () => {
    await expect(
      ouvrirLaSessionDeCapture(
        prisma,
        { ...ENV, APP_ENV: 'production' },
        jeton(),
        MAINTENANT,
      ),
    ).rejects.toThrow(/APP_ENV vaut « production »/);
    expect(await prisma.session.count()).toBe(0);
  });

  it.each(['', 'court', `${'a'.repeat(42)}`, `${'a'.repeat(42)}=`])(
    'refuse un jeton trop faible pour une Session (« %s »)',
    async (token) => {
      await expect(
        ouvrirLaSessionDeCapture(prisma, ENV, token, MAINTENANT),
      ).rejects.toThrow(/jeton/);
      expect(await prisma.session.count()).toBe(0);
    },
  );
});
