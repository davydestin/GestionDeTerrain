import { useEffect, useState } from 'react'
import { AuthContext } from './authContext.js'
import { getCurrentUser, saveProfile, signIn, signOut, signUp } from '../services/authService.js'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    getCurrentUser()
      .then((authenticatedUser) => {
        if (!active) return
        setUser(authenticatedUser)
        setStatus(authenticatedUser ? 'authenticated' : 'guest')
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError.message)
        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [])

  async function login(credentials) {
    setError('')
    const authenticatedUser = await signIn(credentials)
    setUser(authenticatedUser)
    setStatus('authenticated')
    return authenticatedUser
  }

  async function register(details) {
    setError('')
    const authenticatedUser = await signUp(details)
    setUser(authenticatedUser)
    setStatus('authenticated')
    return authenticatedUser
  }

  async function logout() {
    setError('')
    await signOut()
    setUser(null)
    setStatus('guest')
  }

  async function updateProfile(details) {
    setError('')
    const updatedUser = await saveProfile(details)
    setUser(updatedUser)
    return updatedUser
  }

  return (
    <AuthContext.Provider value={{ user, status, error, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}