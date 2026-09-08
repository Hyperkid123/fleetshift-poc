import { runAuthSetup } from "../../auth/setup";
import type { CommandSpec } from "../types";
export const setupCommand: CommandSpec = {
  path: "auth setup",
  description: "Configure OIDC client settings",
  implemented: true,
  run: ({ args }) => runAuthSetup(args),
};
