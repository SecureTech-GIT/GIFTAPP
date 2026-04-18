// src/pages/maintenance/MaintenanceForm.tsx

import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowLeft, Save, Wrench, Upload, X,
  Info, User, DollarSign, Image as ImageIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { GiftMaintenanceAPI, GiftAPI, api } from '@/services/api'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { usePrompt } from '@/hooks/usePrompt'
import { config } from '@/config/environment'
import { useTranslation } from 'react-i18next'

export default function MaintenanceForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = !!id
  const preselectedGift = searchParams.get('gift')

  const [formData, setFormData] = useState<any>({
    maintenance_date: format(new Date(), 'yyyy-MM-dd'),
    maintenance_type: '',
    follow_up_required: false,
    payment_status: 'Pending',
  })

  const [isDirty, setIsDirty] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingReport, setUploadingReport] = useState(false)
  const [uploadingCertificate, setUploadingCertificate] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Fetch form options from DocType
  const { data: formOptions } = useQuery({
    queryKey: ['maintenance-form-options'],
    queryFn: async () => {
      return {
        maintenance_types: [
          'Health Checkup',
          'Feeding',
          'Grooming',
          'Medical Treatment',
          'Vaccination',
          'Repair',
          'Cleaning',
          'Service',
          'Other'
        ],
        paid_by_options: [
          'Owner',
          'Organization',
          'Insurance',
          'Other'
        ],
        payment_statuses: [
          'Paid',
          'Pending',
          'Waived',
          'N/A'
        ],
      }
    },
  })

  // Fetch all gifts
  const { data: gifts } = useQuery({
    queryKey: ['all-gifts'],
    queryFn: async () => {
      const result = await GiftAPI.list()
      return result.success ? result.data : []
    },
  })

  // Auto-select gift when preselectedGift is provided and gifts are loaded
  useEffect(() => {
    if (preselectedGift && gifts && gifts.length > 0 && !isEdit && !formData.gift) {
      const gift = gifts.find(g => g.name === preselectedGift)
      if (gift) {
        handleGiftChange(preselectedGift)
      }
    }
  }, [preselectedGift, gifts, isEdit, formData.gift])

  // Fetch existing record if editing
  const { isLoading } = useQuery({
    queryKey: ['gift-maintenance', id],
    queryFn: async () => {
      if (!id) return null
      const result = await GiftMaintenanceAPI.get(id)
      if (result.success && result.data) {
        setFormData(result.data)
        return result.data
      }
      throw new Error(result.error)
    },
    enabled: isEdit,
  })

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit && id) {
        return await GiftMaintenanceAPI.update(id, data)
      }
      return await GiftMaintenanceAPI.create(data)
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(isEdit ? t('maintenanceForm.maintenanceRecordUpdated') : t('maintenanceForm.maintenanceRecordCreated'))
        queryClient.invalidateQueries({ queryKey: ['gift-maintenance'] })
        queryClient.invalidateQueries({ queryKey: ['gifts'] })
        setIsDirty(false)
        navigate('/maintenance')
      } else {
        toast.error(result.error || t('maintenanceForm.failedToSave'))
      }
    },
    onError: () => toast.error(t('maintenanceForm.failedToSaveMaintenanceRecord')),
  })

  usePrompt({
    when: isDirty && !saveMutation.isPending,
    message: t('maintenanceForm.youHaveUnsavedChanges'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.gift) {
      toast.error(t('maintenanceForm.giftIsRequired'))
      setActiveTab('basic')
      return
    }
    if (!formData.performed_by?.trim()) {
      toast.error(t('maintenanceForm.performedByIsRequired'))
      setActiveTab('provider')
      return
    }
    saveMutation.mutate(formData)
  }

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  const handleGiftChange = async (giftName: string) => {
    const result = await GiftAPI.get(giftName)
    if (result.success && result.data) {
      setFormData((prev: any) => ({
        ...prev,
        gift: giftName,
        gift_name: result.data?.gift_name || giftName,
        current_warehouse: result.data?.warehouse || '',
        current_location: result.data?.storage_location || '',
      }))
      setIsDirty(true)
    }
  }

  // Gift search functionality
  const handleGiftSearch = (value: string) => {
    setSearchTerm(value)
    // Clear gift selection if user is typing
    if (formData.gift) {
      setFormData(prev => ({
        ...prev,
        gift: '',
        gift_name: '',
        current_warehouse: '',
        current_location: '',
      }))
    }
  }

  const clearGiftSelection = () => {
    setFormData(prev => ({
      ...prev,
      gift: '',
      gift_name: '',
      current_warehouse: '',
      current_location: '',
    }))
    setSearchTerm('')
  }

  const selectGift = (gift: any) => {
    handleGiftChange(gift.name)
    setSearchTerm('')
  }

  // Filter gifts based on search term
  const filteredGifts = gifts?.filter(gift => 
    !formData.gift && (
      gift.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (gift.gift_name && gift.gift_name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  ) || []

  // Generic file upload handler
  const handleFileUpload = async (
    file: File, 
    fieldName: string,
    setUploading: (val: boolean) => void
  ) => {
    if (!file) return

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('maintenanceForm.fileSizeMustBeLessThan10MB'))
      return
    }

    setUploading(true)

    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('is_private', '0')
      formDataUpload.append('folder', 'Home/Attachments')

      const response = await api.post('/api/method/upload_file', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (response.data?.message?.file_url) {
        updateField(fieldName, response.data.message.file_url)
        toast.success(t('maintenanceForm.fileUploadedSuccessfully'))
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error?.response?.data?.message || t('maintenanceForm.failedToUploadFile'))
    } finally {
      setUploading(false)
    }
  }

  // Photo upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error(t('maintenanceForm.pleaseUploadImageFile'))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('maintenanceForm.imageSizeMustBeLessThan5MB'))
      return
    }

    handleFileUpload(file, 'maintenance_photos', setUploadingPhoto)
    e.target.value = '' // Reset input
  }

  const getImageUrl = (path: string | undefined) => {
    if (!path) return ''
    if (path.startsWith('http') || path.startsWith('data:')) return path
    return `${config.apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`
  }

  const getFileName = (path: string | undefined) => {
    if (!path) return ''
    return path.split('/').pop() || ''
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">{t('maintenanceForm.loadingMaintenanceRecord')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3 md:gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/maintenance')}
            className="shrink-0 mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <Wrench className="h-6 w-6" />
              {isEdit ? t('maintenanceForm.editMaintenanceRecord') : t('maintenanceForm.newMaintenanceRecord')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEdit ? t('maintenanceForm.updateMaintenanceDetails') : t('maintenanceForm.recordMaintenanceActivity')}
            </p>
          </div>
        </div>
        
        {/* Desktop Actions */}
        <div className="hidden sm:flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => navigate('/maintenance')}>
            {t('maintenanceForm.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? t('maintenanceForm.saving') : (isEdit ? t('maintenanceForm.update') : t('maintenanceForm.save'))}
          </Button>
        </div>
      </div>

      {/* Main Layout: Form (left) + Sidebar (right) */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        
        {/* Main Form with Tabs */}
        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic" className="text-xs sm:text-sm">
                <Info className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('maintenanceForm.basic')}
              </TabsTrigger>
              <TabsTrigger value="provider" className="text-xs sm:text-sm">
                <User className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('maintenanceForm.provider')}
              </TabsTrigger>
              <TabsTrigger value="cost" className="text-xs sm:text-sm">
                <DollarSign className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('maintenanceForm.cost')}
              </TabsTrigger>
              <TabsTrigger value="media" className="text-xs sm:text-sm">
                <ImageIcon className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('maintenanceForm.media')}
              </TabsTrigger>
            </TabsList>

            {/* Basic Tab */}
            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('maintenanceForm.basicInformation')}</CardTitle>
                  <CardDescription>{t('maintenanceForm.selectGiftAndBasicMaintenanceDetails')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="maintenance_date">{t('maintenanceForm.maintenanceDate')}</Label>
                    <Input
                      id="maintenance_date"
                      type="date"
                      value={formData.maintenance_date || ''}
                      onChange={(e) => updateField('maintenance_date', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('maintenanceForm.maintenanceType')}</Label>
                    <Select
                      value={formData.maintenance_type || ''}
                      onValueChange={(value) => updateField('maintenance_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('maintenanceForm.selectType')} />
                      </SelectTrigger>
                      <SelectContent>
                        {formOptions?.maintenance_types?.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label>{t('maintenanceForm.giftRequired')}</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder={t('maintenanceForm.selectGift')}
                        value={formData.gift ? formData.gift_name || formData.gift : searchTerm}
                        onChange={(e) => handleGiftSearch(e.target.value)}
                        disabled={isEdit}
                        className="pr-10"
                      />
                      {formData.gift && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => clearGiftSelection()}
                          disabled={isEdit}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    {/* Gift suggestions dropdown */}
                    {filteredGifts && filteredGifts.length > 0 && !formData.gift && (
                      <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredGifts.map(g => (
                          <div
                            key={g.name}
                            className="flex items-center justify-between p-3 hover:bg-accent cursor-pointer border-b last:border-b-0"
                            onClick={() => selectGift(g)}
                          >
                            <div className="flex-1">
                              <p className="font-medium">{g.name}</p>
                              <p className="text-sm text-muted-foreground">{g.gift_name || g.name}</p>
                            </div>
                            <Badge variant={g.status === 'Available' ? 'default' : g.status === 'Issued' ? 'secondary' : 'outline'}>
                              {g.status || 'Unknown'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {formData.gift_name && (
                    <div className="space-y-2 sm:col-span-2">
                      <Label>{t('maintenanceForm.giftName')}</Label>
                      <Input value={formData.gift_name || ''} readOnly className="bg-muted" />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Current Location */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('maintenanceForm.currentLocation')}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('maintenanceForm.currentWarehouse')}</Label>
                    <Input value={formData.current_warehouse || '-'} readOnly className="bg-muted" />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('maintenanceForm.currentLocation')}</Label>
                    <Input value={formData.current_location || '-'} readOnly className="bg-muted" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Provider Tab */}
            <TabsContent value="provider" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('maintenanceForm.careProviderInformation')}</CardTitle>
                  <CardDescription>{t('maintenanceForm.detailsAboutWhoPerformedMaintenance')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="performed_by">{t('maintenanceForm.performedByRequired')}</Label>
                    <Input
                      id="performed_by"
                      value={formData.performed_by || ''}
                      onChange={(e) => updateField('performed_by', e.target.value)}
                      placeholder={t('maintenanceForm.nameOfPersonOrganization')}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact_number">{t('maintenanceForm.contactNumber')}</Label>
                    <Input
                      id="contact_number"
                      value={formData.contact_number || ''}
                      onChange={(e) => updateField('contact_number', e.target.value)}
                      placeholder="+971-50-xxx-xxxx"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="license_number">{t('maintenanceForm.licenseIdNumber')}</Label>
                    <Input
                      id="license_number"
                      value={formData.license_number || ''}
                      onChange={(e) => updateField('license_number', e.target.value)}
                      placeholder={t('maintenanceForm.professionalLicenseNumber')}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="observations">{t('maintenanceForm.observations')}</Label>
                    <Textarea
                      id="observations"
                      value={formData.observations || ''}
                      onChange={(e) => updateField('observations', e.target.value)}
                      placeholder={t('maintenanceForm.generalObservationsDuringMaintenance')}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="diagnosis">{t('maintenanceForm.diagnosis')}</Label>
                    <Textarea
                      id="diagnosis"
                      value={formData.diagnosis || ''}
                      onChange={(e) => updateField('diagnosis', e.target.value)}
                      placeholder={t('maintenanceForm.medicalDiagnosisIfApplicable')}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="recommendations">{t('maintenanceForm.recommendations')}</Label>
                    <Textarea
                      id="recommendations"
                      value={formData.recommendations || ''}
                      onChange={(e) => updateField('recommendations', e.target.value)}
                      placeholder={t('maintenanceForm.futureRecommendations')}
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center gap-3 sm:col-span-2">
                    <Switch
                      id="follow_up_required"
                      checked={formData.follow_up_required || false}
                      onCheckedChange={(checked) => updateField('follow_up_required', checked)}
                    />
                    <Label htmlFor="follow_up_required">{t('maintenanceForm.followUpRequired')}</Label>
                  </div>

                  {formData.follow_up_required && (
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="follow_up_notes">{t('maintenanceForm.followUpNotes')}</Label>
                      <Textarea
                        id="follow_up_notes"
                        value={formData.follow_up_notes || ''}
                        onChange={(e) => updateField('follow_up_notes', e.target.value)}
                        placeholder={t('maintenanceForm.notesForFollowUp')}
                        rows={2}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cost Tab */}
            <TabsContent value="cost" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('maintenanceForm.costInformation')}</CardTitle>
                  <CardDescription>{t('maintenanceForm.financialDetailsOfMaintenance')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="maintenance_cost">{t('maintenanceForm.maintenanceCost')}</Label>
                    <Input
                      id="maintenance_cost"
                      type="number"
                      step="0.01"
                      value={formData.maintenance_cost || ''}
                      onChange={(e) => updateField('maintenance_cost', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('maintenanceForm.paidBy')}</Label>
                    <Select
                      value={formData.paid_by || ''}
                      onValueChange={(value) => updateField('paid_by', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('maintenanceForm.selectPayer')} />
                      </SelectTrigger>
                      <SelectContent>
                        {formOptions?.paid_by_options?.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('maintenanceForm.paymentStatus')}</Label>
                    <Select
                      value={formData.payment_status || ''}
                      onValueChange={(value) => updateField('payment_status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('maintenanceForm.selectStatus')} />
                      </SelectTrigger>
                      <SelectContent>
                        {formOptions?.payment_statuses?.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoice_number">{t('maintenanceForm.invoiceNumber')}</Label>
                    <Input
                      id="invoice_number"
                      value={formData.invoice_number || ''}
                      onChange={(e) => updateField('invoice_number', e.target.value)}
                      placeholder={t('maintenanceForm.invoiceReference')}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Media Tab */}
            <TabsContent value="media" className="space-y-4">
              {/* Photos */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5" />
                        {t('maintenanceForm.photos')}
                      </CardTitle>
                      <CardDescription>{t('maintenanceForm.uploadMaintenancePhotos')}</CardDescription>
                    </div>
                    <div>
                      <input
                        type="file"
                        id="photo-upload"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        disabled={uploadingPhoto}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('photo-upload')?.click()}
                        disabled={uploadingPhoto}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingPhoto ? t('maintenanceForm.uploading') : t('maintenanceForm.upload')}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {formData.maintenance_photos ? (
                    <div className="relative aspect-video rounded-lg overflow-hidden border bg-muted group">
                      <img
                        src={getImageUrl(formData.maintenance_photos)}
                        alt="Maintenance"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => updateField('maintenance_photos', '')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="mb-2">{t('maintenanceForm.noPhotoUploaded')}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('photo-upload')?.click()}
                        disabled={uploadingPhoto}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {t('maintenanceForm.uploadPhoto')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Documentation */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('maintenanceForm.documentation')}</CardTitle>
                  <CardDescription>{t('maintenanceForm.reportsTestResults')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('maintenanceForm.reportsTestResults')}</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={getFileName(formData.reports)} 
                        readOnly 
                        placeholder={t('maintenanceForm.noFile')} 
                        className="flex-1 bg-muted" 
                      />
                      <input
                        type="file"
                        id="reports-upload"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleFileUpload(file, 'reports', setUploadingReport)
                            e.target.value = ''
                          }
                        }}
                        className="hidden"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon"
                        onClick={() => document.getElementById('reports-upload')?.click()}
                        disabled={uploadingReport}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      {formData.reports && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon"
                          onClick={() => updateField('reports', '')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sop_reference">{t('maintenanceForm.sopReference')}</Label>
                    <Input
                      id="sop_reference"
                      value={formData.sop_reference || ''}
                      onChange={(e) => updateField('sop_reference', e.target.value)}
                      placeholder={t('maintenanceForm.standardOperatingProcedureReference')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('maintenanceForm.certificateIfAny')}</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={getFileName(formData.certificate)} 
                        readOnly 
                        placeholder={t('maintenanceForm.noFile')} 
                        className="flex-1 bg-muted" 
                      />
                      <input
                        type="file"
                        id="cert-upload"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleFileUpload(file, 'certificate', setUploadingCertificate)
                            e.target.value = ''
                          }
                        }}
                        className="hidden"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon"
                        onClick={() => document.getElementById('cert-upload')?.click()}
                        disabled={uploadingCertificate}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      {formData.certificate && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon"
                          onClick={() => updateField('certificate', '')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Mobile Action Buttons */}
          <div className="flex sm:hidden gap-3 justify-end mt-6">
            <Button type="button" variant="outline" onClick={() => navigate('/maintenance')}>
              {t('maintenanceForm.cancel')}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? t('maintenanceForm.saving') : t('maintenanceForm.save')}
            </Button>
          </div>
        </form>

        {/* Sidebar Info (RIGHT SIDE) */}
        <div className="hidden lg:block space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('maintenanceForm.formProgress')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('maintenanceForm.status')}</span>
                <Badge variant={isDirty ? "default" : "secondary"}>
                  {isEdit ? t('maintenanceForm.update') : t('maintenanceForm.save')}
                </Badge>
              </div>
              {formData.gift_name && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('maintenanceList.gift')}</span>
                  <span className="font-medium truncate max-w-[120px]" title={formData.gift_name}>
                    {formData.gift_name}
                  </span>
                </div>
              )}
              {formData.maintenance_type && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('maintenanceList.type')}</span>
                  <Badge variant="outline" className="text-xs">
                    {formData.maintenance_type}
                  </Badge>
                </div>
              )}
              {formData.maintenance_cost && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('maintenanceList.cost')}</span>
                  <span className="font-medium">
                    {formData.maintenance_cost.toFixed(2)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {formData.gift && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('maintenanceForm.giftLocation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {formData.current_warehouse && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t('maintenanceForm.warehouse')}</p>
                    <p className="text-sm font-medium">{formData.current_warehouse}</p>
                  </div>
                )}
                {formData.current_location && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t('maintenanceForm.location')}</p>
                    <p className="text-sm font-medium">{formData.current_location}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {formData.follow_up_required && (
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-orange-900 dark:text-orange-100">
                  {t('maintenanceForm.followUpRequired')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-orange-900 dark:text-orange-100">
                  {t('maintenanceForm.checkFollowUpNotesForDetails')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
