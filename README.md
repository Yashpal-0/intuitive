# Intuitive

A plugin for **Claude Code** and **OpenCode V2** (V1 works too) that makes the agent always think, behave and respond intuitively. It reads for the goal behind your words, does the obvious thing without needless questions, and answers so it clicks on the first read.

| | What changes |
|---|---|
| **Think** | Reads for intent without overriding what you said ("make the test pass" means fix the bug, not special-case the test). Assumes what an expert would assume. Forms a hunch, then verifies it. Remembers your corrections. Sees what a change ripples into. |
| **Act** | Acts on clear requests without check-ins, and answers questions without editing anything. Asks one sharp question, with a default, only when a wrong guess is costly. Matches your codebase and stays in scope. Confirms before anything destructive or public. Checks its work. |
| **Respond** | Answer first, sized to the question. Gives the intuition before the details. Concrete commands, paths and values. No preamble, no filler, no "let me know if…". |

The full text is in [`shared/intuitive.md`](shared/intuitive.md). Your own instructions (CLAUDE.md, AGENTS.md, explicit requests) always take precedence over it.

## Install

### Claude Code

```sh
claude plugin marketplace add Yashpal-0/intuitive
claude plugin install intuitive@intuitive
```

You can also do this inside Claude Code: `/plugin marketplace add Yashpal-0/intuitive`, then `/plugin install intuitive@intuitive`. For a local clone, use its path instead of `Yashpal-0/intuitive`. Start a new session afterwards (or run `/reload-plugins`). To pick up later changes, run `claude plugin marketplace update intuitive`.

Install may say "2 userConfig options not yet set". That's fine: both options default to on. To check the install, run `claude plugin list`; it should show `intuitive@intuitive` as enabled.

### OpenCode V2

Copy one file. Nothing to install.

```sh
git clone https://github.com/Yashpal-0/intuitive
mkdir -p ~/.config/opencode/plugins
cp intuitive/opencode/index.ts ~/.config/opencode/plugins/intuitive.ts
```

- **One project only:** put it in `<project>/.opencode/plugins/intuitive.ts` instead.
- **Reload:** OpenCode reloads watched config directories automatically. If it doesn't pick up the plugin, run `opencode service restart`.
- **Check:** `opencode run --standalone --print-logs "hi" 2>&1 | grep "loading plugin"` should list `intuitive.ts`. This sends "hi" to your model. `opencode plugin list` only shows npm/git package plugins.
- **OpenCode V1 (1.18.29 or newer):** the same file works. Copy it to `~/.config/opencode/plugin/intuitive.ts`.

## How it stays "always on"

| | Claude Code | OpenCode |
|---|---|---|
| Main conversation | A plugin output style with `force-for-plugin`, sent with every request | The `context` hook appends it to the system prompt of every agent request |
| Subagents | `SubagentStart` hook adds a compact version | Child sessions get the compact version |
| Long sessions | A one-line reminder on every prompt | The system prompt is rebuilt on every request |
| After compaction | The style is re-sent automatically | The compaction hook asks the summary to keep your goals, preferences and decisions |
| Title generation | Untouched | Untouched |

## Configure

**Claude Code**

Run `/plugin configure intuitive@intuitive` to switch either option:

- `reminder`: the per-prompt nudge.
- `subagents`: the compact guidelines for subagents.

You can also set `INTUITIVE_REMINDER=off` or `INTUITIVE_SUBAGENTS=off` in the `env` block of a `settings.json`. This works per project, and the env var wins when set.

While the plugin is enabled, its output style replaces whichever one you pick in `/output-style`. To turn everything off, run `/plugin disable intuitive@intuitive`.

**OpenCode**

Options apply when you load the plugin folder through `plugins` in `opencode.json(c)`. In that case, don't also keep a copy in `plugins/`.

```jsonc
{
  "plugins": [
    {
      "package": "/path/to/intuitive/opencode",
      "options": { "subagents": "compact", "compaction": true, "exclude": [], "file": "~/my-style.md" }
    }
  ]
}
```

| Option | Default | Meaning |
|---|---|---|
| `subagents` | `"compact"` | What subagent sessions get: `"compact"`, `"full"` or `"off"` |
| `compaction` | `true` | Steer compaction summaries to keep the user's goals, preferences and decisions |
| `exclude` | `[]` | Agent IDs to leave untouched, e.g. `["plan"]` |
| `file` | — | Your own guidelines file. It replaces the built-in text (relative paths resolve from the project) |

To turn it off, delete the file or add `"-intuitive"` to `plugins`.

## Customize the style

All the text lives in `shared/`:

| File | Used for |
|---|---|
| `intuitive.md` | Main guidelines |
| `subagent.md` | Compact version for subagents |
| `reminder.md` | Per-prompt nudge |
| `compaction.md` | Note added to compaction requests |

Edit those files, then regenerate both plugins:

```sh
node scripts/build.mjs          # rewrites the Claude Code style + hooks and the text block in opencode/index.ts
node scripts/build.mjs --check  # CI: fails if a generated file is stale
```

## Develop and verify

```sh
claude plugin validate . --strict   # marketplace + plugin manifests
bun test tests/                     # OpenCode plugin, V2 and V1 paths
cd opencode && npm i && npm run typecheck
```

This was tested end to end against a mock model server with:

- Claude Code 2.1.301
- OpenCode 2.0.30
- OpenCode 1.19.2

In every case, the guidelines reached the main agent, the subagents and the post-compaction requests as described above.

## Layout

```
.claude-plugin/marketplace.json   Claude Code marketplace (this folder is the marketplace)
claude-code/                      Claude Code plugin
  .claude-plugin/plugin.json
  output-styles/intuitive.md      generated: forced output style
  hooks/hooks.json                SubagentStart + UserPromptSubmit
  hooks/*.sh                      generated: hook scripts (bash, no dependencies)
opencode/                         OpenCode plugin (single file + package.json for npm/git installs)
  index.ts                        V2 setup() + V1 server(), text block generated
shared/                           the text: edit here
scripts/build.mjs                 regenerates the plugin files from shared/
tests/opencode.test.ts            bun unit tests
```

MIT licensed.
