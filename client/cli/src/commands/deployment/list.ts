import { flagString } from "../../argv";
import { clientForArgs } from "../context";
import type { CommandSpec } from "../types";

export const listCommand: CommandSpec = {
  path: "deployment list",
  description: "List deployments",
  implemented: true,
  run: async ({ args }) => {
    const query = new URLSearchParams();
    const pageSize = flagString(args, "page-size");
    if (pageSize) query.set("pageSize", pageSize);
    const response = await (
      await clientForArgs(args)
    ).request<{
      deployments?: unknown[];
    }>(`/v1/deployments${query.size ? `?${query}` : ""}`, {
      method: "GET",
    });
    return response.deployments ?? [];
  },
};
