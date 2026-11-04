import { applyDecorators, SetMetadata } from '@nestjs/common';
import { Public } from '../auth/public.decorator';

export const LECTURE_PUBLIQUE = 'personal-os:lecture-publique';

/**
 * Ouvre une route au portfolio public : sans session (`@Public()`), et sous
 * la portée de lecture publique, qui ne laisse lire que des contenus publiés
 * et n'écrit rien (`PORTEE_PUBLIQUE`, ADR 0019). Les deux vont ensemble : une
 * route publique qui lit des contenus n'a pas d'autre portée possible.
 */
export const LecturePublique = () =>
  applyDecorators(Public(), SetMetadata(LECTURE_PUBLIQUE, true));
