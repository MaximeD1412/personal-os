import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { accepterLesCorpsJson } from './corps';
import { verifierLEnvironnement } from './environnement';
import { exposerOpenApi } from './openapi';

const DEFAULT_PORT = 3000;
const DEFAULT_CORS_ORIGINS = 'http://localhost:4200,http://localhost:4201';

async function bootstrap(): Promise<void> {
  // Avant Nest : une installation mal désignée ne doit rien ouvrir, pas même
  // la connexion à la base (ADR 0031).
  verifierLEnvironnement(process.env);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  accepterLesCorpsJson(app);
  exposerOpenApi(app);

  app.enableCors({
    origin: (process.env['CORS_ORIGINS'] ?? DEFAULT_CORS_ORIGINS)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });

  const port = Number(process.env['PORT'] ?? DEFAULT_PORT);
  await app.listen(port);
  Logger.log(`API disponible sur http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap().catch((erreur: unknown) => {
  Logger.error(erreur instanceof Error ? erreur.message : erreur, 'Bootstrap');
  process.exit(1);
});
