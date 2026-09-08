import { flagString } from "../../argv";
import { clientForArgs } from "../context";
import type { CommandSpec } from "../types";
import { resourceRoute } from "./helpers";

export const listCommand: CommandSpec = {
  path: "resource list",
  description: "List managed resources of a type",
  implemented: true,
  run: async ({ args }) => {
    const type = args.positionals[0];
    if (!type) throw new Error("resource type is required");
    const route = resourceRoute(type);
    const query = new URLSearchParams();
    const pageSize = flagString(args, "page-size");
    const pageToken = flagString(args, "page-token");
    if (pageSize) query.set("page_size", pageSize);
    if (pageToken) query.set("page_token", pageToken);
    return (await clientForArgs(args)).request(
      `${route.path}${query.size ? `?${query}` : ""}`,
    );
  },
};
