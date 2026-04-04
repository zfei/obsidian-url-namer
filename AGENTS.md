# Repository Guidelines

## Project Structure & Module Organization
This repository is a single-package Obsidian plugin.
- `main.ts`: primary plugin logic (URL detection, fetching, and title replacement).
- `manifest.json`: Obsidian plugin metadata (id, version, min app version).
- `styles.css`: optional plugin styles.
- `esbuild.config.mjs`: bundling/watch pipeline.
- `version-bump.mjs` and `versions.json`: release version sync for Obsidian.
- `demo/`: assets used in docs (`url-namer-demo.gif`).
Build artifacts are emitted as `main.js` in the repo root.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start esbuild in watch mode for local development.
- `npm run build`: run TypeScript checks (`tsc --noEmit`) and production bundle.
- `npm run lint`: run ESLint with the Obsidian TypeScript config.
- `npm run version`: bump versions and stage `manifest.json` + `versions.json`.

## Coding Style & Naming Conventions
- Follow `.editorconfig`: tabs, tab width 4, UTF-8, LF, final newline.
- Language target is TypeScript + ESM (`"type": "module"`).
- Keep names descriptive and domain-oriented (for example `UrlTagger`, `rawUrlPattern`).
- Run `npm run lint` before opening a PR; lint config extends `eslint-plugin-obsidianmd` with project overrides.

## Testing Guidelines
There is currently no automated test suite in this repository.
Before submitting changes:
- Run `npm run build` to validate type checks and bundling.
- Run `npm run lint` to catch style and API issues.
- Manually verify behavior in Obsidian by selecting URL text and executing the command.
For regressions, include reproducible sample text/URLs in the PR description.

## Commit & Pull Request Guidelines
Commit history favors short, imperative messages (for example `Allow multiple URLs in the selected text`). Keep one logical change per commit.

For pull requests:
- Explain user-visible behavior changes and any limitations.
- Link related issues/tasks.
- Include screenshots or GIFs for UX changes (`demo/`-style evidence is preferred).
- Confirm `npm run lint` and `npm run build` pass locally.
