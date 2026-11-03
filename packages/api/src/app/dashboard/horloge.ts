import { Injectable } from '@nestjs/common';

/**
 * L'instant de la lecture. Un À faire dépend du temps qui passe (une Échéance
 * entre dans ses sept jours, un ingrédient dans ses trois) : l'horloge est une
 * frontière du système, et les campagnes de test la fixent.
 */
@Injectable()
export class Horloge {
  maintenant(): Date {
    return new Date();
  }
}
