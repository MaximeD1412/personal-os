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

/** Le cookie de session accompagne toute l'application, pas seulement /auth. */
const CHEMIN_SESSION = '/';
/** Le cookie d'aller-retour ne sert qu'au retour d'Authentik. */
const CHEMIN_LOGIN = '/api/auth';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly auth: AuthService,
  ) {}

  /**
   * Départ du flux authorization code.
   *
   * Publique par nécessité : c'est la porte, on ne peut pas demander une
   * session pour venir en chercher une.
   */
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

  /**
   * Retour d'Authentik.
   *
   * Publique elle aussi, et c'est sans danger : elle n'ouvre une session que
   * pour un aller-retour dont ce navigateur détient le cookie, dont l'état
   * correspond, et dont le code s'échange contre un jeton d'identité signé.
   */
  @Public()
  @Get('callback')
  async callback(
    @Req() request: Request,
    @Res() response: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') erreur?: string,
  ): Promise<void> {
    // Le cookie d'aller-retour a fait son office quoi qu'il arrive : le garder
    // laisserait traîner de quoi retenter le retour.
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

  /**
   * Déconnexion. Publique parce qu'elle doit aboutir même sur une session déjà
   * morte : renvoyer 401 à qui veut partir n'aide personne.
   */
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

  /**
   * `SameSite=Lax` et non `Strict` : le retour d'Authentik est une navigation
   * de premier niveau venue d'un autre site, et `Strict` retiendrait le cookie
   * exactement au moment où il sert.
   */
  private cookieDeBase(path: string): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path,
    };
  }
}
