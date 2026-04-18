// src/pages/gifts/ReceivedGiftDetail.tsx

import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowLeft, Edit, Trash2, MapPin, Truck, PackageCheck,
  Clock, Image as ImageIcon, User, MoreVertical, AlertCircle,
  Info, List, FileText, ArrowRight, Package, UserCheck, 
  Building2, Upload
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ReceivedGiftAPI, GiftCategoryAPI } from '@/services/api'
import { toast } from 'sonner'
import { config } from '@/config/environment'
import { format } from 'date-fns'
import { parseFrappeDate } from '@/lib/i18n'
import type { ReceivedGift } from '@/services/api'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const statusColors: Record<string, string> = {
  'Received': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'Stored': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Moved to Inventory': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'Rejected': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export default function ReceivedGiftDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Fetch received gift details
  const { data: gift, isLoading, error } = useQuery({
    queryKey: ['received-gift', id],
    queryFn: async () => {
      if (!id) throw new Error('No gift ID')
      const result = await ReceivedGiftAPI.get(id)
      if (result.success) {
        return result.data
      }
      throw new Error(result.error)
    },
    enabled: !!id,
  })

  // Fetch category details
  const { data: categoryData } = useQuery({
    queryKey: ['category-detail', gift?.category],
    queryFn: async () => {
      if (!gift?.category) return null
      const result = await GiftCategoryAPI.get(gift.category)
      if (result.success) {
        return result.data
      }
      return null
    },
    enabled: !!gift?.category,
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No gift ID')
      return ReceivedGiftAPI.delete(id)
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('receivedGiftDetail.receivedGiftDeletedSuccessfully'))
        queryClient.invalidateQueries({ queryKey: ['received-gifts'] })
        navigate('/received-gifts')
      } else {
        toast.error(result.error || t('receivedGiftDetail.failedToDeleteGift'))
      }
    },
  })

  // Move to inventory mutation
  const moveToInventoryMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No gift ID')
      return ReceivedGiftAPI.moveToInventory(id)
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('receivedGiftDetail.giftMovedToInventory', { gift: result.data }))
        queryClient.invalidateQueries({ queryKey: ['received-gifts'] })
        queryClient.invalidateQueries({ queryKey: ['gifts'] })
        
        setTimeout(() => {
          if (confirm(t('receivedGiftDetail.giftCreatedSuccessfully', { gift: result.data }) + '\n\n' + t('receivedGiftDetail.doYouWantToViewIt'))) {
            navigate(`/gifts/${result.data}`)
          }
        }, 500)
      } else {
        toast.error(result.error || t('receivedGiftDetail.failedToMoveGiftToInventory'))
      }
    },
  })

  const handleDelete = () => setShowDeleteDialog(true)
  const confirmDelete = () => {
    deleteMutation.mutate()
    setShowDeleteDialog(false)
  }

  const handleMoveToInventory = () => setShowMoveDialog(true)
  const confirmMoveToInventory = () => {
    moveToInventoryMutation.mutate()
    setShowMoveDialog(false)
  }

  const getImageUrl = (path: string | undefined) => {
    if (!path) return ''
    if (path.startsWith('http') || path.startsWith('data:')) return path
    return `${config.apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`
  }

  const formatDate = (date: string | undefined) => {
    if (!date) return '-'
    try {
      const dt = parseFrappeDate(date)
      if (Number.isNaN(dt.getTime())) return date
      return format(dt, 'dd MMM yyyy, hh:mm a')
    } catch {
      return date
    }
  }

  const formatDateOnly = (date: string | undefined) => {
    if (!date) return '-'
    try {
      const dt = parseFrappeDate(date)
      if (Number.isNaN(dt.getTime())) return date
      return format(dt, 'dd MMM yyyy')
    } catch {
      return date
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">{t('receivedGiftDetail.loadingGiftReceipt')}</p>
        </div>
      </div>
    )
  }
  
  if (error || !gift) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <p className="text-destructive font-medium">{t('receivedGiftDetail.failedToLoadReceivedGift')}</p>
        <p className="text-sm text-muted-foreground">{error?.toString()}</p>
        <Button variant="outline" onClick={() => navigate('/received-gifts')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('receivedGiftDetail.backToReceivedGifts')}
        </Button>
      </div>
    )
  }

  const giftAttributes = gift.gift_details || []
  const hasImages = gift.gift_images && gift.gift_images.length > 0
  const hasDocuments = gift.gift_documents && gift.gift_documents.length > 0
  const isMovedToInventory = gift.moved_to_inventory || false

  return (
    <div className="space-y-4 md:space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3 md:gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/received-gifts')}
            className="shrink-0 mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl md:text-2xl font-bold text-foreground break-words">
                {gift.gift_name}
              </h1>
              <Badge className={statusColors[gift.status || 'Received'] || 'bg-gray-100'}>
                {gift.status || 'Received'}
              </Badge>
            </div>
            {gift.name && (
              <p className="text-sm text-muted-foreground font-mono break-all">
                ID: {gift.name}
              </p>
            )}
            {categoryData && (
              <p className="text-sm text-muted-foreground">
                Category: {categoryData.category_name}
              </p>
            )}
          </div>
        </div>
        
        {/* Desktop Actions */}
        <div className="hidden sm:flex gap-2 shrink-0">
          {!isMovedToInventory && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/received-gifts/${id}/edit`}>
                  <Edit className="h-4 w-4 mr-2" />
                  {t('receivedGiftDetail.edit')}
                </Link>
              </Button>
              {gift.status !== 'Rejected' && (
                <Button 
                  size="sm" 
                  onClick={handleMoveToInventory}
                  disabled={moveToInventoryMutation.isPending}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {t('receivedGiftDetail.moveToInventory')}
                </Button>
              )}
            </>
          )}
          {isMovedToInventory && gift.gift_created && (
            <Button variant="default" size="sm" asChild>
              <Link to={`/gifts/${gift.gift_created}`}>
                <Package className="h-4 w-4 mr-2" />
                {t('receivedGiftDetail.viewInInventory')}
              </Link>
            </Button>
          )}
          {!isMovedToInventory && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('receivedGiftDetail.delete')}
            </Button>
          )}
        </div>
        
        {/* Mobile Actions */}
        <div className="sm:hidden self-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isMovedToInventory && (
                <>
                  <DropdownMenuItem asChild>
                    <Link to={`/received-gifts/${id}/edit`}>
                      <Edit className="h-4 w-4 mr-2" />
                      {t('receivedGiftDetail.edit')}
                    </Link>
                  </DropdownMenuItem>
                  {gift.status !== 'Rejected' && (
                    <DropdownMenuItem onClick={handleMoveToInventory}>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      {t('receivedGiftDetail.moveToInventory')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={handleDelete} 
                    className="text-destructive"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('receivedGiftDetail.delete')}
                  </DropdownMenuItem>
                </>
              )}
              {isMovedToInventory && gift.gift_created && (
                <DropdownMenuItem asChild>
                  <Link to={`/gifts/${gift.gift_created}`}>
                    <Package className="h-4 w-4 mr-2" />
                    View in Inventory
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Alert if moved to inventory */}
      {isMovedToInventory && gift.gift_created && (
        <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-950/20">
          <PackageCheck className="h-4 w-4 text-purple-600" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="text-purple-900 dark:text-purple-100">
              {t('receivedGiftDetail.thisGiftMovedToInventory', { gift: gift.gift_created || '' })}
            </span>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/gifts/${gift.gift_created}`}>
                <Package className="h-4 w-4 mr-2" />
                {t('receivedGiftDetail.viewGift')}
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content with Tabs */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        {/* Left: Tabbed Content */}
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">
                <Info className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('receivedGiftDetail.overview')}
              </TabsTrigger>
              <TabsTrigger value="received-by" className="text-xs sm:text-sm">
                <UserCheck className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('receivedGiftDetail.receivedBy')}
              </TabsTrigger>
              <TabsTrigger value="donor" className="text-xs sm:text-sm">
                <User className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('receivedGiftDetail.receivedFrom')}
              </TabsTrigger>
              <TabsTrigger value="transport" className="text-xs sm:text-sm">
                <Truck className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('receivedGiftDetail.transport')}
              </TabsTrigger>
              <TabsTrigger value="media" className="text-xs sm:text-sm">
                <ImageIcon className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('receivedGiftDetail.media')}
              </TabsTrigger>
              <TabsTrigger value="attributes" className="text-xs sm:text-sm">
                <List className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('receivedGiftDetail.attributes')}
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    {t('receivedGiftDetail.giftInformation')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.giftName')}</p>
                      <p className="font-medium">{gift.gift_name}</p>
                    </div>
                    
                    {categoryData && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.category')}</p>
                        <p className="font-medium">{categoryData.category_name}</p>
                        {categoryData.category_type && (
                          <p className="text-xs text-muted-foreground">{t('receivedGiftDetail.type')}: {categoryData.category_type}</p>
                        )}
                      </div>
                    )}

                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.status')}</p>
                      <Badge className={statusColors[gift.status || 'Received']}>
                        {gift.status || 'Received'}
                      </Badge>
                    </div>

                    {gift.received_date && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.dateReceived')}</p>
                        <p className="font-medium">{formatDate(gift.received_date)}</p>
                      </div>
                    )}

                    {gift.occasion_received && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.occasion')}</p>
                        <Badge variant="outline">{gift.occasion_received}</Badge>
                      </div>
                    )}
                  </div>

                  {gift.description && (
                    <>
                      <Separator className="my-4" />
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">{t('receivedGiftDetail.description')}</p>
                        <p className="text-sm whitespace-pre-wrap">{gift.description}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Storage Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {t('receivedGiftDetail.storageDetails')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {gift.warehouse && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.warehouse')}</p>
                        <p className="font-medium">{gift.warehouse}</p>
                      </div>
                    )}

                    {gift.storage_location && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.storageLocation')}</p>
                        <p className="font-medium">{gift.storage_location}</p>
                      </div>
                    )}

                    {gift.storage_date && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.storedSince')}</p>
                        <p className="font-medium">{formatDateOnly(gift.storage_date)}</p>
                      </div>
                    )}

                    {gift.current_location_type && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.locationType')}</p>
                        <Badge variant="outline">{gift.current_location_type}</Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Received By Tab */}
            <TabsContent value="received-by" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    {t('receivedGiftDetail.receivedByInformation')}
                  </CardTitle>
                  <CardDescription>
                    {t('receivedGiftDetail.personWhoReceivedGiftOnBehalf')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(gift.received_by_name || gift.received_by_contact || gift.received_by_email) ? (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {gift.received_by_name && (
                        <div className="sm:col-span-2">
                          <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.receivedByLabel')}</p>
                          <p className="font-medium text-lg">{gift.received_by_name}</p>
                        </div>
                      )}

                      {gift.received_by_designation && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.designation')}</p>
                          <p className="font-medium">{gift.received_by_designation}</p>
                        </div>
                      )}

                      {gift.received_by_contact && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.contactNumber')}</p>
                          <p className="font-medium">{gift.received_by_contact}</p>
                        </div>
                      )}

                      {gift.received_by_email && (
                        <div className="sm:col-span-2">
                          <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.email')}</p>
                          <p className="font-medium">{gift.received_by_email}</p>
                        </div>
                      )}

                      {gift.received_at_location && (
                        <>
                          <Separator className="sm:col-span-2 my-2" />
                          <div className="sm:col-span-2">
                            <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.receivedAtLocation')}</p>
                            <p className="text-sm whitespace-pre-wrap">{gift.received_at_location}</p>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>{t('receivedGiftDetail.noReceiverInformationRecorded')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Donor Tab */}
            <TabsContent value="donor" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {t('receivedGiftDetail.receivedFromInformation')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {gift.donor && (
                      <div className="sm:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.receivedFromLabel')}</p>
                        <p className="font-medium text-lg">{gift.donor}</p>
                      </div>
                    )}

                    {gift.donor_type && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.receivedFromType')}</p>
                        <Badge variant="outline">{gift.donor_type}</Badge>
                      </div>
                    )}

                    {gift.donor_country && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.country')}</p>
                        <p className="font-medium">{gift.donor_country}</p>
                      </div>
                    )}

                    {gift.donor_nationality && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.nationality')}</p>
                        <p className="font-medium">{gift.donor_nationality}</p>
                      </div>
                    )}

                    {gift.donor_contact_person && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.contactPerson')}</p>
                        <p className="font-medium">{gift.donor_contact_person}</p>
                      </div>
                    )}

                    {gift.donor_phone && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.phone')}</p>
                        <p className="font-medium">{gift.donor_phone}</p>
                      </div>
                    )}

                    {gift.donor_email && (
                      <div className="sm:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.email')}</p>
                        <p className="font-medium">{gift.donor_email}</p>
                      </div>
                    )}
                  </div>

                  {/* Coordinator Info */}
                  {(gift.coordinator_name || gift.coordinator_phone) && (
                    <>
                      <Separator className="my-4" />
                      <div>
                        <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {t('receivedGiftDetail.coordinator')}
                        </p>
                        <div className="grid sm:grid-cols-2 gap-4">
                          {gift.coordinator_name && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.name')}</p>
                              <p className="font-medium">{gift.coordinator_name}</p>
                            </div>
                          )}
                          {gift.coordinator_designation && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.designation')}</p>
                              <p className="font-medium">{gift.coordinator_designation}</p>
                            </div>
                          )}
                          {gift.coordinator_phone && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.phone')}</p>
                              <p className="font-medium">{gift.coordinator_phone}</p>
                            </div>
                          )}
                          {gift.coordinator_email && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.email')}</p>
                              <p className="font-medium">{gift.coordinator_email}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Transport Tab */}
            <TabsContent value="transport" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    {t('receivedGiftDetail.transportDelivery')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {gift.transport_method && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.transportMethod')}</p>
                        <Badge variant="outline">{gift.transport_method}</Badge>
                      </div>
                    )}

                    {gift.transport_company && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.transportCompany')}</p>
                        <p className="font-medium">{gift.transport_company}</p>
                      </div>
                    )}

                    {gift.tracking_number && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.trackingNumber')}</p>
                        <p className="font-mono text-sm">{gift.tracking_number}</p>
                      </div>
                    )}

                    {gift.delivered_by && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.deliveredBy')}</p>
                        <p className="font-medium">{gift.delivered_by}</p>
                      </div>
                    )}

                    {gift.source_location && (
                      <div className="sm:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.sourceLocation')}</p>
                        <p className="text-sm whitespace-pre-wrap">{gift.source_location}</p>
                      </div>
                    )}

                    {gift.source_contact && (
                      <div className="sm:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">{t('receivedGiftDetail.sourceContact')}</p>
                        <p className="font-medium">{gift.source_contact}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Media Tab (Images & Documents) */}
            <TabsContent value="media" className="space-y-4">
              {/* Images */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    {t('receivedGiftDetail.giftImages')}
                  </CardTitle>
                  <CardDescription>
                    {hasImages ? `${gift.gift_images!.length} ${t('receivedGiftDetail.images')}` : t('receivedGiftDetail.noImagesUploaded')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hasImages ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {gift.gift_images!.map((image, index) => (
                        <div 
                          key={index} 
                          className="relative aspect-square rounded-lg overflow-hidden border bg-muted group cursor-pointer"
                          onClick={() => window.open(getImageUrl(image.image), '_blank')}
                        >
                          <img 
                            src={getImageUrl(image.image)} 
                            alt={`Gift photo ${index + 1}`} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23999" font-size="14"%3ENo Image%3C/text%3E%3C/svg%3E'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>{t('receivedGiftDetail.noImagesUploaded')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Attributes Tab */}
            <TabsContent value="attributes" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5" />
                    {t('receivedGiftDetail.giftAttributes')}
                  </CardTitle>
                  <CardDescription>
                    {giftAttributes.length} {t('receivedGiftDetail.attributes')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {giftAttributes.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {giftAttributes.map((attr: any, index: number) => (
                        <div key={index} className="p-3 bg-muted/50 rounded-lg border">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-xs font-medium text-muted-foreground flex-1">
                              {attr.attribute_label}
                            </p>
                            {attr.is_mandatory && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0">
                                {t('receivedGiftDetail.required')}
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium text-sm break-words">
                            {attr.attribute_value || '-'}
                          </p>
                          {attr.attribute_type && attr.attribute_type !== 'Text' && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Type: {attr.attribute_type}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <List className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>{t('receivedGiftDetail.noAttributesDefined')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* System Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('receivedGiftDetail.systemInformation')}</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('receivedGiftDetail.createdBy')}</p>
                    <p className="text-sm font-medium">{gift.owner || t('receivedGiftDetail.system')}</p>
                  </div>
                  
                  {gift.creation && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t('receivedGiftDetail.createdOn')}</p>
                      <p className="text-sm font-medium">{formatDate(gift.creation)}</p>
                    </div>
                  )}
                  
                  {gift.modified_by && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t('receivedGiftDetail.lastModifiedBy')}</p>
                      <p className="text-sm font-medium">{gift.modified_by}</p>
                    </div>
                  )}

                  {gift.modified && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t('receivedGiftDetail.lastModifiedOn')}</p>
                      <p className="text-sm font-medium">{formatDate(gift.modified)}</p>
                    </div>
                  )}
                  
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">{t('receivedGiftDetail.documentId')}</p>
                    <p className="text-xs font-mono break-all">{gift.name}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Quick Actions */}
          {!isMovedToInventory && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('receivedGiftDetail.quickActions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {gift.status !== 'Rejected' && (
                  <Button 
                    variant="default" 
                    className="w-full justify-start" 
                    size="sm"
                    onClick={handleMoveToInventory}
                    disabled={moveToInventoryMutation.isPending}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    {moveToInventoryMutation.isPending ? t('receivedGiftDetail.moving') : t('receivedGiftDetail.moveToInventory')}
                  </Button>
                )}
                
                <Button variant="outline" className="w-full justify-start" size="sm" asChild>
                  <Link to={`/received-gifts/${id}/edit`}>
                    <Edit className="h-4 w-4 mr-2" />
                    {t('receivedGiftDetail.editReceipt')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Linked Gift */}
          {isMovedToInventory && gift.gift_created && (
            <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-purple-900 dark:text-purple-100">
                  {t('receivedGiftDetail.linkedGift')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-purple-900 dark:text-purple-100 mb-3">
                  {t('receivedGiftDetail.thisReceiptHasBeenProcessed')}
                </p>
                <Button size="sm" variant="default" className="w-full" asChild>
                  <Link to={`/gifts/${gift.gift_created}`}>
                    <Package className="h-4 w-4 mr-2" />
                    {t('receivedGiftDetail.viewGift', { gift: gift.gift_created })}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Quick Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('receivedGiftDetail.summary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('receivedGiftDetail.status')}</span>
                <Badge variant="outline" className="text-xs">
                  {gift.status}
                </Badge>
              </div>
              
              {gift.received_date && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('receivedGiftDetail.received')}</span>
                  <span className="font-medium text-xs">
                    {formatDateOnly(gift.received_date)}
                  </span>
                </div>
              )}

              {giftAttributes.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('receivedGiftDetail.attributes')}</span>
                  <span className="font-medium">{giftAttributes.length}</span>
                </div>
              )}

              {hasImages && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('receivedGiftDetail.images')}</span>
                  <span className="font-medium">{gift.gift_images!.length}</span>
                </div>
              )}

              {hasDocuments && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('receivedGiftDetail.documents')}</span>
                  <span className="font-medium">{gift.gift_documents!.length}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('receivedGiftDetail.areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('receivedGiftDetail.deleteConfirmation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('receivedGiftDetail.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t('receivedGiftDetail.deleting') : t('receivedGiftDetail.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move to Inventory Dialog */}
      <AlertDialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('receivedGiftDetail.moveToMainInventory')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('receivedGiftDetail.moveToInventoryConfirmation')}
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{t('receivedGiftDetail.createNewGiftRecord')}</li>
                <li>{t('receivedGiftDetail.transferAllImagesAndDocuments')}</li>
                <li>{t('receivedGiftDetail.generateBarcode')}</li>
                <li>{t('receivedGiftDetail.makeReceiptReadOnly')}</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('receivedGiftDetail.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmMoveToInventory}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {moveToInventoryMutation.isPending ? t('receivedGiftDetail.moving') : t('receivedGiftDetail.moveToInventory')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
