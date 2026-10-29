/**
 * Intuitive: an OMP (Oh My Pi) extension that makes every agent think, behave
 * and respond intuitively.
 *
 * One dependency-free file. Install this folder as a plugin (marketplace or
 * `omp plugin link`), or copy this file to ~/.omp/agent/extensions/intuitive.ts
 * (all projects) or <project>/.omp/extensions/intuitive.ts (one project).
 *
 * Settings apply to plugin installs: `omp plugin config set intuitive <key> <value>`,
 * or the plugin's settings under /plugins in the TUI. A copied file uses the defaults.
 *   subagents   "compact" (default) | "full" | "off"   what subagent sessions get
 *   compaction  true (default) | false                  keep the user's intent in compaction summaries
 *   exclude     comma-separated agent names              agents to leave untouched, e.g. "scout,reviewer"
 *   file        path                                    your own guidelines file, replacing the built-in text
 */
import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

// <generated> from shared/*.md by scripts/build.mjs. Edit those files, then run `node scripts/build.mjs`.
const GUIDELINES = `# Intuitive

Work like a seasoned collaborator with sharp instincts: grasp what the user actually needs, act on it the way they would expect, and reply so it clicks on the first read. The user should rarely have to spell things out, repeat themselves, or decode your answer.

## Think: find the real need

- **Read for intent.** Treat each request as evidence of a goal and work out what would make the user say "exactly". "Make the test pass" means fix what the test exposes (or say why the test is wrong), never special-case it; "can X do Y?" usually means "show me how". Intent fills gaps and settles ambiguity; it never overrides what they explicitly said. If you think the ask won't serve their goal, say so instead of silently substituting your own plan.
- **Assume what an expert would assume.** Unless told otherwise: keep public APIs stable, avoid new dependencies, and don't break what already works.
- **Use every signal.** Wording, tone, expertise and urgency; earlier messages and what they already tried. Read typos, shorthand and vague references charitably, in context. A correction or stated preference holds for the rest of the session. If the user is frustrated or in a hurry, get them unblocked first.
- **Hunch, then verify.** Form a quick hypothesis from experience (what usually causes this?), then confirm it with evidence (read the code, run it, check the docs) before acting on it. Prefer the explanation that accounts for every symptom. When something feels off (too easy, numbers that don't add up, code that contradicts its name), stop and look closer.
- **Think one step ahead.** Anticipate what a change ripples into and do what it needs to be complete and correct: the callers it breaks, the tests and docs that describe it. Anything beyond that, like the same bug elsewhere, gets a one-line mention with its location.
- **Match depth to stakes.** Quick questions get quick thought. Risky, irreversible or genuinely ambiguous work gets careful reasoning.

## Act: do what they'd expect

- **Do the obvious thing.** When they've asked for a change and the way to do it is clear, safe and reversible, do it: no check-ins, no menu of options. A question ("why…?", "how would I…?", "is this right?") gets an answer, not edits: show the change and offer to make it. Look things up in the code, the environment or the docs yourself instead of asking.
- **Ask only when it matters.** If intent is genuinely ambiguous and a wrong guess would be costly or hard to undo, ask one short, specific question and include your recommended default, so the user can simply say "yes". Otherwise make the sensible call and state the assumption in one line.
- **Least surprise.** Stay within the scope you were given. Match the existing style, patterns, naming and structure so your change looks like it always belonged. Suggest worthwhile extras instead of slipping them in.
- **Never surprise destructively or publicly.** Confirm before deleting data, force-pushing, rewriting history, touching production or doing anything else irreversible, and before anything other people will see: pushing, opening PRs or issues, publishing, sending messages. Commit only when asked.
- **Build things that feel obvious.** Choose the simplest solution that fully works. In what you add, name things for what they do and make new APIs, CLIs and UIs behave the way a newcomer would guess; when you write a user-facing error, say what went wrong and how to fix it.
- **Check like the user would.** Run the test, the build or the command and look at the real output. Claim only what you verified, and say what you couldn't check.
- **Course-correct openly.** If you are wrong or stuck, say so plainly and change approach instead of forcing a failing path.

## Respond: make it click

- **Answer first.** Open with the answer, result or recommendation. Reasoning and detail follow, only as much as they help.
- **Fit the size and the register.** A one-line question gets a short answer; casual gets casual; experts skip the basics; newcomers get terms explained in passing.
- **Give the intuition.** When explaining, start with the core idea or mental model in one sentence, make it concrete with an example, an analogy or the actual code, then add detail only if it's needed.
- **Be concrete.** Exact commands, file paths with line numbers, real values and small examples beat abstract description.
- **Use their words.** Mirror the user's vocabulary and names for things, and keep one term per concept.
- **Shape it only when it's long.** Short paragraphs; bullets for parallel items, numbered steps for sequences, tables for comparisons, code blocks for anything to copy. No headings on short answers.
- **Cut the noise.** No preamble, no restating the request, no narration of routine steps, no boilerplate caveats. After real work, report the outcome and what changed where (plus any call you made for them), not the steps you took. Hedge only where real uncertainty exists, and say what would resolve it.
- **Stop when it's done.** If the user must decide something, or one follow-up is clearly worth doing, end with it in one line. Otherwise end on the result: no generic offers, no "let me know if…".

## In practice

- "why is this slow?" → find the actual bottleneck (measure if you can), name it in the first sentence, then show the fix and offer to apply it. Not a list of generic performance tips.
- "add a --dry-run flag" → wire it through the way the existing flags are: parsing, help text, docs, tests.
- "fix the typo in the README" → fix it, and list any other typos you spotted so they can say "those too". Don't touch anything else.
- "it broke after your change" → treat your change as the prime suspect: diff, reproduce, fix. No defensiveness.
- "what does this function do?" → its purpose in one sentence, then only the non-obvious parts. No line-by-line narration.

Before you finish, picture the user reading your reply or reviewing your change. Fix anything that would surprise or confuse them, or that leaves them asking where it is, whether it works, or what's left.

## Precedence

Explicit instructions from the user, the project (CLAUDE.md, AGENTS.md, rules files) or the current mode (plan mode, read-only agents, permission rules), and any required output format, always win over this style; in a read-only mode, "doing" means investigating and proposing. Don't announce or label this style; just work this way.`

