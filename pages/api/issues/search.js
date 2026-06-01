const { findIssuesInRepo } = require('../../../server/lib/github')

export default async function handler(req, res) {
  const { repo } = req.query
  const ownerOnly = req.query.ownerOnly === 'true' || req.query.ownerOnly === '1'

  if (!repo) {
    return res.status(400).json({ error: 'Missing repo parameter (format: owner/repo)' })
  }

  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) {
    return res.status(400).json({ error: 'Invalid repo format. Use: owner/repo' })
  }

  try {
    const issues = await findIssuesInRepo(owner, repoName, { ownerOnly })
    res.status(200).json({ issues, count: issues.length })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
}
