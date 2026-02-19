import { existsSync, readFileSync } from 'fs'

const RESULTS_FILE = 'test-results/perf-results.json'

if (!existsSync(RESULTS_FILE)) {
  console.error('Perf summary: missing test-results/perf-results.json')
  process.exit(1)
}

const results = JSON.parse(readFileSync(RESULTS_FILE, 'utf-8'))
if (!Array.isArray(results) || results.length === 0) {
  console.error('Perf summary: no perf results found')
  process.exit(1)
}

const latestByTest = new Map()
for (const r of results) latestByTest.set(r.test, r)

const fmt = (v) => (typeof v === 'number' ? `${v}` : String(v))

const checks = [
  {
    target: '60 FPS during pan/zoom/object manipulation',
    tests: ['500-object-fps-pan', '500-object-fps-zoom'],
    pass: () =>
      latestByTest.get('500-object-fps-pan')?.passed === true &&
      latestByTest.get('500-object-fps-zoom')?.passed === true,
    details: () => {
      const pan = latestByTest.get('500-object-fps-pan')?.metrics?.avg
      const zoom = latestByTest.get('500-object-fps-zoom')?.metrics?.avg
      return `pan avg=${fmt(pan)} fps, zoom avg=${fmt(zoom)} fps`
    },
  },
  {
    target: '500+ objects on canvas without performance drops',
    tests: ['500-object-fps-pan', '500-object-fps-zoom'],
    pass: () =>
      latestByTest.get('500-object-fps-pan')?.passed === true &&
      latestByTest.get('500-object-fps-zoom')?.passed === true,
    details: () => {
      const panFrames = latestByTest.get('500-object-fps-pan')?.metrics?.frameCount
      const zoomFrames = latestByTest.get('500-object-fps-zoom')?.metrics?.frameCount
      return `500-object tests executed (pan frames=${fmt(panFrames)}, zoom frames=${fmt(zoomFrames)})`
    },
  },
  {
    target: '<50ms cursor sync latency',
    tests: ['cursor-latency'],
    pass: () => latestByTest.get('cursor-latency')?.passed === true,
    details: () => {
      const m = latestByTest.get('cursor-latency')?.metrics
      return `avg=${fmt(m?.avg)}ms, min=${fmt(m?.min)}ms, max=${fmt(m?.max)}ms`
    },
  },
  {
    target: '<100ms object sync latency',
    tests: ['object-sync-latency'],
    pass: () => latestByTest.get('object-sync-latency')?.passed === true,
    details: () => {
      const m = latestByTest.get('object-sync-latency')?.metrics
      return `latencyA=${fmt(m?.latencyA)}ms, latencyB=${fmt(m?.latencyB)}ms`
    },
  },
  {
    target: '<2s AI agent response time',
    tests: ['ai-agent-response-latency'],
    pass: () => latestByTest.get('ai-agent-response-latency')?.passed === true,
    details: () => {
      const m = latestByTest.get('ai-agent-response-latency')?.metrics
      return `elapsed=${fmt(m?.elapsedMs)}ms, status=${fmt(m?.status)}`
    },
  },
  {
    target: '5+ concurrent users per board',
    tests: ['5-user-sync', '5-user-presence'],
    pass: () =>
      latestByTest.get('5-user-sync')?.passed === true &&
      latestByTest.get('5-user-presence')?.passed === true,
    details: () => {
      const sync = latestByTest.get('5-user-sync')?.passed
      const presence = latestByTest.get('5-user-presence')?.passed
      return `sync=${fmt(sync)}, presence=${fmt(presence)}`
    },
  },
]

let allPass = true

console.log('\nPerformance Targets Summary')
for (const check of checks) {
  const missing = check.tests.filter((name) => !latestByTest.has(name))
  if (missing.length > 0) {
    allPass = false
    console.log(`- FAIL: ${check.target} (missing results: ${missing.join(', ')})`)
    continue
  }

  const passed = check.pass()
  allPass = allPass && passed
  console.log(`- ${passed ? 'PASS' : 'FAIL'}: ${check.target} (${check.details()})`)
}

if (!allPass) process.exit(1)
