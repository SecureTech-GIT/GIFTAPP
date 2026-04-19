/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Search, Plus, X, Check, Users, Loader2, AlertCircle 
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GiftRecipientAPI, EventAPI } from '@/services/api'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/useDebounce'

interface AddGuestModalProps {
  eventName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onGuestsAdded?: () => void
}
// ─── Avatar ─────────────────────────────────────────────────────────
function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const colors = [
    "bg-orange-400",
    "bg-blue-400",
    "bg-green-400",
    "bg-purple-400",
    "bg-pink-400",
  ];
  const idx = name.charCodeAt(0) % colors.length;
  const sz = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";

  return (
    <div
      className={`${sz} ${colors[idx]} rounded-full flex items-center justify-center text-white font-semibold`}
    >
      {initials}
    </div>
  );
}


export function AssignGuestModal({ eventName, open, onOpenChange, onGuestsAdded }: AddGuestModalProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [selectedGuests, setSelectedGuests] = useState<string[]>([])
  const debouncedSearch = useDebounce(search, 300)

  // Only fetch when search has at least 2 characters
  const shouldFetch = debouncedSearch.length >= 2

  // Fetch guests based on search query
  const { data: searchResults, isLoading, error } = useQuery({
    queryKey: ['guest-search', debouncedSearch],
    queryFn: async () => {
      const result = await GiftRecipientAPI.list(debouncedSearch, 1, 50)
      if (!result.success) throw new Error(result.error || t('events.errors.fetchGuestsFailed'))
      return result.data || []
    },
    enabled: open && shouldFetch,
  })

  // Assign guests mutation
  const assignMutation = useMutation({
    mutationFn: async (guestIds: string[]) => {
      const results = await Promise.all(
        guestIds.map(async (guestId) => {
          const res = await EventAPI.addParticipantToEvent(eventName, guestId, 'Invited')
          if (!res.success) {
            throw new Error(res.error || t('events.errors.addGuestFailed', { id: guestId }))
          }
          return res.data
        })
      )
      return results
    },
    onSuccess: () => {
      toast.success(t('events.messages.guestsAdded', { count: selectedGuests.length }))
      setSelectedGuests([])
      setSearch('')
      onOpenChange(false)
      onGuestsAdded?.()
    },
    onError: (error) => {
      toast.error(String((error as any)?.message || t('events.errors.addGuestsFailed')))
      console.error(error)
    }
  })

  const toggleGuest = (guestId: string) => {
    setSelectedGuests(prev => 
      prev.includes(guestId) 
        ? prev.filter(id => id !== guestId)
        : [...prev, guestId]
    )
  }

  const handleAssign = () => {
    if (selectedGuests.length === 0) return
    assignMutation.mutate(selectedGuests)
  }

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedGuests([])
      setSearch('')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 ltr:mr-2 rtl:ml-2" />
            {t('events.modal.addGuests')}
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="ltr:absolute ltr:left-3 rtl:absolute rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('events.modal.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ltr:pl-10 rtl:pr-10 h-11"
          />
          {isLoading && (
            <Loader2 className="ltr:absolute ltr:right-3 rtl:absolute rtl:left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Selected count */}
        {selectedGuests.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-3 py-2 rounded-md">
            <Check className="h-4 w-4" />
            {t('events.modal.selectedCount', { count: selectedGuests.length })}
          </div>
        )}

        {/* Guests List */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6 py-2">
          {/* Initial state - show message to search */}
          {!search && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm font-medium text-foreground mb-1">
                {t('events.modal.searchGuests')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('events.modal.searchHint')}
              </p>
            </div>
          )}

          {/* Searching state */}
          {search && !shouldFetch && (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                {t('events.modal.keepTyping')}
              </p>
            </div>
          )}

          {/* Loading */}
          {isLoading && shouldFetch && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error */}
          {error && shouldFetch && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t('events.modal.loadError')}</AlertDescription>
            </Alert>
          )}

          {/* No results */}
          {!isLoading && !error && shouldFetch && searchResults?.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm font-medium text-foreground mb-1">{t('events.modal.noGuestsFound')}</p>
              <p className="text-xs text-muted-foreground">
                {t('events.modal.tryAdjusting')}
              </p>
            </div>
          )}

          {/* Results list */}
          {!isLoading && !error && searchResults && searchResults.length > 0 && shouldFetch && (
            <div className="space-y-1">
              {searchResults.map((guest: any) => {
                const isSelected = selectedGuests.includes(guest.name)
                return (
                  <div
                    key={guest.name}
                    onClick={() => toggleGuest(guest.name)}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                      ${isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted border border-transparent'}
                    `}
                  >
                    <Checkbox 
                      checked={isSelected}
                      onCheckedChange={() => toggleGuest(guest.name)}
                      className="pointer-events-none"
                    />
                    
                    <Avatar
                      name={guest.owner_full_name || guest.name}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {guest.owner_full_name || guest.name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {guest.coordinator_full_name && (
                          <span>{t('events.modal.coordinator')}: {guest.coordinator_full_name}</span>
                        )}
                        {guest.coordinator_mobile_no && (
                          <span>• {guest.coordinator_mobile_no}</span>
                        )}
                        {guest.guest_nationality && (
                          <span>• {guest.guest_nationality}</span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={assignMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selectedGuests.length === 0 || assignMutation.isPending}
          >
            {assignMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                {t('common.adding')}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t('events.modal.addButton', { count: selectedGuests.length })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}