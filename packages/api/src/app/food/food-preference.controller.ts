import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse } from '@nestjs/swagger';
import type { FoodPreferenceInput } from '@personal-os/contracts';
import { ZodResponse, ZodValidationPipe } from 'nestjs-zod';
import type { UserRecord } from '../auth/auth.repository';
import { CurrentUser } from '../auth/current-user.decorator';
import { Espaces } from '../espace/espaces.decorator';
import {
  FoodPreferenceDto,
  FoodPreferenceInputDto,
  FoodPreferenceListQueryDto,
} from './food-preference.dto';
import { FoodPreferenceService } from './food-preference.service';

/**
 * Les Préférences alimentaires : la Cuisine est à Espace unique, l'Espace
 * foyer, que le service pose à la création. Chaque Compte du Foyer voit et
 * modifie les Préférences des deux.
 */
@Controller('food-preferences')
@Espaces('HOUSEHOLD')
export class FoodPreferenceController {
  constructor(private readonly preferences: FoodPreferenceService) {}

  @Get()
  @ZodResponse({ status: 200, type: [FoodPreferenceDto] })
  lister(
    @Query() requete: FoodPreferenceListQueryDto,
    @CurrentUser() compte: UserRecord,
  ) {
    return this.preferences.lister(requete, compte.id);
  }

  @Post()
  @ApiBody({ type: FoodPreferenceInputDto })
  @ZodResponse({ status: 201, type: FoodPreferenceDto })
  creer(
    @Body(new ZodValidationPipe(FoodPreferenceInputDto))
    saisie: FoodPreferenceInput,
    @CurrentUser() compte: UserRecord,
  ) {
    return this.preferences.creer(saisie, compte.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  supprimer(@Param('id') id: string): Promise<void> {
    return this.preferences.supprimer(id);
  }
}
