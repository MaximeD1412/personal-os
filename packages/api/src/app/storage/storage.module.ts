import { S3Client } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';
import { StockageDisque } from './stockage-disque';
import { StockageObjet } from './stockage-objet';
import { StockageS3 } from './stockage-s3';
import {
  STOCKAGE_CONFIG,
  lireStockageConfig,
  type StockageConfig,
} from './stockage.config';

/**
 * Le port du stockage objet. Un module qui range des fichiers importe celui-ci
 * et reçoit `StockageObjet`, sans savoir qui répond (`STORAGE_PROVIDER`).
 */
@Module({
  providers: [
    { provide: STOCKAGE_CONFIG, useFactory: () => lireStockageConfig() },
    {
      provide: StockageObjet,
      inject: [STOCKAGE_CONFIG],
      useFactory: (config: StockageConfig): StockageObjet =>
        config.fournisseur === 's3'
          ? new StockageS3(
              new S3Client({
                endpoint: config.endpoint,
                region: config.region,
                credentials: {
                  accessKeyId: config.cleDAcces,
                  secretAccessKey: config.secret,
                },
                // OVH sert le bucket dans le chemin, pas en sous-domaine, et
                // ne connaît pas les sommes de contrôle ajoutées par défaut
                // depuis la v3.729 du SDK.
                forcePathStyle: true,
                requestChecksumCalculation: 'WHEN_REQUIRED',
                responseChecksumValidation: 'WHEN_REQUIRED',
              }),
              config.bucket,
            )
          : new StockageDisque(config.racine),
    },
  ],
  exports: [StockageObjet],
})
export class StorageModule {}
