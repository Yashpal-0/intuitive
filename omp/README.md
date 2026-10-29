# Intuitive for OMP

This plugin makes every OMP (Oh My Pi) agent think, behave and respond intuitively. It's one dependency-free extension file, `index.ts`; `package.json` declares it and its settings for OMP's plugin manager.

```sh
# Install from the marketplace in this repo, then restart omp
omp plugin marketplace add Yashpal-0/intuitive
omp plugin install intuitive@intuitive
# Or link this folder
omp plugin link /path/to/intuitive/omp
```

| Request | What it gets |
|---|---|
| Every prompt of the main session | The full guidelines in the system prompt (through the `before_agent_start` hook) |
| Subagent sessions (`task`, eval `agent()`, `/tan`) | A compact version |
| Compaction requests | A note to keep the user's goals, preferences and decisions (through the `session.compacting` hook) |
| Title generation | Nothing of its own: OMP's default `fork` title turn reuses the main prompt and its cache |

There are four settings: `subagents` (`compact` \| `full` \| `off`), `compaction` (boolean), `exclude` (comma-separated agent names) and `file` (your own guidelines). Set them with `omp plugin config set intuitive <key> <value>` or under `/plugins` in omp, then restart omp.

The text block in `index.ts` is generated from `../shared/`. Edit the text there and run `node scripts/build.mjs`.
