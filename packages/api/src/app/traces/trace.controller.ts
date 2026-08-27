import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { Trace, TraceInput } from '@personal-os/contracts';
import { Espaces } from '../espace/espaces.decorator';
import { TraceService } from './trace.service';

/**
 * Le fil traceur du cloisonnement. Comme le Calendrier, il accepte les deux
 * Espaces : c'est à la création qu'on choisit (ADR 0014).
 */
@Controller('traces')
@Espaces('PERSONAL', 'HOUSEHOLD')
export class TraceController {
  constructor(private readonly traces: TraceService) {}

  @Get()
  lister(): Promise<Trace[]> {
    return this.traces.lister();
  }

  @Post()
  creer(@Body() saisie: Partial<TraceInput>): Promise<Trace> {
    return this.traces.creer(saisie);
  }

  @Patch(':id')
  renommer(
    @Param('id') id: string,
    @Body() saisie: Partial<TraceInput>,
  ): Promise<Trace> {
    return this.traces.renommer(id, saisie);
  }

  @Delete(':id')
  @HttpCode(204)
  supprimer(@Param('id') id: string): Promise<void> {
    return this.traces.supprimer(id);
  }
}
