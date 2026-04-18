import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { AuthAPI, UserAPI } from '@/services/api'
import { Card, CardContent } from '@/components/ui/card'

export function RequireAuth() {
  const location = useLocation()

  const { data: user, isLoading } = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      // First check localStorage for cached user
      const cachedUser = localStorage.getItem('frappe_user')
      
      // Verify session is still valid with backend
      const res = await AuthAPI.getLoggedUser()
      if (res.success && res.data && res.data !== 'Guest') {
        // Fetch full name if not in localStorage (for OAuth logins)
        const cachedFullName = localStorage.getItem('frappe_fullname')
        if (!cachedFullName) {
          try {
            const userInfoRes = await UserAPI.getCurrentUser()
            if (userInfoRes.success && userInfoRes.data) {
              localStorage.setItem('frappe_fullname', userInfoRes.data.full_name)
            }
          } catch (e) {
            console.warn('Failed to fetch user full name:', e)
          }
        }

        try {
          const permissionRes = await UserAPI.getPermissionContext()
          if (permissionRes.success && permissionRes.data) {
            const roles = permissionRes.data.roles || []
            const hasEventRole =
              permissionRes.data.is_admin ||
              permissionRes.data.is_event_manager ||
              roles.includes('Event Coordinator')

            if (!hasEventRole) {
              await AuthAPI.logout()
              sessionStorage.setItem('auth_error', 'no_access')
              throw new Error('No role access')
            }
          }
        } catch (roleError) {
          if ((roleError as Error)?.message === 'No role access') {
            throw roleError
          }
          console.warn('Permission context check failed:', roleError)
        }

        return res.data
      }
      
      // Clear cached data if session invalid
      localStorage.removeItem('frappe_user')
      localStorage.removeItem('frappe_fullname')
      throw new Error(res.error || 'Not logged in')
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="py-10 text-center text-muted-foreground">Loading session…</CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
