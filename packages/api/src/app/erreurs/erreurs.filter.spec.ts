import {
  type ArgumentsHost,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { type ApiError, zApiError } from '@personal-os/contracts';
import { ErreurDEspace, type RaisonDuRefus } from '@personal-os/database';
import { ZodSerializationException, ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';
import { ErreurMetier, Introuvable } from './erreur-metier';
import { ErreursFilter } from './erreurs.filter';

const MESSAGE_INTERNE = 'connexion refusée par 10.0.0.12:5432';

describe("ErreursFilter : l'enveloppe unique (ADR 0030)", () => {
  let journal: jest.SpyInstance;

  beforeEach(() => {
    journal = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    journal.mockRestore();
  });

  describe('une erreur métier', () => {
    it('donne un 422 avec son code et son message', () => {
      const erreur = new ErreurMetier(
        'event.period_reversed',
        "La fin d'un Événement ne précède pas son début.",
      );

      expect(envelopper(erreur)).toEqual({
        status: 422,
        code: 'event.period_reversed',
        message: "La fin d'un Événement ne précède pas son début.",
      });
    });

    it('garde le statut qu’elle déclare', () => {
      const erreur = new ErreurMetier('auth.required', 'Aucune session.', 401);

      expect(envelopper(erreur)).toEqual({
        status: 401,
        code: 'auth.required',
        message: 'Aucune session.',
      });
    });

    it('donne un 404 quand elle est un « introuvable »', () => {
      const erreur = new Introuvable(
        'event.not_found',
        'Aucun Événement de cet identifiant.',
      );

      expect(envelopper(erreur)).toEqual({
        status: 404,
        code: 'event.not_found',
        message: 'Aucun Événement de cet identifiant.',
      });
    });
  });

  describe('un schéma non respecté', () => {
    it('donne un 400 `request.invalid` dont `fields` pointe chaque champ', () => {
      const schema = z.object({
        week: z.string(),
        a: z.object({ b: z.array(z.object({ c: z.int() })) }),
      });
      const resultat = schema.safeParse({ a: { b: [{ c: 'x' }] } });

      const enveloppe = envelopper(new ZodValidationException(resultat.error));

      expect(enveloppe).toMatchObject({
        status: 400,
        code: 'request.invalid',
        message: expect.any(String),
      });
      expect(
        enveloppe.fields?.map(({ path, code }) => ({ path, code })),
      ).toEqual([
        { path: 'week', code: 'invalid_type' },
        { path: 'a.b.0.c', code: 'invalid_type' },
      ]);
      expect(enveloppe.fields?.[0].message).toEqual(expect.any(String));
    });
  });

  describe("un refus de la garde d'Espace", () => {
    it.each<[RaisonDuRefus, number, string]>([
      ['hors-portee', 403, 'scope.out_of_reach'],
      ['type-refuse', 403, 'scope.kind_refused'],
      ['absent', 422, 'scope.missing'],
      ['sans-portee', 500, 'scope.undeclared'],
    ])('%s donne un %i `%s`', (raison, status, code) => {
      const enveloppe = envelopper(new ErreurDEspace(raison, 'refusé'));

      expect(enveloppe).toMatchObject({ status, code });
    });

    it('ne laisse rien filer du refus interne quand il est un défaut', () => {
      const enveloppe = envelopper(
        new ErreurDEspace('sans-portee', MESSAGE_INTERNE),
      );

      expect(JSON.stringify(enveloppe)).not.toContain(MESSAGE_INTERNE);
      expect(journal).toHaveBeenCalled();
    });
  });

  describe('une HttpException restante', () => {
    it('garde son statut et son message, sous le code `http.<status>`', () => {
      expect(
        envelopper(new NotFoundException('Aucune Trace de cet identifiant.')),
      ).toEqual({
        status: 404,
        code: 'http.404',
        message: 'Aucune Trace de cet identifiant.',
      });
    });

    it('garde un 503 annoncé par l’API', () => {
      expect(
        envelopper(new ServiceUnavailableException('Base injoignable.')),
      ).toEqual({
        status: 503,
        code: 'http.503',
        message: 'Base injoignable.',
      });
    });

    it.each([
      ['une 500 explicite', new InternalServerErrorException(MESSAGE_INTERNE)],
      ['une réponse hors de son schéma', new ZodSerializationException(null)],
    ])('traite %s comme un défaut', (_cas, erreur: HttpException) => {
      const enveloppe = envelopper(erreur);

      expect(enveloppe.status).toBe(500);
      expect(enveloppe.code).toBe('internal');
      expect(JSON.stringify(enveloppe)).not.toContain(MESSAGE_INTERNE);
    });
  });

  describe('toute autre erreur', () => {
    it('donne un 500 `internal` sans pile ni message interne, et la journalise', () => {
      const erreur = new Error(MESSAGE_INTERNE);

      const enveloppe = envelopper(erreur);

      expect(enveloppe).toEqual({
        status: 500,
        code: 'internal',
        message: expect.any(String),
      });
      expect(JSON.stringify(enveloppe)).not.toContain(MESSAGE_INTERNE);
      expect(JSON.stringify(enveloppe)).not.toContain('at ');
      expect(journal).toHaveBeenCalledWith(MESSAGE_INTERNE, erreur.stack);
    });

    it('accepte une valeur levée qui n’est pas une Error', () => {
      expect(envelopper('chaîne levée')).toMatchObject({
        status: 500,
        code: 'internal',
      });
    });
  });
});

/** Passe l'erreur au filtre et rend ce qu'il a écrit, vérifié par le contrat. */
function envelopper(erreur: unknown): ApiError {
  const reponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const hote = {
    switchToHttp: () => ({ getResponse: () => reponse }),
  } as unknown as ArgumentsHost;

  new ErreursFilter().catch(erreur, hote);

  const [corps] = reponse.json.mock.calls[0] as [unknown];
  const enveloppe = zApiError.strict().parse(corps);
  expect(reponse.status).toHaveBeenCalledWith(enveloppe.status);
  return enveloppe;
}
