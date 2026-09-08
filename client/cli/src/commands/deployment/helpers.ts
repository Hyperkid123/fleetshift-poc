import { readFile } from "node:fs/promises";

import { flagString, type ParsedArgs } from "../../argv";
import type { CliClient } from "../../client";
import { clientForArgs } from "../context";

export function deploymentName(value: string): string {
  return value.startsWith("deployments/") ? value : `deployments/${value}`;
}

export function deploymentClient(args: ParsedArgs): Promise<CliClient> {
  return clientForArgs(args);
}

export interface ManifestInput {
  content: unknown;
  raw: string;
}

export async function readManifest(path: string): Promise<ManifestInput> {
  const content =
    path === "-" ? await readStdin() : await readFile(path, "utf8");
  return {
    content: JSON.parse(content),
    raw: Buffer.from(content).toString("base64"),
  };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function deploymentBody(
  args: ParsedArgs,
  rawManifest: string,
): Record<string, unknown> {
  const placementType = flagString(args, "placement-type", "all").toLowerCase();
  const placementStrategy: Record<string, unknown> = {
    type: `TYPE_${placementType.toUpperCase()}`,
  };
  if (placementType === "static") {
    const targetIDs = flagString(args, "target-ids")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (targetIDs.length === 0) {
      throw new Error("--target-ids is required for static placement");
    }
    placementStrategy.targetIds = targetIDs;
  }
  if (placementType === "selector") {
    const selector = flagString(args, "target-selector");
    if (!selector) {
      throw new Error("--target-selector is required for selector placement");
    }
    placementStrategy.targetSelector = Object.fromEntries(
      selector.split(",").map((entry) => {
        const [key, ...values] = entry.split("=");
        if (!key || values.length === 0) {
          throw new Error(`invalid target selector ${entry}`);
        }
        return [key, values.join("=")];
      }),
    );
  }
  const rolloutType = flagString(
    args,
    "rollout-type",
    "immediate",
  ).toLowerCase();
  if (rolloutType !== "immediate") {
    throw new Error(`unsupported rollout type ${rolloutType}`);
  }
  return {
    manifestStrategy: {
      type: "TYPE_INLINE",
      manifests: [
        { manifestType: flagString(args, "resource-type"), raw: rawManifest },
      ],
    },
    placementStrategy,
    rolloutStrategy: { type: "TYPE_IMMEDIATE" },
  };
}
