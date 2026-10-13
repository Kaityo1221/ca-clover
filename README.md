# CA Clover 🍀

Japan Community Activity Dashboard for Pokémon GO Community Ambassadors.

This public repository contains the GitHub Pages user interface in `docs/`
and public-side application source. The separately deployed Supabase backend
and Campfire data ingestion source are managed in a private repository.

## Privacy boundary

- Public GitHub Pages deploys only `docs/`.
- No database schema, backend Edge source, or auth research should be
  committed to the public branch.
- Browser-facing public code is not secret: all access controls must be
  enforced server-side using Supabase authentication, RLS and limited
  capabilities.
- **Note:** older public Git commits may still expose historical backend
  source. The source separation does not remove that historical exposure.

See `PRIVATE_BACKEND_SPLIT.md` for the pre-merge safety checklist.
