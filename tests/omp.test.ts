// Unit tests for the OMP extension, against a fake `pi` and a fake omp settings store.
// Run with: bun test tests/
import { describe, expect, mock, test } from "bun:test"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const FULL = "Work like a seasoned collaborator"
const COMPACT = "Working style for this task"
const COMPACTION = "When summarizing, keep what lets the work continue"
const BASE = ["omp instructions", "<project-context>workstation, AGENTS.md</project-context>"]
const MAIN = { kind: "main", name: "main", id: "Main", depth: 0 }
const TASK = { kind: "sub", name: "task", id: "0-Task", depth: 1, parentId: "Main" }

// omp keeps plugin settings per project, under the plugin's package name.
const { name: packageName } = JSON.parse(await readFile(path.join(import.meta.dir, "../omp/package.json"), "utf8"))
const saved = new Map<string, Record<string, Record<string, unknown>>>()
let settingsError: Error | undefined
mock.module("@oh-my-pi/pi-coding-agent/extensibility/plugins/loader", () => ({
  getPluginSettings: async (pluginName: string, cwd: string) => {
    if (settingsError) throw settingsError
    return saved.get(cwd)?.[pluginName] ?? {}
  },
}))
const { default: intuitive } = await import("../omp/index.ts")

type Hook = (event: object, ctx: object) => Promise<{ systemPrompt?: string[]; context?: string[] } | undefined>
let projects = 0

/** Loads the extension into a fake `pi` for a project with these saved settings. */
function load(settings: Record<string, unknown> = {}, cwd = `/projects/${++projects}`) {
  saved.set(cwd, { [packageName]: settings })
  const handlers: Record<string, Hook> = {}
  const warnings: string[] = []
  const pi = {
    logger: { warn: (message: string) => warnings.push(message) },
    on: (event: string, handler: Hook) => {
      handlers[event] = handler
    },
  }
  // The fake implements only what the extension uses, with looser handler types than its overloads.
  intuitive(pi as unknown as Parameters<typeof intuitive>[0])
  /** The system prompt a prompt ends up with, or undefined when the extension leaves it alone. */
  const prompt = async (agent: object = MAIN, event: object = {}) =>
    (
      await handlers.before_agent_start(
        { type: "before_agent_start", reason: "prompt", prompt: "hi", systemPrompt: [...BASE], ...event },
        { cwd, agent },
      )
    )?.systemPrompt
  const compacting = () =>
    handlers["session.compacting"]({ type: "session.compacting", sessionId: "s", messages: [] }, { cwd, agent: MAIN })
  return { handlers, prompt, compacting, warnings }
}

describe("OMP extension", () => {
  test("main sessions get the full guidelines after omp's prompt, subagent sessions the compact ones", async () => {
    const { handlers, prompt } = load()
    expect(Object.keys(handlers).sort()).toEqual(["before_agent_start", "session.compacting"])
    const main = await prompt()
    expect(main?.slice(0, BASE.length)).toEqual(BASE)
    expect(main?.at(-1)).toContain(FULL)
    const sub = await prompt(TASK)
    expect(sub?.at(-1)).toContain(COMPACT)
    expect(sub?.join("\n")).not.toContain(FULL)
  })

  test("subagents: off leaves subagents alone, full gives them everything", async () => {
    expect(await load({ subagents: "off" }).prompt(TASK)).toBeUndefined()
    expect((await load({ subagents: "full" }).prompt(TASK))?.at(-1)).toContain(FULL)
  })

  test("exclude leaves the listed agents untouched", async () => {
    const { prompt } = load({ exclude: "Scout, reviewer" })
    expect(await prompt({ ...TASK, name: "scout" })).toBeUndefined()
    expect(await prompt({ ...TASK, name: "reviewer" })).toBeUndefined()
    expect((await prompt())?.at(-1)).toContain(FULL)
  })

  test("compaction gets the guidance, and nothing at all when it's off", async () => {
    expect((await load().compacting())?.context.join("\n")).toContain(COMPACTION)
    // omp keeps only the last extension's compaction result, so "off" must return nothing.
    expect(await load({ compaction: false }).compacting()).toBeUndefined()
  })

  test("a custom guidelines file replaces the built-in text; a bad path falls back", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "intuitive-omp-"))
    await writeFile(path.join(dir, "style.md"), "CUSTOM STYLE\n")
    expect((await load({ file: "./style.md" }, dir).prompt())?.at(-1)).toBe("CUSTOM STYLE")
    const missing = load({ file: path.join(dir, "missing.md") })
    expect((await missing.prompt())?.at(-1)).toContain(FULL)
    expect(missing.warnings.join("\n")).toContain("missing.md")
  })

  test("unreadable settings mean the defaults", async () => {
    settingsError = new Error("lockfile is not JSON")
    try {
      const { prompt, warnings } = load({ subagents: "off" })
      expect((await prompt(TASK))?.at(-1)).toContain(COMPACT)
      expect(warnings.join("\n")).toContain("settings")
    } finally {
      settingsError = undefined
    }
  })

  test("only ever appends to omp's prompt, once, and never throws", async () => {
    const { handlers, prompt } = load()
    // Returning a prompt when omp sent none would replace omp's whole prompt.
    expect(await prompt(MAIN, { systemPrompt: undefined })).toBeUndefined()
    // A second copy of the plugin (say, a plugin install plus a copied file) adds nothing.
    const once = await prompt()
    expect(await prompt(MAIN, { systemPrompt: once })).toBeUndefined()
    const broken = {
      cwd: "/projects/broken",
      get agent(): never {
        throw new Error("no agent")
      },
    }
    await expect(handlers.before_agent_start({ reason: "prompt", systemPrompt: [...BASE] }, broken)).resolves.toBeUndefined()
  })
})
