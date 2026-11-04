import type { ApiFieldError } from '@personal-os/contracts';

/**
 * Une règle métier violée (ADR 0030). `code` suit `<module>.<cas>`, en anglais ;
 * `message` est en français et s'affiche tel quel. Le filtre global en fait
 * l'enveloppe, en 422 sauf statut déclaré. `fields` nomme, quand la règle en
 * vise plusieurs, les objets en cause (les Ingrédients qu'une consolidation ne
 * sait pas convertir).
 */
export class ErreurMetier extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 422,
    readonly fields?: readonly ApiFieldError[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Un objet absent, ou d'un autre Espace : on ne confirme jamais l'existence de
 * ce qu'on ne peut pas voir.
 */
export class Introuvable extends ErreurMetier {
  constructor(code: string, message: string) {
    super(code, message, 404);
  }
}
