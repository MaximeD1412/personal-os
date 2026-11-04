import {
  zTrainingGoal,
  zTrainingGoalInput,
  zTrainingGoalUpdate,
  zTrainingSeriesInput,
} from '@personal-os/contracts';
import { createZodDto } from 'nestjs-zod';

/* Les schémas viennent de `contracts` ; ces classes ne font que les porter jusqu'à Nest (ADR 0030). */

export class TrainingGoalDto extends createZodDto(zTrainingGoal) {}

export class TrainingGoalInputDto extends createZodDto(zTrainingGoalInput) {}

export class TrainingGoalUpdateDto extends createZodDto(zTrainingGoalUpdate) {}

export class TrainingSeriesInputDto extends createZodDto(
  zTrainingSeriesInput,
) {}
