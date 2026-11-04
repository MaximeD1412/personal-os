import type {
  HouseholdRecord,
  HouseholdRepository,
} from './household.repository';
import { HouseholdService } from './household.service';

function service(foyer: HouseholdRecord | null): HouseholdService {
  const repository = {
    foyerDe: () => Promise.resolve(foyer),
  } as unknown as HouseholdRepository;
  return new HouseholdService(repository);
}

const FOYER: HouseholdRecord = {
  id: 'foyer',
  name: 'Foyer',
  members: [
    { id: 'a', email: 'camille@exemple.test', displayName: 'Camille' },
    { id: 'b', email: 'dominique@exemple.test', displayName: null },
    { id: 'c', email: 'sacha@exemple.test', displayName: '  ' },
  ],
};

describe('HouseholdService', () => {
  it("nomme chaque membre par son nom d'affichage, à défaut par la partie locale de son e-mail", async () => {
    const foyer = await service(FOYER).duCompte('a');

    expect(foyer.members).toEqual([
      { id: 'a', displayName: 'Camille' },
      { id: 'b', displayName: 'dominique' },
      { id: 'c', displayName: 'sacha' },
    ]);
  });

  it('ne laisse passer aucun e-mail', async () => {
    const foyer = await service(FOYER).duCompte('a');

    expect(JSON.stringify(foyer)).not.toContain('@');
  });

  it('échoue bruyamment pour un Compte sans Foyer', async () => {
    await expect(service(null).duCompte('perdu')).rejects.toThrow(
      "n'a pas de Foyer",
    );
  });
});
