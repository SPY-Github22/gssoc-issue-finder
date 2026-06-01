const { getProjectsList } = require('../../server/lib/scraper')

export default async function handler(req, res) {
  try {
    const list = await getProjectsList()
    res.status(200).json(list)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
}
