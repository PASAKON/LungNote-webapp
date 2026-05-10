export type LoginState = {
  status: "idle" | "sent" | "error";
  error: string | null;
};

export const LOGIN_INITIAL: LoginState = { status: "idle", error: null };
