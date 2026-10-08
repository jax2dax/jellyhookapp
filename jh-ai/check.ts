// jh-ai/check.ts
// Is this query one the engine would accept? The same two gates every query passes before it runs:
// the structure check (jh-hook/engine/validate.ts) and the type check that compiling performs (does this
// operator fit this field, does this sub-query fit its slot). No database is touched: the SQL is only built,
// never run. A failure's message is what the model is told in its repair retry, so it is written for
// people and is safe to show.
import { Ctx, compileSpecSelect } from "../jh-hook/engine/compile";
import { validateSpec } from "../jh-hook/engine/validate";
import type { HookSpec } from "../jh-hook/types";

const DRY_RUN_SITE = "00000000-0000-0000-0000-000000000000";

export function checkSpec(spec: HookSpec): void {
  validateSpec(spec);
  compileSpecSelect(spec, new Ctx(DRY_RUN_SITE), { limit: true });
}
