import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import {
  StockageObjet,
  verifierLaCle,
  type DescriptionDObjet,
  type ObjetStocke,
} from './stockage-objet';

export type ClientS3 = Pick<S3Client, 'send'>;

/**
 * Le stockage objet sur un bucket compatible S3 : OVH Object Storage en
 * production. Le client est construit par le module, ce qui laisse les tests
 * le remplacer sans atteindre le réseau.
 */
export class StockageS3 extends StockageObjet {
  constructor(
    private readonly client: ClientS3,
    private readonly bucket: string,
  ) {
    super();
  }

  async deposer(
    cle: string,
    contenu: Buffer,
    typeDeContenu: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: verifierLaCle(cle),
        Body: contenu,
        ContentType: typeDeContenu,
      }),
    );
  }

  async lire(cle: string): Promise<ObjetStocke | null> {
    const reponse = await siPresent(
      this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: verifierLaCle(cle) }),
      ),
    );
    if (!reponse?.Body) {
      return null;
    }
    const contenu = Buffer.from(await reponse.Body.transformToByteArray());
    return {
      contenu,
      taille: contenu.length,
      deposeLe: reponse.LastModified ?? new Date(),
    };
  }

  async decrire(cle: string): Promise<DescriptionDObjet | null> {
    const reponse = await siPresent(
      this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: verifierLaCle(cle) }),
      ),
    );
    return reponse
      ? {
          taille: reponse.ContentLength ?? 0,
          deposeLe: reponse.LastModified ?? new Date(),
        }
      : null;
  }

  async supprimer(cle: string): Promise<void> {
    // S3 ne dit rien d'un objet déjà absent.
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: verifierLaCle(cle) }),
    );
  }
}

/** La réponse, ou `null` quand l'objet n'existe pas (GET : `NoSuchKey`, HEAD : `NotFound`). */
async function siPresent<T>(appel: Promise<T>): Promise<T | null> {
  try {
    return await appel;
  } catch (erreur) {
    const { name, $metadata } = erreur as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
    if (
      name === 'NoSuchKey' ||
      name === 'NotFound' ||
      $metadata?.httpStatusCode === 404
    ) {
      return null;
    }
    throw erreur;
  }
}
