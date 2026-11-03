import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

/** L'adresse du document, sous le préfixe global de l'API. */
export const CHEMIN_OPENAPI = 'openapi.json';

/**
 * L'OpenAPI de l'API, déduit des schémas zod que portent les DTO (ADR 0030).
 * Rien ne s'y écrit à la main : c'est de lui que le catalogue de la barre de
 * commande est tiré (ADR 0018, `nx run api:command-catalog`).
 */
export function documentOpenApi(app: INestApplication): OpenAPIObject {
  const configuration = new DocumentBuilder()
    .setTitle('Personal OS')
    .setDescription(
      "L'API privée du tableau de bord. Les contrats sont les schémas zod de `@personal-os/contracts`.",
    )
    .setVersion('1')
    .setOpenAPIVersion('3.1.0')
    .build();

  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, configuration));
}

/**
 * Sert le document en `/api/openapi.json`, hors production seulement. Il est
 * servi sans session : il ne décrit que des formes, aucune donnée. À appeler
 * avant `init()`, pour que la route passe avant celle des 404.
 */
export function exposerOpenApi(
  app: INestApplication,
  env: Record<string, string | undefined> = process.env,
): void {
  if (env['APP_ENV'] === 'production') {
    return;
  }

  SwaggerModule.setup('api', app, () => documentOpenApi(app), {
    useGlobalPrefix: false,
    ui: false,
    raw: ['json'],
    jsonDocumentUrl: `api/${CHEMIN_OPENAPI}`,
  });
}
