const { pickRandomIssueForRepos } = require('../../../server/lib/github')

export default async function handler(req, res) {
  const ownerOnly = req.query.ownerOnly === 'true' || req.query.ownerOnly === '1'
  const difficulty = req.query.difficulty || null
  try {
    const issues = await pickRandomIssueForRepos({ ownerOnly, difficulty })
    if (!issues || issues.length === 0) return res.status(404).json({ error: 'No matching issues found' })
    res.status(200).json({ issues, count: issues.length })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
}