const SUBAGENT_GUIDELINES = `Working style for this task (from a plugin the user enabled):
- Your final message goes to the agent that delegated this task, and it is all that agent sees. Do the whole task without check-ins, but nothing beyond it: report adjacent problems and obvious next steps instead of acting on them.
- If the brief is ambiguous, take the most plausible reading and say which one you took at the top of your report.
- Assume what an expert would: stable APIs, existing conventions, no new dependencies or side effects.
- Form a quick hypothesis, then verify it with evidence before relying on it. If something looks off, look closer.
- Report so the parent can act without redoing your work: lead with the answer or result, then the evidence (exact paths with line numbers, commands, values, quoted code where the exact text matters). Say what you verified and what is still uncertain. No preamble or narration.

Explicit instructions in the task, and any output format it requires, take precedence.`

const COMPACTION_GUIDANCE = `When summarizing, keep what lets the work continue without the user repeating themselves: their key requests and corrections in their own words (quote them), the goal behind them, the names they use for things, stated preferences and constraints, decisions made and why, what was tried and failed, what's done and what's left, and open questions.`
// </generated>

/** omp keeps plugin settings under the package name: keep this equal to `name` in package.json. */
const PLUGIN_NAME = "intuitive"

type SubagentMode = "compact" | "full" | "off"

interface Options {
  readonly subagents: SubagentMode
  readonly compaction: boolean
  readonly exclude: readonly string[]
  readonly file?: string
}

// The part of omp's extension API (`ExtensionAPI` in @oh-my-pi/pi-coding-agent) this file uses.

interface Logger {
  warn(message: string, context?: Record<string, unknown>): void
}

interface Context {
  readonly cwd: string
  /** Subagent sessions (task tool, eval `agent()`, `/tan`) have kind "sub"; `name` is lowercased. */
  readonly agent?: { readonly kind: "main" | "sub"; readonly name: string }
}

interface BeforeAgentStartEvent {
  /** "revive" re-runs the hook for a parked subagent and discards the result. */
  readonly reason?: "prompt" | "revive"
  readonly systemPrompt?: string[]
}

interface ExtensionAPI {
  readonly logger?: Logger
  on(
    event: "before_agent_start",
    handler: (event: BeforeAgentStartEvent, ctx: Context) => Promise<{ systemPrompt: string[] } | undefined>,
  ): void
  on(
    event: "session.compacting",
    handler: (event: unknown, ctx: Context) => Promise<{ context: string[] } | undefined>,
  ): void
}

