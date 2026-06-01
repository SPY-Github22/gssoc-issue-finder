import Head from 'next/head'
import { useEffect, useState } from 'react'

const DIFFICULTIES = ['All Levels', 'Beginner Friendly', 'Intermediate', 'Advanced']

export default function Home() {
  const [repos, setRepos] = useState([])
  const [mode, setMode] = useState('random')
  const [ownerOnly, setOwnerOnly] = useState(true)
  const [difficulty, setDifficulty] = useState('All Levels')
  const [selectedRepo, setSelectedRepo] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [topicInput, setTopicInput] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/repos').then(r => r.json()).then(setRepos).catch(() => setRepos([]))
  }, [])

  const filteredRepos = repos.filter(r => {
    const query = searchInput.toLowerCase()
    const topic = topicInput.toLowerCase()
    const matchesSearch =
      r.project_name.toLowerCase().includes(query) ||
      r.owner_repo.toLowerCase().includes(query) ||
      r.description.toLowerCase().includes(query)

    const matchesTopic = !topic ||
      r.tech_stack.some(t => t.toLowerCase().includes(topic)) ||
      r.topics.some(t => t.toLowerCase().includes(topic)) ||
      r.project_name.toLowerCase().includes(topic) ||
      r.description.toLowerCase().includes(topic)

    return matchesSearch && matchesTopic
  })

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
    let repoToSearch = selectedRepo
    if (!repoToSearch && filteredRepos.length > 0) {
      repoToSearch = filteredRepos[0].owner_repo
      setSelectedRepo(repoToSearch)
    }

    if (!repoToSearch) {
      setError('Please select a repository or enter a matching query/topic')
      return
    }

    setLoading(true)
    setError(null)
    setResults([])
    const res = await fetch(`/api/issues/search?repo=${repoToSearch}&ownerOnly=${ownerOnly}`)
    const data = await res.json()
    setLoading(false)
    if (data.error) {
      setError(data.error)
    } else {
      if (data.count === 0) {
        setError('No matching issues found in this repository')
      } else {
        setResults(data.issues)
      }
    }
  }

  const repoDisplay = repos.find(r => r.owner_repo === selectedRepo)

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
          <p style={styles.subtitle}>Discover open-source issues with zero human comments</p>
        </div>

        <div style={styles.card}>
          <div style={styles.modeToggle}>
            <button
              onClick={() => setMode('random')}
              style={{...styles.modeBtn, ...(mode === 'random' ? styles.modeBtnActive : {})}}
            >
              Random Issue
            </button>
            <button
              onClick={() => setMode('search')}
              style={{...styles.modeBtn, ...(mode === 'search' ? styles.modeBtnActive : {})}}
            >
              Search Repo
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
            </div>
          ) : (
            <div style={styles.searchSection}>
              <p style={styles.label}>Select a Repository:</p>
              <input
                type="text"
                placeholder="Search repositories... (e.g., 'react', 'python')"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={styles.searchInput}
              />
              <input
                type="text"
                placeholder="Search by topic/tech stack... (e.g., 'AI/ML', 'TypeScript')"
                value={topicInput}
                onChange={e => setTopicInput(e.target.value)}
                style={styles.searchInput}
              />
              {(searchInput || topicInput) && (
                <div style={styles.dropdown}>
                  {filteredRepos.slice(0, 10).map(r => (
                    <div
                      key={r.owner_repo}
                      onClick={() => {
                        setSelectedRepo(r.owner_repo)
                        setSearchInput('')
                      }}
                      style={styles.dropdownItem}
                    >
                      <div style={styles.dropdownTitle}>{r.project_name}</div>
                      <div style={styles.dropdownMeta}>{r.owner_repo} • {r.difficulty}</div>
                      {r.tech_stack.length > 0 && (
                        <div style={styles.dropdownMeta}>{r.tech_stack.slice(0, 4).join(', ')}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {selectedRepo && (
                <div style={styles.selectedRepo}>
                  <span style={styles.selectedRepoText}>{repoDisplay?.project_name}</span>
                  <button
                    onClick={() => setSelectedRepo('')}
                    style={styles.clearBtn}
                  >
                    Clear
                  </button>
                </div>
              )}
              <button
                onClick={searchRepo}
                disabled={(!selectedRepo && filteredRepos.length === 0) || loading}
                style={{...styles.primaryBtn, ...styles.searchBtn}}
              >
                {loading ? 'Searching...' : 'Search Issues'}
              </button>
              {loading && (
                <div style={styles.searchInfo}>
                  Searching... please wait, there are a lot of repositories to go through. This might take a while.
                </div>
              )}
              {!selectedRepo && (searchInput || topicInput) && filteredRepos.length > 0 && (
                <div style={styles.repoResults}>
                  <h2 style={styles.resultsTitle}>Top matching repositories</h2>
                  <div style={styles.issuesList}>
                    {filteredRepos.slice(0, 5).map(repo => (
                      <div key={repo.owner_repo} style={styles.issueCard}>
                        <h3 style={styles.issueTitle}>{repo.project_name}</h3>
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div style={styles.resultsSection}>
            <h2 style={styles.resultsTitle}>
              {mode === 'random' ? `${results.length} Random Issues` : `${results.length} Issues in ${selectedRepo}`}
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
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: '#111827',
    border: '2px solid #334155',
    borderTop: 'none',
    borderRadius: '0 0 12px 12px',
    maxHeight: '300px',
    overflowY: 'auto',
    zIndex: 10
  },
  dropdownItem: {
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
    borderBottom: '1px solid #1f2937',
    color: '#e2e8f0'
  },
  dropdownTitle: {
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: '4px'
  },
  dropdownMeta: {
    fontSize: '13px',
    color: '#94a3b8'
  },
  selectedRepo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#111827',
    borderRadius: '12px',
    border: '2px solid #334155'
  },
  selectedRepoText: {
    fontWeight: '600',
    color: '#e2e8f0'
  },
  clearBtn: {
    background: 'none',
    border: '1px solid #334155',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '8px 12px',
    color: '#cbd5e1'
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
    marginTop: '16px',
    padding: '14px 16px',
    borderRadius: '14px',
    background: '#111827',
    color: '#cbd5e1',
    border: '1px solid #334155',
    fontSize: '14px',
    lineHeight: '1.6'
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
  }
}
