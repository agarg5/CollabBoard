import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'

export function LoginPage() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail)
  const signUpWithEmail = useAuthStore((s) => s.signUpWithEmail)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setSubmitting(true)
    try {
      const err = await signInWithEmail(email, password)
      if (err) setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignUp(e: React.MouseEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setSubmitting(true)
    try {
      const err = await signUpWithEmail(email, password)
      if (err) {
        setError(err)
      } else {
        setMessage('Check your email to confirm your account.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex items-center justify-center w-screen h-screen bg-gray-100">
      <div className="flex flex-col items-center gap-4 p-12 bg-white rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-3xl font-bold text-gray-900">CollabBoard</h1>
        <p className="text-base text-gray-500">Real-time collaborative whiteboard</p>

        {renderEmailForm()}
        {renderDivider()}
        {renderGoogleButton()}
      </div>
    </main>
  )

  function renderEmailForm() {
    return (
      <form onSubmit={handleSignIn} className="flex flex-col gap-3 w-full mt-4" aria-label="Sign in with email">
        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        {message && (
          <p role="status" className="text-sm text-green-800 bg-green-50 rounded-lg px-3 py-2">{message}</p>
        )}
        <div>
          <label htmlFor="login-email" className="sr-only">Email</label>
          <input
            id="login-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="sr-only">Password</label>
          <input
            id="login-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="current-password"
            className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={handleSignUp}
            disabled={submitting}
            className="flex-1 px-4 py-3 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg cursor-pointer hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sign Up
          </button>
        </div>
      </form>
    )
  }

  function renderDivider() {
    return (
      <div className="flex items-center gap-3 w-full" role="separator">
        <div className="flex-1 h-px bg-gray-300" />
        <span className="text-sm text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-300" />
      </div>
    )
  }

  function renderGoogleButton() {
    return (
      <button
        onClick={signInWithGoogle}
        aria-label="Sign in with Google"
        className="w-full px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
      >
        Sign in with Google
      </button>
    )
  }
}
