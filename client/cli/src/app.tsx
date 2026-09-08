import { render } from "ink";
import React from "react";

import { JsonOutput, Output } from "./ui";

export async function print(value: unknown, output: string): Promise<void> {
  const element =
    output === "json" ? (
      <JsonOutput value={value} />
    ) : (
      <Output value={typeof value === "string" ? value : formatTable(value)} />
    );
  await new Promise<void>((resolve) => {
    const instance = render(element);
    instance.waitUntilExit().then(() => resolve());
  });
}

function formatTable(value: unknown): string {
  if (!Array.isArray(value)) return JSON.stringify(value, null, 2);
  if (value.length === 0) return "No results.";
  const rows: Record<string, unknown>[] = value.map((item) =>
    typeof item === "object" && item !== null
      ? (item as Record<string, unknown>)
      : { value: item },
  );
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    columns.join("\t"),
    ...rows.map((row) =>
      columns.map((column) => String(row[column] ?? "-")).join("\t"),
    ),
  ].join("\n");
}
