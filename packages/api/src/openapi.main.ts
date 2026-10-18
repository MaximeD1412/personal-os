import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app/app.module';
import { documentOpenApi } from './openapi';

/**
 * Écrit l'OpenAPI dans un fichier, sans démarrer l'API : `preview` assemble
 * les modules sans instancier leurs services, si bien qu'il ne faut ni base
 * ni Authentik. C'est la cible `nx run api:openapi`.
 */
async function ecrireLOpenApi(cible: string): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  app.setGlobalPrefix('api');

  writeFileSync(cible, `${JSON.stringify(documentOpenApi(app), null, 2)}\n`);
  await app.close();
}

void ecrireLOpenApi(resolve(process.argv[2] ?? 'openapi.json'));
