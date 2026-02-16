import { useAuthStore } from '../../store/authStore'

export function LoginPage() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>CollabBoard</h1>
        <p style={styles.subtitle}>Real-time collaborative whiteboard</p>
        <button onClick={signInWithGoogle} style={styles.button}>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#f5f5f5',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '48px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  title: {
    margin: 0,
    fontSize: '32px',
    fontWeight: 700,
    color: '#1a1a1a',
  },
  subtitle: {
    margin: 0,
    fontSize: '16px',
    color: '#666',
  },
  button: {
    marginTop: '16px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 500,
    color: '#fff',
    backgroundColor: '#4285f4',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
}
