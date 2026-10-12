// WebMCP (webmachinelearning.github.io/webmcp): offers Modkeel's crash reading as a tool to an AI
// agent built into the browser, so it can diagnose a crash the user gave it without our MCP
// server (api.modkeel.com/mcp) being installed. Loaded by the home page and /crashes/diagnose.
// It calls the same API as the page's button; a page that can show the reading sets
// window.modkeelShowDiagnosis(reading, text) and the user sees what the agent got.
// The draft moved the API from navigator.modelContext to document.modelContext; both are tried,
// and browsers without either skip this. Keep the description close to diagnose_crash in
// api/src/mcp.ts (lab).
(() => {
  const ctx = document.modelContext || navigator.modelContext;
  if (!ctx || typeof ctx.registerTool !== "function") return;

  const API = "https://api.modkeel.com/v1/diagnose";
  // each crash kind's fix guide, as on the diagnose page
  const GUIDE = {
    MIXIN_FAILED: "/crashes/mixin-apply-failed",
    MISSING_CLASS: "/crashes/noclassdeffounderror",
    OUT_OF_MEMORY: "/crashes/out-of-memory",
    MOD_LOADING: "/crashes/mod-loading-failed",
  };
  const ERRORS = {
    413: "Too large: pass the crash report or the end of the log.",
    422: "No crash found in this text: pass the whole crash report or latest.log.",
    429: "Too many requests from this network: try again in an hour.",
  };
  // MCP-style result: the JSON as text for agents that read content, and as structuredContent
  const done = (data, isError = false) =>
    ({ content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data, isError });

  const tool = {
    name: "diagnose_crash",
    title: "Which mod crashed Minecraft",
    description:
      "Find the mod most likely behind a modded Minecraft crash (Fabric, NeoForge, Forge) " +
      "from a crash report or latest.log. Returns the kind of crash, suspects ranked by " +
      "evidence with a confidence level (NONE when nothing points at a mod), the Minecraft " +
      "version and loader read from the log, problems the Modkeel lab saw in the rest of the " +
      "installed mods and what fixed the same crash for other players. Pass the whole file, " +
      "unedited, up to 4 MB; it is read and dropped, never stored.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The whole crash report or latest.log, as text." },
      },
      required: ["text"],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    async execute(input) {
      const body = String((input && input.text) || "").trim();
      if (!body) return done({ error: "Pass the crash report or log as text." }, true);
      const r = await fetch(API, { method: "POST", body, headers: { "content-type": "text/plain" } })
        .catch(() => null);
      if (!r) return done({ error: "Could not reach api.modkeel.com." }, true);
      if (!r.ok) return done({ error: ERRORS[r.status] || `Modkeel answered ${r.status}.` }, true);
      const d = await r.json();
      if (typeof window.modkeelShowDiagnosis === "function") window.modkeelShowDiagnosis(d, body);
      return done({ ...d, guide: "https://modkeel.com" + (GUIDE[d.kind] || "/crashes/"),
                    analyzer: "https://modkeel.com/crashes/diagnose",
                    source: "Modkeel (modkeel.com), lab data CC BY 4.0" });
    },
  };
  try {
    const p = ctx.registerTool(tool);
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch { /* an older draft's shape: the page works without it */ }
})();
