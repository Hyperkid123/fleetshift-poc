import { flagString } from "../../argv";
import { clientForArgs } from "../context";
import type { CommandSpec } from "../types";

export const queryCommand: CommandSpec = {
  path: "resource query",
  aliases: ["search"],
  description: "Query managed resources with CEL filter",
  implemented: true,
  run: async ({ args }) => {
    const params = new URLSearchParams({
      scope: flagString(args, "scope", "-"),
      filter: flagString(args, "filter"),
    });
    return (await clientForArgs(args)).request(
      `/apis/fleetshift.io/v1/-:queryResources?${params}`,
    );
  },
};
