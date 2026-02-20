# GEMINI.md - Project Rules for Hously

This file contains foundational mandates for Gemini CLI when working on the Hously project. These instructions take absolute precedence over general defaults.

## Foundational Mandates

1.  **Workflow Precedence**: Always follow the **Research -> Strategy -> Execution** lifecycle.
2.  **Sprint Planning**: When working on sprint plans in `docs/react-native-plan/sprint-*.md`:
    - Update the original sprint file with implementation details, statuses, and acceptance criteria.
    - Do NOT create separate summary or implementation files.
    - Mark tasks with ✅ DONE or ⚠️ PARTIAL.
3.  **Tooling & Runtime**: Use **Bun** as the primary package manager and runtime.
4.  **Makefile First**: Always prefer `make` commands for common operations (install, dev, test, lint, migrations). If a necessary command is missing from the `Makefile`, propose adding it.
5.  **Database Migrations**: ALWAYS use `make migrate-dev` for creating migrations. Never run Prisma commands directly if a Makefile equivalent exists.
6.  **Architecture Consistency**:
    - **API**: Elysia plugins, Prisma ORM, JWT cookies, route/service separation.
    - **Web**: TanStack Router/Query, Feature-based folder structure, Tailwind CSS 4.
    - **App**: Expo, React Native, TanStack Query, Zustand, NativeWind.

## Technical Standards

- **Type Safety**: Ensure strict TypeScript compliance across all apps. Use `make typecheck` to validate.
- **Testing**: Every feature or bug fix must include verification. Use `make test` or app-specific test commands.
- **Styling**: 
    - Web: Tailwind CSS 4 (Vanilla CSS preferred for custom components).
    - App: NativeWind.
- **Security**: Never log or commit secrets. Protect `.env` files and sensitive credentials.

## Common Operations Reference

- Install: `make install`
- Dev API: `make dev-api`
- Dev Web: `make dev-web`
- Dev Services: `make dev-services` (Postgres, MinIO, Redis)
- Lint: `make lint`
- Typecheck: `make typecheck`
- Migrations: `make migrate-dev`, `make migrate-deploy`
