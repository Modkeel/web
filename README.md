# modkeel.com

The Modkeel website. Plain HTML, CSS and JavaScript, no build step: open `index.html` in a
browser to preview it.

- `index.html`: the home page.
- `sea.js`: the hero scene, a pixel-art night sea drawn on a canvas and lit per pixel.
- `crashes/`: the crash report reader (`diagnose.html`, through `api.modkeel.com/v1/diagnose`)
  and the guides per kind of crash.
- `minecraft/`, `mods/`, `data/`: pages and data from the Modkeel lab (generated, not edited
  by hand).
- `mcp.html`: the MCP server (`api.modkeel.com/mcp`) and how to add it to an AI assistant.
- `img/`: the icon and the Modkeel Companion screenshots.

For search engines and AI agents:

- `sitemap.xml`, `robots.txt`, `llms.txt`, and the IndexNow key file at the root.
- `_headers`: response headers; on `/`, `Link` headers to the files below.
- `.well-known/api-catalog` (RFC 9727), `.well-known/mcp/server-card.json` (MCP Server Card;
  bump its version with the server's), `.well-known/agent-skills/` (skills index; recompute
  the SKILL.md digest when it changes), `.well-known/glama.json` (Glama listing claim, keep).
- `webmcp.js`: the crash reader as a WebMCP tool (`diagnose_crash`) for the browser's own
  agent, loaded by the home page and the crash reader.

Every push to `main` is deployed to [modkeel.com](https://modkeel.com) by Cloudflare Workers
Builds (Worker `modkeel`, static assets); its "Workers Builds" check is the deploy.

MIT licensed.
