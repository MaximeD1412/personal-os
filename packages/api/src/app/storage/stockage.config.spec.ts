import { join } from 'node:path';
import { lireStockageConfig } from './stockage.config';

describe('lireStockageConfig', () => {
  const S3 = {
    STORAGE_PROVIDER: 's3',
    S3_ENDPOINT: 'https://s3.gra.io.cloud.ovh.net',
    S3_REGION: 'gra',
    S3_BUCKET: 'personal-os',
    S3_ACCESS_KEY_ID: 'identifiant-de-test',
    S3_SECRET_ACCESS_KEY: 'secret-de-test',
  };

  it('range les objets sur le disque par défaut hors production', () => {
    expect(lireStockageConfig({})).toEqual({
      fournisseur: 'disk',
      racine: join(process.cwd(), 'tmp', 'stockage'),
    });
  });

  it('prend le dossier nommé par STORAGE_DISK_DIR', () => {
    expect(
      lireStockageConfig({
        STORAGE_PROVIDER: 'disk',
        STORAGE_DISK_DIR: '/data',
      }),
    ).toEqual({ fournisseur: 'disk', racine: '/data' });
  });

  it('lit la configuration S3', () => {
    expect(lireStockageConfig(S3)).toEqual({
      fournisseur: 's3',
      endpoint: 'https://s3.gra.io.cloud.ovh.net',
      region: 'gra',
      bucket: 'personal-os',
      cleDAcces: 'identifiant-de-test',
      secret: 'secret-de-test',
    });
  });

  it.each(Object.keys(S3).filter((nom) => nom !== 'STORAGE_PROVIDER'))(
    'exige %s pour le stockage S3',
    (nom) => {
      expect(() => lireStockageConfig({ ...S3, [nom]: '' })).toThrow(nom);
    },
  );

  it('accepte S3 en production', () => {
    expect(
      lireStockageConfig({ ...S3, APP_ENV: 'production' }).fournisseur,
    ).toBe('s3');
  });

  it('refuse de démarrer la production sans fournisseur déclaré', () => {
    expect(() => lireStockageConfig({ APP_ENV: 'production' })).toThrow(
      'STORAGE_PROVIDER',
    );
  });

  it('refuse de démarrer la production sur le disque', () => {
    expect(() =>
      lireStockageConfig({ APP_ENV: 'production', STORAGE_PROVIDER: 'disk' }),
    ).toThrow('STORAGE_PROVIDER');
  });

  it('refuse un fournisseur inconnu', () => {
    expect(() => lireStockageConfig({ STORAGE_PROVIDER: 'ftp' })).toThrow(
      'STORAGE_PROVIDER',
    );
  });
});
