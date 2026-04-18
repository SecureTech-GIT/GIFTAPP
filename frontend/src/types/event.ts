// types/event.ts
export interface EventParticipant {
  name?: string
  gift_recipient?: string
  recipient_name?: string
  coordinator_name?: string
  contact_number?: string
  attending?: string
  invitation_status?: string
  remarks?: string
  interested_gifts_count?: number
  issued_gifts_count?: number
}

export interface EventCategorySelection {
  name?: string
  category?: string
  available_count?: number
}

export interface EventGift {
  name?: string
  gift?: string
  gift_name?: string
  category?: string
  display_status?: string
  remarks?: string
}

export interface EventTeamMember {
  name?: string
  user?: string
  full_name?: string
  team_role?: 'Event Manager' | 'Event Coordinator' | string
  assigned_date?: string
  is_primary_contact?: 0 | 1 | boolean
  can_approve?: 0 | 1 | boolean
}

export interface GiftEvent {
  name?: string
  subject: string
  event_owner?: string
  event_coordinator?: string
  event_category?: string
  event_type?: string
  color?: string
  status?: string
  starts_on?: string
  ends_on?: string
  sender?: string
  all_day?: boolean
  description?: string
  address_line_1?: string
  address_line_2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  event_participants?: EventParticipant[]
  event_managers?: EventTeamMember[]
  event_coordinators?: EventTeamMember[]
  event_categories?: EventCategorySelection[]
  event_gifts?: EventGift[]
}
