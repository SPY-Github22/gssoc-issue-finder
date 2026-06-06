import Head from 'next/head'
import { useEffect, useState } from 'react'

const DIFFICULTIES = ['All Levels', 'Beginner Friendly', 'Intermediate', 'Advanced']

const REPO_PLACEHOLDERS = [
  "e.g., 'mindscapev2'",
  "e.g., 'zeroly'",
  "e.g., 'gitfarm'",
  "e.g., 'AyurvaEase'",
  "e.g., 'CodeCraft'"
]

const SYNONYMS = {
  'ml': ['machine learning'],
  'machine learning': ['ml'],
  'ai': ['artificial intelligence'],
  'artificial intelligence': ['ai'],
  'js': ['javascript'],
  'javascript': ['js'],
  'reactjs': ['react'],
  'react.js': ['react'],
  'node': ['nodejs', 'node.js'],
  'nodejs': ['node', 'node.js'],
  'node.js': ['node', 'nodejs'],
  'ts': ['typescript'],
  'typescript': ['ts'],
  'frontend': ['front-end'],
  'front-end': ['frontend'],
  'backend': ['back-end'],
  'back-end': ['backend']
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isMatch(text, term) {
  if (!text) return false
  if (term.length <= 3) {
    const regex = new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, 'i')
    return regex.test(text)
  }
  return text.toLowerCase().includes(term.toLowerCase())
}

