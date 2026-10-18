/**
 * Une règle métier violée (ADR 0030). `code` suit `<module>.<cas>`, en anglais ;
 * `message` est en français et s'affiche tel quel. Le filtre global en fait
 * l'enveloppe, en 422 sauf statut déclaré.
 */
export class ErreurMetier extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 422,
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
