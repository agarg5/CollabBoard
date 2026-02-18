import { defineConfig } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env so VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are available to tests
const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '.env')
try {
  const envFile = readFileSync(envPath, 'utf-8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx)
    const value = trimmed.slice(eqIdx + 1)
    if (!process.env[key]) process.env[key] = value
  }
} catch {
  // .env file is optional (CI may set env vars directly)
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 4,
  projects: [
    {
      name: 'default',
      testIgnore: /perf-/,
    },
    {
      name: 'perf',
      testMatch: /perf-.*\.spec\.ts$/,
      timeout: 120_000,
      use: {
        video: 'off',
      },
    },
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_DEV_BYPASS_AUTH: 'true',
    },
  },
})
