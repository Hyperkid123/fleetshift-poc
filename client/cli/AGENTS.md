# TypeScript CLI Rules

## Scope

- This package owns TypeScript `fleetctl` migration.
- Keep command groups under `src/commands/<group>/`.
- Keep every command in its own file.
- Keep parser, rendering, config, and transport code outside command groups.
- Do not add shared SDK or plugin loading yet.

## Structure

- `src/main.tsx`: process entry point and dispatch.
- `src/commands/registry.ts`: command registration only.
- `src/commands/help.ts`: help rendering.
- `src/commands/<group>/index.ts`: group metadata and child registration.
- `src/commands/<group>/<command>.ts`: one command per file.
- `src/__tests__/`: Vitest and Ink component tests.

## Verification

Run from repository root through Nx:

```text
npx nx run cli:build
npx nx run cli:test
npx nx run cli:lint
```

Use `ink-testing-library` for Ink components. Use `execa` for subprocess tests.

Executable name is `fleetctl`. Do not remove Go CLI until feature and command parity is verified.
