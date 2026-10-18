import type { portal_sessions } from "../schema";

export type PortalSession = Pick<
  typeof portal_sessions.$inferSelect,
  "csrf" | "expires" | "auth_version"
>;

export interface AuthRepository {
  allowLoginAttempt: (now: number) => Promise<boolean>;
  compact: () => Promise<void>;
  revokeSession: (id: string) => Promise<void>;
  saveSession: (input: {
    id: string;
    csrf: string;
    expires: number;
    version: string;
    prior?: string;
  }) => Promise<void>;
  session: (id: string, now: number) => Promise<PortalSession | null>;
}
