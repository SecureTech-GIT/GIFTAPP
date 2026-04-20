import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Bell, Check, CheckCheck, Trash2, FileText, Loader2 } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NotificationAPI, type NotificationLog } from '@/services/api'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { parseFrappeDate } from '@/lib/i18n'
import { useTranslation } from 'react-i18next'

const typeColors: Record<string, string> = {
  Alert: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  Warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  Energy_Point: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  Share: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  Mention: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  Assignment: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
}

// Map document types to routes
const getDocumentLink = (doctype?: string, docname?: string): string | null => {
  if (!doctype || !docname) return null
  
  const routes: Record<string, string> = {
    'Gift': `/gifts/${docname}`,
    'Gift Issue': `/gifts?issue=${docname}`,
    'Gift Interest': `/gifts?interest=${docname}`,
    'Gift Dispatch': `/dispatch/${docname}`,
    'Gift Maintenance': `/maintenance/${docname}`,
    'Gift Receipt': `/receipts/${docname}`,
    'Event': `/events/${docname}`,
  }
  
  return routes[doctype] || null
}

const getNotificationLink = async (notification: NotificationLog): Promise<string | null> => {
  // For Gift notifications, use the document_name to navigate to the gift
  if (notification.document_type === 'Gift' && notification.document_name) {
    return `/gifts/${notification.document_name}`
  }
  
  // For Gift Issue notifications, fetch the gift issue to get the gift ID
  if (notification.document_type === 'Gift Issue' && notification.document_name) {
    try {
      // Import API dynamically to avoid circular dependencies
      const { GiftIssueAPI } = await import('@/services/api')
      const result = await GiftIssueAPI.get(notification.document_name)
      if (result.success && result.data?.gift) {
        return `/gifts/${result.data.gift}`
      }
    } catch (error) {
      console.error('Failed to fetch gift issue details:', error)
    }
    // Fallback to gifts list if we can't get the gift ID
    return '/gifts'
  }
  
  // Fallback to default routing
  return getDocumentLink(notification.document_type, notification.document_name)
}

export default function Notifications() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  const safeRelativeTime = (v?: string) => {
    if (!v) return ''
    try {
      const dt = parseFrappeDate(v)
      if (Number.isNaN(dt.getTime())) return v
      return formatDistanceToNow(dt, { addSuffix: true })
    } catch {
      return v
    }
  }

  const toPlainTextPreview = (html: string, maxLen = 150): string => {
    const text = (html || '').replace(/<[^>]*>/g, ' ')
    return text.length > maxLen ? text.substring(0, maxLen) : text
  }

  // Enhanced function to extract gift name from notification subject
  const getGiftNameFromSubject = (subject: string): string => {
    if (!subject) return ''
    
    // Extract gift name from patterns like "Approval requested for gift: Gift Name"
    const approvalRequestedMatch = subject.match(/:(.+)$/)
    if (approvalRequestedMatch) {
      return approvalRequestedMatch[1].trim()
    }
    
    // Extract gift name from patterns like "Gift delivered: Gift Name"
    const deliveredMatch = subject.match(/:(.+)$/)
    if (deliveredMatch) {
      return deliveredMatch[1].trim()
    }
    
    // Extract gift name from patterns like "Allocation accepted: Gift GiftName allocated to GuestName"
    const acceptedMatch = subject.match(/Gift (.+?) allocated to/)
    if (acceptedMatch) {
      return acceptedMatch[1].trim()
    }
    
    // Extract gift name from patterns like "Allocation rejected: Gift GiftName request for GuestName"
    const rejectedMatch = subject.match(/Gift (.+?) request for/)
    if (rejectedMatch) {
      return rejectedMatch[1].trim()
    }
    
    return ''
  }
  
  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const result = await NotificationAPI.list()
      if (result.success) return result.data || []
      throw new Error(result.error)
    },
  })

  const markReadMutation = useMutation({
    mutationFn: (name: string) => NotificationAPI.markRead(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => NotificationAPI.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('All notifications marked as read')
    },
    onError: () => {
      toast.error('Failed to mark all as read')
    },
  })

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const result = await NotificationAPI.clearAll()
      return result
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      const count = result.data?.deleted_count || 0
      toast.success(`Cleared ${count} notifications`)
    },
    onError: (error) => {
      console.error('Clear all error:', error)
      toast.error('Failed to clear notifications')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => NotificationAPI.delete(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Notification deleted')
    },
    onError: () => {
      toast.error('Failed to delete notification')
    },
  })

  const unreadCount = notifications.filter(n => !n.read).length

  const handleNotificationClick = async (notification: NotificationLog) => {
    // Debug logging
    console.log('Notification clicked:', {
      subject: notification.subject,
      document_type: notification.document_type,
      document_name: notification.document_name,
    })

    // Mark as read if not already
    if (!notification.read) {
      markReadMutation.mutate(notification.name)
    }
    
    // Navigate to linked document if available
    const link = await getNotificationLink(notification)
    if (link) {
      console.log('Navigating to:', link)
      navigate(link)
    } else {
      console.log('No link found for notification')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {t('nav.notifications')}
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} {t('common.new')}
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground">{t('notifications.stayUpdated')}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending || unreadCount === 0}
          >
            {markAllReadMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4 mr-2" />
            )}
            {t('notifications.markAllRead')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => clearAllMutation.mutate()}
            disabled={clearAllMutation.isPending || notifications.length === 0}
            className="text-destructive"
          >
            {clearAllMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            {t('notifications.clearAll')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('notifications.recentNotifications')}
          </CardTitle>
          <CardDescription>
            {notifications.length} {t('notifications.notifications')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              {t('notifications.failedToLoad')}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">{t('notifications.noNotifications')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="divide-y divide-border">
                {notifications.map((notification) => {
                  const link = getNotificationLink(notification)
                  const typeColor = typeColors[notification.type || ''] || typeColors.default
                  
                  return (
                    <div key={notification.name} className="group">
                      <div
                        className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                          !notification.read ? 'bg-primary/5' : ''
                        } ${link ? 'hover:shadow-sm' : ''}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-2 rounded-full ${typeColor}`}>
                            {notification.document_type ? (
                              <FileText className="h-4 w-4" />
                            ) : (
                              <Bell className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-foreground line-clamp-1">
                                {notification.subject}
                              </p>
                              {!notification.read && (
                                <span className="h-2 w-2 bg-primary rounded-full flex-shrink-0" />
                              )}
                              {link && (
                                <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                  → Click to view
                                </span>
                              )}
                            </div>
                            
                            {notification.email_content && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {toPlainTextPreview(notification.email_content)}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {notification.document_type && (
                                <Badge variant="outline" className="text-xs">
                                  {notification.document_type}
                                </Badge>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {safeRelativeTime(notification.creation)}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            {!notification.read && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => markReadMutation.mutate(notification.name)}
                                disabled={markReadMutation.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => deleteMutation.mutate(notification.name)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}