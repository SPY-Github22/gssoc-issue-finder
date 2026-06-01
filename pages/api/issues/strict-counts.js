import { getStrictCountsForRepos } from '../../../server/lib/github'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { repos, ownerOnly = true } = req.body
    if (!Array.isArray(repos) || repos.length === 0) {
      return res.status(400).json({ error: 'repos must be a non-empty array' })
    }

    // Limit batch size to prevent excessive API calls
    if (repos.length > 20) {
      return res.status(400).json({ error: 'Max batch size is 20' })
    }

    const counts = await getStrictCountsForRepos(repos, { ownerOnly })
    res.status(200).json({ counts })
  } catch (error) {
    console.error('Error fetching strict counts:', error)
    res.status(500).json({ error: 'Failed to fetch strict counts' })
  }
}
