import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UserAPI } from '@/services/api'
import { mergePermissions, RolePermissions, DEFAULT_PERMISSIONS } from '@/config/permissions'

interface RoleContextType {
  roles: string[]
  permissions: RolePermissions
  isLoading: boolean
  isAdmin: boolean
  isEventManager: boolean
  isRegistrar: boolean
  isApprover: boolean
  isDeliveryCoordinator: boolean
  isEventCoordinator: boolean
  hasPermission: (permission: keyof RolePermissions) => boolean
  refetchRoles: () => void
  // New permission context fields
  assignedEvents: string[]
  hasGlobalVisibility: boolean
  canApproveForEvent: (eventName: string) => boolean
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [roles, setRoles] = useState<string[]>([])
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS)
  const [isInitialized, setIsInitialized] = useState(false)
  const [assignedEvents, setAssignedEvents] = useState<string[]>([])
  const [hasGlobalVisibility, setHasGlobalVisibility] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['user-permission-context'],
    queryFn: async () => {
      const res = await UserAPI.getPermissionContext()
      if (res.success && res.data) {
        return res.data
      }
      return null
    },
    retry: 1,
    staleTime: 60 * 1000, // Cache for 60 seconds — limits role-revocation lag
    refetchOnMount: true, // Always refetch on mount to ensure fresh data
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (data !== undefined && data !== null) {
      setRoles(data.roles || [])
      setPermissions(mergePermissions(data.roles || []))
      setAssignedEvents(data.assigned_events || [])
      setHasGlobalVisibility(data.has_global_visibility || false)
      setIsInitialized(true)
    }
  }, [data])

  const isAdmin = roles.some(r => 
    r.toLowerCase() === 'admin' || 
    r.toLowerCase() === 'administrator' || 
    r.toLowerCase() === 'system manager'
  )
  const isEventManager = roles.some(r => r.toLowerCase() === 'event manager')
  const isRegistrar = roles.some(r => r.toLowerCase() === 'gift registar')
  const isApprover = roles.some(r => r.toLowerCase() === 'gift approver')
  const isDeliveryCoordinator = roles.some(r => r.toLowerCase() === 'gift delivery coordinator')
  const isEventCoordinator = roles.some(r => r.toLowerCase() === 'event coordinator')

  const hasPermission = (permission: keyof RolePermissions): boolean => {
    // Don't allow access until we've loaded roles at least once
    if (!isInitialized) return false
    return permissions[permission]
  }

  const canApproveForEvent = (eventName: string): boolean => {
    if (!isInitialized) return false
    // Admin and System Manager can approve for all events
    if (isAdmin) return true
    // Event Manager can only approve for events they're assigned to
    if (isEventManager) {
      return assignedEvents.includes(eventName)
    }
    return false
  }

  return (
    <RoleContext.Provider
      value={{
        roles,
        permissions,
        isLoading: isLoading || !isInitialized, // Consider uninitialized as loading
        isAdmin,
        isEventManager,
        isRegistrar,
        isApprover,
        isDeliveryCoordinator,
        isEventCoordinator,
        hasPermission,
        refetchRoles: refetch,
        assignedEvents,
        hasGlobalVisibility,
        canApproveForEvent,
      }}
    >
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const context = useContext(RoleContext)
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider')
  }
  return context
}
