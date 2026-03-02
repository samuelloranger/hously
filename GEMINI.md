# GEMINI.md - Project Rules for Hously

This file contains foundational mandates for Gemini CLI when working on the Hously project. These instructions take absolute precedence over general defaults.

## Project Identity

Hously is a self-hosted command center for homelab enthusiasts. It combines infrastructure monitoring, media pipeline management, and everyday life tools into a single unified dashboard.

## Foundational Mandates

1.  **Workflow Precedence**: Always follow the **Research -> Strategy -> Execution** lifecycle.
2.  **Tooling & Runtime**: Use **Bun** as the primary package manager and runtime.
3.  **Makefile First**: Always prefer `make` commands for common operations (install, dev, test, lint, migrations). If a necessary command is missing from the `Makefile`, propose adding it.
4.  **Database Migrations**: ALWAYS use `make migrate-dev` for creating migrations. Never run Prisma commands directly if a Makefile equivalent exists.
5.  **Architecture Consistency**:
    - **API**: Elysia plugins, Prisma ORM, JWT cookies, route/service separation.
    - **Web**: TanStack Router/Query, Feature-based folder structure, Tailwind CSS 4.
    - **Mobile**: Native iOS app (external repo `../hously-ios`).

## Technical Standards

- **Type Safety**: Ensure strict TypeScript compliance across all apps. Use `make typecheck` to validate.
- **Testing**: Every feature or bug fix must include verification. Use `make test` or app-specific test commands.
- **Styling**:
    - Web: Tailwind CSS 4 (Vanilla CSS preferred for custom components).
- **Security**: Never log or commit secrets. Protect `.env` files and sensitive credentials.

## Common Operations Reference

- Install: `make install`
- Dev API: `make dev-api`
- Dev Web: `make dev-web`
- Dev Services: `make dev-services` (Postgres, MinIO, Redis)
- Lint: `make lint`
- Typecheck: `make typecheck`
- Migrations: `make migrate-dev`, `make migrate-deploy`
