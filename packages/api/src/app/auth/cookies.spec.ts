import type { Request } from 'express';
import { SESSION_COOKIE, readCookie } from './cookies';

function requete(cookie?: string): Request {
  return { headers: cookie === undefined ? {} : { cookie } } as Request;
}

/**
 * Le découpage se fait ici plutôt que par un middleware global, pour que la
 * pile soit assemblée de la même façon dans les tests et en production. Il doit
 * donc être juste tout seul.
 */
describe('readCookie', () => {
  it('lit un cookie parmi plusieurs', () => {
    expect(
      readCookie(
        requete(`autre=x; ${SESSION_COOKIE}=jeton; encore=y`),
        SESSION_COOKIE,
      ),
    ).toBe('jeton');
  });

  it('ne rend rien quand la requête ne porte aucun cookie', () => {
    expect(readCookie(requete(), SESSION_COOKIE)).toBeNull();
  });

  it('ne confond pas un cookie dont le nom est un suffixe', () => {
    // `pos_session` et `autre_pos_session` sont deux cookies différents. Une
    // recherche par sous-chaîne les mélangerait, et la garde lirait le mauvais.
    expect(
      readCookie(requete(`autre_${SESSION_COOKIE}=intrus`), SESSION_COOKIE),
    ).toBeNull();
  });

  it('accepte les espaces que les navigateurs insèrent entre les cookies', () => {
    expect(
      readCookie(requete(`a=1;${SESSION_COOKIE}=jeton`), SESSION_COOKIE),
    ).toBe('jeton');
  });

  it('rend la valeur décodée', () => {
    expect(readCookie(requete(`${SESSION_COOKIE}=a%2Bb`), SESSION_COOKIE)).toBe(
      'a+b',
    );
  });

  it("ne rend rien plutôt que d'inventer une valeur indécodable", () => {
    // Un tel cookie ne vient pas de nous : le rendre tel quel reviendrait à
    // comparer autre chose que ce que le navigateur a reçu.
    expect(
      readCookie(requete(`${SESSION_COOKIE}=%E0%A4%A`), SESSION_COOKIE),
    ).toBeNull();
  });
});
