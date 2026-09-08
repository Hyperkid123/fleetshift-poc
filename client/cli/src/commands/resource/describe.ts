import { describeResourceType, listResourceTypes } from "../../grpc/reflection";
import type { CommandSpec } from "../types";

export const describeCommand: CommandSpec = {
  path: "resource describe",
  description: "Show managed resource schema",
  implemented: true,
  run: async ({ args }) => {
    const requested = args.positionals[0];
    if (!requested) throw new Error("resource type is required");
    const type = (await listResourceTypes()).find(
      (candidate) =>
        candidate.qualifiedName === requested ||
        candidate.collection === requested,
    );
    if (!type) throw new Error(`unknown resource type ${requested}`);
    const description = await describeResourceType(type);
    return [
      `Type:     ${type.qualifiedName}`,
      `Singular: ${type.singular}`,
      `Service:  ${type.serviceName}`,
      "",
      "Methods:",
      ...description.methods.map((method) => `  ${method}`),
      "",
      `Spec (${type.packageName}.${type.singular}):`,
      ...description.fields.map((field) => `  ${field}`),
    ].join("\n");
  },
};
