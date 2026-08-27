import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'personal-os:public';

export const Public = () => SetMetadata(IS_PUBLIC, true);
