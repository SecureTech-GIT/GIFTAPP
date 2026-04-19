import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Edit, Calendar, MapPin, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CategoryAPI, DocTypeAPI, EventAPI, FileAPI, GiftAPI, GiftRecipientAPI } from '@/services/api'
import { format } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/Pagination'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button as UIButton } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2 } from 'lucide-react'

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria', 'Bahrain',
  'Bangladesh', 'Belgium', 'Brazil', 'Canada', 'China', 'Denmark', 'Egypt',
  'France', 'Germany', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Italy',
  'Japan', 'Jordan', 'Kuwait', 'Lebanon', 'Malaysia', 'Mexico', 'Netherlands',
  'New Zealand', 'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Palestine', 'Philippines',
  'Poland', 'Portugal', 'Qatar', 'Russia', 'Saudi Arabia', 'Singapore', 'South Africa',
  'South Korea', 'Spain', 'Sweden', 'Switzerland', 'Syria', 'Thailand', 'Turkey',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Yemen'
]

export default function EventDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'overview' | 'participants'>('overview')
  const [participantSearch, setParticipantSearch] = useState('')
  const [participantPage, setParticipantPage] = useState(1)
  const [participantLimit, setParticipantLimit] = useState(20)
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null)

  const [actionSidebarOpen, setActionSidebarOpen] = useState(false)
  const [actionTab, setActionTab] = useState<'new_participant' | 'new_gift'>('new_participant')

  const actionTitle = useMemo(() => {
    if (actionTab === 'new_gift') return t('events.addGift') || 'Add Gift'
    return t('events.addParticipant') || 'Add Participant'
  }, [actionTab, t])

  const [participantTab, setParticipantTab] = useState<'basic' | 'professional' | 'contact' | 'coordinator'>('basic')
  const [giftTab, setGiftTab] = useState<'basic' | 'attributes' | 'location' | 'images'>('basic')

  const [hasCoordinator, setHasCoordinator] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [nationalitySearch, setNationalitySearch] = useState('')

  const [uploadingImage, setUploadingImage] = useState(false)

  const [newParticipant, setNewParticipant] = useState({
    salutation: '',
    guest_first_name: '',
    guest_last_name: '',
    designation: '',
    organization: '',
    email: '',
    mobile_number: '',
    guest_nationality: '',
    guest_country: '',
    address: '',
    emirates_id: '',
    recipient_type: 'Individual',
    vip_level: 'Standard',
    preferred_contact_method: 'Email',
    blocked: false,
    person_photo: '',
    is_active: true,
    coordinator_full_name: '',
    coordinator_email: '',
    coordinator_mobile_no: '',
    coordinator_emirates_id: '',
  })

  const filteredCountries = COUNTRIES.filter((c) => c.toLowerCase().includes(countrySearch.toLowerCase()))
  const filteredNationalities = COUNTRIES.filter((c) => c.toLowerCase().includes(nationalitySearch.toLowerCase()))

  const [newGift, setNewGift] = useState({
    gift_name: '',
    quantity: 1 as any,
    estimated_value: '' as any,
    category: '',
    description: '',
    status: 'Available',
    barcode_value: '',
    received_datetime: '',
    received_by_name: '',
    received_by_contact: '',
    warehouse: '',
    storage_location: '',
    storage_date: '',
    location_contact_person: '',
    location_contact_number: '',
    location_address: '',
    table_gvlf: [] as Array<{
      attribute_name: string
      attribute_type: 'Text' | 'Number' | 'Select' | 'Date' | 'Checkbox'
      default_value?: string
      is_mandatory?: boolean
      select_options?: string
      display_order?: number
    }>,
    gift_images: [] as Array<{ image: string }>,
  })

  const addGiftAttributeRow = () => {
    setNewGift((g) => ({
      ...g,
      table_gvlf: [
        ...g.table_gvlf,
        {
          attribute_name: '',
          attribute_type: 'Text',
          default_value: '',
          is_mandatory: false,
          select_options: '',
          display_order: g.table_gvlf.length,
        },
      ],
    }))
  }

  const handleGiftImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    setUploadingImage(true)
    try {
      const result = await FileAPI.upload(file, false)
      if (result.success && result.data) {
        setNewGift((g) => ({
          ...g,
          gift_images: [...g.gift_images, { image: result.data.file_url }],
        }))
        toast.success('Image uploaded successfully')
      } else {
        toast.error(result.error || 'Failed to upload image')
      }
    } catch {
      toast.error('Failed to upload image')
    } finally {
      setUploadingImage(false)
      e.target.value = ''
    }
  }

  const handleGiftCategoryChange = async (categoryValue: string) => {
    setNewGift((g) => ({ ...g, category: categoryValue }))

    if (!categoryValue) {
      setNewGift((g) => ({ ...g, table_gvlf: [] }))
      return
    }

    const result = await CategoryAPI.getAttributes(categoryValue)
    if (!result.success) {
      toast.error(result.error || 'Failed to load category attributes')
      return
    }

    const categoryAttributes = result.data || []
    if (Array.isArray(categoryAttributes) && categoryAttributes.length > 0) {
      const mappedAttributes = categoryAttributes.map((attr: any, index: number) => ({
        attribute_name: attr.attribute_name || attr.attribute_label || '',
        attribute_type: attr.attribute_type || 'Text',
        default_value: '',
        is_mandatory: !!attr.is_mandatory,
        select_options: attr.select_options || '',
        display_order: typeof attr.display_order === 'number' ? attr.display_order : index,
      }))
      setNewGift((g) => ({ ...g, table_gvlf: mappedAttributes }))
      toast.success(`Loaded ${mappedAttributes.length} attributes from category`)
    } else {
      setNewGift((g) => ({ ...g, table_gvlf: [] }))
    }
  }

  const renderGiftAttributeDefaultInput = (row: any, idx: number) => {
    const fieldValue = row.default_value || ''
    const setDefaultValue = (val: string) => {
      setNewGift((g) => ({
        ...g,
        table_gvlf: g.table_gvlf.map((r, i) => (i === idx ? { ...r, default_value: val } : r)),
      }))
    }

    switch (row.attribute_type) {
      case 'Select': {
        const options = (row.select_options || '').split('\n').filter(Boolean)
        return (
          <Select value={fieldValue} onValueChange={setDefaultValue}>
            <SelectTrigger>
              <SelectValue placeholder={t('gift.selectValue')} />
            </SelectTrigger>
            <SelectContent>
              {options.length > 0 ? (
                options.map((opt: string) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="__no_options__" disabled>
                  {t('gift.addOptionsBelowFirst')}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        )
      }
      case 'Number':
        return <Input type="number" value={fieldValue} onChange={(e) => setDefaultValue(e.target.value)} placeholder={t('gift.enterNumber')} />
      case 'Date':
        return <Input type="date" value={fieldValue} onChange={(e) => setDefaultValue(e.target.value)} />
      case 'Checkbox':
        return (
          <div className="flex items-center h-10">
            <Checkbox
              checked={fieldValue === '1' || fieldValue === 'true'}
              onCheckedChange={(checked) => setDefaultValue(checked ? '1' : '0')}
            />
            <span className="ltr:ml-2 rtl:mr-2 text-sm">
              {fieldValue === '1' || fieldValue === 'true' ? t('common.yes') : t('common.no')}
            </span>
          </div>
        )
      default:
        return <Input value={fieldValue} onChange={(e) => setDefaultValue(e.target.value)} placeholder={t('gift.enterValue')} />
    }
  }

  const { data: giftCategoryList = [], isLoading: isLoadingGiftCategories } = useQuery({
    queryKey: ['gift-categories'],
    queryFn: async () => {
      const result = await CategoryAPI.list()
      return result.success ? result.data : []
    },
  })

  const { data: giftStatusOptions = [], isLoading: isLoadingGiftStatus } = useQuery({
    queryKey: ['field-options', 'Gift', 'status'],
    queryFn: async () => {
      const res = await DocTypeAPI.getFieldOptions('Gift', 'status')
      return res.success ? res.data : []
    },
  })

  const removeGiftAttributeRow = (idx: number) => {
    setNewGift((g) => ({
      ...g,
      table_gvlf: g.table_gvlf.filter((_, i) => i !== idx),
    }))
  }

  const addGiftImageRow = () => {
    setNewGift((g) => ({
      ...g,
      gift_images: [...g.gift_images, { image: '' }],
    }))
  }

  const removeGiftImageRow = (idx: number) => {
    setNewGift((g) => ({
      ...g,
      gift_images: g.gift_images.filter((_, i) => i !== idx),
    }))
  }

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['event-detail', id],
    queryFn: async () => {
      if (!id) throw new Error('No event id')
      const res = await EventAPI.getWithCounts(id)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: !!id,
  })

  const eventName = (event as any)?.name as string | undefined

  const openNewParticipant = () => {
    setActionTab('new_participant')
    setActionSidebarOpen(true)
  }

  const openNewGift = () => {
    setActionTab('new_gift')
    setActionSidebarOpen(true)
  }

  const createParticipantMutation = useMutation({
    mutationFn: async () => {
      if (!eventName) throw new Error('No event')

      const dataToSend = { ...newParticipant } as any
      if (!hasCoordinator) {
        dataToSend.coordinator_full_name = ''
        dataToSend.coordinator_email = ''
        dataToSend.coordinator_mobile_no = ''
        dataToSend.coordinator_emirates_id = ''
      }

      const createRes = await GiftRecipientAPI.create({
        ...dataToSend,
      } as any)
      if (!createRes.success || !createRes.data?.name) throw new Error(createRes.error || 'Failed to create participant')
      const linkRes = await EventAPI.addParticipantToEvent(eventName, createRes.data.name, 'Invited')
      if (!linkRes.success) throw new Error(linkRes.error || 'Failed to link participant')
      return { recipient: createRes.data, link: linkRes.data }
    },
    onSuccess: () => {
      toast.success(t('events.participantAdded') || 'Participant added')
      setNewParticipant({
        salutation: '',
        guest_first_name: '',
        guest_last_name: '',
        designation: '',
        organization: '',
        email: '',
        mobile_number: '',
        guest_nationality: '',
        guest_country: '',
        address: '',
        emirates_id: '',
        recipient_type: 'Individual',
        vip_level: 'Standard',
        preferred_contact_method: 'Email',
        blocked: false,
        person_photo: '',
        is_active: true,
        coordinator_full_name: '',
        coordinator_email: '',
        coordinator_mobile_no: '',
        coordinator_emirates_id: '',
      })
      setHasCoordinator(false)
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['event-participants', eventName] })
      setActionSidebarOpen(false)
      setActiveTab('participants')
    },
    onError: (e: any) => {
      toast.error(String(e?.message || e || 'Failed to add participant'))
    },
  })

  const createGiftMutation = useMutation({
    mutationFn: async () => {
      if (!eventName) throw new Error('No event')
      if (!newGift.gift_name) throw new Error('Gift name is required')

      const parsedQty = typeof newGift.quantity === 'string' ? parseInt(newGift.quantity, 10) : Number(newGift.quantity)
      const quantity = Number.isFinite(parsedQty) ? parsedQty : undefined

      const parsedVal = typeof newGift.estimated_value === 'string' ? parseFloat(newGift.estimated_value) : Number(newGift.estimated_value)
      const estimated_value = Number.isFinite(parsedVal) ? parsedVal : undefined

      const createRes = await GiftAPI.create({
        gift_name: newGift.gift_name,
        quantity: quantity as any,
        estimated_value: estimated_value as any,
        category: newGift.category || undefined,
        description: newGift.description || undefined,
        status: newGift.status || 'Available',
        barcode_value: newGift.barcode_value || undefined,
        warehouse: newGift.warehouse || undefined,
        storage_location: newGift.storage_location || undefined,
        storage_date: newGift.storage_date || undefined,
        location_contact_person: newGift.location_contact_person || undefined,
        location_contact_number: newGift.location_contact_number || undefined,
        location_address: newGift.location_address || undefined,
        received_datetime: newGift.received_datetime || undefined,
        received_by_name: newGift.received_by_name || undefined,
        received_by_contact: newGift.received_by_contact || undefined,
        table_gvlf: (newGift.table_gvlf || []).map((d, idx) => ({
          idx: idx + 1,
          doctype: 'Gift Category Details',
          parentfield: 'table_gvlf',
          parenttype: 'Gift',
          attribute_name: d.attribute_name,
          attribute_type: d.attribute_type || 'Text',
          default_value: d.default_value || '',
          is_mandatory: d.is_mandatory ? 1 : 0,
          select_options: d.select_options || '',
          display_order: typeof d.display_order === 'number' ? d.display_order : idx,
        })) as any,
        gift_images: (newGift.gift_images || []).map((i, idx) => ({
          idx: idx + 1,
          doctype: 'Gift Images',
          parentfield: 'gift_images',
          parenttype: 'Gift',
          image: i.image,
        })) as any,
      } as any)
      if (!createRes.success || !createRes.data?.name) throw new Error(createRes.error || 'Failed to create gift')
      const linkRes = await EventAPI.addGiftToEvent(eventName, createRes.data.name)
      if (!linkRes.success) throw new Error(linkRes.error || 'Failed to link gift')
      return { gift: createRes.data, link: linkRes.data }
    },
    onSuccess: () => {
      toast.success(t('events.giftMovedToEvent') || 'Gift added')
      setNewGift({
        gift_name: '',
        quantity: 1 as any,
        estimated_value: '' as any,
        category: '',
        description: '',
        status: 'Available',
        barcode_value: '',
        received_datetime: '',
        received_by_name: '',
        received_by_contact: '',
        warehouse: '',
        storage_location: '',
        storage_date: '',
        location_contact_person: '',
        location_contact_number: '',
        location_address: '',
        table_gvlf: [],
        gift_images: [],
      })
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['gift-events'] })
      setActionSidebarOpen(false)
      setActiveTab('overview')
    },
    onError: (e: any) => {
      toast.error(String(e?.message || e || 'Failed to add gift'))
    },
  })

  const {
    data: participantsRes,
    isLoading: participantsLoading,
    error: participantsError,
  } = useQuery({
    queryKey: ['event-participants', eventName, participantSearch, participantPage, participantLimit],
    queryFn: async () => {
      if (!eventName) throw new Error('No event name')
      const res = await EventAPI.listEventParticipants(
        eventName,
        participantSearch,
        participantPage,
        participantLimit
      )
      if (!res.success) throw new Error(res.error)
      return res
    },
    enabled: Boolean(eventName) && activeTab === 'participants',
  })

  const { data: selectedGuest, isLoading: isLoadingSelectedGuest } = useQuery({
    queryKey: ['gift-recipient', selectedGuestId],
    queryFn: async () => {
      if (!selectedGuestId) return null
      const res = await GiftRecipientAPI.get(selectedGuestId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: Boolean(selectedGuestId),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="p-8 space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{String(error || t('common.failedToLoad'))}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => navigate('/events')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Button>
      </div>
    )
  }

  const managers = (event as any).event_managers || []
  const coordinators = (event as any).event_coordinators || []
  const categories = (event as any).event_categories || []
  const gifts = (event as any).event_gifts || []

  const participants = (participantsRes as any)?.data || []
  const totalParticipants = (participantsRes as any)?.total || 0
  const totalParticipantPages = Math.max(1, Math.ceil(totalParticipants / participantLimit))

  const formatDateTime = (v: string | undefined) => {
    if (!v) return '-'
    try {
      return format(new Date(v), 'dd MMM yyyy, hh:mm a')
    } catch {
      return v
    }
  }

  const locationParts = [
    event.address_line_1,
    event.address_line_2,
    event.city,
    event.state,
    event.postal_code,
    event.country,
  ].filter(Boolean)
  const locationText = locationParts.length ? locationParts.join(', ') : '-'

  return (
    <div className="space-y-4 md:space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/events')} className="self-start">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">{event.subject}</h1>
          <p className="text-sm text-muted-foreground font-mono break-all">{event.name}</p>
        </div>
        <Button asChild variant="outline">
          <Link to={`/events/${encodeURIComponent(event.name)}/edit`}>
            <Edit className="h-4 w-4 mr-2" />
            {t('common.edit')}
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="overview" className="py-2">{t('common.overview') || 'Overview'}</TabsTrigger>
          <TabsTrigger value="participants" className="py-2">{t('events.participantsTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('events.eventDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground">{t('common.status')}</div>
                <Badge>{event.status || '-'}</Badge>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground">{t('events.startDate')}</div>
                    <div className="font-medium">{formatDateTime(event.starts_on)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground">{t('events.endDate')}</div>
                    <div className="font-medium">{formatDateTime(event.ends_on)}</div>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <div className="text-muted-foreground">{t('common.location')}</div>
                  <div className="font-medium break-words">{locationText}</div>
                </div>
              </div>
              {event.description && (
                <>
                  <Separator />
                  <div>
                    <div className="text-muted-foreground">{t('events.eventDescription')}</div>
                    <div className="whitespace-pre-wrap">{event.description}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('events.giftsTab')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {gifts.length === 0 && <div className="text-muted-foreground">{t('common.noResults')}</div>}
              {gifts.map((g: any) => (
                <div key={g.name || g.gift} className="flex items-center justify-between border-b last:border-b-0 py-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{g.gift_name || g.gift}</div>
                    <div className="text-xs text-muted-foreground truncate">{g.category || '-'}</div>
                  </div>
                  <Badge variant="outline">{g.display_status || '-'}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
            </div>

            <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('common.actions')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" onClick={openNewParticipant}>
                {t('events.addParticipant') || 'Add Participant'}
              </Button>
              <Button className="w-full" variant="outline" onClick={openNewGift}>
                {t('events.addGift') || 'Add Gift'}
              </Button>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">{t('events.giftsTab')}</div>
                <Badge variant="secondary">{gifts.length}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">{t('events.participantsTab')}</div>
                <Badge variant="secondary">{totalParticipants}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('events.eventTeam')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('events.eventManagers')}
                </div>
                <Badge variant="secondary">{managers.length}</Badge>
              </div>
              {managers.map((m: any) => (
                <div key={m.name || m.user} className="flex items-center justify-between">
                  <div className="truncate">{m.full_name || m.user || '-'}</div>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('events.eventCoordinators')}
                </div>
                <Badge variant="secondary">{coordinators.length}</Badge>
              </div>
              {coordinators.map((c: any) => (
                <div key={c.name || c.user} className="flex items-center justify-between">
                  <div className="truncate">{c.full_name || c.user || '-'}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('events.categoriesTab')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {categories.length === 0 && <div className="text-muted-foreground">{t('common.noResults')}</div>}
              {categories.map((c: any) => (
                <div key={c.name || c.category} className="flex items-center justify-between">
                  <div className="truncate">{c.category}</div>
                  <Badge variant="outline">{Number(c.available_count) || 0}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="participants" className="mt-4">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-base">{t('events.participantsTab')}</CardTitle>
              <Input
                value={participantSearch}
                onChange={(e) => {
                  setParticipantSearch(e.target.value)
                  setParticipantPage(1)
                }}
                placeholder={t('common.search')}
              />
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {participantsLoading && <div className="text-muted-foreground">{t('common.loading')}</div>}
              {participantsError && <div className="text-destructive">{String(participantsError)}</div>}
              {!participantsLoading && participants.length === 0 && (
                <div className="text-muted-foreground">{t('common.noResults')}</div>
              )}
              {participants.map((p: any) => (
                <button
                  key={p.name || p.gift_recipient}
                  type="button"
                  onClick={() => setSelectedGuestId(p.gift_recipient || null)}
                  className="w-full text-left flex items-center justify-between border-b last:border-b-0 py-2 hover:bg-muted/40 rounded-sm px-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.recipient_name || p.gift_recipient || '-'}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.coordinator_name || '-'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{p.attending || '-'}</Badge>
                    <Badge variant={(Number(p.interested_gifts_count) || 0) > 0 ? 'default' : 'secondary'}>
                      {t('events.interests')}: {Number(p.interested_gifts_count) || 0}
                    </Badge>
                    <Badge variant={(Number(p.issued_gifts_count) || 0) > 0 ? 'default' : 'secondary'}>
                      {t('events.issued')}: {Number(p.issued_gifts_count) || 0}
                    </Badge>
                  </div>
                </button>
              ))}

              <div className="pt-4">
                <Pagination
                  currentPage={participantPage}
                  totalPages={totalParticipantPages}
                  totalItems={totalParticipants}
                  itemsPerPage={participantLimit}
                  onPageChange={setParticipantPage}
                  onItemsPerPageChange={(items) => {
                    setParticipantLimit(items)
                    setParticipantPage(1)
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <Sheet open={Boolean(selectedGuestId)} onOpenChange={(open) => !open && setSelectedGuestId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t('events.guestDetails') || 'Guest Details'}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {isLoadingSelectedGuest && <div className="text-sm text-muted-foreground">{t('common.loading')}</div>}
            {!isLoadingSelectedGuest && selectedGuest && (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Name</div>
                  <div className="font-medium">{(selectedGuest as any).owner_full_name || (selectedGuest as any).name}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-muted-foreground">Phone</div>
                    <div className="font-medium break-words">{(selectedGuest as any).mobile_number || '-'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Email</div>
                    <div className="font-medium break-words">{(selectedGuest as any).email || '-'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Coordinator</div>
                    <div className="font-medium break-words">{(selectedGuest as any).coordinator_full_name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Coordinator Phone</div>
                    <div className="font-medium break-words">{(selectedGuest as any).coordinator_mobile_no || '-'}</div>
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="text-muted-foreground">Address</div>
                  <div className="font-medium whitespace-pre-wrap">{(selectedGuest as any).address || '-'}</div>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={actionSidebarOpen} onOpenChange={setActionSidebarOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{actionTitle}</SheetTitle>
          </SheetHeader>

          <div className="mt-4">
            <Tabs value={actionTab} onValueChange={(v) => setActionTab(v as any)} className="w-full">
              <TabsList className="flex w-full overflow-x-auto gap-2">
                <TabsTrigger value="new_participant" className="shrink-0">{t('events.addParticipant') || 'Add Participant'}</TabsTrigger>
                <TabsTrigger value="new_gift" className="shrink-0">{t('events.addGift') || 'Add Gift'}</TabsTrigger>
              </TabsList>

              <TabsContent value="new_participant" className="mt-4">
                <Tabs value={participantTab} onValueChange={(v) => setParticipantTab(v as any)}>
                  <TabsList className="flex w-full overflow-x-auto gap-2">
                    <TabsTrigger value="basic" className="shrink-0">Basic</TabsTrigger>
                    <TabsTrigger value="professional" className="shrink-0">Professional</TabsTrigger>
                    <TabsTrigger value="contact" className="shrink-0">Contact</TabsTrigger>
                    <TabsTrigger value="coordinator" className="shrink-0" disabled={!hasCoordinator}>Coordinator</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="mt-4 space-y-3">
                    <div className="space-y-1">
                      <Label>Salutation</Label>
                      <Select value={newParticipant.salutation} onValueChange={(v) => setNewParticipant((p) => ({ ...p, salutation: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mr">Mr</SelectItem>
                          <SelectItem value="Mrs">Mrs</SelectItem>
                          <SelectItem value="Ms">Ms</SelectItem>
                          <SelectItem value="Dr">Dr</SelectItem>
                          <SelectItem value="Prof">Prof</SelectItem>
                          <SelectItem value="Sheikh">Sheikh</SelectItem>
                          <SelectItem value="Sheikha">Sheikha</SelectItem>
                          <SelectItem value="HH">HH</SelectItem>
                          <SelectItem value="HE">HE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>First name *</Label>
                        <Input value={newParticipant.guest_first_name} onChange={(e) => setNewParticipant((p) => ({ ...p, guest_first_name: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Last name</Label>
                        <Input value={newParticipant.guest_last_name} onChange={(e) => setNewParticipant((p) => ({ ...p, guest_last_name: e.target.value }))} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Recipient type</Label>
                      <Select value={newParticipant.recipient_type} onValueChange={(v) => setNewParticipant((p) => ({ ...p, recipient_type: v }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Individual">Individual</SelectItem>
                          <SelectItem value="Royal Family">Royal Family</SelectItem>
                          <SelectItem value="Government Official">Government Official</SelectItem>
                          <SelectItem value="Organization">Organization</SelectItem>
                          <SelectItem value="VIP">VIP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>VIP level</Label>
                      <Select value={newParticipant.vip_level} onValueChange={(v) => setNewParticipant((p) => ({ ...p, vip_level: v }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Standard">Standard</SelectItem>
                          <SelectItem value="VIP">VIP</SelectItem>
                          <SelectItem value="VVIP">VVIP</SelectItem>
                          <SelectItem value="Royal">Royal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Preferred contact method</Label>
                      <Select value={newParticipant.preferred_contact_method} onValueChange={(v) => setNewParticipant((p) => ({ ...p, preferred_contact_method: v }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Email">Email</SelectItem>
                          <SelectItem value="Phone">Phone</SelectItem>
                          <SelectItem value="Coordinator">Coordinator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Person photo URL</Label>
                      <Input value={newParticipant.person_photo} onChange={(e) => setNewParticipant((p) => ({ ...p, person_photo: e.target.value }))} placeholder="/files/... or full URL" />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label>Enable coordinator</Label>
                        <div className="text-xs text-muted-foreground">Enable to fill coordinator tab</div>
                      </div>
                      <Switch checked={hasCoordinator} onCheckedChange={setHasCoordinator} />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Active</Label>
                      <Switch checked={Boolean(newParticipant.is_active)} onCheckedChange={(v) => setNewParticipant((p) => ({ ...p, is_active: v }))} />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Blocked</Label>
                      <Checkbox checked={Boolean(newParticipant.blocked)} onCheckedChange={(v) => setNewParticipant((p) => ({ ...p, blocked: Boolean(v) }))} />
                    </div>
                  </TabsContent>

                  <TabsContent value="professional" className="mt-4 space-y-3">
                    <div className="space-y-1">
                      <Label>Designation</Label>
                      <Input value={newParticipant.designation} onChange={(e) => setNewParticipant((p) => ({ ...p, designation: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Organization</Label>
                      <Input value={newParticipant.organization} onChange={(e) => setNewParticipant((p) => ({ ...p, organization: e.target.value }))} />
                    </div>
                  </TabsContent>

                  <TabsContent value="contact" className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Mobile</Label>
                        <Input value={newParticipant.mobile_number} onChange={(e) => setNewParticipant((p) => ({ ...p, mobile_number: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Email</Label>
                        <Input value={newParticipant.email} onChange={(e) => setNewParticipant((p) => ({ ...p, email: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Nationality</Label>
                        <Select
                          value={newParticipant.guest_nationality}
                          onValueChange={(v) => {
                            setNewParticipant((p) => ({ ...p, guest_nationality: v }))
                            setNationalitySearch('')
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select nationality" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="px-2 pb-2">
                              <Input
                                placeholder="Search"
                                value={nationalitySearch}
                                onChange={(e) => setNationalitySearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            {filteredNationalities.map((country) => (
                              <SelectItem key={country} value={country}>
                                {country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Country</Label>
                        <Select
                          value={newParticipant.guest_country}
                          onValueChange={(v) => {
                            setNewParticipant((p) => ({ ...p, guest_country: v }))
                            setCountrySearch('')
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="px-2 pb-2">
                              <Input
                                placeholder="Search"
                                value={countrySearch}
                                onChange={(e) => setCountrySearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            {filteredCountries.map((country) => (
                              <SelectItem key={country} value={country}>
                                {country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Emirates ID</Label>
                      <Input value={newParticipant.emirates_id} onChange={(e) => setNewParticipant((p) => ({ ...p, emirates_id: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Address</Label>
                      <Textarea value={newParticipant.address} onChange={(e) => setNewParticipant((p) => ({ ...p, address: e.target.value }))} rows={4} />
                    </div>
                  </TabsContent>

                  <TabsContent value="coordinator" className="mt-4 space-y-3">
                    <div className="space-y-1">
                      <Label>Coordinator full name</Label>
                      <Input value={newParticipant.coordinator_full_name} onChange={(e) => setNewParticipant((p) => ({ ...p, coordinator_full_name: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Coordinator email</Label>
                        <Input value={newParticipant.coordinator_email} onChange={(e) => setNewParticipant((p) => ({ ...p, coordinator_email: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Coordinator mobile</Label>
                        <Input value={newParticipant.coordinator_mobile_no} onChange={(e) => setNewParticipant((p) => ({ ...p, coordinator_mobile_no: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Coordinator Emirates ID</Label>
                      <Input value={newParticipant.coordinator_emirates_id} onChange={(e) => setNewParticipant((p) => ({ ...p, coordinator_emirates_id: e.target.value }))} />
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="mt-4 space-y-2">
                  <UIButton
                    className="w-full"
                    onClick={() => createParticipantMutation.mutate()}
                    disabled={createParticipantMutation.isPending}
                  >
                    {createParticipantMutation.isPending ? (t('common.saving') || 'Saving...') : (t('common.create') || 'Create')}
                  </UIButton>
                </div>
              </TabsContent>

              <TabsContent value="new_gift" className="mt-4">
                <Tabs value={giftTab} onValueChange={(v) => setGiftTab(v as any)}>
                  <TabsList className="flex w-full overflow-x-auto gap-2">
                    <TabsTrigger value="basic" className="shrink-0">Basic</TabsTrigger>
                    <TabsTrigger value="attributes" className="shrink-0">Attributes</TabsTrigger>
                    <TabsTrigger value="location" className="shrink-0">Location</TabsTrigger>
                    <TabsTrigger value="images" className="shrink-0">Images</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="mt-4 space-y-3">
                    <div className="space-y-1">
                      <Label>Gift name *</Label>
                      <Input value={newGift.gift_name} onChange={(e) => setNewGift((g) => ({ ...g, gift_name: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Quantity</Label>
                        <Input value={newGift.quantity as any} onChange={(e) => setNewGift((g) => ({ ...g, quantity: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Estimated value</Label>
                        <Input value={newGift.estimated_value as any} onChange={(e) => setNewGift((g) => ({ ...g, estimated_value: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Category</Label>
                        <Select
                          value={newGift.category}
                          onValueChange={handleGiftCategoryChange}
                          disabled={isLoadingGiftCategories}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {(giftCategoryList as any[]).map((c: any) => (
                              <SelectItem key={c.name} value={c.name}>
                                {c.category_name || c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Status</Label>
                        <Select
                          value={newGift.status}
                          onValueChange={(v) => setNewGift((g) => ({ ...g, status: v }))}
                          disabled={isLoadingGiftStatus}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {(giftStatusOptions as string[]).map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Description</Label>
                      <Textarea value={newGift.description} onChange={(e) => setNewGift((g) => ({ ...g, description: e.target.value }))} rows={4} />
                    </div>
                    <div className="space-y-1">
                      <Label>Barcode</Label>
                      <Input value={newGift.barcode_value} onChange={(e) => setNewGift((g) => ({ ...g, barcode_value: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Received datetime</Label>
                        <Input value={newGift.received_datetime} onChange={(e) => setNewGift((g) => ({ ...g, received_datetime: e.target.value }))} placeholder="YYYY-MM-DD HH:mm" />
                      </div>
                      <div className="space-y-1">
                        <Label>Received by</Label>
                        <Input value={newGift.received_by_name} onChange={(e) => setNewGift((g) => ({ ...g, received_by_name: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Received by contact</Label>
                      <Input value={newGift.received_by_contact} onChange={(e) => setNewGift((g) => ({ ...g, received_by_contact: e.target.value }))} />
                    </div>
                  </TabsContent>

                  <TabsContent value="attributes" className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Attributes</div>
                      <UIButton type="button" variant="outline" size="sm" onClick={addGiftAttributeRow}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </UIButton>
                    </div>
                    {newGift.table_gvlf.length === 0 && (
                      <div className="text-sm text-muted-foreground">No attributes added</div>
                    )}
                    {newGift.table_gvlf.map((row, idx) => (
                      <div key={idx} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">Row {idx + 1}</div>
                          <UIButton type="button" variant="ghost" size="icon" onClick={() => removeGiftAttributeRow(idx)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </UIButton>
                        </div>
                        <div className="space-y-1">
                          <Label>Attribute name</Label>
                          <Input
                            value={row.attribute_name}
                            onChange={(e) =>
                              setNewGift((g) => ({
                                ...g,
                                table_gvlf: g.table_gvlf.map((r, i) => (i === idx ? { ...r, attribute_name: e.target.value } : r)),
                              }))
                            }
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Type</Label>
                            <Select
                              value={row.attribute_type}
                              onValueChange={(v) =>
                                setNewGift((g) => ({
                                  ...g,
                                  table_gvlf: g.table_gvlf.map((r, i) => (i === idx ? { ...r, attribute_type: v as any } : r)),
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Text">Text</SelectItem>
                                <SelectItem value="Number">Number</SelectItem>
                                <SelectItem value="Select">Select</SelectItem>
                                <SelectItem value="Date">Date</SelectItem>
                                <SelectItem value="Checkbox">Checkbox</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label>Value</Label>
                            {renderGiftAttributeDefaultInput(row, idx)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Select options (comma separated)</Label>
                          <Input
                            value={row.select_options || ''}
                            onChange={(e) =>
                              setNewGift((g) => ({
                                ...g,
                                table_gvlf: g.table_gvlf.map((r, i) => (i === idx ? { ...r, select_options: e.target.value } : r)),
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Mandatory</Label>
                          <Checkbox
                            checked={Boolean(row.is_mandatory)}
                            onCheckedChange={(v) =>
                              setNewGift((g) => ({
                                ...g,
                                table_gvlf: g.table_gvlf.map((r, i) => (i === idx ? { ...r, is_mandatory: Boolean(v) } : r)),
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="location" className="mt-4 space-y-3">
                    <div className="space-y-1">
                      <Label>Warehouse</Label>
                      <Select value={newGift.warehouse} onValueChange={(v) => setNewGift((g) => ({ ...g, warehouse: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                          {(warehouses as any[]).map((w: any) => (
                            <SelectItem key={w.name} value={w.name}>
                              {w.warehouse_name || w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Storage location</Label>
                        <Input value={newGift.storage_location} onChange={(e) => setNewGift((g) => ({ ...g, storage_location: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Storage date</Label>
                        <Input value={newGift.storage_date} onChange={(e) => setNewGift((g) => ({ ...g, storage_date: e.target.value }))} placeholder="YYYY-MM-DD" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Location contact person</Label>
                        <Input value={newGift.location_contact_person} onChange={(e) => setNewGift((g) => ({ ...g, location_contact_person: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Location contact number</Label>
                        <Input value={newGift.location_contact_number} onChange={(e) => setNewGift((g) => ({ ...g, location_contact_number: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Location address</Label>
                      <Textarea value={newGift.location_address} onChange={(e) => setNewGift((g) => ({ ...g, location_address: e.target.value }))} rows={4} />
                    </div>
                  </TabsContent>

                  <TabsContent value="images" className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Images</div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="gift-image-upload" className="text-sm cursor-pointer">
                          <div className="flex items-center gap-2 text-sm text-primary hover:underline">
                            <Plus className="h-4 w-4" />
                            Upload
                          </div>
                        </Label>
                        <input
                          id="gift-image-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleGiftImageUpload}
                          disabled={uploadingImage}
                        />
                        <UIButton type="button" variant="outline" size="sm" onClick={addGiftImageRow}>
                          Add URL
                        </UIButton>
                      </div>
                    </div>
                    {newGift.gift_images.length === 0 && (
                      <div className="text-sm text-muted-foreground">No images added</div>
                    )}
                    {newGift.gift_images.map((row, idx) => (
                      <div key={idx} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">Image {idx + 1}</div>
                          <UIButton type="button" variant="ghost" size="icon" onClick={() => removeGiftImageRow(idx)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </UIButton>
                        </div>
                        <div className="space-y-1">
                          <Label>Image URL</Label>
                          <Input
                            value={row.image}
                            onChange={(e) =>
                              setNewGift((g) => ({
                                ...g,
                                gift_images: g.gift_images.map((r, i) => (i === idx ? { ...r, image: e.target.value } : r)),
                              }))
                            }
                            placeholder="/files/... or full URL"
                          />
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>

                <div className="mt-4 space-y-2">
                  <UIButton className="w-full" onClick={() => createGiftMutation.mutate()} disabled={createGiftMutation.isPending}>
                    {createGiftMutation.isPending ? (t('common.saving') || 'Saving...') : (t('common.create') || 'Create')}
                  </UIButton>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
