import type { AccountConnectToken } from "../../contracts";
export interface ConnectRequest extends AccountConnectToken {
  itemId?: string;
  onClose: () => void;
  onError: () => void;
  onSuccess: (id: string) => void;
}
export interface ConnectWidget {
  destroy: () => Promise<void>;
  open: (request: ConnectRequest) => Promise<void>;
}
