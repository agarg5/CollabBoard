import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { LoginPage } from './components/auth/LoginPage'
import './App.css'

function App() {
  const { user, loading, initialize, signOut } = useAuthStore()

  useEffect(() => {
    const unsubscribe = initialize()
    return unsubscribe
  }, [initialize])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>CollabBoard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>{user.email}</span>
          <button onClick={signOut} style={{ padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>
      <p style={{ padding: '16px' }}>Canvas goes here</p>
    </div>
  )
}

export default App
