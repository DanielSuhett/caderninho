import type { AccountConnectToken, AccountResponse } from "../../contracts";

export type LoadState =
  | { kind: typeof LoadStatus.loading }
  | { kind: typeof LoadStatus.ready }
  | { kind: typeof LoadStatus.failed; session: boolean };

export const LoadStatus = {
  failed: "failed",
  loading: "loading",
  ready: "ready",
} as const;

export interface AccountState {
  busy: boolean;
  load: LoadState;
  message: string;
  snapshot: AccountResponse | undefined;
  step: number;
}

export interface AccountActions {
  connectItem: (itemId?: string) => void;
  copy: (value: string) => void;
  disconnectAssistants: () => void;
  logout: () => void;
  pauseSync: () => void;
  refresh: () => void;
  requestSync: () => void;
  resumeSync: () => void;
  selectStep: (step: number) => void;
}

export interface CommandContext {
  csrf: string;
  signal: AbortSignal;
}

export interface AccountApi {
  connectItem: (context: CommandContext, itemId: string) => Promise<void>;
  connectToken: (
    context: CommandContext,
    itemId?: string,
  ) => Promise<AccountConnectToken>;
  disconnectAssistants: (context: CommandContext) => Promise<void>;
  logout: (context: CommandContext) => Promise<void>;
  pauseSync: (context: CommandContext) => Promise<void>;
  read: (signal: AbortSignal) => Promise<AccountResponse>;
  requestSync: (context: CommandContext) => Promise<void>;
  resumeSync: (context: CommandContext) => Promise<void>;
}

export interface ConnectRequest extends AccountConnectToken {
  itemId: string | undefined;
  onClose: () => void;
  onError: () => void;
  onSuccess: (itemId: string) => void;
}

export interface ConnectWidget {
  destroy: () => Promise<void>;
  open: (request: ConnectRequest) => Promise<void>;
}

export interface AccountBrowser {
  captureFocus: () => () => void;
  copy: (value: string) => Promise<void>;
  login: () => void;
  selectStep: (step: number) => void;
  step: () => number | undefined;
  visible: () => boolean;
}
