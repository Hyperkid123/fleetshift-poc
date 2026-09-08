/* eslint-disable playwright/no-standalone-expect */
import { describe, expect, it } from "vitest";

import { flagString, hasFlag, parseArgs } from "../argv";

describe("parseArgs", () => {
  it("parses command, aliases, short flags, and positional values", () => {
    const args = parseArgs([
      "res",
      "query",
      "--filter",
      "state == 'ACTIVE'",
      "-o",
      "json",
    ]);
    expect(args.command).toEqual(["res", "query"]);
    expect(flagString(args, "filter")).toBe("state == 'ACTIVE'");
    expect(flagString(args, "output")).toBe("json");
  });

  it("parses boolean flags", () => {
    const args = parseArgs(["auth", "login", "--no-browser", "--debug"]);
    expect(hasFlag(args, "no-browser")).toBe(true);
    expect(hasFlag(args, "debug")).toBe(true);
  });
});
