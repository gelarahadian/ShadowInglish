# ShadowInglish

ShadowInglish is a Next.js App Router application for practicing English speaking through shadowing lessons, transcripts, vocabulary, and progress tracking.

## Stack

- Next.js 16
- React 19
- TypeScript strict
- Tailwind CSS v4
- Supabase PostgreSQL
- React Query
- Zustand
- React Hook Form
- Zod
- Lucide
- shadcn/ui-compatible structure

## Project Status

This repository is currently in foundation setup. MVP features such as authentication, lessons, YouTube import, shadowing practice, translation, vocabulary, progress tracking, AI feedback, Whisper, and FFmpeg are not implemented yet.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Do not commit real secret values. `SUPABASE_SERVICE_ROLE_KEY` must only be used server-side.

## Scripts

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```

Use `pnpm format` to format the project.
