# AGENTS.md

This file provides guidance to AI coding assistants when working with code in this repository.

**Important**: You **must** follow [these rules](./node_modules/@peerigon/configs/ai/rules.mdc) and its language-specific rules referenced in that file.

## Keeping This File Updated

When you make changes to the project that affect how AI agents should work with the codebase, update this file accordingly. This includes changes to:

- Overall folder structure
- Tech stack (frameworks, libraries, languages)
- npm scripts and development commands
- Testing approaches
- Build and deployment processes

**Important: Keep this file concise**. Only include information that is relevant for most or all development tasks. Omit specific implementation details that don't affect how agents interact with the codebase.

## What this package is

`@peerigon/sevdesk` is a TypeScript SDK for the [sevDesk API](https://api.sevdesk.de/), **generated from sevDesk's own OpenAPI spec**. Almost nothing about the endpoints is written by hand: 154 operations across 22 modules are emitted by a generator from a committed copy of the spec.

The consequence that matters most: **adding or fixing an endpoint is never a code change in `src/generated/`.** It is a spec update, a generator change, or an override. See [Making changes](#making-changes).

## Development Commands

This project uses npm scripts for all development tasks:

- **Test all**: `npm test` - Runs all tests in parallel (format, lint, types, unit, generated, publishable, jsr, commits)
- **Unit tests**: `npm run test:unit` - Run Vitest tests once
- **Watch tests**: `npm run vitest` - Run Vitest in watch mode
- **Lint**: `npm run test:lint` - ESLint with zero warnings allowed
- **Type check**: `npm run test:types` - TypeScript compiler check
- **Format check**: `npm run test:format` - Oxfmt format validation
- **Regenerate**: `npm run generate` - Rebuild `src/generated/` and the `exports` maps from the committed spec
- **Update the spec**: `npm run spec:update` - Refetch `openapi/openapi.yaml` from sevDesk

**Important**: Use the typescript-lsp MCP (`getDiagnostics`, `getTypeAtPosition`, `getDefinition`, etc.) for type information
**Important**: Use the vitest-server MCP to run individual tests.
**Important**: Use the eslint MCP to check for linting errors.

`npm test` includes `test:publishable`, which needs `dist/` — run `npm run build` first if it fails on missing files.

## Project Structure

```
openapi/openapi.yaml     Committed snapshot of sevDesk's spec. The single source of truth.
scripts/
  fetch-spec.ts          `npm run spec:update`
  generate/              The generator. Hand-written.
    naming.ts            Spec names → public API names. Changing this is a BREAKING CHANGE.
    operations.ts        Reads the spec; decides what paginates.
    overrides.ts         Hand-maintained corrections to what the generator infers.
    emit.ts              Renders module source and the `exports` maps.
    main.ts              Entry point for `npm run generate:modules`.
    verify-up-to-date.ts `npm run test:generated`.
src/
  main.ts                Public entry: client, errors, types, helpers. No endpoint imports.
  core/                  HAND-WRITTEN runtime. Everything generated code calls.
  generated/             GENERATED and committed. Never edit by hand.
    api.ts               openapi-typescript output (types only, ~18k lines).
    contact.ts, …        One module per spec tag.
  tests/                 Test helpers and cross-cutting tests (not published).
```

- **Tests**: Co-located with source files using `.test.ts` suffix
- **Configuration**: Uses `@peerigon/configs` for shared TypeScript, ESLint, and Oxfmt configs

## Architecture

Each generated module is a thin binding; all behaviour lives in `src/core/`:

```ts
export const getContacts: PaginatedOperation<"getContacts"> = defineOperation("getContacts", {
  method: "GET",
  path: "/Contact",
  paginated: true,
});
```

`defineOperation` (`src/core/operation.ts`) derives the entire type surface — query params, path params, request body, response — from `operations[operationId]` in the generated `api.ts`. That is why a 154-endpoint SDK is a few hundred lines of runtime.

**Modularity is a hard requirement.** Consumers import `@peerigon/sevdesk/contact`, not the whole SDK. So:

- `src/main.ts` must **never** import anything from `src/generated/` except types.
- Generated modules must import from `src/core/`, never from each other.

**Query params are intentionally open.** `QueryOf<Id>` is the spec's declared params intersected with `Record<string, QueryValue>`. sevDesk documents most filter params only in prose, so rejecting unknown keys would make the SDK unusable. Declared params are still fully checked.

## Making changes

### sevDesk changed their API

```bash
npm run spec:update     # refetch openapi/openapi.yaml
npm run generate        # rebuild src/generated/ + exports maps
npm test
```

Review the spec diff and the generated diff separately — the spec diff explains the generated one. Commit both.

### An endpoint's pagination is wrong

`isPaginated()` in `scripts/generate/operations.ts` infers this, because the spec never states it: `limit`/`offset`/`countAll` are documented in sevDesk's API description, not on the operations. The rule is _GET + no path params + an `{objects: [...]}` array response_.

- Wrong for **one** endpoint → add it to `notPaginated` / `alsoPaginated` in `scripts/generate/overrides.ts`.
- Wrong for a **class** of endpoints → fix the rule, and check the override list still applies.

Then `npm run generate`.

### An endpoint is missing or the generated code is wrong

Do **not** edit `src/generated/`. It is deleted and rewritten on every `npm run generate`, and `npm run test:generated` fails the build if it has drifted. Change the spec snapshot, the generator, or the overrides instead.

For an endpoint sevDesk offers but does not document, consumers can call `defineOperation` themselves — it is exported from the package root.

### Renaming rules are a breaking change

`moduleName()` and `exportName()` in `scripts/generate/naming.ts` decide the import subpaths and function names consumers write. Changing either renames the public API. Treat it as a breaking change and use a `BREAKING CHANGE:` footer.

The spec's casing is inconsistent (`getContacts` beside `UpdateCommunicationWay` and `getcreditNotePositions`). `exportName` only lowers the first character — deliberately. Re-splitting glued-together words would be guesswork, and a later change to that guess would rename exports again.

## Constraints worth knowing

- **This is a library, not an app. Nothing in `src/` may read the environment.** There is no `src/env.ts`, and there must not be — a top-level env read would throw on `import` for every consumer without that variable set. The API token is passed in via `createClient({ apiToken })`. (The root styleguide's advice to destructure env vars at module scope applies to applications; it does not apply here.)
- **The error domain is claimed once.** `errors.domain("SevDesk")` in `src/core/errors.ts` throws if the name is claimed twice, so that call must stay the only one. Do not mutate `errors.serialize.includeStack` from library code — that global belongs to the consuming app.
- **`src/generated/api.ts` is excluded from ESLint** (`eslint.config.js`). It is machine output shaped by sevDesk's spec and is already checked by `tsc`. The tag modules beside it _are_ linted and must stay clean.
- **JSR rejects "slow types".** Every public symbol needs an explicit type annotation — which is why generated operations are emitted as `export const x: Operation<"x"> = …` and the error classes in `src/core/errors.ts` spell out their constructor types. `npm run test:jsr` catches regressions.
- **`openapi-typescript` declares a `typescript@^5` peer** while this repo is on TypeScript 6. `package.json` has an `overrides` entry for it; `.npmrc` keeps `strict-peer-deps` meaningful for everything else.
- **`.npmrc` sets `min-release-age=7`, and `@peerigon/typescript-toolkit@5.0.1` is younger than that.** It is in the lockfile because it was installed once with `npm install --min-release-age=0` (5.x is the first release with the `errors` module this SDK is built on). `npm ci` is unaffected — it installs from the lockfile — but regenerating the lockfile before ~2026-08-15 fails with a bare `ETARGET ... with a date before` error. Re-run with `--min-release-age=0` if you hit it, or wait out the window.
- **`generate:format` runs oxfmt twice on purpose.** oxfmt's JSDoc reflow needs a second pass to reach a fixed point on the generated `api.ts`; with one pass, `npm run generate` leaves the tree in a state `npm run test:format` rejects. `verify-up-to-date.ts` mirrors this.
- **The exports maps are generated** into both `package.json` and `jsr.json` (neither registry supports the wildcards we'd need). Don't hand-edit them; run `npm run generate`.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages (e.g. `feat: ...`, `fix: ...`, `chore: ...`). This is enforced by commitlint, both via a `commit-msg` git hook (`.husky/commit-msg`) and via `npm run test:commits` (config in `commitlint.config.js`), which catches commits made with `--no-verify`.

**Important**: For breaking changes, do not use the `!` shorthand (e.g. `feat!:`). semantic-release uses the `conventional-changelog-angular` preset, whose header parser ignores `!` — such commits are silently dropped from the release. Always add a `BREAKING CHANGE:` footer instead.

## Releasing

Releases are made by semantic-release from commit messages; the `version` field in `package.json` and `jsr.json` is a placeholder and must not be edited.

This package continues the version line of the previous `@peerigon/sevdesk` (last published: **2.1.0**), but that history lives in a different repository, so this repo has no matching tag. semantic-release derives the version from git tags — **without a seed tag the first release would be 1.0.0, published over the existing 2.x line.** Seed it once, on the last template commit before the rewrite:

```bash
git tag v2.1.0 3f5d32c
git push origin v2.1.0
```

Verified with `@semantic-release/commit-analyzer`: with that tag in place, the rewrite's `BREAKING CHANGE:` footer yields a `major` bump, so the first release is **3.0.0**, and the release notes cover only the rewrite rather than the whole template history.

Note that a `semantic-release --dry-run` prunes local-only tags, so re-create the tag if you run one before pushing it.

## Template as a git remote

Configure the `template` remote so it can **only be fetched**, never pushed to:

```bash
git remote set-url --push template DISABLED
```

Verify with `git remote -v`: `template` should show a normal fetch URL and `DISABLED` (or empty) for push.

## Pulling Updates from Template

If the user is asking you to pull in updates from the template repository, follow the steps below.

### Step 1: Merge Template Updates

```bash
git fetch template
git merge --strategy-option theirs --no-commit template/main
```

This will:

- Prefer template files in conflicts (`--strategy-option theirs`)
- Stage changes without committing (`--no-commit`)

### Step 2: Restore Project Specific Files

Restore project-specific files and changes:

- **package.json**: Restore original dependencies but keep the dependency updates from the template repository. Keep the `exports` map, the `generate:*`/`spec:update`/`test:generated` scripts and the `overrides` entry.
- **README.md**: Restore original project documentation
- **AGENTS.md**: Restore project specific instructions and include changes from the template repository
- **src/**: Restore project specific source code and include changes from the template repository
- **eslint.config.js / tsconfig.build.json / vite.config.ts**: Keep this repo's additions (the `src/generated/api.ts` ignore, `"types": ["node"]`, and the env-free vitest config)
- Do **not** let the template reintroduce `src/env.ts` — see [Constraints worth knowing](#constraints-worth-knowing)
- If a file has been deleted in **this** repository, **do not** restore it from the template repository.

### Step 3: Verify and Clean Up

1. Run `npm install` to update lockfile
2. Run `npm test` to verify everything works
3. Review `git status` and `git diff --staged` for unexpected changes

### Step 4: Stage Changes

**IMPORTANT**: Stage your changes, but **do not commit**. Ask the user to review the changes first.
