const fetch = require('node-fetch')
const { getProjectsList } = require('./scraper')

const GITHUB_API_URL = 'https://api.github.com'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''

function getGitHubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'gssoc-issue-finder'
  }
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`
  }
  return headers
}

function isBotUsername(name) {
  if (!name) return false
  return /bot/i.test(name) || /\[bot\]$/i.test(name)
}

async function checkIssueHasLinkedPR(owner, repo, issueNumber) {
  // Check if issue has any associated/linked pull requests by checking its timeline
  const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/issues/${issueNumber}/timeline?per_page=50`
  const r = await fetch(url, { headers: getGitHubHeaders() })
  if (!r.ok) return false
  const events = await r.json()
  if (!Array.isArray(events)) return false

  // Look for connected_pr events or PR references
  return events.some(event =>
    event.event === 'connected' ||
    event.event === 'cross-referenced' ||
    (event.source && event.source.issue && event.source.issue.pull_request)
  )
}

async function fetchOpenIssues(owner, repo) {
  const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/issues?state=open&per_page=30`
  const r = await fetch(url, { headers: getGitHubHeaders() })
  if (!r.ok) return []
  const items = await r.json()
  if (!Array.isArray(items)) return []

  return items
    .filter(issue => !issue.pull_request)
    .map(issue => ({
      number: issue.number,
      title: issue.title,
      html_url: issue.html_url,
      user: issue.user?.login || null,
      comments: issue.comments || 0,
      comments_url: issue.comments_url || null,
      labels: Array.isArray(issue.labels)
        ? issue.labels.map(label => ({ name: label.name }))
        : []
    }))
}

async function fetchIssueCommentAuthors(commentsUrl) {
  if (!commentsUrl) return []
  const url = `${commentsUrl}?per_page=100`
  const r = await fetch(url, { headers: getGitHubHeaders() })
  if (!r.ok) return []
  const items = await r.json()
  if (!Array.isArray(items)) return []
  return items.map(comment => comment.user?.login).filter(Boolean)
}

function hasHumanComments(commentAuthors, issueAuthor) {
  return commentAuthors.some(author =>
    author && !isBotUsername(author) && author.toLowerCase() !== issueAuthor?.toLowerCase()
  )
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
}

async function pickRandomIssueForRepos({ ownerOnly = true, difficulty = null } = {}) {
  let projects = await getProjectsList()
  
  // Filter by difficulty if specified
  if (difficulty && difficulty !== 'All') {
    projects = projects.filter(p => p.difficulty === difficulty)
  }
  
  shuffle(projects)
  const results = []
  const targetCount = 5

  for (const p of projects) {
    if (results.length >= targetCount) break
    
    try {
      const issues = await fetchOpenIssues(p.owner, p.repo)
      for (const issue of issues) {
        if (results.length >= targetCount) break
        
        if (ownerOnly && issue.user?.toLowerCase() !== p.owner.toLowerCase()) {
          continue
        }

        let commentAuthors = []
        if (issue.comments > 0) {
          commentAuthors = await fetchIssueCommentAuthors(issue.comments_url)
          if (hasHumanComments(commentAuthors, issue.user)) {
            continue
          }
        }

        // Check if issue is linked to a PR
        const hasLinkedPR = await checkIssueHasLinkedPR(p.owner, p.repo, issue.number)
        if (hasLinkedPR) continue

        results.push({
          repo: `${p.owner}/${p.repo}`,
          title: issue.title,
          user: issue.user,
          comments: issue.comments,
          labels: issue.labels,
          html_url: issue.html_url,
          difficulty: p.difficulty,
          project_name: p.project_name
        })
      }
    } catch (error) {
      continue
    }
  }

  return results.length > 0 ? results : null
}

async function findIssuesInRepo(owner, repo, { ownerOnly = true } = {}) {
  const projects = await getProjectsList()
  const project = projects.find(
    p => p.owner.toLowerCase() === owner.toLowerCase() && p.repo.toLowerCase() === repo.toLowerCase()
  )

  if (!project) return []

  try {
    const issues = await fetchOpenIssues(owner, repo)
    const results = []
    const targetCount = 5

    for (const issue of issues) {
      if (results.length >= targetCount) break
      
      if (ownerOnly && issue.user?.toLowerCase() !== owner.toLowerCase()) {
        continue
      }

      let commentAuthors = []
      if (issue.comments > 0) {
        commentAuthors = await fetchIssueCommentAuthors(issue.comments_url)
        if (hasHumanComments(commentAuthors, issue.user)) {
          continue
        }
      }

      // Check if issue is linked to a PR
      const hasLinkedPR = await checkIssueHasLinkedPR(owner, repo, issue.number)
      if (hasLinkedPR) continue

      results.push({
        repo: `${owner}/${repo}`,
        title: issue.title,
        user: issue.user,
        comments: issue.comments,
        labels: issue.labels,
        html_url: issue.html_url,
        difficulty: project.difficulty,
        project_name: project.project_name
      })
    }

    return results
  } catch (error) {
    return []
  }
}

module.exports = { pickRandomIssueForRepos, findIssuesInRepo }
