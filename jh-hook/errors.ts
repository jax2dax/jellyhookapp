// jh-hook/errors.ts
// Two kinds of failure, and the difference matters to the person using Hook:
//
//  HookError  the query itself can't run as written (wrong type, unknown
//             field, a list fed into a single-value slot, over the credit
//             limit). Safe and useful to show verbatim: it says what to fix.
//  anything   a database or server problem. Never shown verbatim (it can
//  else       carry SQL or connection details); the action logs it with a
//             reference code and the person sees that code.
// Client-safe.

export class HookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HookError";
  }
}

export const isHookError = (e: unknown): e is HookError => e instanceof Error && e.name === "HookError";
