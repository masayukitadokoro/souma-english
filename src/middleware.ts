import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const publicPaths = ['/login', '/signup', '/logout']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))
  const isApi = pathname.startsWith('/api')
  const isOnboarding = pathname.startsWith('/onboarding')
  const isMotivation = pathname.startsWith('/motivation')

  if (isApi) return supabaseResponse

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isPublic) {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!profile) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (user && !isOnboarding && !isMotivation && !isPublic) {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!profile) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
