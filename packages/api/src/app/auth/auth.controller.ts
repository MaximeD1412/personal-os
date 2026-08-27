import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  CurrentUser as CurrentUserContract,
  LogoutResponse,
} from '@personal-os/contracts';
import type { CookieOptions, Request, Response } from 'express';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';
import type { UserRecord } from './auth.repository';
import { AuthService } from './auth.service';
import { LOGIN_COOKIE, SESSION_COOKIE, readCookie } from './cookies';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';

const CHEMIN_SESSION = '/';
const CHEMIN_LOGIN = '/api/auth';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly auth: AuthService,
  ) {}

  @Public()
  @Get('login')
  async login(@Res() response: Response): Promise<void> {
    const depart = await this.auth.commencerConnexion();

    response.cookie(LOGIN_COOKIE, depart.transactionId, {
      ...this.cookieDeBase(CHEMIN_LOGIN),
      maxAge: this.config.loginTtlSeconds * 1000,
    });
    response.redirect(302, depart.url);
  }

  @Public()
  @Get('callback')
  async callback(
    @Req() request: Request,
    @Res() response: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') erreur?: string,
  ): Promise<void> {
    response.clearCookie(LOGIN_COOKIE, this.cookieDeBase(CHEMIN_LOGIN));

    if (erreur) {
      throw new UnauthorizedException(`Authentik a refusé la connexion.`);
    }
    if (!code || !state) {
      throw new BadRequestException('Retour de connexion incomplet.');
    }

    const session = await this.auth.terminerConnexion(
      readCookie(request, LOGIN_COOKIE),
      code,
      state,
    );

    response.cookie(SESSION_COOKIE, session.token, {
      ...this.cookieDeBase(CHEMIN_SESSION),
      maxAge: session.maxAgeMs,
    });
    response.redirect(302, this.config.dashboardUrl);
  }

  @Get('me')
  me(@CurrentUser() user: UserRecord): CurrentUserContract {
    return { email: user.email, displayName: user.displayName };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutResponse> {
    const url = await this.auth.terminerSession(
      readCookie(request, SESSION_COOKIE),
    );

    response.clearCookie(SESSION_COOKIE, this.cookieDeBase(CHEMIN_SESSION));
    return { endSessionUrl: url };
  }

  private cookieDeBase(path: string): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path,
    };
  }
}
