import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Truck, Eye, Package, AlertCircle, MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination } from '@/components/Pagination'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { GiftDispatchAPI, DocTypeAPI, DashboardAPI } from '@/services/api'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { getStatusColor } from '@/lib/statusColors'
import { useTranslation } from 'react-i18next'
import { parseFrappeDate } from '@/lib/i18n'


export default function DispatchList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deleteDispatchName, setDeleteDispatchName] = useState<string | null>(null)
  const [deleteDispatchDetails, setDeleteDispatchDetails] = useState<{ 
    giftIssue: string; 
    gift: string; 
    status: string 
  }>({ giftIssue: '', gift: '', status: '' })
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Fetch dispatch status options from backend
  const { data: dispatchStatuses = [] } = useQuery({
    queryKey: ['field-options', 'Gift Dispatch', 'dispatch_status'],
    queryFn: async () => {
      const result = await DocTypeAPI.getFieldOptions('Gift Dispatch', 'dispatch_status')
      return result.success ? result.data : ['Pending', 'In Transit', 'Delivered', 'Returned']
    },
  })

  // Fetch dashboard stats (for metrics cards)
  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const result = await DashboardAPI.getStats()
      return result.success ? result.data : null
    },
    staleTime: 30000,
  })

  // Fetch dispatches with server-side pagination
  const { data: dispatchesResponse, isLoading, error } = useQuery({
    queryKey: ['gift-dispatch-paginated', statusFilter, currentPage, itemsPerPage],
    queryFn: async () => {
      const filters: Record<string, string> = {}
      if (statusFilter && statusFilter !== 'all') {
        filters.dispatch_status = statusFilter
      }
      
      const result = await GiftDispatchAPI.list(filters, currentPage, itemsPerPage)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch dispatches')
      }
      
      return result
    },
  })

  // Extract dispatches
  const dispatches = dispatchesResponse?.data || []
  const totalItems = dispatchesResponse?.total || 0
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))

  // Calculate dashboard metrics from current page (or use dashboard stats if available)
  const dashboardMetrics = {
    totalDispatches: (dashboardStats as any)?.totalDispatches || totalItems,
    inTransit:
      (dashboardStats as any)?.dispatchesInTransit ||
      dispatches.filter((d) => String(d.dispatch_status) === "In Transit")
        .length,
    delivered:
      (dashboardStats as any)?.dispatchesDelivered ||
      dispatches.filter((d) => String(d.dispatch_status) === "Delivered")
        .length,
    prepared:
      (dashboardStats as any)?.dispatchesPrepared ||
      dispatches.filter((d) => String(d.dispatch_status) === "Pending").length,
  }

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (name: string) => GiftDispatchAPI.delete(name),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('dispatchList.dispatchDeletedSuccessfully'))
        queryClient.invalidateQueries({ queryKey: ['gift-dispatches-paginated'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
        setDeleteDispatchName(null)
        setDeleteDispatchDetails({ giftIssue: '', gift: '', status: '' })
      } else {
        toast.error(result.error || t('dispatchList.failedToDeleteDispatch'))
      }
    },
    onError: (error) => {
      toast.error(t('dispatchList.failedToDeleteDispatch'))
      console.error('Delete error:', error)
    }
  })

  const handleDelete = (name: string) => {
    deleteMutation.mutate(name)
  }

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, itemsPerPage])

  // Error handling
  useEffect(() => {
    if (error) {
      console.error('Failed to load dispatches:', error)
      toast.error(t('dispatchList.failedToLoadDispatches'))
    }
  }, [error])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
  {/* <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
      <Truck className="h-6 w-6 text-foreground" />
      {t('dispatchList.title')}
  </h1> */}
  {/* <p className="flex gap-2 items-center">
    <Truck className="h-6 w-6 text-primary text-lg" />
    {t('dispatchList.description')}
  </p> */}
