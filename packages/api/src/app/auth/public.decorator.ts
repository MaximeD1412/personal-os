import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'personal-os:public';

/**
 * Ouvre un endpoint au monde entier.
 *
 * La garde de session est globale : tout est fermé par défaut, et une route ne
 * s'ouvre que si quelqu'un l'a écrit **ici**, en toutes lettres. C'est
 * l'inverse d'une liste de routes à protéger, où l'oubli se traduit par une
 * fuite silencieuse plutôt que par un 401 qu'on remarque tout de suite.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
