# Intuitive for Claude Code

This plugin makes Claude always think, behave and respond intuitively.

| Part | What it does |
|---|---|
| `output-styles/intuitive.md` | The main guidelines. Forced on with `force-for-plugin`, so they go with every request and survive `/compact`. Claude Code's coding instructions stay in place (`keep-coding-instructions`). |
| `hooks/subagent-start.sh` | Gives every subagent a compact version. |
| `hooks/user-prompt-submit.sh` | Adds a one-line reminder to each prompt. |

Install from the repo root (the marketplace):

```sh
claude plugin marketplace add /path/to/intuitive
claude plugin install intuitive@intuitive
```

Run `/plugin configure intuitive@intuitive` to toggle `reminder` and `subagents`. Run `/plugin disable intuitive@intuitive` to turn it off.

The output style and hook scripts are generated from `../shared/`. Edit the text there and run `node scripts/build.mjs`.
