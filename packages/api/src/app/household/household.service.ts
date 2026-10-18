import { Injectable } from '@nestjs/common';
import type { Household } from '@personal-os/contracts';
import { HouseholdRepository, type MemberRecord } from './household.repository';

@Injectable()
export class HouseholdService {
  constructor(private readonly foyers: HouseholdRepository) {}

  /**
   * Le Foyer du Compte connecté. Tout Compte en a un — la migration le pose et
   * l'appariement y rattache chaque Compte — : son absence est un défaut, pas
   * un cas à rendre.
   */
  async duCompte(userId: string): Promise<Household> {
    const foyer = await this.foyers.foyerDe(userId);
    if (!foyer) {
      throw new Error(`Le Compte ${userId} n'a pas de Foyer.`);
    }

    return {
      id: foyer.id,
      name: foyer.name,
      members: foyer.members.map((membre) => ({
        id: membre.id,
        displayName: nommer(membre),
      })),
    };
  }
}

/** Le nom d'affichage, à défaut la partie locale de l'e-mail. */
export function nommer(
  membre: Pick<MemberRecord, 'email' | 'displayName'>,
): string {
  const nom = membre.displayName?.trim();
  return nom ? nom : membre.email.split('@')[0];
}
