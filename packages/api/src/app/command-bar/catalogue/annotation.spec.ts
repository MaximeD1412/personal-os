import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ZodResponse, createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { documentOpenApi } from '../../../openapi';
import { Command } from '../command.decorator';
import { genererCatalogue } from './generer';

class NoteInputDto extends createZodDto(
  z.object({ title: z.string().min(1), pinned: z.boolean().optional() }),
) {}

class NoteDto extends createZodDto(z.object({ id: z.string() })) {}

class NoteQueryDto extends createZodDto(z.object({ q: z.string() })) {}

@Controller('notes')
class NoteController {
  @Get()
  @ZodResponse({ status: 200, type: [NoteDto] })
  lister(@Query() requete: NoteQueryDto) {
    return [{ id: requete.q }];
  }

  @Post()
  @ZodResponse({ status: 201, type: NoteDto })
  @Command({
    intent: 'Créer une note',
    examples: ['note : rappeler le plombier'],
    screen: '/notes/nouvelle',
    params: { title: 'required' },
  })
  creer(@Body() saisie: NoteInputDto) {
    return { id: saisie.title };
  }
}

@Module({ controllers: [NoteController] })
class NoteModule {}

/** Le catalogue d'une API jouet, de l'annotation au fichier, par l'OpenAPI de Nest. */
async function catalogueDe(module: unknown) {
  const app = await NestFactory.create(module as typeof NoteModule, {
    preview: true,
    logger: false,
  });
  app.setGlobalPrefix('api');
  try {
    return genererCatalogue(documentOpenApi(app));
  } finally {
    await app.close();
  }
}

describe('@Command, de l’annotation au catalogue (ADR 0018)', () => {
  it("fait entrer l'endpoint annoté au catalogue, et lui seul", async () => {
    const catalogue = await catalogueDe(NoteModule);

    expect(catalogue).toEqual({
      actions: [
        {
          id: 'NoteController_creer',
          intent: 'Créer une note',
          examples: ['note : rappeler le plombier'],
          screen: '/notes/nouvelle',
          params: {
            title: {
              required: true,
              schema: expect.objectContaining({ type: 'string', minLength: 1 }),
            },
          },
        },
      ],
    });
  });

  it("refuse une annotation qui nomme un champ que l'endpoint n'a pas", async () => {
    @Controller('drafts')
    class DraftController {
      @Post()
      @ZodResponse({ status: 201, type: NoteDto })
      @Command({
        intent: 'Créer un brouillon',
        examples: ['brouillon : lettre au syndic'],
        screen: '/brouillons/nouveau',
        params: { titre: 'required' },
      })
      creer(@Body() saisie: NoteInputDto) {
        return { id: saisie.title };
      }
    }

    @Module({ controllers: [DraftController] })
    class DraftModule {}

    await expect(catalogueDe(DraftModule)).rejects.toThrow(
      /DraftController_creer : « titre » absent du schéma d'entrée \(champs : title, pinned\)/,
    );
  });
});
