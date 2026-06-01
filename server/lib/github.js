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
  
  if (difficulty && difficulty !== 'All') {
    projects = projects.filter(p => p.difficulty === difficulty)
  }
  
  shuffle(projects)
  const results = []
  const targetCount = 5
  const PROJECT_BATCH_SIZE = 5
  const ISSUE_BATCH_SIZE = 10

  for (let i = 0; i < projects.length; i += PROJECT_BATCH_SIZE) {
    if (results.length >= targetCount) break
    
    const batch = projects.slice(i, i + PROJECT_BATCH_SIZE)
    
    // Fetch open issues for projects in parallel
    const batchIssues = await Promise.allSettled(
      batch.map(async p => {
        const issues = await fetchOpenIssues(p.owner, p.repo)
        return { p, issues }
      })
    )

    const potentialIssues = []
    for (const result of batchIssues) {
      if (result.status === 'fulfilled' && result.value.issues) {
        const { p, issues } = result.value
        for (const issue of issues) {
          if (ownerOnly && issue.user?.toLowerCase() !== p.owner.toLowerCase()) {
            continue
          }
          potentialIssues.push({ p, issue })
        }
      }
    }

    // Validate issues in parallel batches
    for (let j = 0; j < potentialIssues.length; j += ISSUE_BATCH_SIZE) {
      if (results.length >= targetCount) break
      const issueBatch = potentialIssues.slice(j, j + ISSUE_BATCH_SIZE)
      
      const validatedResults = await Promise.allSettled(
        issueBatch.map(async ({ p, issue }) => {
          if (issue.comments > 0) {
            const commentAuthors = await fetchIssueCommentAuthors(issue.comments_url)
            if (hasHumanComments(commentAuthors, issue.user)) {
              return null
            }
          }
          const hasLinkedPR = await checkIssueHasLinkedPR(p.owner, p.repo, issue.number)
          if (hasLinkedPR) return null

          return {
            repo: `${p.owner}/${p.repo}`,
            title: issue.title,
            user: issue.user,
            comments: issue.comments,
            labels: issue.labels,
            html_url: issue.html_url,
            difficulty: p.difficulty,
            project_name: p.project_name
          }
        })
      )

      for (const vResult of validatedResults) {
        if (vResult.status === 'fulfilled' && vResult.value) {
          if (results.length < targetCount) {
            results.push(vResult.value)
          }
        }
      }
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

async function getStrictCountsForRepos(reposList, { ownerOnly = true } = {}) {
  const results = await Promise.allSettled(
    reposList.map(async ({ owner, repo }) => {
      try {
        const issues = await fetchOpenIssues(owner, repo)
        let strictCount = 0
        const MAX_COUNT = 5 // Cap the count at 5 for performance
        
        for (const issue of issues) {
          if (strictCount >= MAX_COUNT) break
          
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

          const hasLinkedPR = await checkIssueHasLinkedPR(owner, repo, issue.number)
          if (hasLinkedPR) continue

          strictCount++
        }
        
        return { owner_repo: `${owner}/${repo}`, strict_count: strictCount }
      } catch (error) {
        return { owner_repo: `${owner}/${repo}`, strict_count: 0 }
      }
    })
  )
  
  return results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean)
}

module.exports = { pickRandomIssueForRepos, findIssuesInRepo, getStrictCountsForRepos }
