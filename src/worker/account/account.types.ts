export interface AccountSource {
  readonly configured: boolean;
  application(): Promise<{
    clientId: string;
    readItem(itemId: string): Promise<{
      id: string;
      connector?: { id: number | string };
    }>;
    token(itemId?: string): Promise<{ accessToken: string }>;
  }>;
}