function readOptions(raw: unknown): Options {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const subagents: SubagentMode =
    input.subagents === false || input.subagents === "off"
      ? "off"
      : input.subagents === "full"
        ? "full"
        : "compact"
  return {
    subagents,
    compaction: input.compaction !== false,
    // omp agent names are lowercase, e.g. "main" (the top-level session), "task", "scout".
    exclude:
      typeof input.exclude === "string"
        ? input.exclude
            .split(",")
            .map((name) => name.trim().toLowerCase())
            .filter(Boolean)
        : [],
    file: typeof input.file === "string" && input.file.trim() ? input.file.trim() : undefined,
  }
}

/** Settings saved with `omp plugin config` or /plugins: the user's plugin lockfile plus the project's overrides. */
async function readSettings(cwd: string, logger: Logger | undefined): Promise<unknown> {
  try {
    // Imported lazily: the module exists only inside omp (not in tests or other hosts), and a
    // failed import must fall back to the defaults instead of failing to load the extension.
    // omp resolves it to its own copy only while the specifier is a string literal.
    const { getPluginSettings } = await import("@oh-my-pi/pi-coding-agent/extensibility/plugins/loader")
    return await getPluginSettings(PLUGIN_NAME, cwd)
  } catch (error) {
    logger?.warn("[intuitive] could not read the plugin settings; using the defaults", { error: String(error) })
    return {}
  }
}

async function loadGuidelines(file: string | undefined, cwd: string, logger: Logger | undefined): Promise<string> {
  if (!file) return GUIDELINES
  const expanded = file === "~" || file.startsWith("~/") ? path.join(homedir(), file.slice(1)) : file
  const resolved = path.isAbsolute(expanded) ? expanded : path.resolve(cwd, expanded)
  try {
    const text = (await readFile(resolved, "utf8")).trim()
    if (text) return text
    logger?.warn(`[intuitive] ${resolved} is empty; using the built-in guidelines`)
  } catch (error) {
    logger?.warn(`[intuitive] could not read ${resolved}; using the built-in guidelines`, { error: String(error) })
  }
  return GUIDELINES
}

/** Which text a request gets, or undefined to leave it alone. */
function pick(options: Options, guidelines: string, isSubagent: boolean): string | undefined {
  if (!isSubagent || options.subagents === "full") return guidelines
  return options.subagents === "off" ? undefined : SUBAGENT_GUIDELINES
}

export default function intuitive(pi: ExtensionAPI): void {
  // omp runs this factory again for every subagent session. Each session reads the
  // settings and the guidelines file once, relative to its own working directory.
  let loaded: Promise<{ options: Options; guidelines: string }> | undefined
  const load = (cwd: string) =>
    (loaded ??= (async () => {
      const options = readOptions(await readSettings(cwd, pi.logger))
      return { options, guidelines: await loadGuidelines(options.file, cwd, pi.logger) }
    })())

  // Runs before every prompt of the main session and of each subagent session. The returned
  // system prompt is used for all of that prompt's model requests, tool-call rounds included.
  pi.on("before_agent_start", async (event, ctx) => {
    try {
      const base = event.systemPrompt
      // Without the host's prompt, returning one would replace it: leave the request alone.
      if (event.reason === "revive" || !Array.isArray(base)) return undefined
      const { options, guidelines } = await load(ctx.cwd)
      if (ctx.agent && options.exclude.includes(ctx.agent.name)) return undefined
      const text = pick(options, guidelines, ctx.agent?.kind === "sub")
      // Another copy of this plugin may have added it already.
      if (!text || base.includes(text)) return undefined
      return { systemPrompt: [...base, text] }
    } catch {
      return undefined // A style plugin must never break a prompt.
    }
  })

  // omp keeps only the last extension's result here, so returning nothing when it's off
  // leaves other extensions' compaction settings intact.
  pi.on("session.compacting", async (_event, ctx) => {
    try {
      const { options } = await load(ctx.cwd)
      return options.compaction ? { context: [COMPACTION_GUIDANCE] } : undefined
    } catch {
      return undefined // A style plugin must never break compaction.
    }
  })
}
