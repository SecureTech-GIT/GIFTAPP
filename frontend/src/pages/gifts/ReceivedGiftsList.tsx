import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Plus, Search, MoreHorizontal, Edit, Trash2, Eye, 
  PackageCheck, TrendingUp, Grid3x3, List as ListIcon,
  Filter, X, ArrowRight, AlertCircle, Package
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Pagination } from '@/components/Pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ReceivedGiftAPI, GiftCategoryAPI, DashboardAPI } from '@/services/api'
import type { ReceivedGift } from '@/services/api'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { parseFrappeDate } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { getStatusColor } from '@/lib/statusColors'
import { useTranslation } from 'react-i18next'


export default function ReceivedGiftsList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [donorTypeFilter, setDonorTypeFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Debounce search
  const debouncedSearch = useDebounce(search, 500)

  // Fetch dashboard stats
  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const result = await DashboardAPI.getStats()
      return result.success ? result.data : null
    },
    staleTime: 30000,
  })

  // Fetch received gifts with server-side pagination
  const { data: giftsResponse, isLoading, error } = useQuery({
    queryKey: ['received-gifts-paginated', statusFilter, categoryFilter, donorTypeFilter, debouncedSearch, currentPage, itemsPerPage],
    queryFn: async () => {
      const filters: Record<string, string> = {}
      
      if (statusFilter && statusFilter !== 'all') filters.status = statusFilter
      if (categoryFilter && categoryFilter !== 'all') filters.category = categoryFilter
      if (donorTypeFilter && donorTypeFilter !== 'all') filters.donor_type = donorTypeFilter
      if (debouncedSearch) filters.search = debouncedSearch
      
      const result = await ReceivedGiftAPI.list(filters, currentPage, itemsPerPage)
      
      // DEBUG: Log the raw response
      console.log('API Response:', result)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch received gifts')
      }
      
      return result
    },
  })

  // DEBUG: Log giftsResponse
  console.log('giftsResponse:', giftsResponse)

  // Extract gifts from response - SIMPLIFIED
  const gifts = giftsResponse?.data || []
  const totalItems = giftsResponse?.total || 0
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))

  // DEBUG: Log extracted gifts
  console.log('Extracted gifts:', gifts)
  console.log('Total items:', totalItems)

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['gift-categories'],
    queryFn: async () => {
      const result = await GiftCategoryAPI.list()
      return result.success ? result.data : []
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (name: string) => ReceivedGiftAPI.delete(name),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('receivedGifts.receivedGiftDeletedSuccessfully'))
        queryClient.invalidateQueries({ queryKey: ['received-gifts-paginated'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      } else {
        toast.error(result.error || t('receivedGifts.failedToDelete'))
      }
    },
  })

  // Move to inventory mutation
  const moveToInventoryMutation = useMutation({
    mutationFn: (name: string) => ReceivedGiftAPI.moveToInventory(name),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('receivedGifts.giftMovedToInventory', { gift: result.data }))
        queryClient.invalidateQueries({ queryKey: ['received-gifts-paginated'] })
        queryClient.invalidateQueries({ queryKey: ['gifts-paginated'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
        
        setTimeout(() => {
          if (confirm(t('receivedGifts.giftCreatedSuccessfully', { gift: result.data }) + '\n\n' + t('receivedGifts.doYouWantToViewIt'))) {
            navigate(`/gifts/${result.data}`)
          }
        }, 500)
      } else {
        toast.error(result.error || t('receivedGifts.failedToMoveGift'))
      }
    },
  })

  const handleDelete = async (name: string) => {
    if (!confirm(t('receivedGifts.deleteConfirmation'))) return
    deleteMutation.mutate(name)
  }

  const handleMoveToInventory = async (gift: ReceivedGift) => {
    if (gift.moved_to_inventory) {
      toast.info(t('receivedGifts.alreadyMovedToInventory'))
      return
    }
    
    if (!confirm(t('receivedGifts.moveToInventoryConfirmation', { gift: gift.gift_name }))) {
      return
    }
    
    moveToInventoryMutation.mutate(gift.name)
  }

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, categoryFilter, donorTypeFilter, debouncedSearch, itemsPerPage])

  // Error handling
  useEffect(() => {
    if (error) {
      console.error('Failed to load received gifts:', error)
      toast.error(t('receivedGifts.failedToLoadReceivedGifts'))
    }
  }, [error])

  // Calculate stats from current page data
  const stats = {
    total: dashboardStats?.totalReceivedGifts || totalItems,
    received: gifts?.filter((g: ReceivedGift) => g.status === 'Received').length || 0,
    stored: gifts?.filter((g: ReceivedGift) => g.status === 'Stored').length || 0,
    moved: gifts?.filter((g: ReceivedGift) => g.moved_to_inventory).length || 0,
  }

  const hasActiveFilters = statusFilter !== 'all' || categoryFilter !== 'all' || donorTypeFilter !== 'all' || search !== ''

  const clearFilters = () => {
    setStatusFilter('all')
    setCategoryFilter('all')
    setDonorTypeFilter('all')
    setSearch('')
  }

  const formatDate = (date: string | undefined) => {
    if (!date) return '-'
    try {
      const dt = parseFrappeDate(date)
      if (Number.isNaN(dt.getTime())) return date
      return format(dt, 'dd MMM yyyy')
    } catch {
      return date
    }
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <PackageCheck className="h-7 w-7" />
            {t('receivedGifts.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('receivedGifts.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link to="/gifts">
              <Package className="h-4 w-4 mr-2" />
              {t('receivedGifts.viewInventory')}
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/received-gifts/new">
              <Plus className="h-4 w-4 mr-2" />
              {t('receivedGifts.newInboundGift')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('receivedGifts.totalReceived')}
            </CardTitle>
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('receivedGifts.allTimeReceipts')}</p>
          </CardContent>
        </Card>

        <Card 
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => setStatusFilter('Received')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('receivedGifts.received')}
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.received}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('receivedGifts.awaitingProcessing')}</p>
          </CardContent>
        </Card>

        <Card 
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => setStatusFilter('Stored')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('receivedGifts.stored')}
            </CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.stored}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('receivedGifts.inStorage')}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('receivedGifts.movedToInventory')}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.moved}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('receivedGifts.processed')}</p>
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
                  placeholder={t('receivedGifts.searchPlaceholder')}
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

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder={t('receivedGifts.allStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('receivedGifts.allStatus')}</SelectItem>
                  <SelectItem value="Received">Received</SelectItem>
                  <SelectItem value="Stored">Stored</SelectItem>
                  <SelectItem value="Moved to Inventory">Moved to Inventory</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              {/* Donor Type Filter */}
              <Select value={donorTypeFilter} onValueChange={setDonorTypeFilter}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder={t('receivedGifts.receivedFrom')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('receivedGifts.receiverType')}</SelectItem>
                  <SelectItem value="Individual">{t('receivedGifts.individual')}</SelectItem>
                  <SelectItem value="Organization">{t('receivedGifts.organization')}</SelectItem>
                  <SelectItem value="Government">{t('receivedGifts.government')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder={t('receivedGifts.allCategories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('receivedGifts.allCategories')}</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>
                      {cat.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View Toggle */}
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                  title={t('receivedGifts.listView')}
                >
                  <ListIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  title={t('receivedGifts.gridView')}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Active Filters */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  {t('receivedGifts.activeFilters')}
                </span>
                {search && (
                  <Badge variant="secondary" className="gap-1">
                    {t('receivedGifts.search')}: {search}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSearch('')} />
                  </Badge>
                )}
                {statusFilter && statusFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    {t('receivedGifts.status')}: {statusFilter}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setStatusFilter('all')} />
                  </Badge>
                )}
                {donorTypeFilter && donorTypeFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    {t('receivedGifts.donor')}: {donorTypeFilter}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setDonorTypeFilter('all')} />
                  </Badge>
                )}
                {categoryFilter && categoryFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    {t('receivedGifts.category')}: {categories?.find(c => c.name === categoryFilter)?.category_name || categoryFilter}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setCategoryFilter('all')} />
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                  {t('receivedGifts.clearAll')}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      {!isLoading && gifts.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
          {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} {t('receivedGifts.title').toLowerCase()}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('receivedGifts.giftName')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('receivedGifts.receivedFromColumn')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('receivedGifts.country')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('receivedGifts.type')}</TableHead>
                    <TableHead className="hidden xl:table-cell">{t('receivedGifts.dateReceived')}</TableHead>
                    <TableHead>{t('receivedGifts.status')}</TableHead>
                    <TableHead className="text-right">{t('receivedGifts.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                          <span className="text-muted-foreground">{t('receivedGifts.loadingReceivedGifts')}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : gifts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <PackageCheck className="h-12 w-12 text-muted-foreground/50" />
                          <p className="text-muted-foreground font-medium">{t('receivedGifts.noReceivedGiftsFound')}</p>
                          <p className="text-sm text-muted-foreground">
                            {hasActiveFilters ? t('receivedGifts.tryAdjustingFilters') : t('receivedGifts.recordFirstGiftReceipt')}
                          </p>
                          {hasActiveFilters ? (
                            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
                              {t('receivedGifts.clearFilters')}
                            </Button>
                          ) : (
                            <Button asChild size="sm" className="mt-2">
                              <Link to="/received-gifts/new">
                                <Plus className="h-4 w-4 mr-2" />
                                {t('receivedGifts.newInboundGift')}
                              </Link>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    gifts.map((gift: ReceivedGift) => (
                      <TableRow 
                        key={gift.name} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/received-gifts/${gift.name}`)}
                      >
                        <TableCell className="font-medium">
                          <div>
                            <p>{gift.gift_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{gift.name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{gift.donor || '-'}</TableCell>
                        <TableCell className="hidden lg:table-cell">{gift.donor_country || '-'}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {gift.donor_type ? (
                            <Badge variant="outline" className="text-xs">{gift.donor_type}</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {formatDate(gift.received_date)}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", getStatusColor(gift.status || 'Received'))}>
                            {gift.status || 'Received'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to={`/received-gifts/${gift.name}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  {t('receivedGifts.viewDetails')}
                                </Link>
                              </DropdownMenuItem>
                              {!gift.moved_to_inventory && (
                                <DropdownMenuItem asChild>
                                  <Link to={`/received-gifts/${gift.name}/edit`}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    {t('receivedGifts.edit')}
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              {!gift.moved_to_inventory && gift.status !== 'Rejected' && (
                                <DropdownMenuItem onClick={() => handleMoveToInventory(gift)}>
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  {t('receivedGifts.moveToInventory')}
                                </DropdownMenuItem>
                              )}
                              {!gift.moved_to_inventory && (
                                <DropdownMenuItem
                                  onClick={() => handleDelete(gift.name)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t('receivedGifts.delete')}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {!isLoading && gifts.length > 0 && (
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
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  <span className="text-muted-foreground">{t('receivedGifts.loadingReceivedGifts')}</span>
                </div>
              </CardContent>
            </Card>
          ) : gifts.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-2">
                  <PackageCheck className="h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground font-medium">{t('receivedGifts.noReceivedGiftsFound')}</p>
                  <p className="text-sm text-muted-foreground">
                    {hasActiveFilters ? t('receivedGifts.tryAdjustingFilters') : t('receivedGifts.recordFirstGiftReceipt')}
                  </p>
                  {hasActiveFilters ? (
                    <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
                      {t('receivedGifts.clearFilters')}
                    </Button>
                  ) : (
                    <Button asChild size="sm" className="mt-2">
                      <Link to="/received-gifts/new">
                        <Plus className="h-4 w-4 mr-2" />
                        {t('receivedGifts.newInboundGift')}
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {gifts.map((gift: ReceivedGift) => (
                  <Card 
                    key={gift.name} 
                    className="hover:shadow-lg transition-all cursor-pointer group"
                    onClick={() => navigate(`/received-gifts/${gift.name}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate group-hover:text-primary transition-colors">
                            {gift.gift_name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
                            {gift.name}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/received-gifts/${gift.name}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                {t('receivedGifts.view')}
                              </Link>
                            </DropdownMenuItem>
                            {!gift.moved_to_inventory && (
                              <DropdownMenuItem asChild>
                                <Link to={`/received-gifts/${gift.name}/edit`}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  {t('receivedGifts.edit')}
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {!gift.moved_to_inventory && gift.status !== 'Rejected' && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                handleMoveToInventory(gift)
                              }}>
                                <ArrowRight className="h-4 w-4 mr-2" />
                                {t('receivedGifts.moveToInventory')}
                              </DropdownMenuItem>
                            )}
                            {!gift.moved_to_inventory && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(gift.name)
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('receivedGifts.delete')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t('receivedGifts.statusLabel')}</span>
                        <Badge className={cn("text-xs", getStatusColor(gift.status || 'Received'))}>
                          {gift.status || 'Received'}
                        </Badge>
                      </div>
                      
                      {gift.donor && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{t('receivedGifts.receivedFrom')}</span>
                          <span className="text-xs font-medium truncate max-w-[150px]">
                            {gift.donor}
                          </span>
                        </div>
                      )}
                      
                      {gift.donor_country && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{t('receivedGifts.country')}</span>
                          <span className="text-xs font-medium truncate max-w-[150px]">
                            {gift.donor_country}
                          </span>
                        </div>
                      )}
                      
                      {gift.received_date && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{t('receivedGifts.receivedOn')}</span>
                          <span className="text-xs font-medium">
                            {formatDate(gift.received_date)}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <Card>
                <CardContent className="p-0">
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
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}
