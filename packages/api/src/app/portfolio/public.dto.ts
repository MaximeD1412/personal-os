import {
  zPublicLangKey,
  zPublicPage,
  zPublicPageKey,
  zPublicProject,
  zPublicProjectKey,
  zPublicProjectSummary,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/*
 * Les DTO ne font que porter les schémas de `contracts` jusqu'à Nest (ADR
 * 0030). Ceux du portfolio public sont dédiés : le sérialiseur ne laisse sortir
 * que leurs champs, ni notes, ni liens, ni dépenses, ni Espace (SEC-2).
 */

export class PublicLangKeyDto extends createZodDto(zPublicLangKey) {}

export class PublicPageKeyDto extends createZodDto(zPublicPageKey) {}

export class PublicProjectKeyDto extends createZodDto(zPublicProjectKey) {}

export class PublicPageDto extends createZodDto(zPublicPage) {}

export class PublicProjectSummaryDto extends createZodDto(
  zPublicProjectSummary,
) {}

export class PublicProjectDto extends createZodDto(zPublicProject) {}
