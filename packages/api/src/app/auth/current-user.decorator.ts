import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { UserRecord } from './auth.repository';

export const PORTEUR = 'personalOsUser';

export const CurrentUser = createParamDecorator(
  (_donnee: unknown, context: ExecutionContext): UserRecord => {
    const request = context.switchToHttp().getRequest<Request>();
    return (request as Request & Record<string, UserRecord>)[PORTEUR];
  },
);
