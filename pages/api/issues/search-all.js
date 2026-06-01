import { findIssuesBySearch } from '../../../server/lib/github'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { search, topic, ownerOnly } = req.query
    const isOwnerOnly = ownerOnly === 'true'
    
    // We target 10 issues for cross-repo search to give a good variety
    const issues = await findIssuesBySearch(search, topic, { 
      ownerOnly: isOwnerOnly,
      targetCount: 10
    })

    if (!issues) {
      return res.status(404).json({ error: 'No matching issues found', count: 0 })
    }

    res.status(200).json({ issues, count: issues.length })
  } catch (error) {
    console.error('Error in cross-repo search:', error)
    res.status(500).json({ error: 'Failed to search issues' })
  }
}
