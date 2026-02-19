import { spawnSync } from 'child_process'

const targets = [
  {
    id: 'cursor-latency',
    label: '<50ms cursor sync latency',
    file: 'tests/e2e/perf-requirements.spec.ts',
    grep: 'cursor broadcast round-trip avg < 50ms',
  },
  {
    id: 'object-sync',
    label: '<100ms object sync latency',
    file: 'tests/e2e/perf-requirements.spec.ts',
    grep: 'object creation syncs to both clients within 100ms',
  },
  {
    id: 'concurrent-sync',
    label: '5+ concurrent users (object sync)',
    file: 'tests/e2e/perf-requirements.spec.ts',
    grep: '5 users all sync object creation',
  },
  {
    id: 'concurrent-presence',
    label: '5+ concurrent users (presence)',
    file: 'tests/e2e/perf-requirements.spec.ts',
    grep: '5 users see presence of all others',
  },
  {
    id: 'ai-latency',
    label: '<2s AI agent response time',
    file: 'tests/e2e/perf-ai-agent.spec.ts',
    grep: 'AI agent responds within 2000ms',
  },
]

const outcome = new Map()

for (const t of targets) {
  console.log(`\n=== Running target: ${t.label} ===`)
  const runId = `${Date.now()}-${t.id}`
  const res = spawnSync(
    'npx',
    ['playwright', 'test', '--project=perf', t.file, '-g', t.grep],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        PERF_RUN_ID: runId,
      },
    },
  )
  outcome.set(t.id, res.status === 0)
}

const passed = (id) => outcome.get(id) === true

const requirements = [
  {
    label: '<50ms cursor sync latency',
    pass: passed('cursor-latency'),
  },
  {
    label: '<100ms object sync latency',
    pass: passed('object-sync'),
  },
  {
    label: '<2s AI agent response time',
    pass: passed('ai-latency'),
  },
  {
    label: '5+ concurrent users per board',
    pass: passed('concurrent-sync') && passed('concurrent-presence'),
  },
]

console.log('\nPerformance Targets Summary')
for (const r of requirements) {
  console.log(`- ${r.pass ? 'PASS' : 'FAIL'}: ${r.label}`)
}

const allPass = requirements.every((r) => r.pass)
process.exit(allPass ? 0 : 1)
