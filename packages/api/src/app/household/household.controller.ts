import { Controller, Get } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import type { UserRecord } from '../auth/auth.repository';
import { CurrentUser } from '../auth/current-user.decorator';
import { HouseholdDto } from './household.dto';
import { HouseholdService } from './household.service';

/**
 * Le Foyer et ses Comptes, pour choisir les Participants d'un Repas planifié
 * et porter les Préférences alimentaires. `Household` et `User` sont hors
 * Espace : aucun `@Espaces` à déclarer. Le schéma de sortie borne la réponse :
 * ni e-mail ni sujet OIDC ne la traversent (ADR 0030).
 */
@Controller('household')
export class HouseholdController {
  constructor(private readonly foyers: HouseholdService) {}

  @Get()
  @ZodResponse({ status: 200, type: HouseholdDto })
  lire(@CurrentUser() user: UserRecord) {
    return this.foyers.duCompte(user.id);
  }
}
