---
title: "Manage Brand Identity Colors Directly From the Notra API"
description: "Notra's API now exposes full CRUD for brand identity colors, so teams can sync their brand guidelines programmatically instead of re-entering them by hand."
date: "2026-10-20"
image: "./api-brand-identity-colors.png"
imageAlt: "Manage Brand Identity Colors Directly From the Notra API"
---

Notra's API now lets you create, read, update, and delete the colors attached to a brand identity, which means your brand's visual guidelines can live in code and sync automatically instead of being re-typed into a dashboard. If your team already manages brand voice and tone through Notra to keep generated changelogs, blog posts, and social updates on-message, this closes the gap for color: your palette can now travel with the rest of your brand identity wherever your workflows need it.

## What shipped

Four new endpoints are now live under the brand identities resource:

- `GET /v1/brand-identities/{brandIdentityId}/colors` — list every color saved against a brand identity
- `POST /v1/brand-identities/{brandIdentityId}/colors` — add a new color
- `PATCH /v1/brand-identities/{brandIdentityId}/colors/{colorId}` — update an existing color
- `DELETE /v1/brand-identities/{brandIdentityId}/colors/{colorId}` — remove a color

Colors are validated as hex values when you create or update them, so malformed values are rejected before they ever reach a brand identity record. The endpoints reuse the existing `brand-identities.read` and `brand-identities.write` scopes, so if you've already issued an API key with access to brand identities, it already has the permissions it needs to manage colors too — there's no new scope to request or key to rotate.

An equivalent set of tools is planned for Notra's MCP server as a follow-up, which will let AI agents and MCP-compatible tools read and update brand colors the same way they can already work with other parts of a brand identity.

## Why it matters

Notra builds generated content around a brand identity that captures your voice, tone, and visual guidelines so that changelogs, blog posts, and social updates feel like they came from your team rather than a generic AI. Color is part of that identity, and until now, the only way to manage it was through the dashboard. For teams that treat their brand guidelines as a single source of truth — say, a design system repo, a style guide service, or an internal tool that already owns the canonical list of brand colors — that meant a manual, one-off step to keep Notra in sync.

With these endpoints, that sync can be automated. A few concrete scenarios this unlocks:

- **Design system sync**: if your brand colors live in a design tokens file or a design system package, you can write a script that reads that source of truth and calls the Notra API to keep the brand identity's colors current whenever the tokens change.
- **Programmatic brand identity setup**: teams spinning up a new brand identity for a new product line or sub-brand can create it and populate its full color palette in one scripted pass, rather than clicking through a form.
- **Multi-brand and agency workflows**: if you manage content for multiple brand identities inside Notra, you can maintain their color palettes from a central system instead of updating each one by hand in the dashboard.
- **Cleanup and maintenance**: outdated or duplicate colors can be removed with a single `DELETE` call as part of routine brand identity housekeeping.

This follows the same pattern as other recent API additions, like write-scoped API keys and the async content generation endpoints: more of what you can do by hand in the dashboard is becoming something you can also do from a script, a CI job, or another internal tool.

## How to use it

To list the colors on a brand identity, call the list endpoint with an API key scoped to `brand-identities.read`:

```bash
curl https://api.usenotra.com/v1/brand-identities/{brandIdentityId}/colors \
  -H "Authorization: Bearer YOUR_API_KEY"
```

To add a color, send a hex value to the same resource with a key scoped to `brand-identities.write`:

```bash
curl -X POST https://api.usenotra.com/v1/brand-identities/{brandIdentityId}/colors \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"hex": "#1A1A1A", "name": "Primary Ink"}'
```

Updating a color's hex value or label uses `PATCH` against the specific color ID:

```bash
curl -X PATCH https://api.usenotra.com/v1/brand-identities/{brandIdentityId}/colors/{colorId} \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"hex": "#1F1F1F"}'
```

And removing one that's no longer part of the palette is a straightforward `DELETE`:

```bash
curl -X DELETE https://api.usenotra.com/v1/brand-identities/{brandIdentityId}/colors/{colorId} \
  -H "Authorization: Bearer YOUR_API_KEY"
```

If a hex value is malformed — missing the leading `#`, the wrong number of digits, or containing invalid characters — the `POST` or `PATCH` call will be rejected before the color is saved, so you can catch formatting mistakes in your own validation layer or CI before they reach your brand identity.

If you're issuing API keys for the first time, make sure the key you generate includes the `brand-identities.read` scope for list operations and `brand-identities.write` for create, update, and delete. Existing keys that already cover brand identities don't need to be reissued — the new color endpoints are covered by the same scopes you're already using.

## What this means for your content pipeline

Notra turns shipped work from GitHub, Linear, and Slack into publish-ready changelogs, blog posts, and social posts, and it leans on your brand identity to keep that output consistent with how your team actually communicates. Keeping the color portion of that identity accurate matters most when generated content includes visual elements or when your brand identity feeds downstream tools, like a design system or a marketing site, that expect an authoritative palette.

Because this uses the same scopes as the rest of the brand identity API, there's nothing new to configure if you're already managing brand voice or other identity fields programmatically. If you haven't used the brand identities API yet, this is a reasonable place to start: pull your current palette, confirm it matches what's live in your design system, and set up a small sync job so future palette changes don't require a manual update in the dashboard.
