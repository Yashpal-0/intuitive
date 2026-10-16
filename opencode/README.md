# Intuitive for OpenCode

This plugin makes every OpenCode agent think, behave and respond intuitively. It's one dependency-free file that works with OpenCode V2 (`id` + `setup`) and V1 1.18.29+ (`server`).

```sh
# OpenCode V2: all projects
mkdir -p ~/.config/opencode/plugins && cp index.ts ~/.config/opencode/plugins/intuitive.ts
# OpenCode V1
mkdir -p ~/.config/opencode/plugin && cp index.ts ~/.config/opencode/plugin/intuitive.ts
```

| Request | What it gets |
|---|---|
| Every agent request | The full guidelines in the system prompt (through the `context` hook) |
| Subagent sessions | A compact version |
| Compaction requests | A note to keep the user's goals, preferences and decisions |
| Title generation | Nothing |

There are four options: `subagents` (`"compact"` \| `"full"` \| `"off"`), `compaction` (boolean), `exclude` (agent IDs) and `file` (your own guidelines). Pass them by listing this folder in `plugins` in `opencode.json(c)`:

```jsonc
{ "plugins": [{ "package": "/path/to/intuitive/opencode", "options": { "subagents": "full" } }] }
```

The text block in `index.ts` is generated from `../shared/`. Edit the text there and run `node scripts/build.mjs`.
