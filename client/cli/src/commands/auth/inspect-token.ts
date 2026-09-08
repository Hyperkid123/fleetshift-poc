import { formatTokenInspection, inspectStoredTokens } from "../../auth/inspect";
import type { CommandSpec } from "../types";

export const inspectTokenCommand: CommandSpec = {
  path: "auth inspect-token",
  description: "Decode and display stored authentication tokens",
  implemented: true,
  run: async ({ args, output }) => {
    const inspection = await inspectStoredTokens(args);
    return output === "json"
      ? inspection
      : formatTokenInspection(inspection, "table");
  },
};
