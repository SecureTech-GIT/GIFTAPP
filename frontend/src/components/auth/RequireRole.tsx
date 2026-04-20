import { Navigate, useLocation } from 'react-router-dom'
import { useRole } from '@/contexts/RoleContext'
import { RolePermissions } from '@/config/permissions'
import { toast } from 'sonner'
import { useEffect, useRef } from 'react'

interface RequireRoleProps {
  children: React.ReactNode
  permission: keyof RolePermissions
  redirectTo?: string
}

export function RequireRole({ children, permission, redirectTo = '/' }: RequireRoleProps) {
  const { hasPermission, isLoading, roles } = useRole()
  const location = useLocation()
  const hasShownToast = useRef(false)
  const hasCheckedPermission = useRef(false)

  const hasAccess = hasPermission(permission)

  useEffect(() => {
    // Only check permission after loading is complete and we have roles data
    if (!isLoading && roles.length >= 0 && !hasCheckedPermission.current) {
      hasCheckedPermission.current = true
      
      if (!hasAccess && !hasShownToast.current) {
        hasShownToast.current = true
        toast.error('Access Denied', {
          description: 'You do not have permission to access this page.',
        })
      }
    }
  }, [isLoading, hasAccess, roles.length])

  // Show loading until we have definitive role data
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <div className="text-sm text-muted-foreground">Checking permissions...</div>
        </div>
      </div>
    )
  }

  // After loading completes, check access
  if (!hasAccess) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
