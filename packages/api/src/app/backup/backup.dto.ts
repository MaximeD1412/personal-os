import { zBackupRunReport, zBackupStatus } from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest (ADR
 * 0030). Aucun schéma ne se définit ici.
 */

export class BackupStatusDto extends createZodDto(zBackupStatus) {}

/**
 * Une union ne fait pas une classe : ce DTO reste la valeur que rend
 * `createZodDto`, nommé pour l'OpenAPI, et le contrôleur le passe à son
 * propre pipe (comme `FoodPreferenceInputDto`).
 */
export const BackupRunReportDto = createZodDto(zBackupRunReport);
Object.defineProperty(BackupRunReportDto, 'name', {
  value: 'BackupRunReportDto',
});