export default function Home() {

  const [repos, setRepos] = useState([])
  const [mode, setMode] = useState('search')
  const [ownerOnly, setOwnerOnly] = useState(true)
  const [difficulty, setDifficulty] = useState('All Levels')
  const [searchInput, setSearchInput] = useState('')
  const [topicInput, setTopicInput] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [repoPlaceholderIdx, setRepoPlaceholderIdx] = useState(0)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [leaderboardInput, setLeaderboardInput] = useState('')
  const [leaderboardPage, setLeaderboardPage] = useState(0)
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false)
  const [leaderboardResults, setLeaderboardResults] = useState([])
  const [leaderboardOffset, setLeaderboardOffset] = useState(0)
  const [hasMoreLeaderboard, setHasMoreLeaderboard] = useState(true)

  useEffect(() => {
    fetch('/api/repos').then(r => r.json()).then(setRepos).catch(() => setRepos([]))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setRepoPlaceholderIdx(i => (i + 1) % REPO_PLACEHOLDERS.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let timer
    if (loading) {
      timer = setInterval(() => {
        setTimeElapsed(prev => prev + 1)
      }, 1000)
    } else {
      setTimeElapsed(0)
    }
    return () => clearInterval(timer)
  }, [loading])

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const fetchLeaderboard = async (isNext = false) => {
    const topic = leaderboardInput.toLowerCase()
    if (!topic) return
    
    let searchTerms = [topic]
    if (SYNONYMS[topic]) {
      searchTerms = searchTerms.concat(SYNONYMS[topic])
    }

    // Find all matching repos locally
    const matching = repos.filter(r => {
      return searchTerms.some(term => 
        r.tech_stack.some(t => isMatch(t, term)) ||
        r.topics.some(t => isMatch(t, term)) ||
        isMatch(r.project_name, term) ||
        isMatch(r.description, term)
      )
    }).sort((a, b) => {
      return (b.unassigned_count || 0) - (a.unassigned_count || 0)
    })

    const newOffset = isNext ? leaderboardOffset + 10 : 0
    const takeCount = 10
    
    const batch = matching.slice(newOffset, newOffset + takeCount)
    if (batch.length === 0) {
      setHasMoreLeaderboard(false)
      if (!isNext) setLeaderboardResults([])
      return
    }

    setIsLeaderboardLoading(true)
    try {
      const payload = batch.map(r => {
        const [owner, repo] = r.owner_repo.split('/')
        return { owner, repo }
      })
      const res = await fetch('/api/issues/strict-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repos: payload, ownerOnly })
      })
      const data = await res.json()
      if (data.counts) {
        // map strict_counts back to batch
        const enriched = batch.map(r => {
          const match = data.counts.find(c => c.owner_repo === r.owner_repo)
          return { ...r, strict_count: match ? match.strict_count : 0 }
        })
        
        // Sort by strict_count desc
        enriched.sort((a, b) => b.strict_count - a.strict_count)
        
        // Take top 10
        setLeaderboardResults(enriched.slice(0, 10))
        setLeaderboardOffset(newOffset)
        setHasMoreLeaderboard(newOffset + takeCount < matching.length)
      }
    } catch (e) {
      console.error(e)
    }
    setIsLeaderboardLoading(false)
  }

  async function getRandom() {
    setLoading(true)
    setError(null)
    setResults([])
    const diffParam = difficulty === 'All Levels' ? '' : `&difficulty=${encodeURIComponent(difficulty)}`
    const res = await fetch(`/api/issues/random?ownerOnly=${ownerOnly}${diffParam}`)
    const data = await res.json()
    setLoading(false)
    if (data.error) {
      setError(data.error)
    } else {
      setResults(data.issues || [])
    }
  }

  async function searchRepo() {
    if (!searchInput && !topicInput) {
      setError('Please enter a repository name or tech stack to search')
      return
    }

    setLoading(true)
    setError(null)
    setResults([])
    
    const queryParams = new URLSearchParams({
      ownerOnly,
      ...(searchInput && { search: searchInput }),
      ...(topicInput && { topic: topicInput })
    })

    try {
      const res = await fetch(`/api/issues/search-all?${queryParams}`)
      const data = await res.json()
      
      setLoading(false)
      if (data.error) {
        setError(data.error)
      } else {
        if (data.count === 0 || !data.issues || data.issues.length === 0) {
          setError('No matching issues found')
        } else {
          setResults(data.issues)
        }
      }
    } catch (e) {
      setLoading(false)
      setError('Failed to fetch issues')
    }
  }

  return (
    <div style={styles.container}>
      <Head>
        <title>GSSoC Issue Finder</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: linear-gradient(135deg, #0b1120 0%, #111827 100%); min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e2e8f0; }
        `}</style>
      </Head>

      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.title}>GSSoC Issue Finder</h1>
        </div>

        <div style={styles.card}>
          <div style={styles.modeToggle}>
            <button
              onClick={() => setMode('search')}
              style={{...styles.modeBtn, ...(mode === 'search' ? styles.modeBtnActive : {})}}
            >
              Search Repo
            </button>
            <button
              onClick={() => setMode('random')}
              style={{...styles.modeBtn, ...(mode === 'random' ? styles.modeBtnActive : {})}}
            >
              Random Issue
            </button>
          </div>

          <div style={styles.filterSection}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={ownerOnly}
                onChange={e => setOwnerOnly(e.target.checked)}
              />
              <span style={{marginLeft: 8}}>Owner-opened issues only</span>
            </label>
          </div>

          {mode === 'random' ? (
            <div style={styles.randomSection}>
              <div style={styles.difficultyGroup}>
                <p style={styles.label}>Filter by Difficulty:</p>
                <div style={styles.difficultyButtons}>
                  {DIFFICULTIES.map(diff => (
                    <button
                      key={diff}
                      onClick={() => setDifficulty(diff)}
                      style={{
                        ...styles.diffBtn,
                        ...(difficulty === diff ? styles.diffBtnActive : {})
                      }}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={getRandom}
                disabled={loading}
                style={{...styles.primaryBtn, ...styles.randomBtn}}
              >
                {loading ? 'Finding issue...' : 'Find Random Issue'}
              </button>
              {loading && mode === 'random' && (
                <div style={styles.searchInfo}>
                  <div style={styles.timerClock}>{formatTime(timeElapsed)}</div>
                  <div>Searching... please wait, there are a lot of repositories to go through. This might take a while.</div>
                </div>
              )}
              {error && mode === 'random' && (
                <div style={styles.errorBox}>
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div style={styles.searchSection}>
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px',
                color: '#93c5fd',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <span style={{ fontSize: '20px' }}>💡</span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '4px', color: '#bfdbfe' }}>Quick Start Guide</strong>
                  1. Enter a language or tech stack (e.g., 'TypeScript') in the second box below.<br/>
                  2. Click the green <strong>Search Issues</strong> button to find your first issue!
                </div>
              </div>
              
              <p style={styles.label}>SELECT A REPOSITORY:</p>
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <input
                  type="text"
                  placeholder={`Search by repository name... (${REPO_PLACEHOLDERS[repoPlaceholderIdx]})`}
                  value={searchInput}
                  onChange={e => { setSearchInput(e.target.value); setError(null) }}
                  style={styles.searchInput}
                  onKeyDown={e => e.key === 'Enter' && searchRepo()}
                />
                <input
                  type="text"
                  placeholder="Search by topic/tech stack... (e.g., 'AI/ML', 'TypeScript')"
                  value={topicInput}
                  onChange={e => { setTopicInput(e.target.value); setError(null) }}
                  style={styles.searchInput}
                  onKeyDown={e => e.key === 'Enter' && searchRepo()}
                />
              </div>
              <button
                onClick={searchRepo}
                disabled={(!searchInput && !topicInput) || loading}
                style={{...styles.primaryBtn, ...styles.searchBtn}}
              >
                {loading ? 'Searching...' : 'Search Issues'}
              </button>
              <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
                <em>Note: Repos that are most relevant will be displayed.</em>
              </div>
              {loading && mode === 'search' && (
                <div style={styles.searchInfo}>
                  <div style={styles.timerClock}>{formatTime(timeElapsed)}</div>
                  <div>Searching... please wait, there are a lot of repositories to go through. This might take a while.</div>
                </div>
              )}
              {error && mode === 'search' && (
                <div style={styles.errorBox}>
                  {error}
                </div>
              )}
              <div style={{...styles.repoResults, borderTop: '1px solid #1f2937', paddingTop: '24px', marginTop: '32px'}}>
                <h2 style={{...styles.resultsTitle, color: '#38bdf8'}}>Top Verified Projects (Leaderboard)</h2>
                <p style={{color: '#94a3b8', fontSize: '14px', marginBottom: '16px'}}>
                  Enter a tech stack. We will batch scan projects on GitHub for strict workable issues (0 human comments, no PRs) and rank the top 10!
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="text"
                    placeholder="Enter a tech stack (e.g. 'React', 'Python')..."
                    value={leaderboardInput}
                    onChange={e => setLeaderboardInput(e.target.value)}
                    style={{...styles.searchInput, flex: 1}}
                    onKeyDown={e => e.key === 'Enter' && fetchLeaderboard(false)}
                  />
                  <button
                    onClick={() => fetchLeaderboard(false)}
                    disabled={isLeaderboardLoading || !leaderboardInput}
                    style={{...styles.primaryBtn, background: '#38bdf8', color: '#0f172a', whiteSpace: 'nowrap'}}
                  >
                    {isLeaderboardLoading ? 'Scanning...' : 'Search Live'}
                  </button>
                </div>
                
                {isLeaderboardLoading && (
                  <div style={{marginTop: '24px', textAlign: 'center', color: '#38bdf8', fontWeight: '500'}}>
                    Scanning live issues on GitHub... this might take 5-10 seconds!
                  </div>
                )}

                {!isLeaderboardLoading && leaderboardResults.length > 0 && (
                  <div style={{marginTop: '24px'}}>
                    <div style={styles.issuesList}>
                      {leaderboardResults.map(repo => (
                        <a key={repo.owner_repo} style={styles.issueCard} href={repo.repo_url} target="_blank" rel="noreferrer">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h3 style={styles.issueTitle}>{repo.project_name}</h3>
                            <span style={{...styles.openIssuesBadge, background: '#38bdf8', color: '#0f172a'}}>
                              {repo.strict_count}{repo.strict_count === 5 ? '+' : ''} strict open issues
                            </span>
                          </div>
                          <div style={styles.issueMeta}>
                            <span>{repo.owner_repo}</span>
                            <span>{repo.difficulty}</span>
                          </div>
                          <div style={styles.labelsContainer}>
                            {repo.tech_stack.slice(0, 4).map((tag, i) => (
                              <span key={i} style={styles.repoTag}>{tag}</span>
                            ))}
                            {repo.topics.slice(0, 4).map((tag, i) => (
                              <span key={`topic-${i}`} style={styles.repoTag}>{tag}</span>
                            ))}
                          </div>
                        </a>
                      ))}
                    </div>
                    {hasMoreLeaderboard && (
                      <div style={{...styles.pagination, justifyContent: 'flex-end'}}>
                        <button 
                          onClick={() => fetchLeaderboard(true)}
                          disabled={isLeaderboardLoading}
                          style={styles.pageBtn}
                        >
                          Scan Next Batch →
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {!isLeaderboardLoading && leaderboardInput && leaderboardResults.length === 0 && (
                  <div style={{marginTop: '16px', color: '#94a3b8', fontSize: '14px'}}>
                    No projects scanned yet, or no projects found.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div style={styles.resultsSection}>
            <h2 style={styles.resultsTitle}>
              {mode === 'random' ? `${results.length} Random Issues` : `${results.length} Matching Issues`}
            </h2>
            <div style={styles.issuesList}>
              {results.map((issue, idx) => (
                <a
                  key={idx}
                  href={issue.html_url}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.issueCard}
                >
                  <h3 style={styles.issueTitle}>{issue.title}</h3>
                  <div style={styles.issueMeta}>
                    <span>Repo: {issue.repo}</span>
                    <span>User: {issue.user}</span>
                    <span>{issue.comments} comments</span>
                  </div>
                  {issue.labels.length > 0 && (
                    <div style={styles.labelsContainer}>
                      {issue.labels.map((label, i) => (
                        <span key={i} style={{...styles.label, display: 'inline-block', padding: '4px 8px', background: '#1f2937', borderRadius: '4px', fontSize: '13px', fontWeight: '500', color: '#e2e8f0'}}>
                          {label.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={styles.footer}>
                    <span style={{...styles.badge, backgroundColor: getDifficultyColor(issue.difficulty)}}>
                      {issue.difficulty}
                    </span>
                    <span style={styles.footerText}>Click to open on GitHub →</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function getDifficultyColor(difficulty) {
  switch (difficulty) {
    case 'Beginner Friendly':
      return '#10b981'
    case 'Intermediate':
      return '#f59e0b'
    case 'Advanced':
      return '#ef4444'
    default:
      return '#475569'
  }
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0b1120 0%, #111827 100%)',
    padding: '20px'
  },
  main: {
    maxWidth: '900px',
    margin: '0 auto'
  },
  header: {
    textAlign: 'center',
    color: '#e2e8f0',
    marginBottom: '40px',
    paddingTop: '20px'
  },
  title: {
    fontSize: '48px',
    fontWeight: 'bold',
    marginBottom: '12px'
  },
  subtitle: {
    fontSize: '18px',
    color: '#cbd5e1'
  },
  card: {
    background: '#111827',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '24px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
    border: '1px solid rgba(148, 163, 184, 0.15)'
  },
  modeToggle: {
    display: 'flex',
    gap: '12px',
    marginBottom: '28px'
  },
  modeBtn: {
    flex: 1,
    padding: '12px 20px',
    border: '2px solid #334155',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: '#0f172a',
    color: '#cbd5e1'
  },
  modeBtnActive: {
    background: '#334155',
    color: '#e2e8f0',
    borderColor: 'transparent'
  },
  filterSection: {
    marginBottom: '24px',
    padding: '16px',
    background: '#0f172a',
    borderRadius: '12px',
    border: '1px solid #334155'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    color: '#cbd5e1'
  },
  randomSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  difficultyGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  difficultyButtons: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  diffBtn: {
    padding: '10px 16px',
    border: '2px solid #334155',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: '#0f172a',
    color: '#cbd5e1'
  },
  diffBtnActive: {
    background: '#334155',
    color: '#e2e8f0',
    borderColor: 'transparent'
  },
  searchSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  searchInput: {
    padding: '12px 16px',
    border: '2px solid #334155',
    borderRadius: '12px',
    fontSize: '16px',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
    background: '#0f172a',
    color: '#e2e8f0'
  },
  primaryBtn: {
    padding: '14px 24px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    color: 'white',
    background: '#16a34a'
  },
  randomBtn: {
    width: '100%'
  },
  searchBtn: {
    width: '100%'
  },
  errorBox: {
    background: '#581c1c',
    color: '#fee2e2',
    padding: '16px',
    borderRadius: '12px',
    marginBottom: '24px',
    border: '2px solid #991b1b',
    fontSize: '16px'
  },
  resultsSection: {
    animation: 'slideUp 0.3s ease'
  },
  resultsTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: '16px'
  },
  issuesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  issueCard: {
    display: 'block',
    background: '#111827',
    borderRadius: '12px',
    padding: '20px',
    textDecoration: 'none',
    color: '#e2e8f0',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
    border: '1px solid #1f2937'
  },
  issueTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: '12px',
    lineHeight: '1.4'
  },
  issueMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '14px',
    color: '#94a3b8',
    marginBottom: '12px'
  },
  repoResults: {
    marginTop: '24px'
  },
  repoTag: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '999px',
    background: '#1f2937',
    color: '#cbd5e1',
    fontSize: '12px',
    fontWeight: '600'
  },
  labelsContainer: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '12px'
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '12px',
    borderTop: '1px solid #1f2937'
  },
  searchInfo: {
    marginBottom: '24px',
    padding: '24px 16px',
    borderRadius: '14px',
    background: '#0f172a',
    color: '#cbd5e1',
    border: '1px solid #334155',
    fontSize: '15px',
    lineHeight: '1.6',
    textAlign: 'center',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
  },
  timerClock: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#38bdf8',
    marginBottom: '12px',
    fontFamily: 'monospace',
    letterSpacing: '2px'
  },
  badge: {
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    color: 'white'
  },
  footerText: {
    fontSize: '13px',
    color: '#94a3b8',
    fontWeight: '500'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '20px'
  },
  pageBtn: {
    padding: '8px 16px',
    background: '#1f2937',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s ease'
  },
  pageBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  pageText: {
    color: '#94a3b8',
    fontSize: '14px',
    fontWeight: '500'
  },
  openIssuesBadge: {
    background: '#16a34a',
    color: 'white',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    marginLeft: '12px'
  }
}
