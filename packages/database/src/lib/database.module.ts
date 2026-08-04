import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Rend l'accès aux données disponible partout : chaque module reste plat
 * (ADR 0016) et n'a pas à recâbler sa propre connexion.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
