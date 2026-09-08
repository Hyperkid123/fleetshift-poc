import { flagString } from "../../argv";
import { clientForArgs } from "../context";
import type { CommandSpec } from "../types";
import { resourceID, resourceRoute, resourceSpec } from "./helpers";

export const createCommand: CommandSpec = {
  path: "resource create",
  description: "Create a managed resource",
  implemented: true,
  run: async ({ args }) => {
    const type = args.positionals[0];
    const specFile = flagString(args, "spec-file");
    if (!type || !specFile)
      throw new Error("resource type and --spec-file are required");
    const route = resourceRoute(type);
    return (await clientForArgs(args)).request(
      `${route.path}?${route.singular}_id=${encodeURIComponent(resourceID(args))}`,
      {
        method: "POST",
        body: JSON.stringify({ spec: await resourceSpec(specFile) }),
      },
    );
  },
};
