import {
  Global,
  Logger,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  private static readonly logger = new Logger(DatabaseModule.name);

  // Le cycle de vie est tenu ici, et non par le service : celui-ci est un
  // client Prisma étendu, dont Nest ne verrait pas les crochets.
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.$connect();
    DatabaseModule.logger.log('Connexion à la base établie.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
