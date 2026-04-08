import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getBackendApiBaseUrl } from '@/lib/backend-url'
import {
  AUTH_REQUEST_TIMEOUT_MS,
  extractAuthErrorMessage,
  fetchWithTimeout,
  readResponsePayload,
} from '@/lib/auth-http'

const ALLOWED_DOMAINS = ['@ogr.iuc.edu.tr', '@iuc.edu.tr']
const API_URL = getBackendApiBaseUrl()

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // ── Google OAuth ──────────────────────────────────────────────
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // ── Email + Password ──────────────────────────────────────────
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'E-posta', type: 'email' },
        password: { label: 'Şifre',   type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const normalizedEmail = String(credentials.email).trim().toLowerCase()

        try {
          const res = await fetchWithTimeout(`${API_URL}/auth/login/`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body:    JSON.stringify({
              email:     normalizedEmail,
              iuc_email: normalizedEmail,
              password: credentials.password,
            }),
          }, AUTH_REQUEST_TIMEOUT_MS)

          if (!res.ok) {
            const { text, data, isJson } = await readResponsePayload(res)
            console.error(
              'Credentials login failed',
              res.status,
              extractAuthErrorMessage(data) || (text && !isJson ? text : ''),
            )
            return null
          }

          const data = await res.json()
          if (!data?.user?.id || !data?.access || !data?.refresh) {
            console.error('Credentials login response missing fields', data)
            return null
          }
          return {
            id:              data.user.id,
            name:            data.user.full_name,
            email:           data.user.iuc_email,
            iuc_email:       data.user.iuc_email,
            student_no:      data.user.student_no,
            is_verified:     data.user.is_verified,
            department_year: data.user.department_year,
            avatar_url:      data.user.avatar_url,
            access_token:    data.access,
            refresh_token:   data.refresh,
          }
        } catch (error) {
          console.error('Credentials authorize crashed', error)
          return null
        }
      },
    }),
  ],

  callbacks: {
    // ── signIn — block non-İÜC Google accounts ──────────────────
    async signIn({ account, profile }) {
      if (account?.provider === 'google') {
        const email = profile?.email ?? ''
        const allowed = ALLOWED_DOMAINS.some((d) => email.endsWith(d))
        if (!allowed) return '/login?error=NotIUCEmail'

        // Register or fetch user from Django
        try {
          await fetch(`${API_URL}/auth/google/`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body:    JSON.stringify({
              email:      email,
              name:       profile?.name,
              google_id:  profile?.sub,
              avatar_url: profile?.picture,
            }),
          })
        } catch {
          return false
        }
      }
      return true
    },

    // ── jwt — attach tokens to JWT ───────────────────────────────
    async jwt({ token, user, account }) {
      if (user) {
        token.access_token    = (user as any).access_token
        token.refresh_token   = (user as any).refresh_token
        token.iuc_email       = (user as any).iuc_email ?? user.email ?? ''
        token.student_no      = (user as any).student_no
        token.is_verified     = (user as any).is_verified ?? false
        token.department_year = (user as any).department_year
        token.avatar_url      = (user as any).avatar_url
      }

      // Google OAuth — fetch token from Django
      if (account?.provider === 'google' && account.id_token) {
        try {
          const res = await fetch(`${API_URL}/auth/google/token/`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body:    JSON.stringify({ id_token: account.id_token }),
          })
          if (res.ok) {
            const data = await res.json()
            token.access_token  = data.access
            token.refresh_token = data.refresh
            token.is_verified   = true
          }
        } catch {}
      }

      return token
    },

    // ── session — expose to client ───────────────────────────────
    async session({ session, token }) {
      session.access_token        = token.access_token as string
      session.user.id             = token.sub ?? ''
      session.user.iuc_email      = token.iuc_email as string
      session.user.student_no     = token.student_no as string | null
      session.user.is_verified    = token.is_verified as boolean
      session.user.department_year = token.department_year as number | null
      session.user.avatar_url     = token.avatar_url as string | null
      return session
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },

  trustHost: true,
  session: { strategy: 'jwt' },
})
