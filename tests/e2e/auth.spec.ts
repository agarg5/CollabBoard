import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = `test-${Date.now()}@collabboard.test`
const TEST_PASSWORD = 'TestPass123!'

test.describe('Auth flows', () => {
  test.describe.configure({ mode: 'serial' })

  // Clean up test user if still present (e.g. prior run failed before delete test)
  test.afterAll(async () => {
    const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return

    const admin = createClient(url, serviceKey)
    const { data } = await admin.auth.admin.listUsers()
    const testUser = data?.users?.find((u) => u.email === TEST_EMAIL)
    if (testUser) {
      await admin.rpc('delete_user_data', { target_user_id: testUser.id })
      await admin.auth.admin.deleteUser(testUser.id)
    }
  })

  test('sign up with email/password', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('Email').fill(TEST_EMAIL)
    await page.getByPlaceholder('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign Up' }).click()

    // Either we get a confirmation message or we're redirected to the board list
    const confirmationOrBoards = await Promise.race([
      page
        .getByText('Check your email to confirm your account.')
        .waitFor({ timeout: 5000 })
        .then(() => 'confirmation' as const),
      page
        .getByText('My Boards')
        .waitFor({ timeout: 5000 })
        .then(() => 'boards' as const),
    ])

    expect(['confirmation', 'boards']).toContain(confirmationOrBoards)
  })

  test('sign in with email/password', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('Email').fill(TEST_EMAIL)
    await page.getByPlaceholder('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()

    // Should see board list or an error if email not confirmed
    const result = await Promise.race([
      page
        .getByText('My Boards')
        .waitFor({ timeout: 5000 })
        .then(() => 'boards' as const),
      page
        .locator('.text-red-600')
        .waitFor({ timeout: 5000 })
        .then(() => 'error' as const),
    ])

    if (result === 'error') {
      test.skip(true, 'Email confirmation required; cannot test sign-in flow')
    }

    await expect(page.getByText('My Boards')).toBeVisible()
    await expect(page.getByText(TEST_EMAIL)).toBeVisible()
  })

  test('sign out', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('Email').fill(TEST_EMAIL)
    await page.getByPlaceholder('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()

    const signedIn = await page
      .getByText('My Boards')
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false)

    if (!signedIn) {
      test.skip(true, 'Could not sign in; email confirmation may be required')
    }

    await page.getByRole('button', { name: 'Sign out' }).click()

    // Should be back on login page
    await expect(page.getByText('CollabBoard')).toBeVisible()
    await expect(page.getByPlaceholder('Email')).toBeVisible()
  })

  test('delete account', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('Email').fill(TEST_EMAIL)
    await page.getByPlaceholder('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()

    const signedIn = await page
      .getByText('My Boards')
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false)

    if (!signedIn) {
      test.skip(true, 'Could not sign in; email confirmation may be required')
    }

    // Accept the confirmation dialog
    page.on('dialog', (dialog) => dialog.accept())

    await page.getByRole('button', { name: 'Delete Account' }).click()

    // Should redirect to login page
    await expect(page.getByPlaceholder('Email')).toBeVisible({ timeout: 10000 })

    // Try signing in with deleted credentials — should fail
    await page.getByPlaceholder('Email').fill(TEST_EMAIL)
    await page.getByPlaceholder('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.locator('.text-red-600')).toBeVisible({ timeout: 5000 })
  })
})
