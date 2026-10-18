import { Module } from '@nestjs/common';
import { HouseholdController } from './household.controller';
import { HouseholdRepository } from './household.repository';
import { HouseholdService } from './household.service';

/** Le Foyer : les deux Comptes qui le composent, hors de tout Espace. */
@Module({
  controllers: [HouseholdController],
  providers: [HouseholdService, HouseholdRepository],
})
export class HouseholdModule {}
