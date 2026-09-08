import type { CommandSpec } from "../types";
import { deploymentClient, deploymentName } from "./helpers";

export const getCommand: CommandSpec = {
  path: "deployment get",
  description: "Get deployment by name",
  implemented: true,
  run: async ({ args }) => {
    const name = args.positionals[0];
    if (!name) throw new Error("deployment name is required");
    return (await deploymentClient(args)).request(
      `/v1/${deploymentName(name)}`,
    );
  },
};
