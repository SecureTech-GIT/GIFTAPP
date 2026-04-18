// src/pages/Login.tsx

import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { AuthAPI } from '@/services/api'
import { config } from '@/config/environment'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const schema = z.object({
  username: z.string().trim().min(1, 'Email is required').max(140),
  password: z.string().min(1, 'Password is required').max(200),
  remember: z.boolean().optional(),
})

type FormValues = z.infer<typeof schema>

export default function Login() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)

  const assetBase = import.meta.env.BASE_URL

  const from = useMemo(() => {
    const state = location.state as { from?: string } | null
    return state?.from || '/'
  }, [location.state])

  useEffect(() => {
    const authError = sessionStorage.getItem('auth_error')
    if (authError === 'no_access') {
      toast.error(t('auth.noAccessToSystem'))
      sessionStorage.removeItem('auth_error')
    }
  }, [t])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '', remember: false },
  })

  const loginMutation = useMutation({
    mutationFn: async (values: FormValues) =>
      AuthAPI.login(values.username, values.password),
    onSuccess: (res) => {
  if (res.success) {
    toast.success(t('auth.loginSuccess'))
    navigate(from, { replace: true })
    window.location.reload()
  } else {
    let errorMessage = t('auth.loginFailed')

    if (res.error) {
      const errorLower = res.error.toLowerCase()

      if (
        errorLower.includes('user disabled or missing') ||
        errorLower.includes('disabled or missing')
      ) {
        // ✅ Disabled user — show no access message
        errorMessage = t('auth.noAccessToSystem')

      } else if (
        errorLower.includes('invalid login credentials') ||
        errorLower.includes('frappe.exceptions.authenticationerror') ||
        errorLower.includes('username or password is incorrect')
      ) {
        errorMessage = t('auth.incorrectCredentials')

      } else if (errorLower.includes('suspended')) {
        errorMessage = t('auth.accountSuspended')

      } else if (errorLower.includes('locked')) {
        errorMessage = t('auth.accountLocked')

      } else if (errorLower.includes('inactive')) {
        errorMessage = t('auth.accountInactive')

      } else if (errorLower.includes('do not have access to the system')) {
        errorMessage = t('auth.noAccessToSystem')

      } else {
        errorMessage = res.error
      }
    }

    toast.error(errorMessage)
  }
},

  onError: (error: any) => {
    let errorMessage = t('auth.loginFailed')

    const message = error?.response?.data?.message?.toLowerCase() ?? ''
    const excType = error?.response?.data?.exc_type
    const status = error?.response?.status

    if (
      error?.code === 'NETWORK_ERROR' ||
      error?.message?.includes('Network Error') ||
      error?.message?.includes('fetch')
    ) {
      errorMessage = t('auth.networkError')

    } else if (
      message.includes('user disabled or missing') ||
      message.includes('disabled or missing')
    ) {
      // ✅ Disabled user — same message as no-role users
      errorMessage = t('auth.noAccessToSystem')

    } else if (
      excType === 'AuthenticationError' ||
      message.includes('invalid login credentials') ||
      message.includes('username or password')
    ) {
      errorMessage = t('auth.incorrectCredentials')

    } else if (message.includes('suspended')) {
      errorMessage = t('auth.accountSuspended')

    } else if (message.includes('locked')) {
      errorMessage = t('auth.accountLocked')

    } else if (message.includes('inactive')) {
      errorMessage = t('auth.accountInactive')

    } else if (status >= 500) {
      errorMessage = t('auth.serverError')

    } else if (error?.message) {
      errorMessage = error.message
    }

    toast.error(errorMessage)
  },


  })

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  return (
    <main
      className="min-h-svh bg-cover backdrop-blur-md bg-center bg-no-repeat relative flex items-center justify-center p-4 sm:p-6"
      style={{ backgroundImage: `url(${assetBase}login-bg.jpg)` }}
    >
     

      {/* Centered login container */}
      <div
        className="flex flex-col bg-gradient-to-br from-white/40 via-white/20 to-white/10 backdrop-blur-2xl border border-white/40 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] rounded-2xl w-full max-w-md px-6 sm:px-8 py-8 items-center"
      >
        {/* Logo (small version of the illustration) */}
        <div className="mb-3 sm:mb-4">
          <img
            src={`${assetBase}imagelogo.png`}
            alt="Gift Management Application"
            className="h-32 sm:h-40 md:h-48 w-auto mx-auto"
          />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
          {t('auth.GiftManagementApplication')}
        </h2>

        {/* Login Form */}
        <div className="w-full">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) =>
                loginMutation.mutate(values),
              )}
              className="flex flex-col gap-5"
            >
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="email" className="font-medium">
                        {t('auth.emailAddress')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="email"
                          autoComplete="username"
                          placeholder="alex@example.com"
                          className="h-10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-red-500" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        htmlFor="password"
                        className="font-medium"
                      >
                        {t('auth.passwordLabel')}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            id="password"
                            autoComplete="current-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="•••••••"
                            className="h-10 pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="remember"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal cursor-pointer">
                        {t('auth.rememberMe')}
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                className="w-full sm:w-1/2 mx-auto"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending
                  ? t('auth.signingIn')
                  : t('auth.signIn')}
              </Button>

              {/* Microsoft Login Button */}
              <div className="w-full flex flex-col items-center gap-3 mt-4">
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Or</span>
                  </div>
                </div>
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2 border-gray-300 hover:bg-gray-50"
                  onClick={() => {
                    window.location.href = `${config.backendUrl}/api/method/gift.api.microsoft_login`;
                  }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <rect x="2" y="2" width="20" height="20" rx="2" fill="#F25022"/>
                    <rect x="2" y="12" width="9.5" height="10" fill="#7FBA00"/>
                    <rect x="12.5" y="2" width="9.5" height="9.5" fill="#00A4EF"/>
                    <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900"/>
                  </svg>
                  Login with Microsoft
                </Button>
              </div>
            </form>
          </Form>


        </div>
      </div>
       {/* Language Selector - Top right */}
      <div className="absolute bottom-4 right-4 z-50 safe-area-fab-br">
        <Select value={i18n.language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-32 h-10 border-gray-200 shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="en">{t('profile.english')}</SelectItem>
            <SelectItem value="ar">{t('profile.arabic')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </main>
  )
}