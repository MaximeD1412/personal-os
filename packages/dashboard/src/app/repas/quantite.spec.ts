import { portions, quantiteDeLigne } from './quantite';

describe('La quantité d’une ligne de recette', () => {
  it.each([
    [250, 'G', '250\u00a0g'],
    [1.5, 'KG', '1,5\u00a0kg'],
    [0.25, 'L', '0,25\u00a0l'],
    [50, 'CL', '50\u00a0cl'],
    [1.5, 'TSP', '1,5\u00a0c. à café'],
    [2, 'TBSP', '2\u00a0c. à soupe'],
    [1, 'PIECE', '1\u00a0pièce'],
    [0.5, 'PIECE', '0,5\u00a0pièce'],
    [3, 'PIECE', '3\u00a0pièces'],
    [1250, 'ML', '1\u202f250\u00a0ml'],
  ] as const)(
    'écrit %s %s comme « %s », sans la convertir',
    (quantity, unit, attendu) => {
      expect(quantiteDeLigne({ quantity, unit })).toBe(attendu);
    },
  );

  it('accorde les portions', () => {
    expect(portions(1)).toBe('1\u00a0portion');
    expect(portions(4)).toBe('4\u00a0portions');
  });
});
