# GSSoC Issue Finder

Minimal Next.js app that finds open GSSoC issues with zero human comments.

Usage (local):

1. Install dependencies:

```bash
cd gssoc-issue-finder
npm install
```

2. Run dev server:

```bash
npm run dev
```

The app exposes `/api/repos` (scrapes GSSoC projects) and `/api/issues/random`.