</div>
        <Button asChild variant="outline">
          <Link to="/dispatch/new">
            <Plus className="h-4 w-4 mr-2" />
            {t('dispatchList.newDispatch')}
          </Link>
        </Button>
      </div>

      {/* Dashboard Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dispatchList.totalDispatches')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardMetrics.totalDispatches}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('dispatchList.allTime')}</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setStatusFilter('Pending')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dispatchList.prepared')}</CardTitle>
            <AlertCircle className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardMetrics.prepared}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('dispatchList.readyToDispatch')}</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setStatusFilter('In Transit')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dispatchList.inTransit')}</CardTitle>
            <Truck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardMetrics.inTransit}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('dispatchList.currentlyShipping')}</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setStatusFilter('Delivered')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dispatchList.delivered')}</CardTitle>
            <Package className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardMetrics.delivered}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('dispatchList.successfullyDelivered')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={t('dispatchList.allStatuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('dispatchList.allStatuses')}</SelectItem>
              {dispatchStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Results Count */}
      {!isLoading && dispatches.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
          {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} {t('dispatchList.title').toLowerCase()}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden md:table-cell table-header">{t('dispatchList.dispatchId')}</TableHead>
                <TableHead className="table-header">{t('dispatchList.giftIssue')}</TableHead>
                <TableHead className="hidden lg:table-cell table-header">{t('dispatchList.gift')}</TableHead>
                <TableHead className="table-header">{t('dispatchList.status')}</TableHead>
                <TableHead className="hidden md:table-cell table-header">{t('dispatchList.guest')}</TableHead>
                <TableHead className="hidden lg:table-cell table-header">{t('dispatchList.dispatchDate')}</TableHead>
                <TableHead className="text-right table-header">{t('dispatchList.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      <span className="text-muted-foreground">{t('dispatchList.loadingDispatches')}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : dispatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-medium mb-2">{t('dispatchList.noDispatchesFound')}</h3>
                    <p className="text-muted-foreground mb-4">
                      {statusFilter === 'all' 
                        ? t('dispatchList.createFirstDispatch') 
                        : t('dispatchList.noDispatchesMatchFilter')}
                    </p>
                    {statusFilter === 'all' && (
                      <Button asChild variant="outline">
                        <Link to="/dispatch/new">
                          <Plus className="h-4 w-4 mr-2" />
                          {t('dispatchList.createDispatch')}
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                dispatches.map((dispatch) => (
                  <TableRow 
                    key={dispatch.name} 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => navigate(`/dispatch/${dispatch.name}`)}
                  >
                    <TableCell className="hidden md:table-cell font-mono text-sm">
                      {dispatch.name}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{dispatch.related_gift_issue || '-'}</p>
                        {/* Show gift name on mobile */}
                        <p className="text-xs text-muted-foreground lg:hidden">
                          {dispatch.gift_name || 'No gift'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div>
                        <p className="font-medium">{dispatch.gift_name || '-'}</p>
                        <p className="text-xs text-muted-foreground">{dispatch.gift || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {dispatch.dispatch_status === 'Pending' && (
                        <Badge className={getStatusColor('Pending') || 'bg-gray-500 text-white'}>
                          Pending
                        </Badge>
                      )}
                      {dispatch.dispatch_status !== 'Pending' && (
                        <Badge className={getStatusColor(dispatch.dispatch_status || 'Unknown') || 'bg-gray-500 text-white'}>
                          <span className="hidden sm:inline">{dispatch.dispatch_status || 'Unknown'}</span>
                          <span className="sm:hidden">
                            {String(dispatch.dispatch_status) === 'In Transit' ? 'Transit' :
                             String(dispatch.dispatch_status) === 'Delivered' ? 'Done' :
                             String(dispatch.dispatch_status) === 'Returned' ? 'Return' :
                             dispatch.dispatch_status}
                          </span>
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {(dispatch as any).owner_full_name || dispatch.recipient_name || '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {dispatch.dispatch_date ? (
                        <span className="text-sm">
                          {(() => {
                            try {
                              const dt = parseFrappeDate(dispatch.dispatch_date)
                              return Number.isNaN(dt.getTime())
                                ? dispatch.dispatch_date
                                : format(dt, 'dd MMM yyyy, HH:mm')
                            } catch {
                              return dispatch.dispatch_date
                            }
                          })()}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/dispatch/${dispatch.name}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            {t('dispatchList.viewDetails')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/dispatch/${dispatch.name}/edit`)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('dispatchList.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setDeleteDispatchName(dispatch.name)
                              setDeleteDispatchDetails({
                                giftIssue: dispatch.related_gift_issue || 'Unknown Issue',
                                gift: dispatch.gift_name || 'Unknown Gift',
                                status: dispatch.dispatch_status || 'Unknown'
                              })
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('dispatchList.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {!isLoading && dispatches.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(items) => {
                setItemsPerPage(items)
                setCurrentPage(1)
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDispatchName} onOpenChange={(open) => !open && setDeleteDispatchName(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dispatchList.deleteGiftDispatch')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dispatchList.deleteConfirmation')}
              {deleteDispatchDetails.status === 'Delivered' && (
                <span className="block mt-2 text-orange-600 dark:text-orange-400 font-medium">
                  {t('dispatchList.warningDelivered')}
                </span>
              )}
              {deleteDispatchDetails.status === 'In Transit' && (
                <span className="block mt-2 text-orange-600 dark:text-orange-400 font-medium">
                  {t('dispatchList.warningInTransit')}
                </span>
              )}
              <span className="block mt-2">
                {t('dispatchList.cannotBeUndone')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t('dispatchList.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDispatchName && handleDelete(deleteDispatchName)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t('dispatchList.deleting') : t('dispatchList.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
