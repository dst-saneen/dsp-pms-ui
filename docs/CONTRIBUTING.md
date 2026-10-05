# Documentation Contribution Policy

## Choose the document home

| Purpose | Directory |
| --- | --- |
| First-time setup and onboarding | `getting-started/` |
| User workflows, product decisions, and module behavior | `product/` |
| Architecture, security boundaries, and engineering standards | `architecture/` |
| Implementation plans and developer completion records | `development/` or `superpowers/plans/` |
| Deployment, recovery, and operator procedures | `operations/` |
| Test plans, manual QA, and UAT instructions | `testing/` |
| Deliberately retained final evidence | `evidence/` |
| External analyses and source workbooks | `reference/` |
| Superseded or date-specific records | `archive/` |

## File and lifecycle rules

- Use lowercase kebab-case filenames. Prefix historical records with `YYYY-MM-DD` when the date is material.
- State the document audience, status, and last meaningful review near the top when those details affect use.
- Link to the current source of truth instead of copying it into a second location.
- Keep screenshots beside the guide that owns them. Do not commit compressed copies of an extracted guide.
- Keep raw logs, browser traces, generated previews, inspection files, and local QA runs outside Git. Promote only a reviewed final artifact into `evidence/` with a short provenance note.
- Update relative links when moving a document and run `node scripts/repository-hygiene.mjs` before committing.

The hygiene check permits `README.md` and `AGENTS.md` at the repository root; all other project documentation belongs under `docs/`.
