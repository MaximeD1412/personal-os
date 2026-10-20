import { zCv, zCvKey } from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest (ADR
 * 0030). Le fichier lui-même n'a pas de schéma : il arrive en multipart, sous
 * le champ `file`, et se juge à son contenu (`cv.televersement.ts`).
 */

export class CvDto extends createZodDto(zCv) {}

export class CvKeyDto extends createZodDto(zCvKey) {}
