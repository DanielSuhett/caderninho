export interface ConsentDetails {
  clientName: string;
  clientDomain?: string | null | undefined;
  redirectHost: string;
  redirectIsLoopback: boolean;
}
