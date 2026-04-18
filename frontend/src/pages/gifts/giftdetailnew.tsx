/* eslint-disable @typescript-eslint/no-explicit-any */
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Edit, Trash2, MapPin, Truck, Wrench,
  Send, Clock, Image as ImageIcon,
  Heart, Plus, MoreVertical, AlertCircle,
  Scan, Info, List, FileText, CheckCircle, ExternalLink,
  ChevronDown, ChevronUp, Calendar, User, Phone,
  Search, X, Upload, AlertTriangle, Package,
  RotateCcw, Users, History, Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { GiftAPI, GiftDispatchAPI, GiftRecipientAPI, type GiftDetailBundle } from '@/services/api'
import { toast } from 'sonner'
import { config } from '@/config/environment'
import { format } from 'date-fns'
import { parseFrappeDate } from '@/lib/i18n'
import type { Gift } from '@/types/gift'
import { useEffect, useState } from 'react'

// ─── Status Colors ───────
const statusColors: Record<string, string> = {
  Available: 'bg-green-100 text-green-700 border border-green-200',
  Issued: 'bg-blue-100 text-blue-700 border border-blue-200',
  'In Transit': 'bg-orange-100 text-orange-700 border border-orange-200',
  Delivered: 'bg-purple-100 text-purple-700 border border-purple-200',
}

// ─── Timeline Config ─────
const timelineConfig = {
  created: { icon: Plus, color: 'bg-green-500', label: 'Gift Created' },
  modified: { icon: Edit, color: 'bg-blue-500', label: 'Modified' },
  issued: { icon: Send, color: 'bg-purple-500', label: 'Issued' },
  interest: { icon: Heart, color: 'bg-pink-500', label: 'Interest Recorded' },
  dispatched: { icon: Truck, color: 'bg-indigo-500', label: 'Dispatched' },
  delivered: { icon: CheckCircle, color: 'bg-green-600', label: 'Delivered' },
  location: { icon: MapPin, color: 'bg-gray-500', label: 'Location Change' },
}

interface TimelineEvent {
  type: keyof typeof timelineConfig
  date: string
  title: string
  description?: string
  link?: string
}

// ─── Avatar Helper ───────
const avatarColors = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500'
]

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sizeClass} ${getAvatarColor(name)} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}>
      {getInitials(name)}
    </div>
  )
}

// ─── Accordion Section 
function AccordionSection({
  icon: Icon,
  title,
  defaultOpen = false,
  badge,
  children,
  titleBg
}: {
  icon: any
  title: string
  titleBg?:string
  defaultOpen?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        style={{ backgroundColor: titleBg }}
        className={`w-full flex items-center justify-between bg-[${titleBg}] px-5 py-4 hover:bg-muted/30 transition-colors`}
      >
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-foreground text-sm">{title}</span>
          {badge && <span>{badge}</span>}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
        }
      </button>
      {open && <div className="border-t border-border">{children}</div>}
    </div>
  )
}

// ─── Label/Value Pair 
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  )
}

