import { conditionnements, portions, quantiteDeLigne } from './quantite';

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

describe('Un nombre de conditionnements', () => {
  it.each([
    [1, 'boîte', '1\u00a0boîte'],
    [2, 'boîte', '2\u00a0boîtes'],
    [3, 'sachet', '3\u00a0sachets'],
    [2, 'bocal', '2\u00a0bocaux'],
    [2, 'pot de yaourt', '2\u00a0pots de yaourt'],
    [2, 'filet de 3', '2\u00a0filets de 3'],
    [4, 'noix', '4\u00a0noix'],
    [2, 'cageots', '2\u00a0cageots'],
    [2, 'tonneau', '2\u00a0tonneaux'],
  ] as const)('écrit %s × « %s » comme « %s »', (nombre, libelle, attendu) => {
    expect(conditionnements(nombre, libelle)).toBe(attendu);
  });
});
