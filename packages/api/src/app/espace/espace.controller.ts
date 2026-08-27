import { Controller, Get } from '@nestjs/common';
import type { Scope } from '@personal-os/contracts';
import type { UserRecord } from '../auth/auth.repository';
import { CurrentUser } from '../auth/current-user.decorator';
import { EspaceRepository } from './espace.repository';

@Controller('espaces')
export class EspaceController {
  constructor(private readonly espaces: EspaceRepository) {}

  /** Les Espaces que le Compte connecté atteint via ses appartenances. */
  @Get()
  mesEspaces(@CurrentUser() user: UserRecord): Promise<Scope[]> {
    return this.espaces.espacesDe(user.id);
  }
}
