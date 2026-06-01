# GSSoC Issue Finder

A minimal Next.js application that helps contributors find open, workable issues in GirlScript Summer of Code (GSSoC) repositories. It scans repositories and surfaces issues that are genuinely untouched and ready for assignment.

## Features

- Tech Stack Search: Search for issues by technology (e.g., React, Python). Includes smart synonym matching (e.g., searching for "ML" automatically matches "Machine Learning", "JS" matches "JavaScript").
- Random Issue Picker: Instantly fetches a random workable issue if you don't know where to start.
- Live Leaderboard: Displays a real-time ranking of GSSoC repositories based on the highest number of currently open, unclaimed issues.

## Edge Cases Handled

To ensure only high-quality, workable issues are displayed, the backend incorporates strict filtering logic to handle the following edge cases:

- Bot Comments Ignored: Comments made by known automated bots (Github Actions, Vercel, Snyk, Dependabot, GSSoC Bot, etc.) are ignored. An issue is still considered untouched if only a bot has replied to it.
- Human Claim Detection: If a human user (other than the issue author) has commented on the issue, it is assumed they are asking to be assigned, and the issue is filtered out.
- Pull Request Checking: The application checks the GitHub timeline API to verify if an issue has a linked Pull Request. Issues with open, non-draft Pull Requests are excluded, even if they have no assignees.
- Owner Verification: Only issues opened directly by the repository owner or maintainer are considered valid. Issues opened by random external contributors are ignored.
- Announcement Filtering: Broadcasts and repository announcements (e.g., issues containing keywords like "important", "announcement", "notice", or "reminder" in the title) are identified and excluded.
- Unassigned Filter: The API actively filters out issues that already have an assignee designated.
- API Timeout Protection: Serverless function limits (like Vercel's 10-second timeout) are mitigated using a 7.5-second graceful abort strategy. If the GitHub API takes too long, the backend safely returns partial data instead of crashing.

## Usage (Local Development)

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

The application relies on GitHub's public API. For higher rate limits, configure a GitHub Personal Access Token as a GITHUB_TOKEN environment variable.
