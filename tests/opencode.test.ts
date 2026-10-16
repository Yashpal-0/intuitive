// Unit tests for the OpenCode plugin's V2 (`setup`) and V1 (`server`) paths.
// Run with: bun test tests/
import { describe, expect, test } from "bun:test"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import plugin from "../opencode/index.ts"

const FULL = "Work like a seasoned collaborator"
const COMPACT = "Working style for this task"
const COMPACTION = "When summarizing, keep what lets the work continue"

type Hook = (event: any) => unknown

/** A fake V2 plugin context that records hook registrations. */
async function setupV2(options: Record<string, unknown> = {}, sessions: Record<string, any> = {}) {
  const hooks: Record<string, Hook> = {}
  const ctx = {
    options,
    location: { directory: options.__dir ?? process.cwd() },
    session: {
      get: async ({ sessionID }: { sessionID: string }) => {
        const entry = sessions[sessionID]
        if (typeof entry === "function") return entry()
        return entry ?? { id: sessionID }
      },
      hook: async (name: string, callback: Hook) => {
        hooks[name] = callback
        return { dispose: async () => {} }
      },
    },
  }
  await (plugin as any).setup(ctx)
  const context = async (sessionID: string, agent = "build") => {
    const event = { sessionID, agent, system: [] as Array<{ type: string; text: string }>, messages: [], options: {}, tools: {} }
    await hooks.context?.(event)
    return event.system.map((part) => part.text).join("\n")
  }
  return { hooks, context }
}

describe("OpenCode V2 (setup)", () => {
  test("exports a V2 definition and a V1 server", () => {
    expect(plugin.id).toBe("intuitive")
    expect(typeof plugin.setup).toBe("function")
    expect(typeof plugin.server).toBe("function")
  })

  test("main sessions get the full guidelines, subagent sessions the compact ones", async () => {
    const { hooks, context } = await setupV2({}, { child: { id: "child", parentID: "main" } })
    expect(Object.keys(hooks).sort()).toEqual(["compaction", "context"])
    expect(await context("main")).toContain(FULL)
    const child = await context("child", "general")
    expect(child).toContain(COMPACT)
    expect(child).not.toContain(FULL)
  })

  test("subagents: off skips subagents, full gives them everything", async () => {
    const sessions = { child: { parentID: "main" } }
    expect(await (await setupV2({ subagents: "off" }, sessions)).context("child")).toBe("")
    expect(await (await setupV2({ subagents: false }, sessions)).context("child")).toBe("")
    expect(await (await setupV2({ subagents: "full" }, sessions)).context("child")).toContain(FULL)
  })

  test("exclude leaves the listed agents untouched", async () => {
    const { context } = await setupV2({ exclude: ["build"] })
    expect(await context("main", "build")).toBe("")
    expect(await context("main", "plan")).toContain(FULL)
  })

  test("compaction hook adds guidance, and can be turned off", async () => {
    const on = await setupV2()
    const event = { system: [] as any[] }
    await on.hooks.compaction?.(event)
    expect(event.system[0].text).toContain(COMPACTION)
    const off = await setupV2({ compaction: false })
    expect(off.hooks.compaction).toBeUndefined()
  })

  test("a custom guidelines file replaces the built-in text; a bad path falls back", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "intuitive-"))
    await writeFile(path.join(dir, "style.md"), "CUSTOM STYLE\n")
    expect(await (await setupV2({ file: "./style.md", __dir: dir })).context("main")).toBe("CUSTOM STYLE")
    expect(await (await setupV2({ file: path.join(dir, "missing.md") })).context("main")).toContain(FULL)
  })

  test("never throws: failed lookups fall back to the full text, broken events are ignored", async () => {
    const { hooks, context } = await setupV2({}, {
      boom: () => {
        throw new Error("lookup failed")
      },
    })
    expect(await context("boom")).toContain(FULL)
    await expect(Promise.resolve(hooks.context?.({ sessionID: "x", agent: "build" }))).resolves.toBeUndefined()
    await expect(Promise.resolve(hooks.compaction?.({}))).resolves.toBeUndefined()
  })

  test("a hanging session lookup times out instead of stalling the request", async () => {
    const { context } = await setupV2({}, { slow: () => new Promise(() => {}) })
    const started = Date.now()
    expect(await context("slow")).toContain(FULL)
    expect(Date.now() - started).toBeLessThan(5000)
  }, 10_000)

  test("each session is looked up once", async () => {
    let calls = 0
    const { context } = await setupV2({}, {
      child: () => {
        calls++
        return { parentID: "main" }
      },
    })
    await context("child")
    await context("child")
    expect(calls).toBe(1)
  })
})

describe("OpenCode V1 (server)", () => {
  const v1 = async (options: Record<string, unknown> = {}, parents: Record<string, string> = {}) =>
    (plugin as any).server(
      {
        directory: process.cwd(),
        client: { session: { get: async ({ path: { id } }: any) => ({ data: { id, parentID: parents[id] } }) } },
      },
      options,
    )

  const transform = async (hooks: any, sessionID: string | undefined, head = "You are opencode, an agent") => {
    const output = { system: [head] }
    await hooks["experimental.chat.system.transform"]({ sessionID, model: {} }, output)
    return output.system.slice(1).join("\n")
  }

  test("adds the guidelines to session requests, compact ones to subagents", async () => {
    const hooks = await v1({}, { child: "main" })
    expect(await transform(hooks, "main")).toContain(FULL)
    expect(await transform(hooks, "child")).toContain(COMPACT)
  })

  test("skips session-less calls and V1's title and summary agents", async () => {
    const hooks = await v1()
    expect(await transform(hooks, undefined)).toBe("")
    expect(await transform(hooks, "main", "You are a title generator. You output ONLY a thread title.")).toBe("")
    expect(await transform(hooks, "main", "Summarize what was done in this conversation.")).toBe("")
  })

  test("compaction context is added unless turned off", async () => {
    const output = { context: [] as string[] }
    await (await v1())["experimental.session.compacting"]({ sessionID: "main" }, output)
    expect(output.context.join("\n")).toContain(COMPACTION)
    expect((await v1({ compaction: false }))["experimental.session.compacting"]).toBeUndefined()
  })
})
