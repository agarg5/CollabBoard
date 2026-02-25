#!/usr/bin/env node
/**
 * Script to record a video demo of the fun board
 * Usage: npm run record-fun-board-video
 * 
 * This script uses Playwright to:
 * 1. Start the dev server
 * 2. Navigate to the fun board
 * 3. Record a video showing the board and interactions
 * 4. Save the video to scripts/fun-board-demo.webm
 */

import { chromium, type Browser, type Page } from 'playwright'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5199'
const FUN_BOARD_ID = '11111111-1111-1111-1111-111111111111'

let devServer: ReturnType<typeof spawn> | null = null

async function startDevServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting dev server...')
    devServer = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5199', '--strictPort'], {
      env: { ...process.env, VITE_DEV_BYPASS_AUTH: 'true' },
      stdio: 'pipe',
    })

    let output = ''
    devServer.stdout?.on('data', (data) => {
      output += data.toString()
      if (output.includes('Local:') || output.includes('ready')) {
        console.log('✅ Dev server started')
        resolve()
      }
    })

    devServer.stderr?.on('data', (data) => {
      const msg = data.toString()
      if (msg.includes('EADDRINUSE')) {
        console.log('ℹ️  Dev server already running on port 5199')
        resolve()
      } else if (msg.includes('error')) {
        console.error('❌ Dev server error:', msg)
      }
    })

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!output.includes('Local:') && !output.includes('ready')) {
        console.log('⚠️  Dev server may already be running, continuing...')
        resolve()
      }
    }, 30000)
  })
}

async function stopDevServer(): Promise<void> {
  if (devServer) {
    console.log('🛑 Stopping dev server...')
    devServer.kill()
    devServer = null
  }
}

async function waitForServer(page: Page): Promise<void> {
  console.log('⏳ Waiting for server to be ready...')
  for (let i = 0; i < 30; i++) {
    try {
      const response = await page.goto(BASE_URL, { timeout: 5000, waitUntil: 'domcontentloaded' })
      if (response && response.ok()) {
        console.log('✅ Server is ready')
        return
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error('Server did not become ready in time')
}

async function recordVideo(): Promise<void> {
  const browser = await chromium.launch({
    headless: false, // Show browser for better video
    args: ['--disable-blink-features=AutomationControlled'],
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: join(__dirname, 'videos'),
      size: { width: 1920, height: 1080 },
    },
  })

  const page = await context.newPage()

  try {
    // Navigate to the app
    console.log('📱 Navigating to app...')
    await waitForServer(page)
    await page.goto(BASE_URL)
    await page.waitForSelector('text=My Boards', { timeout: 10000 })

    // Wait a moment for the page to fully load
    await page.waitForTimeout(1000)

    // Try to find the fun board or navigate to it directly
    console.log('🎨 Looking for Fun Board...')
    const funBoardLink = page.getByText('Fun Board 🎉').first()
    
    if (await funBoardLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('✅ Found Fun Board, clicking...')
      await funBoardLink.click()
    } else {
      // Try navigating directly to the board
      console.log('🔗 Navigating directly to board...')
      await page.goto(`${BASE_URL}/board/${FUN_BOARD_ID}`)
    }

    // Wait for canvas to load
    console.log('⏳ Waiting for canvas...')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000) // Give time for objects to render

    // Pan to show the board better (center on the frame area)
    console.log('📐 Panning canvas...')
    const canvas = page.locator('canvas').first()
    const box = await canvas.boundingBox()
    if (box) {
      // Click and drag to pan
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2 - 100, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(500)
    }

    // Zoom in a bit
    console.log('🔍 Zooming in...')
    await page.keyboard.press('Control+=') // Zoom in
    await page.waitForTimeout(500)
    await page.keyboard.press('Control+=') // Zoom in again
    await page.waitForTimeout(1000)

    // Pan to center the fun board content
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(1000)
    }

    // Click on a sticky note to show interaction
    console.log('🖱️  Interacting with objects...')
    if (box) {
      // Click on the first sticky note (around 150, 180 in board coordinates)
      // Adjust for pan/zoom
      await page.mouse.click(box.x + box.width / 2 - 100, box.y + box.height / 2 - 150)
      await page.waitForTimeout(500)
      
      // Click elsewhere to deselect
      await page.mouse.click(box.x + box.width / 2 + 200, box.y + box.height / 2 + 200)
      await page.waitForTimeout(500)
    }

    // Pan around to show more of the board
    console.log('📊 Showing more of the board...')
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 300, box.y + box.height / 2, { steps: 20 })
      await page.mouse.up()
      await page.waitForTimeout(1000)
    }

    // Final pause to show the full board
    console.log('📸 Final shot...')
    await page.waitForTimeout(2000)

    console.log('✅ Recording complete!')
  } catch (error) {
    console.error('❌ Error during recording:', error)
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
}

async function main() {
  try {
    // Ensure videos directory exists
    const videosDir = join(__dirname, 'videos')
    if (!existsSync(videosDir)) {
      const { mkdirSync } = await import('fs')
      mkdirSync(videosDir, { recursive: true })
    }

    await startDevServer()
    await new Promise((resolve) => setTimeout(resolve, 3000)) // Give server time to fully start

    await recordVideo()

    // Find the recorded video
    const videosDir = join(__dirname, 'videos')
    const { readdirSync } = await import('fs')
    const videos = readdirSync(videosDir).filter((f) => f.endsWith('.webm'))
    
    if (videos.length > 0) {
      const latestVideo = videos.sort().reverse()[0]
      const videoPath = join(videosDir, latestVideo)
      const outputPath = join(__dirname, 'fun-board-demo.webm')
      
      // Copy to a more accessible location
      const { copyFileSync } = await import('fs')
      copyFileSync(videoPath, outputPath)
      
      console.log(`\n🎉 Video saved to: ${outputPath}`)
      console.log(`📁 Also available in: ${videoPath}`)
    } else {
      console.log('⚠️  No video file found in videos directory')
    }
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  } finally {
    await stopDevServer()
  }
}

main()
