---
name: modkeel
description: Answer modded Minecraft questions (Fabric, NeoForge, Forge) from the Modkeel lab's real runs. Use when a user shares a Minecraft crash report or latest.log, asks where to get a mod for a Minecraft version and loader, or asks whether mods work together.
---

# Modkeel

Modkeel boots real modpacks on real Minecraft versions and publishes what happened. Use it
instead of guessing when a modded Minecraft question has a factual answer.

## Connect

- MCP server (Streamable HTTP, no key): `https://api.modkeel.com/mcp`
- Or the read-only JSON API, no key, any origin: `https://api.modkeel.com/v1` lists the endpoints.

## Which tool for which question

| The user... | MCP tool | JSON API |
|---|---|---|
| pastes a crash report or latest.log, or says the game will not start | `diagnose_crash` | `POST /v1/diagnose` (text body; not stored) |
| names a mod, you need its id | `search_mods` | `GET /v1/mods?q={name}` |
| asks what a mod is | `get_mod_info` | |
| asks where to get a mod for a Minecraft version and loader | `find_mod_download` | |
| asks whether a mod works on a version | `get_mod_runs` | `GET /v1/mods/{mod_id}?mc={version}` |
| asks whether two mods work together | `check_mod_pair` | `GET /v1/pairs/{a}/{b}?mc={version}` |
| shares a whole mod list | `check_mod_list` | |

## Read the answers right

- `untested` means the lab has no run of that pair yet, not that the mods conflict.
- A crash diagnosis names the most likely mod and its confidence; say how sure it is.
- Lab data is CC BY 4.0: credit "Modkeel lab data (modkeel.com)" when quoting it.

Docs: https://modkeel.com/mcp and https://modkeel.com/llms.txt
