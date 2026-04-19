import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, Package, Upload, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { GiftReceiptAPI, GiftCategoryAPI, GiftAPI, FileAPI } from '@/services/api'
import { toast } from 'sonner'
import type { GiftReceipt } from '@/types/gift'
import { format } from 'date-fns'
import { config } from '@/config/environment'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { usePrompt } from '@/hooks/usePrompt'

interface GiftDetail {
  attribute_label: string
  attribute_value: string
}

interface GiftComboboxProps {
  gifts: any[]
  selectedGift: string
  onSelectGift: (value: string) => void
  loading: boolean
}

function GiftCombobox({ gifts, selectedGift, onSelectGift, loading }: GiftComboboxProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const selectedGiftData = gifts.find(g => g.name === selectedGift)

  return (
    <div className="space-y-2">
      <Label>Select Existing Gift {loading && '(Loading...)'}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={loading}
          >
            {selectedGift && selectedGiftData ? (
              <span className="truncate">
                {selectedGiftData.gift_name} <span className="text-muted-foreground">({selectedGiftData.name})</span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                {loading ? 'Loading gifts...' : 'Search and select a gift...'}
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Search gifts by name or ID..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? (
                  <div className="py-6 text-center">
                    <Package className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading gifts...</p>
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">No gifts found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try a different search term
                    </p>
                  </div>
                )}
              </CommandEmpty>
              <CommandGroup heading={`${gifts.length} Available Gifts`}>
                {gifts.map((gift) => (
                  <CommandItem
                    key={gift.name}
                    value={`${gift.gift_name} ${gift.name}`}
                    onSelect={() => {
                      onSelectGift(gift.name)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedGift === gift.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="font-medium">{gift.gift_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {gift.name}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedGift && selectedGiftData && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Check className="h-3 w-3 text-green-600" />
          Selected: <span className="font-medium">{selectedGiftData.gift_name}</span>
        </div>
      )}
    </div>
  )
}

interface GiftImage {
  image: string
  image_caption?: string
}

export default function ReceiptForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const isEdit = !!id

  const [formData, setFormData] = useState<Partial<GiftReceipt>>({
    receipt_date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    receipt_status: 'Pending Inspection',
    create_new_gift: true,
    current_location_type: 'Warehouse',
    storage_date: format(new Date(), 'yyyy-MM-dd'),
  })

  const [attributes, setAttributes] = useState<GiftDetail[]>([])
  const [images, setImages] = useState<GiftImage[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Direct state for dropdowns
  const [categories, setCategories] = useState<any[]>([])
  const [existingGifts, setExistingGifts] = useState<any[]>([])
  const [receiptStatuses] = useState(['Pending Inspection', 'Approved', 'Quarantine', 'Rejected'])
  const [itemConditions] = useState(['New', 'Excellent', 'Good', 'Fair', 'Needs Repair', 'Living (Healthy)', 'Living (Sick)', 'Living (Needs Doctor)', 'Living (In Care)', 'Sent to Zoo', 'Deceased'])
  const [healthStatuses] = useState(['Healthy', 'Needs Checkup', 'Under Treatment', 'Recovering', 'Critical', 'Quarantine'])
  const [locationTypes] = useState(['Warehouse', 'Farm', 'Event', 'In Transit', 'With Recipient', 'Maintenance Center', 'Other'])
  const [transportMethods] = useState(['Air', 'Sea', 'Land', 'Hand Delivery'])
  
  const [loading, setLoading] = useState(true)
  const [fetchingGifts, setFetchingGifts] = useState(false)

  // Fetch all data on mount
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true)
      try {
        console.log('🔄 Fetching data using API services...')
        
        console.log('📦 Fetching categories...')
        const catResult = await GiftCategoryAPI.list()
        console.log('Categories result:', catResult)
        if (catResult.success && catResult.data) {
          setCategories(catResult.data)
          console.log(`✅ Loaded ${catResult.data.length} categories`)
        }

        console.log('✨ Initial load complete!')
      } catch (error) {
        console.error('❌ Error fetching data:', error)
        toast.error('Failed to load form data')
      } finally {
        setLoading(false)
      }
    }

    fetchAllData()
  }, [])

  // Fetch existing gifts when switching to link mode
  useEffect(() => {
    if (!formData.create_new_gift) {
      const fetchGifts = async () => {
        setFetchingGifts(true)
        try {
          console.log('🎁 Fetching available gifts using GiftAPI...')
          
          const result = await GiftAPI.list({ status: 'Available' })
          console.log('Gifts result:', result)
          
          if (result.success && result.data) {
            setExistingGifts(result.data)
            console.log(`✅ Loaded ${result.data.length} available gifts`)
          } else {
            console.warn('⚠️ No gifts returned or error:', result.error)
            const allResult = await GiftAPI.list()
            if (allResult.success && allResult.data) {
              const available = allResult.data.filter((g: any) => !g.status || g.status === 'Available')
              setExistingGifts(available)
              console.log(`✅ Filtered ${available.length} available gifts from all`)
            }
          }
        } catch (error) {
          console.error('❌ Failed to fetch gifts:', error)
          toast.error('Failed to load available gifts')
        } finally {
          setFetchingGifts(false)
        }
      }
      fetchGifts()
    } else {
      setExistingGifts([])
    }
  }, [formData.create_new_gift])

  // Fetch existing receipt if editing
  useEffect(() => {
    if (isEdit && id) {
      const fetchReceipt = async () => {
        try {
          console.log('📄 Fetching receipt:', id)
          const result = await GiftReceiptAPI.get(id)
          
          if (result.success && result.data) {
            console.log('✅ Receipt loaded:', result.data)
            setFormData(result.data)
            setAttributes(result.data.gift_details || [])
            setImages(result.data.gift_images || [])
          } else {
            toast.error(result.error || 'Failed to load receipt')
          }
        } catch (error) {
          console.error('❌ Error fetching receipt:', error)
          toast.error('Failed to load receipt')
        }
      }
      fetchReceipt()
    }
  }, [isEdit, id])

  // Handle category change
  const handleCategoryChange = async (categoryName: string) => {
    updateField('category', categoryName)
    
    if (!categoryName || !formData.create_new_gift) return

    try {
      console.log('🏷️ Fetching category:', categoryName)
      const result = await GiftCategoryAPI.get(categoryName)
      
      if (result.success && result.data) {
        console.log('✅ Category loaded:', result.data.category_name)
        console.log('📋 Gift details:', result.data.category_attributes)

        if (result.data.category_attributes && result.data.category_attributes.length > 0) {
          const mappedAttrs = result.data.category_attributes.map((attr: any) => ({
            attribute_label: attr.attribute_name || '',
            attribute_value: attr.default_value || '',
          }))
          setAttributes(mappedAttrs)
          setIsDirty(true)
          toast.success(`Loaded ${mappedAttrs.length} attributes from ${result.data.category_name}`)
        } else {
          toast.info('No predefined attributes for this category')
          setAttributes([])
        }
      } else {
        toast.error(result.error || 'Failed to load category')
      }
    } catch (error) {
      console.error('❌ Failed to fetch category:', error)
      toast.error('Failed to load category attributes')
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<GiftReceipt>) => {
      const submitData = {
        ...data,
        gift_details: attributes.filter(a => a.attribute_value).map((attr, idx) => ({
          ...attr,
          idx: idx + 1,
          doctype: 'Gift Details',
          parentfield: 'gift_details',
          parenttype: 'Gift Receipt',
        })),
        gift_images: images.map((img, idx) => ({
          ...img,
          idx: idx + 1,
          doctype: 'Gift Images',
          parentfield: 'gift_images',
          parenttype: 'Gift Receipt',
        })),
      }

      if (isEdit && id) {
        return GiftReceiptAPI.update(id, submitData)
      }
      return GiftReceiptAPI.create(submitData)
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(isEdit ? 'Receipt updated successfully' : 'Receipt created successfully')
        queryClient.invalidateQueries({ queryKey: ['gift-receipts'] })
        setIsDirty(false)
        navigate('/receipts')
      } else {
        toast.error(result.error || 'Failed to save receipt')
      }
    },
    onError: (error: Error) => toast.error(error.message),
  })

  usePrompt({
    when: isDirty && !saveMutation.isPending,
    message: 'You have unsaved changes in this gift receipt. Are you sure you want to leave?',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.received_from?.trim()) {
      toast.error(t('receipts.validation.receivedFromRequired'))
      return
    }
    if (formData.create_new_gift && !formData.gift_name?.trim()) {
      toast.error(t('receipts.validation.giftNameRequired'))
      return
    }
    if (!formData.create_new_gift && !formData.gift?.trim()) {
      toast.error(t('receipts.validation.selectGiftRequired'))
      return
    }
    
    saveMutation.mutate(formData)
  }

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value } as Partial<GiftReceipt>))
    setIsDirty(true)
  }

  const handleFileUpload = async (field: keyof GiftReceipt, file: File) => {
    try {
      const result = await FileAPI.upload(file)
      if (result.success && result.data) {
        updateField(field, result.data.file_url)
        toast.success('File uploaded successfully')
      } else {
        toast.error(result.error || 'Failed to upload file')
      }
    } catch (error) {
      toast.error('Failed to upload file')
    }
  }

  // Attribute handlers
  const addAttribute = () => {
    setAttributes([...attributes, { attribute_label: '', attribute_value: '' }])
    setIsDirty(true)
  }

  const updateAttribute = (index: number, field: 'attribute_label' | 'attribute_value', value: string) => {
    const updated = [...attributes]
    updated[index] = { ...updated[index], [field]: value }
    setAttributes(updated)
    setIsDirty(true)
  }

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index))
    setIsDirty(true)
  }

  // Image handlers
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const result = await FileAPI.upload(file)
      if (result.success && result.data) {
        setImages([...images, { image: result.data.file_url, image_caption: '' }])
        setIsDirty(true)
        toast.success('Image uploaded successfully')
      } else {
        toast.error(result.error || 'Failed to upload image')
      }
    } catch (error) {
      toast.error('Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  const updateImageCaption = (index: number, caption: string) => {
    const updated = [...images]
    updated[index] = { ...updated[index], image_caption: caption }
    setImages(updated)
    setIsDirty(true)
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
    setIsDirty(true)
  }

  const isLivingCondition = formData.item_condition?.includes('Living')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Package className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium">Loading form data...</p>
          <p className="text-sm text-muted-foreground mt-2">Check console (F12) for details</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/receipts')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEdit ? 'Edit Receipt' : 'New Gift Receipt'}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? 'Update receipt details' : 'Record receiving a new gift'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Receipt Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Receipt Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="receipt_date">Receipt Date *</Label>
              <Input
                id="receipt_date"
                type="datetime-local"
                value={formData.receipt_date ? format(new Date(formData.receipt_date), "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) => updateField('receipt_date', e.target.value.replace('T', ' ') + ':00')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.receipt_status || ''}
                onValueChange={(value) => updateField('receipt_status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {receiptStatuses.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="received_from">Received From *</Label>
              <Input
                id="received_from"
                value={formData.received_from || ''}
                onChange={(e) => updateField('received_from', e.target.value)}
                placeholder="Name of donor/source"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="received_by">Received By (User)</Label>
              <Input
                id="received_by"
                value={formData.received_by || ''}
                onChange={(e) => updateField('received_by', e.target.value)}
                placeholder="User email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source_contact">Source Contact</Label>
              <Input
                id="source_contact"
                value={formData.source_contact || ''}
                onChange={(e) => updateField('source_contact', e.target.value)}
                placeholder="Contact number"
              />
            </div>

            <div className="space-y-2">
              <Label>Transport Method</Label>
              <Select
                value={formData.transport_method || ''}
                onValueChange={(value) => updateField('transport_method', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {transportMethods.map(method => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transport_company">Transport Company</Label>
              <Input
                id="transport_company"
                value={formData.transport_company || ''}
                onChange={(e) => updateField('transport_company', e.target.value)}
                placeholder="Company name"
              />
            </div>
          </CardContent>
        </Card>

        {/* Gift Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Gift Details</CardTitle>
            <CardDescription>Create a new gift or link to an existing one</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                id="create_new_gift"
                checked={!!formData.create_new_gift}
                onCheckedChange={(checked) => updateField('create_new_gift', checked)}
                disabled={isEdit}
              />
              <Label htmlFor="create_new_gift">Create New Gift</Label>
            </div>

            <Separator />

            {formData.create_new_gift ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="gift_name">Gift Name *</Label>
                  <Input
                    id="gift_name"
                    value={formData.gift_name || ''}
                    onChange={(e) => updateField('gift_name', e.target.value)}
                    placeholder="Enter gift name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gift_id">Gift Code</Label>
                  <Input
                    id="gift_id"
                    value={formData.gift_id || ''}
                    onChange={(e) => updateField('gift_id', e.target.value)}
                    placeholder="Optional gift ID"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category || ''}
                    onValueChange={handleCategoryChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length > 0 ? (
                        categories.map(cat => (
                          <SelectItem key={cat.name} value={cat.name}>
                            {cat.category_name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-cat" disabled>No categories available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Describe the gift"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barcode_value">Barcode ID</Label>
                  <Input
                    id="barcode_value"
                    value={formData.barcode_value || ''}
                    onChange={(e) => updateField('barcode_value', e.target.value)}
                    placeholder="Barcode number"
                  />
                </div>
              </div>
            ) : (
              <GiftCombobox
                gifts={existingGifts}
                selectedGift={formData.gift || ''}
                onSelectGift={(value) => updateField('gift', value)}
                loading={fetchingGifts}
              />
            )}
          </CardContent>
        </Card>

        {/* Gift Attributes */}
        {formData.create_new_gift && formData.category && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Gift Attributes</CardTitle>
                  <CardDescription>Additional properties from category template</CardDescription>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addAttribute}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Attribute
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {attributes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No attributes defined. Select a category with attributes or add custom ones.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Attribute</TableHead>
                      <TableHead className="w-[50%]">Value</TableHead>
                      <TableHead className="w-[10%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attributes.map((attr, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            value={attr.attribute_label}
                            onChange={(e) => updateAttribute(index, 'attribute_label', e.target.value)}
                            placeholder="e.g., Color, Age"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={attr.attribute_value}
                            onChange={(e) => updateAttribute(index, 'attribute_value', e.target.value)}
                            placeholder="Enter value"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAttribute(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Condition Assessment */}
        <Card>
          <CardHeader>
            <CardTitle>Condition Assessment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Item Condition</Label>
              <Select
                value={formData.item_condition || ''}
                onValueChange={(value) => updateField('item_condition', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {itemConditions.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLivingCondition && (
              <div className="space-y-2">
                <Label>Health Status</Label>
                <Select
                  value={formData.health_status || ''}
                  onValueChange={(value) => updateField('health_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select health status" />
                  </SelectTrigger>
                  <SelectContent>
                    {healthStatuses.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="inspection_notes">Inspection Notes</Label>
              <Textarea
                id="inspection_notes"
                value={formData.inspection_notes || ''}
                onChange={(e) => updateField('inspection_notes', e.target.value)}
                placeholder="Notes from inspection"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inspection_date">Inspection Date</Label>
              <Input
                id="inspection_date"
                type="datetime-local"
                value={formData.inspection_date ? format(new Date(formData.inspection_date), "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) => updateField('inspection_date', e.target.value.replace('T', ' ') + ':00')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inspected_by">Inspected By</Label>
              <Input
                id="inspected_by"
                value={formData.inspected_by || ''}
                onChange={(e) => updateField('inspected_by', e.target.value)}
                placeholder="User email"
              />
            </div>
          </CardContent>
        </Card>

        {/* Storage Assignment */}
        <Card>
          <CardHeader>
            <CardTitle>Storage Assignment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Assign to Warehouse</Label>
              <Input
                value={formData.assign_to_warehouse || ''}
                onChange={(e) => updateField('assign_to_warehouse', e.target.value)}
                placeholder="Warehouse (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storage_location">Storage Location/Section</Label>
              <Input
                id="storage_location"
                value={formData.storage_location || ''}
                onChange={(e) => updateField('storage_location', e.target.value)}
                placeholder="Specific location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storage_date">Stored Since</Label>
              <Input
                id="storage_date"
                type="date"
                value={formData.storage_date || ''}
                onChange={(e) => updateField('storage_date', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Location Type</Label>
              <Select
                value={formData.current_location_type || ''}
                onValueChange={(value) => updateField('current_location_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {locationTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {[
              { field: 'health_certificate', label: 'Health Certificate' },
              { field: 'transport_documents', label: 'Transport Documents' },
              { field: 'purchase_invoice', label: 'Purchase Invoice' },
              { field: 'other_documents', label: 'Other Documents' },
            ].map(({ field, label }) => (
              <div key={field} className="space-y-2">
                <Label>{label}</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData[field as keyof GiftReceipt] as string || ''}
                    readOnly
                    placeholder="No file"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => document.getElementById(`${field}_input`)?.click()}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  <input
                    id={`${field}_input`}
                    type="file"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(field as keyof GiftReceipt, e.target.files[0])}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Gift Images */}
        {formData.create_new_gift && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Gift Images</CardTitle>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                    disabled={uploadingImage}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={uploadingImage}
                  >
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingImage ? 'Uploading...' : 'Upload Image'}
                    </label>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {images.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Package className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">No images uploaded</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  {images.map((img, index) => (
                    <Card key={index}>
                      <CardContent className="p-4 space-y-2">
                        <div className="relative group">
                          <img
                            src={`${config.apiBaseUrl}${img.image}`}
                            alt={img.image_caption || 'Gift image'}
                            className="w-full h-32 object-cover rounded"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeImage(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input
                          value={img.image_caption || ''}
                          onChange={(e) => updateImageCaption(index, e.target.value)}
                          placeholder="Caption (optional)"
                          className="text-sm"
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 justify-end sticky bottom-0 bg-background py-4 border-t">
          <Button type="button" variant="outline" onClick={() => navigate('/receipts')}>
            Cancel
          </Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Receipt' : 'Create Receipt'}
          </Button>
        </div>
      </form>
    </div>
  )
}
