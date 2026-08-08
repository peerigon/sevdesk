This directory is intentionally empty.

`vite.config.ts` points `envDir` here so the unit test run never loads the repo
root `.env`, which 1Password Environments mounts as a named pipe holding a
production sevDesk token. See AGENTS.md, "The sevDesk API token".
