export interface ConsentDetails {
  clientDomain?: string | null | undefined;
  clientName: string;
  redirectHost: string;
  redirectIsLoopback: boolean;
}
