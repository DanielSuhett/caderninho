import type {
  AccountConnectToken,
  AccountResponse,
} from "@/contracts/portal.types";

export type LoadState =
  | { kind: typeof LoadStatus.loading }
  | { kind: typeof LoadStatus.ready }
  | { kind: typeof LoadStatus.failed; session: boolean };

export const LoadStatus = {
  loading: "loading",
  ready: "ready",
  failed: "failed",
} as const;

export interface AccountState {
  snapshot: AccountResponse | undefined;
  load: LoadState;
  step: number;
  message: string;
  busy: boolean;
}

export interface AccountActions {
  refresh(): void;
  selectStep(step: number): void;
  connectItem(itemId?: string): void;
  pauseSync(): void;
  resumeSync(): void;
  requestSync(): void;
  disconnectAssistants(): void;
  logout(): void;
  copy(value: string): void;
}

export interface CommandContext {
  csrf: string;
  signal: AbortSignal;
}

export interface AccountApi {
  read(signal: AbortSignal): Promise<AccountResponse>;
  connectToken(
    context: CommandContext,
    itemId?: string,
  ): Promise<AccountConnectToken>;
  connectItem(context: CommandContext, itemId: string): Promise<void>;
  pauseSync(context: CommandContext): Promise<void>;
  resumeSync(context: CommandContext): Promise<void>;
  requestSync(context: CommandContext): Promise<void>;
  disconnectAssistants(context: CommandContext): Promise<void>;
  logout(context: CommandContext): Promise<void>;
}

export interface ConnectRequest extends AccountConnectToken {
  itemId: string | undefined;
  onSuccess(itemId: string): void;
  onError(): void;
  onClose(): void;
}

export interface ConnectWidget {
  open(request: ConnectRequest): Promise<void>;
  destroy(): Promise<void>;
}

export interface AccountBrowser {
  step(): number | undefined;
  selectStep(step: number): void;
  visible(): boolean;
  captureFocus(): () => void;
  copy(value: string): Promise<void>;
  login(): void;
}
