import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Plus, Wrench, Eye, Search, TrendingUp, Calendar, DollarSign,
  Filter, X, MoreHorizontal, Edit, Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { GiftMaintenanceAPI, DashboardAPI } from '@/services/api'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/useDebounce'
import { useTranslation } from 'react-i18next'
import { parseFrappeDate } from '@/lib/i18n'

const typeColors: Record<string, string> = {
  'Cleaning': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'Repair': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'Inspection': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'Restoration': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'Service': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Preventive Maintenance': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  'Other': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

const paymentColors: Record<string, string> = {
  'Pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Paid': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Waived': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'N/A': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

const conditionColors: Record<string, string> = {
  'Excellent': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Good': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'Fair': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Poor': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  'Damaged': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export default function MaintenanceList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [deleteMaintenanceName, setDeleteMaintenanceName] = useState<string | null>(null)
  const [deleteMaintenanceDetails, setDeleteMaintenanceDetails] = useState<{ 
    gift: string; 
    type: string; 
    date: string;
    cost: number;
  }>({ gift: '', type: '', date: '', cost: 0 })
  
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Debounce search
  const debouncedSearch = useDebounce(search, 500)

  // Fetch form options
  const { data: formOptions } = useQuery({
    queryKey: ['maintenance-form-options'],
    queryFn: async () => {
      return {
        maintenance_types: ['Cleaning', 'Repair', 'Inspection', 'Restoration', 'Service', 'Preventive Maintenance', 'Other'],
        payment_statuses: ['Paid', 'Pending', 'Waived', 'N/A'],
      }
    },
  })

  // Fetch dashboard stats
  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const result = await DashboardAPI.getStats()
      return result.success ? result.data : null
    },
    staleTime: 30000,
  })

  // Fetch maintenance records with server-side pagination
  const { data: recordsResponse, isLoading, error } = useQuery({
    queryKey: ['gift-maintenance-paginated', typeFilter, paymentFilter, debouncedSearch, currentPage, itemsPerPage],
    queryFn: async () => {
      const filters: Record<string, string> = {}
      
      if (typeFilter && typeFilter !== 'all') filters.maintenance_type = typeFilter
      if (paymentFilter && paymentFilter !== 'all') filters.payment_status = paymentFilter
      if (debouncedSearch) filters.search = debouncedSearch
      
      const result = await GiftMaintenanceAPI.list(filters, currentPage, itemsPerPage)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch maintenance records')
      }
      
      return result
    },
  })

  // Extract records
  const records = recordsResponse?.data || []
  const totalItems = recordsResponse?.total || 0
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (name: string) => GiftMaintenanceAPI.delete(name),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('maintenanceList.maintenanceRecordDeletedSuccessfully'))
        queryClient.invalidateQueries({ queryKey: ['gift-maintenance-paginated'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
        setDeleteMaintenanceName(null)
        setDeleteMaintenanceDetails({ gift: '', type: '', date: '', cost: 0 })
      } else {
        toast.error(result.error || t('maintenanceList.failedToDeleteMaintenanceRecord'))
      }
    },
    onError: (error) => {
      toast.error(t('maintenanceList.failedToDeleteMaintenanceRecord'))
      console.error('Delete error:', error)
    }
  })

  const handleDelete = (name: string) => {
    deleteMutation.mutate(name)
  }

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [typeFilter, paymentFilter, debouncedSearch, itemsPerPage])

  // Error handling
  useEffect(() => {
    if (error) {
      console.error('Failed to load maintenance records:', error)
      toast.error(t('maintenanceList.failedToLoadMaintenanceRecords'))
    }
  }, [error])

  // Calculate stats (use dashboard stats if available, otherwise calculate from current page)
  const stats = {
    total: (dashboardStats as any)?.totalMaintenance || totalItems,
    thisMonth: (dashboardStats as any)?.maintenanceThisMonth || records.filter(r => {
      const date = r.maintenance_date ? parseFrappeDate(r.maintenance_date) : new Date('')
      if (Number.isNaN(date.getTime())) return false
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length,
    pending: (dashboardStats as any)?.maintenancePending || records.filter(r => r.payment_status === 'Pending').length,
    totalCost: (dashboardStats as any)?.maintenanceTotalCost || records.reduce((sum, r) => sum + (r.maintenance_cost || 0), 0),
  }

  const hasActiveFilters = typeFilter !== 'all' || paymentFilter !== 'all' || search !== ''

  const clearFilters = () => {
    setTypeFilter('all')
    setPaymentFilter('all')
    setSearch('')
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-7 w-7" />
            {t('maintenanceList.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('maintenanceList.description')}</p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/maintenance/new">
            <Plus className="h-4 w-4 mr-2" />
            {t('maintenanceList.newRecord')}
          </Link>
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('maintenanceList.totalRecords')}
              </CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('maintenanceList.allTime')}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('maintenanceList.thisMonth')}
              </CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.thisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('maintenanceList.maintenanceActivities')}</p>
          </CardContent>
        </Card>

        <Card 
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => setPaymentFilter('Pending')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('maintenanceList.pendingPayment')}
              </CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('maintenanceList.unpaidInvoices')}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('maintenanceList.totalCost')}
              </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              AED {stats.totalCost.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('maintenanceList.totalMaintenanceCost')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('maintenanceList.searchByGiftProviderOrId')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
                {debouncedSearch !== search && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  </div>
                )}
              </div>

              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder={t('maintenanceList.allTypes')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('maintenanceList.allTypes')}</SelectItem>
                  {formOptions?.maintenance_types?.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Payment Status Filter */}
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder={t('maintenanceList.paymentStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('maintenanceList.allPaymentStatus')}</SelectItem>
                  {formOptions?.payment_statuses?.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Active Filters */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Filter className="h-3 w-3" />
                    {t('maintenanceList.activeFilters')}
                  </span>
                  {search && (
                    <Badge variant="secondary" className="gap-1">
                      {t('maintenanceList.search')}: {search}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSearch('')} />
                    </Badge>
                  )}
                  {typeFilter && typeFilter !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      {t('maintenanceList.type')}: {typeFilter}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setTypeFilter('all')} />
                    </Badge>
                  )}
                  {paymentFilter && paymentFilter !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      {t('maintenanceList.payment')}: {paymentFilter}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setPaymentFilter('all')} />
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                    {t('maintenanceList.clearAll')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      {!isLoading && records.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {t('maintenanceList.showingResults')}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="table-header">{t('maintenanceList.gift')}</TableHead>
                  <TableHead className="table-header">{t('maintenanceList.type')}</TableHead>
                  <TableHead className="hidden md:table-cell table-header">{t('maintenanceList.date')}</TableHead>
                  <TableHead className="hidden lg:table-cell table-header">{t('maintenanceList.performedBy')}</TableHead>
                  <TableHead className="hidden lg:table-cell table-header">{t('maintenanceList.condition')}</TableHead>
                  <TableHead className="hidden xl:table-cell table-header">{t('maintenanceList.cost')}</TableHead>
                  <TableHead className="hidden xl:table-cell table-header">{t('maintenanceList.payment')}</TableHead>
                  <TableHead className="text-right table-header">{t('maintenanceList.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                        <span className="text-muted-foreground">{t('maintenanceList.loadingMaintenanceRecords')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Wrench className="h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground font-medium">{t('maintenanceList.noMaintenanceRecordsFound')}</p>
                        <p className="text-sm text-muted-foreground">
                          {hasActiveFilters ? t('maintenanceList.tryAdjustingFilters') : t('maintenanceList.createFirstMaintenanceRecord')}
                        </p>
                        {hasActiveFilters ? (
                          <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
                            {t('maintenanceList.clearFilters')}
                          </Button>
                        ) : (
                          <Button asChild size="sm" className="mt-2">
                            <Link to="/maintenance/new">
                              <Plus className="h-4 w-4 mr-2" />
                              {t('maintenanceList.newRecord')}
                            </Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow 
                      key={record.name} 
                      className="cursor-pointer hover:bg-muted/50" 
                      onClick={() => navigate(`/maintenance/${record.name}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.gift_name || record.gift || '-'}</p>
                          <p className="text-xs text-muted-foreground font-mono">{record.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", typeColors[record.maintenance_type || ''])}>
                          {record.maintenance_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {record.maintenance_date ? (() => {
                          try {
                            const dt = parseFrappeDate(record.maintenance_date)
                            return Number.isNaN(dt.getTime()) ? record.maintenance_date : format(dt, 'dd MMM yyyy')
                          } catch {
                            return record.maintenance_date
                          }
                        })() : '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {record.performed_by || '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {(record as any).condition_after ? (
                          <Badge variant="outline" className={cn("text-xs", conditionColors[(record as any).condition_after])}>
                            {(record as any).condition_after}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {record.maintenance_cost ? (
                          <span className="font-medium">AED {record.maintenance_cost.toFixed(2)}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {record.payment_status && (
                          <Badge className={cn("text-xs", paymentColors[record.payment_status])}>
                            {record.payment_status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/maintenance/${record.name}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              {t('maintenanceList.viewDetails')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/maintenance/${record.name}/edit`)}>
                              <Edit className="h-4 w-4 mr-2" />
                              {t('maintenanceList.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setDeleteMaintenanceName(record.name)
                                setDeleteMaintenanceDetails({
                                  gift: record.gift_name || record.gift || 'Unknown Gift',
                                  type: record.maintenance_type || 'Unknown Type',
                                  date: record.maintenance_date ? (() => {
                                    try {
                                      const dt = parseFrappeDate(record.maintenance_date)
                                      return Number.isNaN(dt.getTime()) ? record.maintenance_date : format(dt, 'dd MMM yyyy')
                                    } catch {
                                      return record.maintenance_date
                                    }
                                  })() : 'Unknown Date',
                                  cost: record.maintenance_cost || 0
                                })
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('maintenanceList.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {!isLoading && records.length > 0 && (
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
      <AlertDialog open={!!deleteMaintenanceName} onOpenChange={(open) => !open && setDeleteMaintenanceName(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('maintenanceList.deleteMaintenanceRecord')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('maintenanceList.deleteConfirmation')}
              <span className="block mt-2">
                {t('maintenanceList.deleteDate')}
              </span>
              {deleteMaintenanceDetails.cost > 0 && (
                <span className="block">
                  {t('maintenanceList.deleteCost')}
                </span>
              )}
              <span className="block mt-2 text-orange-600 dark:text-orange-400 font-medium">
                {t('maintenanceList.cannotBeUndone')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t('maintenanceList.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMaintenanceName && handleDelete(deleteMaintenanceName)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t('maintenanceList.deleting') : t('maintenanceList.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
