import { comptesDeDemo, refuserLaProduction } from './environment';

describe("L'environnement du jeu de démo", () => {
  describe('APP_ENV', () => {
    it('refuse explicitement de tourner en production', () => {
      expect(() => refuserLaProduction({ APP_ENV: 'production' })).toThrow(
        /APP_ENV vaut « production »/,
      );
    });

    it.each([undefined, 'staging', 'development'])(
      'laisse tourner avec APP_ENV=%s',
      (valeur) => {
        expect(() => refuserLaProduction({ APP_ENV: valeur })).not.toThrow();
      },
    );

    it('ne se laisse pas tromper par la casse ou les espaces', () => {
      expect(() => refuserLaProduction({ APP_ENV: ' Production ' })).toThrow();
    });
  });

  describe('DEMO_ACCOUNT_EMAILS', () => {
    it("lit les deux Comptes dans l'ordre, comme l'appariement les écrit", () => {
      expect(
        comptesDeDemo({
          DEMO_ACCOUNT_EMAILS: ' A@Exemple.test , b@exemple.test',
        }),
      ).toEqual(['a@exemple.test', 'b@exemple.test']);
    });

    it.each([
      [undefined],
      [''],
      ['a@exemple.test'],
      ['a@exemple.test,b@exemple.test,c@exemple.test'],
      ['a@exemple.test,A@exemple.test'],
      ['a@exemple.test,'],
    ])('refuse « %s » : il faut deux adresses distinctes', (valeur) => {
      expect(() => comptesDeDemo({ DEMO_ACCOUNT_EMAILS: valeur })).toThrow(
        /DEMO_ACCOUNT_EMAILS/,
      );
    });
  });
});
