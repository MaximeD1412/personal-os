export interface CurrentUser {
  email: string;
  displayName: string | null;
}

export interface LogoutResponse {
  endSessionUrl: string | null;
}
