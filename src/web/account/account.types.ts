import type { AccountConnectToken } from "../../contracts";
export const ConnectFailure = {
  Authorization: "authorization",
  Duplicate: "duplicate",
  Other: "other",
  Unavailable: "unavailable",
} as const;
export type ConnectFailure =
  (typeof ConnectFailure)[keyof typeof ConnectFailure];
export interface ConnectRequest extends AccountConnectToken {
  itemId?: string;
  onClose: () => void;
  onError: (failure: ConnectFailure) => void;
  onSuccess: (id: string) => void;
}
export interface ConnectWidget {
  destroy: () => Promise<void>;
  open: (request: ConnectRequest) => Promise<void>;
}
