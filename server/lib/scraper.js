const fetch = require('node-fetch')

const GSSOC_PROJECTS_API = 'https://gssoc.girlscript.org/api/projects'
const CACHE_TTL_MS = 1000 * 60 * 5
let cachedProjects = null
let cachedAt = 0

async function getProjectsList() {
  if (cachedProjects && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedProjects
  }

  const resp = await fetch(GSSOC_PROJECTS_API)
  if (!resp.ok) throw new Error('Failed to fetch GSSoC project list')
  const json = await resp.json()

  if (!json || !Array.isArray(json.projects)) {
    throw new Error('Unexpected GSSoC project API response')
  }

  const projects = json.projects
    .map(project => ({
      owner: project.owner_repo?.split('/')[0] || null,
      repo: project.owner_repo?.split('/')[1] || null,
      owner_repo: project.owner_repo || null,
      repo_url: project.repo_url || null,
      project_name: project.name,
      description: project.description || '',
      difficulty: project.difficulty,
      admin_name: project.admin_name,
      admin_github: project.admin_github,
      has_beginner_issues: project.has_beginner_issues,
      good_first_count: project.good_first_count,
      unassigned_count: project.unassigned_count,
      tech_stack: Array.isArray(project.tech_stack) ? project.tech_stack : [],
      topics: Array.isArray(project.gh?.topics) ? project.gh.topics : []
    }))
    .filter(p => p.owner && p.repo)

  cachedProjects = projects
  cachedAt = Date.now()
  return projects
}

module.exports = { getProjectsList }
module.exports.getProjectsList = getProjectsList
