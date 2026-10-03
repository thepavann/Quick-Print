# Contributing to QuickPrint

Thanks for contributing.

## Development

Requirements:

- Node.js 22.12+
- npm 10+
- A Supabase project for database-backed features

```bash
cp .env.example .env
npm install
npm run dev
```

## Before opening a pull request

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Keep changes focused, avoid committing secrets, and update documentation when configuration or deployment behavior changes.
