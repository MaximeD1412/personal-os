import {
  zTrainingSession,
  zTrainingSessionCompletion,
  zTrainingSessionInput,
  zTrainingSessionListQuery,
  zTrainingSessionUpdate,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/* Les schémas viennent de `contracts` ; ces classes ne font que les porter jusqu'à Nest (ADR 0030). */

export class TrainingSessionDto extends createZodDto(zTrainingSession) {}

export class TrainingSessionInputDto extends createZodDto(
  zTrainingSessionInput,
) {}

export class TrainingSessionUpdateDto extends createZodDto(
  zTrainingSessionUpdate,
) {}

export class TrainingSessionCompletionDto extends createZodDto(
  zTrainingSessionCompletion,
) {}

export class TrainingSessionListQueryDto extends createZodDto(
  zTrainingSessionListQuery,
) {}
