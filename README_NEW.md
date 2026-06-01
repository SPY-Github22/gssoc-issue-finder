# GSSoC Issue Finder

This app helps you discover open-source issues from GSSoC projects that have zero human comments, making it easy to contribute to new issues.

## ✨ Features

- **Random Issue Discovery** – Click to find a random issue with no comments
- **Difficulty Filtering** – Filter by Beginner Friendly, Intermediate, or Advanced
- **Repo-Specific Search** – Search for issues in a specific GSSoC project
- **Owner-Only Mode** – Optionally show only issues opened by the repo owner
- **Live Data** – Project list auto-updates every 5 minutes from the official GSSoC API
- **Beautiful UI** – Modern purple gradient design with smooth interactions

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

## 🔑 GitHub Token (Optional but Recommended)

By default, the app uses GitHub's public API which has a **60 requests/hour rate limit** (unauthenticated).

To enable full speed (**5,000 requests/hour**), add your GitHub token:

1. Generate a token at https://github.com/settings/tokens
   - Scopes needed: `public_repo` (read-only)
   
2. Create a `.env.local` file:
```bash
GITHUB_TOKEN=your_token_here
```

3. Restart the dev server

### How to Generate a GitHub Token
1. Go to https://github.com/settings/tokens (or Settings → Developer settings → Personal access tokens)
2. Click "Generate new token (classic)"
3. Give it a name like "GSSoC Issue Finder"
4. Select scope: `public_repo`
5. Click "Generate token" and copy it
6. Paste it in `.env.local`

## 📁 Project Structure

```
pages/
  index.js              # Main UI with random and search modes
  api/
    repos.js            # GET /api/repos - list all GSSoC projects
    issues/
      random.js         # GET /api/issues/random - find random issue
      search.js         # GET /api/issues/search - search repo issues

server/lib/
  scraper.js            # Fetch project list from GSSoC API
  github.js             # GitHub API wrappers for issues
```

## 🎯 Usage

### Random Mode
1. Select difficulty (or "All Levels")
2. Toggle "Owner-opened issues only" if desired
3. Click "Find Random Issue"
4. Click the result to open on GitHub

### Search Mode  
1. Type to search through 381 GSSoC projects
2. Select a project from the dropdown
3. Click "Search Issues"
4. Browse all matching issues in that repo

## 📊 Data Sources

- **Project List**: [GSSoC API](https://gssoc.girlscript.org/api/projects)
- **Issues**: [GitHub API](https://api.github.com)

Projects auto-update every 5 minutes.

## 🛠️ Building for Production

```bash
npm run build
npm run start
```

## 📝 License

MIT
