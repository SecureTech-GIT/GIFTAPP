// src/pages/gifts/ReceivedGiftForm.tsx

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowLeft, Save, PackageCheck, Plus, Trash2, 
  Info, User, Truck, Warehouse as WarehouseIcon, FileText, UserCheck,
  Image as ImageIcon, Upload, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReceivedGiftAPI, GiftCategoryAPI, api } from '@/services/api'
import { toast } from 'sonner'
import type { ReceivedGift } from '@/services/api'
import { usePrompt } from '@/hooks/usePrompt'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { config } from '@/config/environment'
import { useTranslation } from 'react-i18next'

const attributeTypes = ['Text', 'Number', 'Select', 'Text Area', 'Date']

export default function ReceivedGiftForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const isEdit = !!id

  const [formData, setFormData] = useState<Partial<ReceivedGift>>({
    status: 'Received',
    received_date: new Date().toISOString().split('T')[0] + 'T' + new Date().toTimeString().slice(0, 5),
    gift_details: [],
    gift_images: [],
    gift_documents: [],
  })

  const [isDirty, setIsDirty] = useState(false)
  const [categoryChanged, setCategoryChanged] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingDocument, setUploadingDocument] = useState(false)

  // Fetch form options dynamically
  const { data: formOptions } = useQuery({
    queryKey: ['gift-received-form-options'],
    queryFn: async () => {
      const result = await ReceivedGiftAPI.getFormOptions()
      return result.success ? result.data : {
        occasions: [],
        statuses: [],
        location_types: [],
        donor_types: [],
        transport_methods: []
      }
    },
  })

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['gift-categories'],
    queryFn: async () => {
      const result = await GiftCategoryAPI.list()
      return result.success ? result.data : []
    },
  })

  // Fetch countries
  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/resource/Country', {
          params: {
            fields: JSON.stringify(['name', 'country_name']),
            limit_page_length: 999
          }
        })
        return response.data.data || []
      } catch (error) {
        console.error('Failed to fetch countries:', error)
        return []
      }
    },
  })

  // Fetch received gift if editing
  const { data: existingGift, isLoading } = useQuery({
    queryKey: ['received-gift', id],
    queryFn: async () => {
      if (!id) return null
      const result = await ReceivedGiftAPI.get(id)
      if (result.success && result.data) {
        setFormData(result.data)
        return result.data
      }
      throw new Error(result.error)
    },
    enabled: isEdit,
  })

  // Load category attributes when category changes (only for new documents)
  useEffect(() => {
    if (!formData.category || isEdit || !categoryChanged) return

    const loadAttributes = async () => {
      const result = await ReceivedGiftAPI.getCategoryAttributes(formData.category!)
      if (result.success && result.data && result.data.length > 0) {
        setFormData(prev => ({
          ...prev,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          gift_details: result.data.map((attr: any) => ({
            attribute_label: attr.attribute_label,
            attribute_value: attr.default_value || '',
            attribute_type: attr.attribute_type,
            is_mandatory: attr.is_mandatory,
            select_options: attr.select_options,
            display_order: attr.display_order,
          }))
        }))
        // console.log("s", result);
        toast.success(t('receivedGiftForm.loadedAttributesFromCategory', { count: result.data.length || 0 }))
        setIsDirty(true)
      }
    }

    loadAttributes()
    setCategoryChanged(false)
  }, [formData.category, isEdit, categoryChanged])

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ReceivedGift>) => {
      if (isEdit && id) {
        return ReceivedGiftAPI.update(id, data)
      }
      return ReceivedGiftAPI.create(data)
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(isEdit ? t('receivedGiftForm.inboundGiftUpdated') : t('receivedGiftForm.inboundGiftRecorded'))
        queryClient.invalidateQueries({ queryKey: ['received-gifts'] })
        setIsDirty(false)
        navigate(`/received-gifts/${result.data.name}`)
      } else {
        toast.error(result.error || t('receivedGiftForm.failedToSave'))
      }
    },
    onError: () => toast.error(t('receivedGiftForm.failedToSaveInboundGift')),
  })

  usePrompt({
    when: isDirty && !saveMutation.isPending,
    message: t('receivedGiftForm.unsavedChanges'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.gift_name?.trim()) {
      toast.error(t('receivedGiftForm.giftNameIsRequired'))
      setActiveTab('basic')
      return
    }

    // Validate mandatory attributes
    if (formData.gift_details && formData.gift_details.length > 0) {
      const missingAttrs = formData.gift_details
        .filter(attr => attr.is_mandatory && !attr.attribute_value?.trim())
        .map(attr => attr.attribute_label)
      
      if (missingAttrs.length > 0) {
        toast.error(t('receivedGiftForm.pleaseFillMandatoryAttributes', { attributes: missingAttrs.join(', ') }))
        setActiveTab('attributes')
        return
      }
    }

    saveMutation.mutate(formData)
  }

  const updateField = (field: keyof ReceivedGift, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  const updateAttribute = (index: number, field: string, value: any) => {
    const updated = [...(formData.gift_details || [])]
    updated[index] = { ...updated[index], [field]: value }
    updateField('gift_details', updated)
  }

  const addAttribute = () => {
    const newAttr = {
      attribute_label: '',
      attribute_value: '',
      attribute_type: 'Text',
      is_mandatory: false,
      select_options: '',
      display_order: (formData.gift_details?.length || 0) + 1,
    }
    updateField('gift_details', [...(formData.gift_details || []), newAttr])
  }

  const removeAttribute = (index: number) => {
    const updated = formData.gift_details?.filter((_, i) => i !== index)
    updateField('gift_details', updated)
  }

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingImage(true)

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error(t('receivedGiftForm.fileIsNotAnImageFile', { file: file.name }))
          continue
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(t('receivedGiftForm.fileIsTooLargeMaxSizeIs5MB', { file: file.name }))
          continue
        }

        // Upload to Frappe
        const formDataUpload = new FormData()
        formDataUpload.append('file', file)
        formDataUpload.append('is_private', '0')
        formDataUpload.append('folder', 'Home/Attachments')

        const response = await api.post('/api/method/upload_file', formDataUpload, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })

        if (response.data.message) {
          const fileUrl = response.data.message.file_url
          
          // Add to gift_images array
          const newImage = {
            image: fileUrl,
          }
          
          updateField('gift_images', [...(formData.gift_images || []), newImage])
          toast.success(t('receivedGiftForm.fileUploadedSuccessfully', { file: file.name }))
        }
      }
    } catch (error) {
      console.error('Image upload error:', error)
      toast.error(t('receivedGiftForm.failedToUploadImage'))
    } finally {
      setUploadingImage(false)
      // Reset input
      e.target.value = ''
    }
  }

  const removeImage = (index: number) => {
    const updated = formData.gift_images?.filter((_, i) => i !== index)
    updateField('gift_images', updated)
  }

  // Document upload handler
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingDocument(true)

    try {
      for (const file of Array.from(files)) {
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(t('receivedGiftForm.fileIsTooLargeMaxSizeIs10MB', { file: file.name }))
          continue
        }

        // Upload to Frappe
        const formDataUpload = new FormData()
        formDataUpload.append('file', file)
        formDataUpload.append('is_private', '0')
        formDataUpload.append('folder', 'Home/Attachments')

        const response = await api.post('/api/method/upload_file', formDataUpload, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })

        if (response.data.message) {
          const fileUrl = response.data.message.file_url
          
          // Add to gift_documents array
          const newDoc = {
            document: fileUrl,
            document_name: file.name,
            document_type: file.type || 'Unknown',
          }
          
          updateField('gift_documents', [...(formData.gift_documents || []), newDoc])
          toast.success(t('receivedGiftForm.fileUploadedSuccessfully', { file: file.name }))
        }
      }
    } catch (error) {
      console.error('Document upload error:', error)
      toast.error(t('receivedGiftForm.failedToUploadDocument'))
    } finally {
      setUploadingDocument(false)
      // Reset input
      e.target.value = ''
    }
  }

  const removeDocument = (index: number) => {
    const updated = formData.gift_documents?.filter((_, i) => i !== index)
    updateField('gift_documents', updated)
  }

  const getImageUrl = (path: string | undefined) => {
    if (!path) return ''
    if (path.startsWith('http') || path.startsWith('data:')) return path
    return `${config.apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`
  }

  // Check if moved to inventory
  const isMovedToInventory = formData.moved_to_inventory || false

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">{t('receivedGiftForm.loadingInboundGift')}</p>
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
            onClick={() => navigate('/received-gifts')}
            className="shrink-0 mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <PackageCheck className="h-6 w-6" />
              {isEdit ? t('receivedGiftForm.editInboundGift') : t('receivedGiftForm.recordNewInboundGift')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEdit ? t('receivedGiftForm.updateInboundGiftDetails') : t('receivedGiftForm.documentGiftFromExternalSource')}
            </p>
          </div>
        </div>
        
        {/* Desktop Actions */}
        <div className="hidden sm:flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => navigate('/received-gifts')}>
            {t('receivedGiftForm.cancel')}
          </Button>
          {!isMovedToInventory && (
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? t('receivedGiftForm.saving') : isEdit ? t('receivedGiftForm.update') : t('receivedGiftForm.save')}
            </Button>
          )}
        </div>
      </div>

      {/* Alert if moved to inventory */}
      {isMovedToInventory && formData.gift_created && (
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <PackageCheck className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-blue-900 dark:text-blue-100">
              {t('receivedGiftForm.thisGiftMovedToInventory', { gift: formData.gift_created || '' })}
            </span>
            <Button size="sm" variant="outline" asChild>
              <a href={`/gifts/${formData.gift_created}`}>{t('receivedGiftForm.viewGift')}</a>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Layout: Form (left) + Sidebar (right) */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        
        {/* Main Form with Tabs */}
        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="basic" className="text-xs sm:text-sm">
                <Info className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('receivedGiftForm.basic')}
              </TabsTrigger>
              <TabsTrigger value="received-by" className="text-xs sm:text-sm">
                <UserCheck className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('receivedGiftForm.receivedBy')}
              </TabsTrigger>
              <TabsTrigger value="attributes" className="text-xs sm:text-sm">
                <FileText className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('receivedGiftForm.attributes')}
              </TabsTrigger>
              <TabsTrigger value="received-from" className="text-xs sm:text-sm">
                <User className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('receivedGiftForm.from')}
              </TabsTrigger>
              <TabsTrigger value="transport" className="text-xs sm:text-sm">
                <Truck className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('receivedGiftForm.transport')}
              </TabsTrigger>
              <TabsTrigger value="storage" className="text-xs sm:text-sm">
                <WarehouseIcon className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('receivedGiftForm.storage')}
              </TabsTrigger>
              <TabsTrigger value="media" className="text-xs sm:text-sm">
                <ImageIcon className="h-4 w-4 mr-1.5 hidden sm:inline" />
                {t('receivedGiftForm.media')}
              </TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('receivedGiftForm.giftInformation')}</CardTitle>
                  <CardDescription>{t('receivedGiftForm.basicDetailsAboutInboundGift')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="gift_name">{t('receivedGiftForm.giftName')} *</Label>
                    <Input
                      id="gift_name"
                      value={formData.gift_name || ''}
                      onChange={(e) => updateField('gift_name', e.target.value)}
                      placeholder={t('receivedGiftForm.enterGiftName')}
                      required
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('receivedGiftForm.category')}</Label>
                    <Select
                      value={formData.category || ''}
                      onValueChange={(value) => {
                        updateField('category', value)
                        if (!isEdit) setCategoryChanged(true)
                      }}
                      disabled={isMovedToInventory}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('receivedGiftForm.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map(cat => (
                          <SelectItem key={cat.name} value={cat.name}>
                            {cat.category_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="received_date">{t('receivedGiftForm.dateTimeReceived')} *</Label>
                    <Input
                      id="received_date"
                      type="datetime-local"
                      value={formData.received_date || ''}
                      onChange={(e) => updateField('received_date', e.target.value)}
                      required
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('receivedGiftForm.status')}</Label>
                    <Select
                      value={formData.status || 'Received'}
                      onValueChange={(value) => updateField('status', value)}
                      disabled={isMovedToInventory}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {formOptions?.statuses?.map(status => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('receivedGiftForm.occasion')}</Label>
                    <Select
                      value={formData.occasion_received || ''}
                      onValueChange={(value) => updateField('occasion_received', value)}
                      disabled={isMovedToInventory}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('receivedGiftForm.selectOccasion')} />
                      </SelectTrigger>
                      <SelectContent>
                        {formOptions?.occasions?.map(occ => (
                          <SelectItem key={occ} value={occ}>{occ}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="description">{t('receivedGiftForm.description')}</Label>
                    <Textarea
                      id="description"
                      value={formData.description || ''}
                      onChange={(e) => updateField('description', e.target.value)}
                      placeholder={t('receivedGiftForm.briefDescriptionOfGift')}
                      rows={3}
                      disabled={isMovedToInventory}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Received By Information Tab */}
            <TabsContent value="received-by" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('receivedGiftForm.receivedByInformation')}</CardTitle>
                  <CardDescription>{t('receivedGiftForm.whoReceivedGiftOnBehalf')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="received_by_name">{t('receivedGiftForm.receivedByName')}</Label>
                    <Input
                      id="received_by_name"
                      value={formData.received_by_name || ''}
                      onChange={(e) => updateField('received_by_name', e.target.value)}
                      placeholder={t('receivedGiftForm.nameOfPersonWhoReceivedGift')}
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="received_by_designation">{t('receivedGiftForm.designation')}</Label>
                    <Input
                      id="received_by_designation"
                      value={formData.received_by_designation || ''}
                      onChange={(e) => updateField('received_by_designation', e.target.value)}
                      placeholder={t('receivedGiftForm.jobTitlePosition')}
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="received_by_contact">{t('receivedGiftForm.contactNumber')}</Label>
                    <Input
                      id="received_by_contact"
                      value={formData.received_by_contact || ''}
                      onChange={(e) => updateField('received_by_contact', e.target.value)}
                      placeholder="+971-50-xxx-xxxx"
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="received_by_email">{t('receivedGiftForm.email')}</Label>
                    <Input
                      id="received_by_email"
                      type="email"
                      value={formData.received_by_email || ''}
                      onChange={(e) => updateField('received_by_email', e.target.value)}
                      placeholder="email@example.com"
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="received_at_location">{t('receivedGiftForm.receivedAtLocation')}</Label>
                    <Textarea
                      id="received_at_location"
                      value={formData.received_at_location || ''}
                      onChange={(e) => updateField('received_at_location', e.target.value)}
                      placeholder={t('receivedGiftForm.physicalLocationWhereGiftWasReceived')}
                      rows={2}
                      disabled={isMovedToInventory}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Attributes Tab */}
            <TabsContent value="attributes" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t('receivedGiftForm.giftAttributes')}</CardTitle>
                      <CardDescription>
                        {formData.gift_details?.length 
                          ? `${formData.gift_details.length} ${t('receivedGiftForm.customAttributes')}${formData.gift_details.length !== 1 ? 's' : ''}`
                          : t('receivedGiftForm.noAttributesYet')}
                      </CardDescription>
                    </div>
                    {!isMovedToInventory && (
                      <Button type="button" variant="outline" size="sm" onClick={addAttribute}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('receivedGiftForm.add')}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.gift_details && formData.gift_details.length > 0 ? (
                    formData.gift_details.map((attr, index) => (
                      <div key={index} className="p-4 border rounded-lg bg-muted/30 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 grid gap-3 sm:grid-cols-2">
                            {/* Attribute Label */}
                            <div className="space-y-2">
                              <Label className="text-sm">{t('receivedGiftForm.attributeName')} *</Label>
                              <Input
                                value={attr.attribute_label || ''}
                                onChange={(e) => updateAttribute(index, 'attribute_label', e.target.value)}
                                placeholder={t('receivedGiftForm.colorSize')}
                                disabled={isMovedToInventory}
                              />
                            </div>

                          </div>

                          {!isMovedToInventory && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAttribute(index)}
                              className="shrink-0"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>

                        {/* Select Options (if type is Select) */}
                        {attr.attribute_type === 'Select' && (
                          <div className="space-y-2">
                            <Label className="text-sm">{t('receivedGiftForm.options')}</Label>
                            <Textarea
                              value={attr.select_options || ''}
                              onChange={(e) => updateAttribute(index, 'select_options', e.target.value)}
                              placeholder={t('receivedGiftForm.option1Option2Option3')}
                              rows={3}
                              disabled={isMovedToInventory}
                            />
                          </div>
                        )}

                        {/* Attribute Value */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">{t('receivedGiftForm.value')}</Label>
                            {attr.is_mandatory && (
                              <Badge variant="destructive" className="text-[10px] h-5">{t('receivedGiftForm.required')}</Badge>
                            )}
                          </div>
                          
                          {attr.attribute_type === 'Select' && attr.select_options ? (
                            <Select
                              value={attr.attribute_value || ''}
                              onValueChange={(value) => updateAttribute(index, 'attribute_value', value)}
                              disabled={isMovedToInventory}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('receivedGiftForm.selectValue')} />
                              </SelectTrigger>
                              <SelectContent>
                                {attr.select_options.split('\n').filter(Boolean).map((opt) => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : attr.attribute_type === 'Text Area' ? (
                            <Textarea
                              value={attr.attribute_value || ''}
                              onChange={(e) => updateAttribute(index, 'attribute_value', e.target.value)}
                              placeholder="Enter value"
                              rows={2}
                              disabled={isMovedToInventory}
                            />
                          ) : (
                            <Input
                              type={attr.attribute_type === 'Number' ? 'number' : attr.attribute_type === 'Date' ? 'date' : 'text'}
                              value={attr.attribute_value || ''}
                              onChange={(e) => updateAttribute(index, 'attribute_value', e.target.value)}
                              placeholder={t('receivedGiftForm.enterValue')}
                              disabled={isMovedToInventory}
                            />
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>{t('receivedGiftForm.noAttributesDefined')}</p>
                      <p className="text-sm mt-1">{t('receivedGiftForm.selectCategoryToAutoLoadAttributes')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Received From Tab (Previously Donor) */}
            <TabsContent value="received-from" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('receivedGiftForm.receivedFrom')}</CardTitle>
                  <CardDescription>{t('receivedGiftForm.detailsAboutWhoSentGift')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="donor">{t('receivedGiftForm.receivedFromPersonOrganization')}</Label>
                    <Input
                      id="donor"
                      value={formData.donor || ''}
                      onChange={(e) => updateField('donor', e.target.value)}
                      placeholder={t('receivedGiftForm.royalCourtEmbassyCompany')}
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('receivedGiftForm.receivedFromType')}</Label>
                    <Select
                      value={formData.donor_type || ''}
                      onValueChange={(value) => updateField('donor_type', value)}
                      disabled={isMovedToInventory}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('receivedGiftForm.receivedFrom')} />
                      </SelectTrigger>
                      <SelectContent>
                        {formOptions?.donor_types?.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('receivedGiftForm.country')}</Label>
                    <Select
                      value={formData.donor_country || ''}
                      onValueChange={(value) => updateField('donor_country', value)}
                      disabled={isMovedToInventory}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('receivedGiftForm.selectCountry')} />
                      </SelectTrigger>
                      <SelectContent>
                        {countries?.map((country: any) => (
                          <SelectItem key={country.name} value={country.name}>
                            {country.country_name || country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="donor_nationality">{t('receivedGiftForm.nationality')}</Label>
                    <Input
                      id="donor_nationality"
                      value={formData.donor_nationality || ''}
                      onChange={(e) => updateField('donor_nationality', e.target.value)}
                      placeholder={t('receivedGiftForm.nationality')}
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="donor_contact_person">{t('receivedGiftForm.contactPerson')}</Label>
                    <Input
                      id="donor_contact_person"
                      value={formData.donor_contact_person || ''}
                      onChange={(e) => updateField('donor_contact_person', e.target.value)}
                      placeholder={t('receivedGiftForm.contactPersonName')}
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="donor_phone">{t('receivedGiftForm.contactPhone')}</Label>
                    <Input
                      id="donor_phone"
                      value={formData.donor_phone || ''}
                      onChange={(e) => updateField('donor_phone', e.target.value)}
                      placeholder="+971-50-xxx-xxxx"
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="donor_email">{t('receivedGiftForm.contactEmail')}</Label>
                    <Input
                      id="donor_email"
                      type="email"
                      value={formData.donor_email || ''}
                      onChange={(e) => updateField('donor_email', e.target.value)}
                      placeholder="email@example.com"
                      disabled={isMovedToInventory}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('receivedGiftForm.coordinatorInformation')}</CardTitle>
                  <CardDescription>{t('receivedGiftForm.internalCoordinatorDetails')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="coordinator_name">{t('receivedGiftForm.coordinatorName')}</Label>
                    <Input
                      id="coordinator_name"
                      value={formData.coordinator_name || ''}
                      onChange={(e) => updateField('coordinator_name', e.target.value)}
                      placeholder={t('receivedGiftForm.coordinatorNamePlaceholder')}
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="coordinator_designation">{t('receivedGiftForm.designation')}</Label>
                    <Input
                      id="coordinator_designation"
                      value={formData.coordinator_designation || ''}
                      onChange={(e) => updateField('coordinator_designation', e.target.value)}
                      placeholder={t('receivedGiftForm.jobTitle')}
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="coordinator_phone">{t('receivedGiftForm.phone')}</Label>
                    <Input
                      id="coordinator_phone"
                      value={formData.coordinator_phone || ''}
                      onChange={(e) => updateField('coordinator_phone', e.target.value)}
                      placeholder="+971-50-xxx-xxxx"
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="coordinator_email">{t('receivedGiftForm.email')}</Label>
                    <Input
                      id="coordinator_email"
                      type="email"
                      value={formData.coordinator_email || ''}
                      onChange={(e) => updateField('coordinator_email', e.target.value)}
                      placeholder="email@example.com"
                      disabled={isMovedToInventory}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Transport Tab */}
            <TabsContent value="transport" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('receivedGiftForm.transportDelivery')}</CardTitle>
                  <CardDescription>{t('receivedGiftForm.shippingAndDeliveryInformation')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('receivedGiftForm.transportMethod')}</Label>
                    <Select
                      value={formData.transport_method || ''}
                      onValueChange={(value) => updateField('transport_method', value)}
                      disabled={isMovedToInventory}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('receivedGiftForm.selectMethod')} />
                      </SelectTrigger>
                      <SelectContent>
                        {formOptions?.transport_methods?.map(method => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transport_company">{t('receivedGiftForm.transportCompany')}</Label>
                    <Input
                      id="transport_company"
                      value={formData.transport_company || ''}
                      onChange={(e) => updateField('transport_company', e.target.value)}
                      placeholder={t('receivedGiftForm.courierShippingCompany')}
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tracking_number">{t('receivedGiftForm.trackingNumber')}</Label>
                    <Input
                      id="tracking_number"
                      value={formData.tracking_number || ''}
                      onChange={(e) => updateField('tracking_number', e.target.value)}
                      placeholder={t('receivedGiftForm.trackingAWBNumber')}
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="delivered_by">{t('receivedGiftForm.deliveredBy')}</Label>
                    <Input
                      id="delivered_by"
                      value={formData.delivered_by || ''}
                      onChange={(e) => updateField('delivered_by', e.target.value)}
                      placeholder={t('receivedGiftForm.personWhoDelivered')}
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="source_location">{t('receivedGiftForm.sourceLocation')}</Label>
                    <Textarea
                      id="source_location"
                      value={formData.source_location || ''}
                      onChange={(e) => updateField('source_location', e.target.value)}
                      placeholder={t('receivedGiftForm.originAddress')}
                      rows={2}
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="source_contact">{t('receivedGiftForm.sourceContact')}</Label>
                    <Input
                      id="source_contact"
                      value={formData.source_contact || ''}
                      onChange={(e) => updateField('source_contact', e.target.value)}
                      placeholder={t('receivedGiftForm.contactAtSource')}
                      disabled={isMovedToInventory}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Storage Tab */}
            <TabsContent value="storage" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('receivedGiftForm.storageDetails')}</CardTitle>
                  <CardDescription>{t('receivedGiftForm.currentStorageLocationInformation')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('receivedGiftForm.warehouse')}</Label>
                    <Input
                      value={formData.warehouse || ''}
                      onChange={(e) => updateField('warehouse', e.target.value)}
                      placeholder={t('receivedGiftForm.selectWarehouse')}
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storage_location">{t('receivedGiftForm.storageLocationSection')}</Label>
                    <Input
                      id="storage_location"
                      value={formData.storage_location || ''}
                      onChange={(e) => updateField('storage_location', e.target.value)}
                      placeholder={t('receivedGiftForm.sectionShelfBin')}
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storage_date">{t('receivedGiftForm.storedSince')}</Label>
                    <Input
                      id="storage_date"
                      type="date"
                      value={formData.storage_date || ''}
                      onChange={(e) => updateField('storage_date', e.target.value)}
                      disabled={isMovedToInventory}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('receivedGiftForm.locationType')}</Label>
                    <Select
                      value={formData.current_location_type || ''}
                      onValueChange={(value) => updateField('current_location_type', value)}
                      disabled={isMovedToInventory}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('receivedGiftForm.selectLocationType')} />
                      </SelectTrigger>
                      <SelectContent>
                        {formOptions?.location_types?.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Media Tab - Images & Documents */}
            <TabsContent value="media" className="space-y-4">
              {/* Images */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5" />
                        {t('receivedGiftForm.giftImages')}
                      </CardTitle>
                      <CardDescription>
                        {t('receivedGiftForm.uploadPhotosOfInboundGift')}
                      </CardDescription>
                    </div>
                    {!isMovedToInventory && (
                      <div>
                        <input
                          type="file"
                          id="image-upload"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('image-upload')?.click()}
                          disabled={uploadingImage}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadingImage ? t('receivedGiftForm.uploading') : t('receivedGiftForm.uploadImages')}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {formData.gift_images && formData.gift_images.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {formData.gift_images.map((img, index) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden border bg-muted group">
                          <img
                            src={getImageUrl(img.image)}
                            alt={`Gift ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23999" font-size="14"%3ENo Image%3C/text%3E%3C/svg%3E'
                            }}
                          />
                          {!isMovedToInventory && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeImage(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="mb-2">{t('receivedGiftForm.noImagesUploaded')}</p>
                      {!isMovedToInventory && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('image-upload')?.click()}
                          disabled={uploadingImage}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {t('receivedGiftForm.uploadImages')}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

            </TabsContent>
          </Tabs>

          {/* Mobile Action Buttons */}
          <div className="flex sm:hidden gap-3 justify-end mt-6">
            <Button type="button" variant="outline" onClick={() => navigate('/received-gifts')}>
              {t('receivedGiftForm.cancel')}
            </Button>
            {!isMovedToInventory && (
              <Button type="submit" disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? t('receivedGiftForm.saving') : t('receivedGiftForm.save')}
              </Button>
            )}
          </div>
        </form>

        {/* Sidebar Info (RIGHT SIDE) */}
        <div className="hidden lg:block space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('receivedGiftForm.formProgress')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('receivedGiftForm.status')}</span>
                <Badge variant={isMovedToInventory ? "secondary" : "default"}>
                  {isMovedToInventory ? t('receivedGiftForm.readOnly') : isDirty ? t('receivedGiftForm.unsaved') : t('receivedGiftForm.saved')}
                </Badge>
              </div>
              {formData.gift_name && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('receivedGiftForm.giftName')}</span>
                  <span className="font-medium truncate max-w-[120px]" title={formData.gift_name}>
                    {formData.gift_name}
                  </span>
                </div>
              )}
              {formData.gift_images && formData.gift_images.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('receivedGiftForm.images')}</span>
                  <Badge variant="outline" className="text-xs">
                    {formData.gift_images.length}
                  </Badge>
                </div>
              )}
              {formData.gift_documents && formData.gift_documents.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('receivedGiftForm.documents')}</span>
                  <Badge variant="outline" className="text-xs">
                    {formData.gift_documents.length}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {formData.category && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('receivedGiftForm.category')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">
                  {categories?.find(c => c.name === formData.category)?.category_name || formData.category}
                </p>
                {formData.gift_details && formData.gift_details.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.gift_details.length} attribute{formData.gift_details.length !== 1 ? 's' : ''}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {isMovedToInventory && formData.gift_created && (
            <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-purple-900 dark:text-purple-100">
                  {t('receivedGiftForm.movedToInventory')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-purple-900 dark:text-purple-100 mb-2">
                  {t('receivedGiftForm.giftId')}: <strong>{formData.gift_created}</strong>
                </p>
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <a href={`/gifts/${formData.gift_created}`}>{t('receivedGiftForm.viewInInventory')}</a>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
