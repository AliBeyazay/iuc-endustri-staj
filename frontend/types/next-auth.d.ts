import { DefaultSession, DefaultUser } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session extends DefaultSession {
    access_token: string
    user: {
      id: string
      iuc_email: string
      student_no: string | null
      is_verified: boolean
      department_year: number | null
      avatar_url: string | null
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    access_token: string
    refresh_token: string
    iuc_email: string
    student_no: string | null
    is_verified: boolean
    department_year: number | null
    avatar_url: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    access_token: string
    refresh_token: string
    iuc_email: string
    student_no: string | null
    is_verified: boolean
    department_year: number | null
    avatar_url: string | null
  }
}
