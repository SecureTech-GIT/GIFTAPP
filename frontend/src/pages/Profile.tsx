import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, User, Mail, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

import { AuthAPI, UserAPI } from '@/services/api'

export default function Profile() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const { data: user } = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const res = await AuthAPI.getLoggedUser()
      if (res.success) return res.data
      return undefined
    },
    retry: false,
  })

  const fullName = localStorage.getItem('frappe_fullname') || user || 'User'

  const initials = fullName
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error(t('profile.passwordMismatch'))
      }
      if (newPassword.length < 6) {
        throw new Error(t('profile.passwordTooShort'))
      }
      return UserAPI.updatePassword(currentPassword, newPassword)
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('profile.passwordUpdated'))
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error(res.error || t('common.error'))
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || t('common.error'))
    },
  })

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('profile.title')}</h1>
          <p className="text-muted-foreground">{t('profile.accountSettings')}</p>
        </div>
      </div>

      {/* Avatar Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {initials || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">{fullName}</CardTitle>
              <CardDescription>{user || 'user@example.com'}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('profile.accountInfo')}
          </CardTitle>
          <CardDescription>{t('profile.accountInfoDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            {/* Email - read only */}
            <div className="space-y-2">
              <Label>{t('profile.emailLabel')}</Label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{user || t('profile.notAvailable')}</span>
              </div>
            </div>
            
            {/* Full Name - read only */}
            <div className="space-y-2">
              <Label>{t('profile.fullNameLabel')}</Label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{fullName}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t('profile.changePassword')}
          </CardTitle>
          <CardDescription>{t('profile.changePasswordDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t('profile.currentPassword')}</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('profile.newPassword')}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('profile.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button
            onClick={() => updatePasswordMutation.mutate()}
            disabled={
              updatePasswordMutation.isPending ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
            className="w-full"
          >
            {updatePasswordMutation.isPending ? t('common.loading') : t('profile.updatePassword')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