// ─── Record Interest Modal 
function RecordInterestModal({
  open,
  onClose,
  onRecord,
  isSubmitting,
}: {
  open: boolean
  onClose: () => void
  onRecord: (recipientName: string) => void
  isSubmitting?: boolean
}) {
  const [search, setSearch] = useState('')
  const [selectedRecipient, setSelectedRecipient] = useState<{ id: string; name: string } | null>(null)

  const recipientsQuery = useQuery({
    queryKey: ['recipient-search-for-interest-modal', search],
    enabled: open,
    queryFn: async () => {
      const result = await GiftRecipientAPI.list(search, 1, 20)
      return result.success ? (result.data || []) : []
    },
  })

  const filtered = (recipientsQuery.data || []).map((g: any) => ({
    id: g.name,
    name: g.owner_full_name || [g.guest_first_name, g.guest_last_name].filter(Boolean).join(' ') || g.name,
    role: g.vip_level || g.designation || g.recipient_type || '',
    org: g.organization || '',
  }))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-base font-semibold">Record Interest</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Guest Name</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search guests..."
                className="w-full pl-9 pr-4 py-2.5 border border-primary rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {search && (
              <div className="mt-1 border border-border rounded-lg overflow-hidden bg-white shadow-sm">
                {filtered.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setSelectedRecipient({ id: g.id, name: g.name })
                      setSearch(g.name)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                  >
                    <Avatar name={g.name} size="sm" />
                    <div className="text-left">
                      <p className="text-sm font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{[g.role, g.org].filter(Boolean).join(' • ')}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!selectedRecipient || isSubmitting}
            onClick={() => selectedRecipient && onRecord(selectedRecipient.id)}
          >
            Record Interest
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create Dispatch Modal 
function CreateDispatchModal({
  open,
  onClose,
  onConfirm,
  isSubmitting,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (payload: {
    transport_mode?: string
    delivery_date?: string
    received_by_name?: string
    receiver_id?: string
  }) => void
  isSubmitting?: boolean
}) {
  const [transportMode, setTransportMode] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [receivedByName, setReceivedByName] = useState('')
  const [receiverId, setReceiverId] = useState('')

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex flex-row items-center gap-3">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
            <Truck className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold">Create Dispatch</DialogTitle>
          </div>
        </DialogHeader>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Transport Mode</label>
            <div className="relative">
              <select
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
                className="w-full appearance-none border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white pr-10"
              >
                <option value="">Select transport mode...</option>
                <option>Private Courier</option>
                <option>Diplomatic Pouch</option>
                <option>Hand Carry</option>
                <option>Air Freight</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Delivery Date</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Received By</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Full Name"
                value={receivedByName}
                onChange={(e) => setReceivedByName(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Receiver Emirates ID</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="784-XXXX-XXXXXXX-X"
                value={receiverId}
                onChange={(e) => setReceiverId(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            disabled={isSubmitting}
            onClick={() => onConfirm({
              transport_mode: transportMode || undefined,
              delivery_date: deliveryDate || undefined,
              received_by_name: receivedByName || undefined,
              receiver_id: receiverId || undefined,
            })}
          >
            <CheckCircle className="h-4 w-4" /> Confirm Dispatch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Confirm Issue Modal ─
function ConfirmIssueModal({
  open, onClose, guestName, onConfirm
}: { open: boolean; onClose: () => void; guestName: string; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
        <div className="px-6 pt-6 pb-5 space-y-3">
          <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Confirm Issue</h3>
            <p className="text-sm text-muted-foreground mt-1.5">
              Are you sure you want to issue this gift to <strong className="text-foreground">{guestName}</strong>?
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              This action will update the inventory and create a dispatch record automatically.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-destructive text-white hover:bg-destructive/90" onClick={onConfirm}>
            Confirm Issue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Rejection Reason Modal 
function RejectionModal({
  open,
  onClose,
  requesterName,
  onConfirm,
  isSubmitting,
}: {
  open: boolean
  onClose: () => void
  requesterName: string
  onConfirm: (reason: string) => void
  isSubmitting?: boolean
}) {
  const [comments, setComments] = useState('')
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex flex-row items-center gap-3">
          <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center">
            <X className="h-4 w-4 text-red-500" />
          </div>
          <DialogTitle className="text-base font-semibold">Rejection Reason</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            You are about to reject the gift issuance request for{' '}
            <strong className="text-foreground">{requesterName}</strong>. Please provide a reason for this action.
          </p>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1 block">
              Additional Comments <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Provide additional context for the rejection..."
              rows={4}
              className="w-full border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>This action cannot be undone. The requester will be notified immediately via email.</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={!comments.trim() || isSubmitting}
            onClick={() => onConfirm(comments.trim())}
          >
            Confirm Rejection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Gift Side Panel 
function EditGiftPanel({
  open,
  onClose,
  gift,
  onUpdate,
  isUpdating,
}: {
  open: boolean
  onClose: () => void
  gift: any
  onUpdate: (payload: Partial<Gift>) => void
  isUpdating?: boolean
}) {
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [attributesOpen, setAttributesOpen] = useState(false)
  const [imagesOpen, setImagesOpen] = useState(false)
  const [giftName, setGiftName] = useState('')
  const [quantity, setQuantity] = useState<number>(1)
  const [estimatedValue, setEstimatedValue] = useState<number>(0)
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!open || !gift) return
    setGiftName(gift.gift_name || '')
    setQuantity(typeof gift.quantity === 'number' ? gift.quantity : 1)
    setEstimatedValue(typeof gift.estimated_value === 'number' ? gift.estimated_value : 0)
    setDescription(gift.description || '')
  }, [open, gift])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Edit Gift</h2>
            <p className="text-sm text-muted-foreground">Update gift details and attributes</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-3 overflow-y-auto divide-y divide-border">
          {/* Section 1: Details */}
          <div>
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="font-semibold text-sm">Details</span>
              </div>
              {detailsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {detailsOpen && (
              <div className="px-6 pb-5 space-y-4 bg-amber-50/30">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Gift Name <span className="text-red-500">*</span></label>
                  <input
                    value={giftName}
                    onChange={(e) => setGiftName(e.target.value)}
                    className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Quantity</label>
                    <input
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value || 0))}
                      type="number"
                      className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Estimated Value</label>
                    <input
                      value={estimatedValue}
                      onChange={(e) => setEstimatedValue(Number(e.target.value || 0))}
                      type="number"
                      className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Category</label>
                    <div className="relative">
                      <select className="w-full appearance-none border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white pr-8">
                        <option>Legacy Heritage Assets</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Status</label>
                    <div className="relative">
                      <select className="w-full appearance-none border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white pr-8">
                        <option>Issued</option>
                        <option>Available</option>
                        <option>In Transit</option>
                        <option>Delivered</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Next</Button>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Attributes */}
          <div>
            <button
              onClick={() => setAttributesOpen(!attributesOpen)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="font-semibold text-sm">Attributes</span>
              </div>
              {attributesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {attributesOpen && (
              <div className="px-6 pb-5 bg-muted/10">
                <p className="text-sm text-muted-foreground py-3">No attributes configured.</p>
              </div>
            )}
          </div>

          {/* Section 3: Images */}
          <div>
            <button
              onClick={() => setImagesOpen(!imagesOpen)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center">
                  <span className="text-xs font-bold text-muted-foreground">3</span>
                </div>
                <span className="font-semibold text-sm">Images</span>
              </div>
              {imagesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {imagesOpen && (
              <div className="px-6 pb-5 bg-amber-50/30 space-y-3">
                <div className="border-2 border-dashed border-amber-200 rounded-xl p-8 text-center">
                  <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Upload className="h-5 w-5 text-amber-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Drag and drop images here or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">Supported formats: PNG, JPG (Max 5MB)</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="aspect-square rounded-lg bg-muted border border-border overflow-hidden">
                      <div className="w-full h-full bg-gray-200" />
                    </div>
                  ))}
                  <div className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/10">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!giftName.trim() || isUpdating}
            onClick={() => onUpdate({
              gift_name: giftName.trim(),
              quantity,
              estimated_value: estimatedValue,
              description,
            })}
          >
            {isUpdating ? 'Updating...' : 'Update Gift'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component
export default function GiftDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const queryClient = useQueryClient()

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showInterestModal, setShowInterestModal] = useState(false)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [showConfirmIssue, setShowConfirmIssue] = useState<{ interestName: string; guestName: string } | null>(null)
  const [showRejectionModal, setShowRejectionModal] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<{ type: 'interest' | 'issue'; name: string; label: string } | null>(null)
  const [selectedIssueForDispatch, setSelectedIssueForDispatch] = useState<string | null>(null)

  // ── Queries ─────────────
  const { data: bundle, isLoading, error } = useQuery({
    queryKey: ['gift-detail-bundle', id],
    queryFn: async () => {
      if (!id) throw new Error('No gift ID')
      const result = await GiftAPI.getDetailBundle(id)
      if (result.success) return result.data
      throw new Error(result.error)
    },
    enabled: !!id,
  })

  const gift = (bundle as GiftDetailBundle | undefined)?.gift as Gift | undefined
  const categoryData = bundle?.category
  const giftIssues = bundle?.issues || []
  const giftInterests = bundle?.interests || []
  const dispatchRecords = bundle?.dispatches || []
  const returnHistory = bundle?.return_history || []
  const canApprove = !!bundle?.can_approve

  const pendingIssue = (bundle?.pending_issue_requests || [])[0]
  const pendingInterest = (bundle?.pending_interest_requests || [])[0]
  const pendingApproval = pendingIssue
    ? { type: 'issue' as const, name: pendingIssue.name, subtitle: pendingIssue.owner_full_name || pendingIssue.gift_recipient || pendingIssue.name }
    : pendingInterest
      ? { type: 'interest' as const, name: pendingInterest.name, subtitle: pendingInterest.owner_full_name || pendingInterest.gift_recipient || pendingInterest.name }
      : null

  const hasApprovalRequest = !!pendingApproval
  const approvalRequester = pendingApproval?.subtitle || 'Requester'

  // ── Delete ──────────────
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No gift ID')
      return GiftAPI.delete(id)
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('gifts.giftDeletedSuccessfully'))
        queryClient.invalidateQueries({ queryKey: ['gifts'] })
        navigate('/gifts')
      } else {
        toast.error(result.error || t('gifts.failedToDeleteGift'))
      }
    },
  })

  const recordInterestMutation = useMutation({
    mutationFn: async (recipientName: string) => {
      if (!id) throw new Error('No gift ID')
      return GiftAPI.recordInterest({
        gift: id,
        gift_recipient: recipientName,
        interest_source: 'Manual Entry',
      })
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Interest recorded successfully')
        setShowInterestModal(false)
        queryClient.invalidateQueries({ queryKey: ['gift-detail-bundle', id] })
      } else {
        toast.error(result.error || 'Failed to record interest')
      }
    },
  })

  const approveInterestMutation = useMutation({
    mutationFn: async (interestName: string) => GiftAPI.approveInterestAndIssue(interestName),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Interest approved and issue created')
        queryClient.invalidateQueries({ queryKey: ['gift-detail-bundle', id] })
      } else {
        toast.error(result.error || 'Failed to approve interest')
      }
    },
  })

  const createIssueMutation = useMutation({
    mutationFn: async (interestName: string) => GiftAPI.createIssueFromInterest(interestName),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Gift issued successfully')
        setShowConfirmIssue(null)
        queryClient.invalidateQueries({ queryKey: ['gift-detail-bundle', id] })
      } else {
        toast.error(result.error || 'Failed to issue gift')
      }
    },
  })

  const approveIssueMutation = useMutation({
    mutationFn: async (issueName: string) => GiftAPI.approveIssue(issueName),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Issue approved successfully')
        queryClient.invalidateQueries({ queryKey: ['gift-detail-bundle', id] })
      } else {
        toast.error(result.error || 'Failed to approve issue')
      }
    },
  })

  const sendIssueForApprovalAgainMutation = useMutation({
    mutationFn: async (issueName: string) => GiftAPI.sendIssueForApprovalAgain(issueName),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Issue sent for approval again')
        queryClient.invalidateQueries({ queryKey: ['gift-detail-bundle', id] })
      } else {
        toast.error(result.error || 'Failed to send issue for approval again')
      }
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ type, name, reason }: { type: 'interest' | 'issue'; name: string; reason: string }) => {
      return type === 'interest'
        ? GiftAPI.rejectInterest(name, reason)
        : GiftAPI.rejectIssue(name, reason)
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Request rejected successfully')
        setShowRejectionModal(false)
        setRejectTarget(null)
        queryClient.invalidateQueries({ queryKey: ['gift-detail-bundle', id] })
      } else {
        toast.error(result.error || 'Failed to reject request')
      }
    },
  })

  const dispatchMutation = useMutation({
    mutationFn: async (payload: {
      transport_mode?: string
      delivery_date?: string
      received_by_name?: string
      receiver_id?: string
    }) => {
      if (!bundle?.event) throw new Error('Gift event is required for dispatch')

      const issueName = selectedIssueForDispatch || giftIssues[0]?.name
      if (!issueName) throw new Error('No issue available to create dispatch')

      return GiftDispatchAPI.create({
        related_gift_issue: issueName,
        gift: gift?.name,
        event: bundle.event,
        dispatch_date: payload.delivery_date || new Date().toISOString().slice(0, 10),
        dispatch_status: 'Pending',
        transport_mode: payload.transport_mode,
        received_by_name: payload.received_by_name,
        receiver_id: payload.receiver_id,
      })
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Dispatch created successfully')
        setShowDispatchModal(false)
        setSelectedIssueForDispatch(null)
        queryClient.invalidateQueries({ queryKey: ['gift-detail-bundle', id] })
      } else {
        toast.error(result.error || 'Failed to create dispatch')
      }
    },
  })

  const updateGiftMutation = useMutation({
    mutationFn: async (payload: Partial<Gift>) => {
      if (!id) throw new Error('No gift ID')
      return GiftAPI.update(id, payload)
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Gift updated successfully')
        setShowEditPanel(false)
        queryClient.invalidateQueries({ queryKey: ['gift-detail-bundle', id] })
        queryClient.invalidateQueries({ queryKey: ['gifts'] })
      } else {
        toast.error(result.error || 'Failed to update gift')
      }
    },
  })

  // ── Helpers ─────────────
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

  const formatDateTime = (date: string | undefined) => {
    if (!date) return '-'
    try {
      const dt = parseFrappeDate(date)
      if (Number.isNaN(dt.getTime())) return date
      return format(dt, 'dd MMM yyyy \'at\' hh:mm a')
    } catch {
      return date
    }
  }

  // ── Timeline ────────────
  const buildTimeline = (): TimelineEvent[] => {
    const events: TimelineEvent[] = []
    if (!gift) return events

    if (gift.creation) {
      events.push({ type: 'created', date: gift.creation, title: 'Gift Created', description: gift.gift_name })
    }
    if (gift.modified && gift.modified !== gift.creation) {
      events.push({ type: 'modified', date: gift.modified, title: 'Modified', description: `Modified by ${gift.modified_by || 'system'}` })
    }
    giftInterests?.forEach((interest: any) => {
      events.push({
        type: 'interest',
        date: interest.interest_datetime || interest.date || interest.creation,
        title: 'Interest Recorded',
        description: interest.owner_full_name || interest.gift_recipient || interest.name,
        link: `/gifts/${gift.name}`,
      })
    })
    giftIssues?.forEach((issue: any) => {
      events.push({
        type: 'issued',
        date: issue.date || issue.creation,
        title: 'Issued',
        description: issue.name,
        link: `/gifts/${gift.name}`,
      })
      if (issue.status === 'Delivered' && issue.delivery_date) {
        events.push({ type: 'delivered', date: issue.delivery_date, title: 'Delivered', link: `/gifts/${gift.name}` })
      }
    })
    dispatchRecords?.forEach((dispatch: any) => {
      events.push({ type: 'dispatched', date: dispatch.dispatch_date || dispatch.creation, title: 'Dispatched', description: `${dispatch.dispatch_type || 'Create Dispatch'} - ${dispatch.dispatch_status || 'Prepared'}`, link: `/dispatch/${dispatch.name}` })
    })
    return events.sort(
      (a, b) =>
        parseFrappeDate(String(b.date || 0)).getTime() -
        parseFrappeDate(String(a.date || 0)).getTime(),
    )
  }

  // ── States ──────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Loading gift details...</p>
        </div>
      </div>
    )
  }

  if (error || !gift) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <p className="text-destructive font-medium">Failed to load gift</p>
        <Button variant="outline" onClick={() => navigate('/gifts')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Gifts
        </Button>
      </div>
    )
  }

  const giftAttributes = gift.table_gvlf || []
  const hasImages = gift.gift_images && gift.gift_images.length > 0
  const hasBarcode = gift.barcode_value || gift.barcode
  const timeline = buildTimeline()

  const isDelivered = giftIssues?.some((i: any) => i.status === 'Delivered')
  const hasActiveDispatch = dispatchRecords?.some((d: any) => d.dispatch_status === 'In Transit')
  const effectiveStatus = isDelivered ? 'Delivered' : hasActiveDispatch ? 'In Transit' : gift.status || 'Available'
  const isIssued = !!giftIssues?.length

  const displayInterests = giftInterests || []
  const latestDispatch = dispatchRecords?.[0]

  return (
    <>
      <div className="min-h-svh bg-background">
        {/* ── Approval Banner ──────────────────────────────────────────────────── */}
        {hasApprovalRequest && (
          <div className="border-l-8 border rounded-md border-[#D6A95C]/50 px-4 md:px-6 py-5 bg-white">
            <div className="flex items-center justify-between gap-4 max-w-screen-xl mx-auto">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                  <User className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900">Approval Request</p>
                  <p className="text-xs text-amber-700">{approvalRequester} has requested this gift.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-300 text-amber-800 "
                  onClick={() => {
                    if (!pendingApproval) return
                    setRejectTarget({ type: pendingApproval.type, name: pendingApproval.name, label: pendingApproval.subtitle })
                    setShowRejectionModal(true)
                  }}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={!canApprove}
                  onClick={() => {
                    if (!pendingApproval) return
                    if (pendingApproval.type === 'issue') {
                      approveIssueMutation.mutate(pendingApproval.name)
                    } else {
                      approveInterestMutation.mutate(pendingApproval.name)
                    }
                  }}
                >
                  Approve
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 md:px-6 py-5 max-w-screen-xl mx-auto">
          {/* ── Page Header ─ */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-start gap-3">
              <button
                onClick={() => navigate('/gifts')}
                className="mt-1 p-1 rounded-lg hover:bg-muted transition-colors shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-muted-foreground" />
              </button>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-bold text-foreground">{gift.gift_name}</h1>
                  <Badge className={statusColors[effectiveStatus] || 'bg-gray-100 text-gray-700'}>
                    {effectiveStatus}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  ID: {gift.name}
                  {categoryData && <> • Category: {categoryData.category_name}</>}
                </p>
              </div>
            </div>

            {/* Desktop actions */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditPanel(true)}
                className="gap-2"
              >
                <Edit className="h-4 w-4" /> Edit Gift
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleteMutation.isPending}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" /> Delete Gift
              </Button>
            </div>

            {/* Mobile actions */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowEditPanel(true)}>
                    <Edit className="h-4 w-4 mr-2" /> Edit Gift
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Gift
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ── Two-column Layout ───────────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-[1fr_300px] gap-5">
            {/* ── LEFT COLUMN ──────────────────────────────────────────────────── */}
            <div className="space-y-4">
              {/* Photos */}
              {hasImages && (
                <div className="bg-white rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm text-foreground">Photos</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                    {gift.gift_images!.map((image: any, index: number) => (
                      <div
                        key={index}
                        className="aspect-square rounded-xl overflow-hidden bg-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(getImageUrl(image.image), '_blank')}
                      >
                        <img
                          src={getImageUrl(image.image)}
                          alt={`Gift photo ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23334155" width="100" height="100"/%3E%3C/svg%3E'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gift Handover Details (accordion) */}
              <AccordionSection
                icon={Truck}
                title="Gift Handover Details"
                titleBg='#EFF6FF'
                defaultOpen={!!latestDispatch}
              >
                {latestDispatch ? (
                  <div className="px-5 py-4 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Field label="Transport Mode">
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          {latestDispatch.transport_mode || 'Private Courier'}
                        </div>
                      </Field>
                      <Field label="Delivery Date">
                        {formatDateOnly(latestDispatch.delivery_date || latestDispatch.creation)}
                      </Field>
                      <Field label="Received By">
                        {latestDispatch.received_by_name || 'Jassim Al-Thani'}
                      </Field>
                      <Field label="Receiver Emirates ID">
                        {latestDispatch.receiver_id || '784-1980-1234567-1'}
                      </Field>
                    </div>
                    {latestDispatch.dispatched_by && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Dispatched by {latestDispatch.dispatched_by} on {formatDateTime(latestDispatch.dispatched_at || latestDispatch.creation)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="px-5 py-4">
                    <p className="text-sm text-muted-foreground">No dispatch records found.</p>
                  </div>
                )}
              </AccordionSection>

              {/* Basic Information (accordion) */}
              <AccordionSection icon={Info} titleBg='#F5F5F0' title="Information" defaultOpen>
                <div className="px-5 py-4 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Gift Name">{gift.gift_name}</Field>
                    {/* <Field label="Quantity">{typeof gift.quantity === 'number' ? gift.quantity : '1'}</Field> */}
                    {/* <Field label="Estimated Value">{typeof gift.estimated_value === 'number' ? gift.estimated_value.toLocaleString() : '0'}</Field> */}
                    {categoryData && (
                      <Field label="Category">
                        <div>
                          <p>{categoryData.category_name}</p>
                          {categoryData.category_type && (
                            <p className="text-xs text-muted-foreground">Type: {categoryData.category_type}</p>
                          )}
                        </div>
                      </Field>
                    )}
                    {/* <Field label="Status">
                      <Badge className={statusColors[effectiveStatus] || 'bg-gray-100'}>{effectiveStatus}</Badge>
                    </Field> */}
                  </div>
                  {gift.description && (
                    <Field label="Description">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{gift.description}</p>
                    </Field>
                  )}
                </div>
              </AccordionSection>

              {/* Location & Storage (accordion) */}
              {/* <AccordionSection icon={MapPin} title="Location & Storage">
                <div className="px-5 py-4">
                  {(gift.warehouse || gift.storage_location || gift.storage_date) ? (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {gift.warehouse && <Field label="Warehouse">{gift.warehouse}</Field>}
                      {gift.storage_location && <Field label="Storage Location">{gift.storage_location}</Field>}
                      {gift.storage_date && <Field label="Stored Since">{formatDateOnly(gift.storage_date)}</Field>}
                      {gift.location_contact_person && <Field label="Contact Person">{gift.location_contact_person}</Field>}
                      {gift.location_contact_number && <Field label="Contact Number">{gift.location_contact_number}</Field>}
                      {gift.location_address && (
                        <div className="sm:col-span-2">
                          <Field label="Address">{gift.location_address}</Field>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No location information available.</p>
                  )}
                </div>
              </AccordionSection> */}

              {/* Gift Details / Attributes (accordion) */}
              <AccordionSection
                icon={List}
                titleBg='#F5F5F0'
                title="Gift Details"
                badge={
                  giftAttributes.length > 0
                    ? <span className="text-xs text-muted-foreground">{giftAttributes.length} attribute{giftAttributes.length !== 1 ? 's' : ''}</span>
                    : undefined
                }
              >
                <div className="px-5 py-4">
                  {giftAttributes.length > 0 ? (
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {giftAttributes.map((attr: any, index: number) => (
                        <div key={index} className="p-3 rounded-lg border border-border bg-muted/30">
                          <p className="text-xs font-medium text-primary mb-1">{attr.attribute_name}</p>
                          <p className="font-semibold text-sm">{attr.default_value || '-'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No gift details/attributes added.</p>
                  )}
                </div>
              </AccordionSection>

              {/* Gift Interests (accordion) */}
              <AccordionSection
                icon={Users}
                title="Gift Interests"
                titleBg='#F5F5F0'
                // defaultOpen
                badge={
                  <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full font-medium">
                    {displayInterests.length} Guest{displayInterests.length !== 1 ? 's' : ''}
                  </span>
                }
              >
                <div className="divide-y divide-border">
                  {displayInterests.map((interest: any, index: number) => {
                    const name = interest.guest_name || interest.name || 'Unknown Guest'
                    const isGiftIssued = !!interest.converted_to_issue || interest.follow_up_status === 'Converted to Issue'
                    const isPendingApproval = interest.approval_status === 'Pending'
                    const isPreviouslyRejected = interest.approval_status === 'Rejected'
                    const linkedIssue = giftIssues?.find((i: any) => (i as any)?.from_gift_interest === interest.name)
                    const isIssueRejected = (linkedIssue as any)?.approval_status === 'Rejected'
                    return (
                      <div key={interest.name || index} className={`flex items-start justify-between gap-4 px-5 py-4 ${isPreviouslyRejected ? 'bg-red-50/50' : ''}`}>
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Avatar name={name} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">{name}</p>
                              {isPreviouslyRejected && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[11px] rounded-full font-medium border border-red-200">Previously Rejected</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              Interested on {formatDateTime(interest.interest_datetime || interest.date || interest.creation)}
                              {interest.coordinator_full_name && (
                                <> • <User className="h-3 w-3" /> Coordinator: {interest.coordinator_full_name}</>
                              )}
                            </p>
                            {interest.approved_by && (
                              <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Processed by {interest.approved_by}
                              </p>
                            )}
                            {isPreviouslyRejected && (
                              <button className="text-xs text-red-600 mt-0.5 underline underline-offset-2">
                                Rejection History
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isGiftIssued && (
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium border border-green-200 flex items-center gap-1.5">
                              <CheckCircle className="h-3 w-3" /> Gift Issued
                            </span>
                          )}
                          {isPendingApproval && !isGiftIssued && (
                            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium border border-amber-200">
                              • Issue Pending Approval
                            </span>
                          )}
                          {isIssueRejected && (
                            <button
                              onClick={() => {
                                if (!(linkedIssue as any)?.name) return
                                if (typeof canApprove !== 'undefined' && !canApprove) return
                                sendIssueForApprovalAgainMutation.mutate((linkedIssue as any).name)
                              }}
                              className={`text-sm font-medium text-amber-700 hover:underline ${typeof canApprove !== 'undefined' && !canApprove ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              Send for Approval Again
                            </button>
                          )}
                          {!isGiftIssued && !isPendingApproval && (
                            <button
                              onClick={() => setShowConfirmIssue({ interestName: interest.name, guestName: name })}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              Issue Gift
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </AccordionSection>

              {/* Gift Event History (accordion) */}
              <AccordionSection icon={Calendar} titleBg='#F5F5F0' title="Gift Event History" >
                <div className="divide-y divide-border">
                  {[
                    { name: 'National Day 2025', date: '02 Dec 2025', time: '04:00 PM', status: 'Closed', color: 'bg-gray-100 text-gray-700' },
                    { name: 'Heritage Festival', date: '15 Nov 2025', time: '10:00 AM', status: 'Completed', color: 'bg-green-100 text-green-700' },
                    { name: 'Winter Gala 2025', date: '15 Jan 2025', time: '09:00 AM', status: 'Past Event', color: 'bg-gray-100 text-gray-600' },
                    { name: 'Autumn Summit 2024', date: '10 Nov 2024', time: '02:30 PM', status: 'Past Event', color: 'bg-gray-100 text-gray-600' },
                  ].map((event, index) => {
                    const initials = event.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                    const colors = ['bg-orange-500', 'bg-teal-500', 'bg-slate-500', 'bg-purple-500']
                    return (
                      <div key={index} className="flex items-center justify-between px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 ${colors[index]} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{event.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Calendar className="h-3 w-3" /> {event.date}
                              <span>•</span>
                              <Clock className="h-3 w-3" /> {event.time}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${event.color} border`}>
                          {event.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </AccordionSection>

              {/* Gift Return History (accordion) */}
              <AccordionSection icon={RotateCcw} titleBg='#F5F5F0' title="Gift Return History">
                <div className="divide-y divide-border">
                  {returnHistory.map((item: any, index: number) => (
                    <div key={index} className="flex items-start gap-3 px-5 py-4">
                      <Avatar name={item.owner_full_name || item.gift_recipient || item.name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-sm font-semibold">{item.owner_full_name || item.gift_recipient || item.name}</p>
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[11px] rounded-full border border-red-200 font-medium">Returned</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Reason: {item.return_reason || '-'}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <User className="h-3 w-3" /> Collected by {item.return_handled_by || '-'}
                          <span className="mx-1">•</span>
                          <Calendar className="h-3 w-3" /> {formatDateTime(item.return_date || item.modified || item.creation)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!returnHistory.length && (
                    <div className="px-5 py-4 text-sm text-muted-foreground">No return history found.</div>
                  )}
                </div>
              </AccordionSection>

              {/* Related Documents */}
              {/* {((giftIssues?.length || 0) > 0 || (dispatchRecords?.length || 0) > 0) && (
                <div className="bg-white rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Related Documents</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Linked records for this gift</p>
                  <div className="space-y-3">
                    {giftIssues && giftIssues.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Send className="h-3 w-3" /> Gift Issues ({giftIssues.length})
                        </p>
                        {giftIssues.map((issue: any) => (
                          <Link
                            key={issue.name}
                            to={`/issues/${issue.name}`}
                            className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors mb-2"
                          >
                            <div>
                              <p className="text-sm font-medium">{issue.name}</p>
                              <p className="text-xs text-muted-foreground">System Information {formatDateOnly(issue.date || issue.creation)}</p>
                            </div>
                            {issue.status && <Badge variant="outline" className="text-xs">{issue.status}</Badge>}
                          </Link>
                        ))}
                      </div>
                    )}
                    {dispatchRecords && dispatchRecords.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Truck className="h-3 w-3" /> Dispatches ({dispatchRecords.length})
                        </p>
                        {dispatchRecords.map((dispatch: any) => (
                          <Link
                            key={dispatch.name}
                            to={`/dispatch/${dispatch.name}`}
                            className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors mb-2"
                          >
                            <div>
                              <p className="text-sm font-medium">{dispatch.name}</p>
                              <p className="text-xs text-muted-foreground">{dispatch.dispatch_type || 'Dispatch'} • {formatDateOnly(dispatch.date || dispatch.creation)}</p>
                            </div>
                            {dispatch.status && <Badge variant="outline" className="text-xs">{dispatch.status}</Badge>}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )} */}
            </div>

            {/* ── RIGHT SIDEBAR ──────────────────────────────────────────────── */}
            <div className="space-y-4">
              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-border p-4">
                <p className="text-sm font-semibold text-foreground mb-3">Quick Actions</p>
                <div className="space-y-2">
                  {isIssued ? (
                    <Link to={`/gifts/${gift.name}`} className="block">
                      <div className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                        <FileText className="h-4 w-4" /> View Issue Details
                      </div>
                    </Link>
                  ) : (
                    <button
                      className="w-full"
                      onClick={() => {
                        const eligibleInterest = displayInterests.find((i: any) => i.approval_status === 'Approved' && !i.converted_to_issue)
                        if (!eligibleInterest) {
                          toast.error('No approved interest available to issue')
                          return
                        }
                        const name = eligibleInterest.owner_full_name || eligibleInterest.gift_recipient || eligibleInterest.name
                        setShowConfirmIssue({ interestName: eligibleInterest.name, guestName: name })
                      }}
                    >
                      <div className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                        <Send className="h-4 w-4" /> Issue this Gift
                      </div>
                    </button>
                  )}
                  <button
                    onClick={() => setShowInterestModal(true)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors text-foreground"
                    style={{ display: effectiveStatus === 'Delivered' ? 'none' : undefined }}
                  >
                    <Heart className="h-4 w-4 text-muted-foreground" /> Record Interest
                  </button>
                  <button
                    onClick={() => setShowDispatchModal(true)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors text-foreground"
                  >
                    <Truck className="h-4 w-4 text-muted-foreground" /> Create Dispatch
                  </button>
                </div>
              </div>

              {/* Barcode */}
              {hasBarcode && (
                <div className="bg-white rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Scan className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Barcode</p>
                  </div>
                  <div className="bg-white rounded-lg border border-border p-4 text-center">
                    {gift.barcode ? (
                      <img
                        src={getImageUrl(gift.barcode)}
                        alt="Barcode"
                        className="w-full h-auto max-h-16 object-contain mx-auto"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      // Placeholder barcode visual
                      <div className="flex items-end justify-center gap-px h-14">
                        {Array.from({ length: 40 }).map((_, i) => (
                          <div
                            key={i}
                            className="bg-foreground"
                            style={{ width: i % 3 === 0 ? '3px' : '1.5px', height: `${Math.random() * 30 + 30}px` }}
                          />
                        ))}
                      </div>
                    )}
                    <p className="text-xs font-mono text-muted-foreground mt-2">
                      {gift.barcode_value || '971000000019'}
                    </p>
                  </div>
                </div>
              )}

              {/* Activity Timeline */}
              <div className="bg-white rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Activity Timeline</p>
                </div>
                <div className="space-y-4">
                  {timeline.length > 0 ? timeline.map((event, index) => {
                    const cfg = timelineConfig[event.type]
                    const Icon = cfg.icon
                    const isLast = index === timeline.length - 1
                    return (
                      <div key={index} className="relative pl-8">
                        {!isLast && (
                          <div className="absolute left-3 top-6 bottom-0 w-px bg-border" />
                        )}
                        <div className={`absolute left-0 top-0 w-6 h-6 rounded-full ${cfg.color} flex items-center justify-center shadow-sm z-10`}>
                          <Icon className="h-3 w-3 text-white" />
                        </div>
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground leading-snug">{event.title}</p>
                            <p className="text-xs text-muted-foreground shrink-0">{formatDateOnly(event.date)}</p>
                          </div>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                          )}
                          {event.link && (
                            <Link to={event.link} className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                              View details <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  }) : (
                    // Placeholder timeline matching Figma
                    [
                      { icon: Truck, color: 'bg-blue-500', title: 'Dispatched', desc: 'Create Dispatch - Prepared', link: true, date: '28 Jan 2026' },
                      { icon: Edit, color: 'bg-blue-500', title: 'Modified', desc: 'Modified by Administrator', link: false, date: '23 Jan 2026' },
                      { icon: Plus, color: 'bg-green-500', title: 'Gift Created', desc: gift.gift_name, link: false, date: '22 Jan 2026' },
                      { icon: Send, color: 'bg-purple-500', title: 'Issued', desc: 'Issue Created', link: true, date: '08 Jan 2026' },
                    ].map((item, idx, arr) => {
                      const Icon = item.icon
                      return (
                        <div key={idx} className="relative pl-8">
                          {idx < arr.length - 1 && (
                            <div className="absolute left-3 top-6 bottom-0 w-px bg-border" />
                          )}
                          <div className={`absolute left-0 top-0 w-6 h-6 rounded-full ${item.color} flex items-center justify-center shadow-sm z-10`}>
                            <Icon className="h-3 w-3 text-white" />
                          </div>
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold leading-snug">{item.title}</p>
                              <p className="text-xs text-muted-foreground shrink-0">{item.date}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                            {item.link && (
                              <span className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5 cursor-pointer">
                                View details <ExternalLink className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* System Information */}
              <div className="bg-white rounded-xl border border-border p-4">
                <p className="text-sm font-semibold text-foreground mb-3">System Information</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Created By</p>
                    <p className="text-sm font-medium">{gift.owner || 'Administrator'}</p>
                  </div>
                  {gift.creation && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Created On</p>
                      <p className="text-sm font-medium">{formatDate(gift.creation)}</p>
                    </div>
                  )}
                  {gift.modified_by && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Last Modified By</p>
                      <p className="text-sm font-medium">{gift.modified_by}</p>
                    </div>
                  )}
                  {gift.modified && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Last Modified On</p>
                      <p className="text-sm font-medium">{formatDate(gift.modified)}</p>
                    </div>
                  )}
                  {/* <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Document ID</p>
                    <p className="text-sm font-mono">{gift.name}</p>
                  </div> */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ─────────── */}
      <RecordInterestModal
        open={showInterestModal}
        onClose={() => setShowInterestModal(false)}
        onRecord={(recipientName) => recordInterestMutation.mutate(recipientName)}
        isSubmitting={recordInterestMutation.isPending}
      />

      <CreateDispatchModal
        open={showDispatchModal}
        onClose={() => setShowDispatchModal(false)}
        onConfirm={(payload) => dispatchMutation.mutate(payload)}
        isSubmitting={dispatchMutation.isPending}
      />

      <ConfirmIssueModal
        open={!!showConfirmIssue}
        onClose={() => setShowConfirmIssue(null)}
        guestName={showConfirmIssue?.guestName || ''}
        onConfirm={() => {
          if (!showConfirmIssue) return
          createIssueMutation.mutate(showConfirmIssue.interestName)
        }}
      />

      <RejectionModal
        open={showRejectionModal}
        onClose={() => setShowRejectionModal(false)}
        requesterName={rejectTarget?.label || approvalRequester}
        onConfirm={(reason) => {
          if (!rejectTarget) return
          rejectMutation.mutate({ type: rejectTarget.type, name: rejectTarget.name, reason })
        }}
        isSubmitting={rejectMutation.isPending}
      />

      <EditGiftPanel
        open={showEditPanel}
        onClose={() => setShowEditPanel(false)}
        gift={gift}
        onUpdate={(payload) => updateGiftMutation.mutate(payload)}
        isUpdating={updateGiftMutation.isPending}
      />

      {/* ── Delete Dialog ─── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{gift.gift_name}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { deleteMutation.mutate(); setShowDeleteDialog(false) }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}