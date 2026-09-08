import { runAuthEnrollSigning } from "../../auth/enroll-signing";
import type { CommandSpec } from "../types";

export const enrollSigningCommand: CommandSpec = {
  path: "auth enroll-signing",
  description: "Generate and enroll signing key pair",
  implemented: true,
  run: ({ args }) => runAuthEnrollSigning(args),
};
