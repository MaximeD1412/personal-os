import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

const DEFAULT_PORT = 3000;
const DEFAULT_CORS_ORIGINS = 'http://localhost:4200,http://localhost:4201';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // Le tableau de bord et le portfolio sont servis depuis d'autres hôtes.
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

void bootstrap();
