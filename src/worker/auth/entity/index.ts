export interface PortalSession {
  csrf: string;
  expires: number;
}
export interface AdminAccess {
  generated: boolean;
  secret: string;
}
