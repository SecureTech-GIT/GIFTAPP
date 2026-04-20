import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Globe, Users, UserPlus, Shield, Trash2, Pencil, UserX  } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

import { UserAPI, type FrappeUser } from '@/services/api'
import { useRole } from '@/contexts/RoleContext'

const AVAILABLE_ROLES = ['System Manager', 'Event Manager', 'Event Coordinator']

export default function Settings() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { isAdmin } = useRole()

  // New user form state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserRole, setNewUserRole] = useState('')
  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<FrappeUser | null>(null)
  const [editUserRoles, setEditUserRoles] = useState<string[]>([])
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  // Fetch users list (admin only)
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await UserAPI.list()
      if (res.success) return res.data
      return []
    },
    enabled: isAdmin,
  })

  const updateUserRoleMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) {
        return { success: false, error: t('common.validationError') }
      }

      const currentManagedRoles = getUserManagedRoles(editingUser)

      for (const role of currentManagedRoles) {
        if (!editUserRoles.includes(role)) {
          const removeResult = await UserAPI.removeRole(editingUser.name, role)
          if (!removeResult.success) {
            return removeResult
          }
        }
      }

      for (const role of editUserRoles) {
        if (!currentManagedRoles.includes(role)) {
          const addResult = await UserAPI.addRole(editingUser.name, role)
          if (!addResult.success) {
            return addResult
          }
        }
      }

      return { success: true }
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('settings.userRoleUpdated'))
        queryClient.invalidateQueries({ queryKey: ['users-list'] })
        setIsEditRoleOpen(false)
        setEditingUser(null)
        setEditUserRoles([])
      } else {
        toast.error(res.error || t('common.error'))
      }
    },
    onError: () => {
      toast.error(t('common.error'))
    },
  })

  const toggleEditRole = (role: string, checked: boolean) => {
    setEditUserRoles((prev) => {
      if (checked) {
        return prev.includes(role) ? prev : [...prev, role]
      }
      return prev.filter((r) => r !== role)
    })
  }

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async () => {
      return UserAPI.create(newUserEmail, newUserName, [newUserRole])
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('settings.userCreated'))
        queryClient.invalidateQueries({ queryKey: ['users-list'] })
        setIsAddUserOpen(false)
        resetForm()
      } else {
        toast.error(res.error || t('common.error'))
      }
    },
    onError: () => {
      toast.error(t('common.error'))
    },
  })

  // Disable user mutation
  const disableUserMutation = useMutation({
    mutationFn: (userId: string) => UserAPI.disable(userId),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('settings.userDisabled'))
        queryClient.invalidateQueries({ queryKey: ['users-list'] })
      } else {
        toast.error(res.error || t('common.error'))
      }
    },
  })

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  // Check if form has any data
  const hasFormData = newUserEmail.trim() !== '' || newUserName.trim() !== '' || newUserRole.trim() !== ''

  // Reset form fields
  const resetForm = () => {
    setNewUserEmail('')
    setNewUserName('')
    setNewUserRole('')
  }

  // Handle dialog close with confirmation if data exists
  const handleDialogClose = (open: boolean) => {
    if (!open && hasFormData) {
      setShowCancelDialog(true)
    } else {
      setIsAddUserOpen(open)
      if (!open) {
        resetForm()
      }
    }
  }

  // Handle confirmed cancel
  const handleConfirmedCancel = () => {
    setShowCancelDialog(false)
    setIsAddUserOpen(false)
    resetForm()
  }

  // Handle cancel without confirmation (when no data)
  const handleDirectCancel = () => {
    setIsAddUserOpen(false)
    resetForm()
  }

  const getUserManagedRoles = (user: FrappeUser) => {
    return (user.roles || [])
        .map((r) => r.role)
        .filter((role) => AVAILABLE_ROLES.includes(role))
  }

  const openEditRoleDialog = (user: FrappeUser) => {
    setEditingUser(user)
    setEditUserRoles(getUserManagedRoles(user))
    setIsEditRoleOpen(true)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
          <p className="text-muted-foreground">{t('settings.description')}</p>
        </div>
      </div>

      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('profile.language')}
          </CardTitle>
          <CardDescription>{t('profile.selectLanguage')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={i18n.language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t('profile.english')}</SelectItem>
              <SelectItem value="ar">{t('profile.arabic')}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* User Management - Admin Only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('settings.userManagement')}
                </CardTitle>
                {/* <CardDescription>{t('settings.userManagementDesc')}</CardDescription> */}
              </div>
              <Dialog open={isAddUserOpen} onOpenChange={handleDialogClose}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t('settings.addUser')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('settings.addNewUser')}</DialogTitle>
                    <DialogDescription>{t('settings.addNewUserDesc')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('settings.email')}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="user@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">{t('settings.fullName')}</Label>
                      <Input
                        id="fullName"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('common.role')}</Label>
                      <Select value={newUserRole} onValueChange={setNewUserRole}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={hasFormData ? () => setShowCancelDialog(true) : handleDirectCancel}>
                      {t('common.cancel')}
                    </Button>
                    <Button
                      onClick={() => createUserMutation.mutate()}
                      disabled={!newUserEmail || !newUserName || !newUserRole || createUserMutation.isPending}
                    >
                      {createUserMutation.isPending ? t('common.loading') : t('settings.createUser')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.noResults')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('settings.fullName')}</TableHead>
                    <TableHead>{t('settings.email')}</TableHead>
                    <TableHead>{t('common.role0')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.name}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{getUserManagedRoles(user).join(', ') || t('common.none')}</TableCell>
                      <TableCell>
                        <Badge variant={user.enabled ? 'default' : 'secondary'}>
                          {user.enabled ? t('settings.active') : t('settings.disabled')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditRoleDialog(user)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {user.enabled ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive">
                                  <UserX  className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('settings.disableUser')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('settings.disableUserConfirm', { name: user.full_name })}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => disableUserMutation.mutate(user.name)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {t('settings.disable')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => UserAPI.enable(user.name).then(() => {
                                toast.success(t('settings.userEnabled'))
                                queryClient.invalidateQueries({ queryKey: ['users-list'] })
                              })}
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={isEditRoleOpen}
        onOpenChange={(open) => {
          setIsEditRoleOpen(open)
          if (!open) {
            setEditingUser(null)
            setEditUserRoles([])
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.editUserRole')}</DialogTitle>
            <DialogDescription>{editingUser?.full_name || editingUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>{t('common.role0')}</Label>
            <div className="space-y-3">
              {AVAILABLE_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={editUserRoles.includes(role)}
                    onCheckedChange={(checked) => toggleEditRole(role, Boolean(checked))}
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditRoleOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => updateUserRoleMutation.mutate()}
              disabled={updateUserRoleMutation.isPending || !editingUser}
            >
              {updateUserRoleMutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.discardChanges')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.discardChangesConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowCancelDialog(false)}>
              {t('common.keepEditing')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.discardChanges')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
