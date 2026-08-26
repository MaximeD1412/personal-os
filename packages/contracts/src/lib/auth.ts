/**
 * Le compte qui porte la session courante, tel que `GET /api/auth/me` le rend.
 *
 * Il ne contient rien du fournisseur d'identité : ni jeton, ni sujet. Le
 * navigateur n'a besoin que de savoir qui il est, et l'application répond seule
 * à « ce que tu peux voir » (ADR 0015).
 */
export interface CurrentUser {
  email: string;
  displayName: string | null;
}

/** Réponse de `POST /api/auth/logout`. */
export interface LogoutResponse {
  /**
   * Où finir de se déconnecter chez Authentik, quand il publie une adresse
   * pour ça. La session applicative, elle, est déjà révoquée quand cette
   * réponse arrive : le navigateur n'a plus rien à faire pour qu'elle le soit.
   */
  endSessionUrl: string | null;
}
