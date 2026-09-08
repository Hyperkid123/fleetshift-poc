import type { ParsedArgs } from "../argv";

export interface CommandContext {
  args: ParsedArgs;
  output: string;
}

export type CommandRunner = (context: CommandContext) => Promise<unknown>;

export interface CommandSpec {
  path: string;
  aliases?: string[];
  description: string;
  implemented?: boolean;
  run?: CommandRunner;
}
