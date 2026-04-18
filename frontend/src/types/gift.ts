// Gift Management System Types - Matches Frappe Backend Schema

// Base Frappe document fields
export interface FrappeDoc {
  name: string
  owner?: string
  creation?: string
  modified?: string
  modified_by?: string
  docstatus?: number
}

// Child table base (name is optional for new records)
export interface FrappeChildDoc {
  name?: string
  parent?: string
  parentfield?: string
  parenttype?: string
  idx?: number
  doctype?: string
}

// Gift Category Details (child table for Gift Category - template attributes)
export interface GiftCategoryDetail extends FrappeChildDoc {
  attribute_name: string
  attribute_type?: 'Text' | 'Number' | 'Select' | 'Date' | 'Checkbox'
  is_mandatory?: boolean | 0 | 1
  select_options?: string // newline-separated options for Select type
  default_value?: string
  display_order?: number
}

// Gift Category
export interface GiftCategory extends FrappeDoc {
  category_name: string
  description?: string
  category_type?: string
  requires_maintenance?: boolean | 0 | 1
  category_attributes?: GiftCategoryDetail[] // Template attributes for this category
}

// Gift Details (child table for Gift - actual attribute values)
export interface GiftDetail extends FrappeChildDoc {
  attribute_name: string
  attribute_type?: 'Text' | 'Number' | 'Select' | 'Date' | 'Checkbox'
  is_mandatory?: boolean
  select_options?: string
  default_value?: string
  display_order?: number
}

// Gift Images (child table for Gift)
export interface GiftImage extends FrappeChildDoc {
  image?: string
}

// Gift Store (location history timeline)
export interface GiftStore extends FrappeChildDoc {
  transfer_date?: string
  from_location?: string
  from_warehouse?: string
  to_location?: string
  to_warehouse?: string
  reason?: 'Initial Storage' | 'Warehouse Transfer' | 'Event Display' | 'Maintenance' | 'Delivery' | 'Return' | 'Other'
  transferred_by?: string
  remarks?: string
  reference_document?: string
}

export interface GiftEventHistoryRow extends FrappeChildDoc {
  from_event?: string
  to_event?: string
  moved_on?: string
  moved_by?: string
  remarks?: string
  from_event_name?: string
  from_event_status?: string
  to_event_name?: string
  to_event_status?: string
}

// Gift - matches exact Frappe doctype structure
export interface Gift extends FrappeDoc {
  // Basic Info
  gift_name: string
  gift_id?: string
  quantity?: number
  estimated_value?: number
  description?: string
  category?: string // Link to Gift Category
  status?: '' | 'Available' | 'Issued' | 'Delivered' | 'Reserved'
  
  // Barcode
  import_barcode?: boolean
  barcode?: string // Attach (readonly) - auto generated
  barcode_value?: string // Manual barcode ID when import_barcode is checked
  uae_ring_number?: string

  // Assignment
  event?: string
  event_name?: string

  // Receiving
  received_datetime?: string
  received_by_name?: string
  received_by_contact?: string
  
  // Child Tables
  gift_details?: GiftDetail[]
  gift_images?: GiftImage[]
  gift_event_history?: GiftEventHistoryRow[]
  table_gvlf?: any[]
  
  // Recipient Info (readonly - populated when issued)
  gift_recipient?: string
  owner_full_name?: string
  coordinator_full_name?: string
  mobile_number?: string
  emirates_id?: string
  address?: string
  issued_date?: string
  person_photo?: string
  
  // Condition
  item_condition?: 'New' | 'Excellent' | 'Good' | 'Fair' | 'Needs Repair' | 
    'Living (Healthy)' | 'Living (Sick)' | 'Living (Needs Doctor)' | 
    'Living (In Care)' | 'Sent to Zoo' | 'Deceased'
  health_status?: 'Healthy' | 'Needs Checkup' | 'Under Treatment' | 'Recovering' | 'Critical' | 'Quarantine'
  
  // Location
  current_location_type?: 'Warehouse' | 'Farm' | 'Event' | 'In Transit' | 'With Recipient' | 'Maintenance Center' | 'Other'
  warehouse?: string // Link to Warehouse
  storage_location?: string
  storage_date?: string
  location_contact_person?: string
  location_contact_number?: string
  location_address?: string
  gift_location_history?: GiftStore[] // readonly
  
  // QR Code
  qr_code_enabled?: boolean
  qr_code_value?: string // readonly
  qr_code_image?: string // readonly
  scan_count?: number // readonly
}

// Gift Recipient
export interface GiftRecipient {
  name: string

  // Auto-generated (read-only)
  owner_full_name?: string

  // Guest basic info
  salutation?: string
  guest_first_name: string
  guest_last_name?: string
  designation?: string
  organization?: string
  coordinator_first_name?:string;
  coordinator_last_name?:string;

  // Contact info
  email?: string
  mobile_number?: string
  guest_nationality?: string
  guest_country?: string
  address?: string
  emirates_id?: string

  // Metadata
  recipient_type?: 'Individual' | 'Royal Family' | 'Government Official' | 'Organization' | 'VIP'
  vip_level?: string
  preferred_contact_method?: '' | 'Email' | 'Phone'
  blocked?: boolean
  person_photo?: string
  is_active?: boolean

  // Coordinator info (optional)
  coordinator_full_name?: string
  coordinator_email?: string
  coordinator_mobile_no?: string
  coordinator_emirates_id?: string

  // Timestamps
  creation?: string
  modified?: string
}

// Gift Issue Document (child table)
export interface GiftIssueDocument extends FrappeChildDoc {
  document_type?: string
  document_attachment?: string
  description?: string
}

// Gift Issue
export interface GiftIssue extends FrappeDoc {
  gift: string
  gift_name?: string
  guest_name?: string
  guest_full_name?: string
  created_by_full_name?: string
  date?: string
  status?: 'Pending' | 'In Transit' | 'Delivered' | 'Returned' | 'Cancelled'
  approval_status?: 'Awaiting Approval' | 'Approved' | 'Rejected'
  rejection_reason?: string
  category?: string
  gift_recipient: string
  owner_full_name: string
  coordinator_full_name: string
  mobile_number: string
  emirates_id?: string
  address?: string
  person_photo?: string
  delivery_note?: string
  delivery_description?: string
  dispatch_date?: string
  delivery_method?: 'Direct Handover' | 'Transport' | 'Courier'
  dispatch_type?: 'In-Person' | 'At Event' | 'At Office'
  tracking_number?: string
  delivery_date?: string
  actual_delivery_time?: string
  delivery_address?: string
  received_by_type?: 'Guest (VIP)' | 'Family Member' | 'Representative' | 'Coordinator' | 'Other'
  received_by_name?: string
  receiver_id?: string
  receiver_contact?: string
  receiver_relationship?: string
  delivery_person_name?: string
  delivery_person_contact?: string
  delivery_person_id?: string
  delivery_person_company?: string
  transport_company?: string
  vehicle_number?: string
  driver_name?: string
  driver_contact?: string
  delivery_remarks?: string
  event?: string
  dispatch_reference?: string
  dispatch_status?: string
  transport_mode?: string
  estimated_arrival?: string
  documents?: GiftIssueDocument[]
}

// Gift Interest
export interface GiftInterest extends FrappeDoc {
  gift?: string
  gift_name?: string
  guest_name?: string
  guest_full_name?: string
  created_by_full_name?: string
  interest_datetime?: string
  date?: string
  category?: string
  gift_recipient?: string
  owner_full_name?: string
  coordinator_full_name?: string
  mobile_number?: string
  emirates_id?: string
  address?: string
  interest_source?: 'Direct Inquiry' | 'Event Registration' | 'Website' | 'Referral' | 'QR Code Scan' | 'Phone Call' | 'Email' | 'Other' | 'Manual Entry'
  event?: string
  interest_level?: 'Very Interested' | 'Interested' | 'Just Browsing' | 'Reserved'
  remarks?: string
  follow_up_status?: 'New' | 'Converted to Issue' | 'Closed'
  approval_status?: 'Pending' | 'Approved' | 'Rejected'
  approved_by?: string
  approved_on?: string
  converted_to_issue?: string
  conversion_date?: string
}

// Gift Receipt Photos (child table)
export interface GiftReceiptPhoto extends FrappeChildDoc {
  photo?: string
}

// Gift Receipt
export interface GiftReceipt extends FrappeDoc {
  receipt_date: string
  received_from: string
  received_by?: string
  receipt_status?: 'Pending Inspection' | 'Approved' | 'Quarantine' | 'Rejected'
  source_location?: string
  source_contact?: string
  transport_method?: string
  transport_company?: string
  create_new_gift?: boolean
  gift?: string
  gift_name?: string
  gift_id?: string
  category?: string
  breed?: string
  gender?: string
  weight?: string
  description?: string
  item_condition?: string
  health_status?: string
  inspection_date?: string
  inspected_by?: string
  inspection_notes?: string
  assign_to_warehouse: string
  storage_location?: string
  storage_date?: string
  current_location_type?: 'Warehouse' | 'Farm' | 'Event' | 'In Transit' | 'With Recipient' | 'Maintenance Center' | 'Other'
  barcode_value?: string
  health_certificate?: string
  transport_documents?: string
  purchase_invoice?: string
  other_documents?: string
  gift_details?: GiftDetail[]
  gift_images?: GiftImage[]
  receipt_photos?: GiftReceiptPhoto[]
  amended_from?: string
}

// Gift Dispatch
export interface GiftDispatch extends FrappeDoc {
  dispatch_date?: string
  gift?: string
  gift_name?: string
  current_warehouse?: string
  dispatch_type?: 'Internal' | 'Hand-over' | 'Courier'
  tracking_number?: string
  dispatch_status?: 'Pending' | 'Dispatched' | 'Failed' | 'Returned'
  related_gift_issue?: string
  event?: string
  return_reason?: string
  return_handled_on?: string
  related_event?: string
  to_warehouse?: string
  recipient_name?: string
  recipient_contact?: string
  destination_address?: string
  transport_mode?: string
  vehicle_number?: string
  driver_name?: string
  driver_contact?: string
  estimated_arrival?: string
  actual_delivery_date?: string
  delivery_date?: string
  health_certificate?: string
  transport_permit?: string
  delivery_note?: string
  other_documents?: string
  dispatched_by?: string
  dispatched_at?: string
  received_by_name?: string
  receiver_id?: string
  delivery_remarks?: string
  amended_from?: string
}

// Gift Maintenance
export interface GiftMaintenance extends FrappeDoc {
  maintenance_date?: string
  maintenance_type?: 'Routine Checkup' | 'Emergency' | 'Vaccination' | 'Treatment' | 'Repair' | 'Cleaning' | 'Other'
  gift?: string
  gift_name?: string
  current_warehouse?: string
  current_location?: string
  performed_by?: string
  provider_type?: 'Internal' | 'External Vet' | 'External Service'
  contact_number?: string
  license_number?: string
  health_status?: string
  weight?: string
  temperature?: string
  vital_signs?: string
  observations?: string
  diagnosis?: string
  treatment_given?: string
  recommendations?: string
  medications?: string
  follow_up_required?: boolean
  next_checkup_date?: string
  follow_up_notes?: string
  maintenance_photos?: string
  reports?: string
  sop_reference?: string
  certificate?: string
  maintenance_cost?: number
  paid_by?: string
  payment_status?: 'Pending' | 'Paid' | 'Partially Paid'
  invoice_number?: string
}

// API Response types
export interface FrappeListResponse<T> {
  data: T[]
}

export interface FrappeDocResponse<T> {
  data: T
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  total?: number
  page?: number
  totalPages?: number
}

// Dashboard stats
export interface DashboardStats {
  totalGifts: number
  availableGifts: number
  issuedGifts: number
  inTransitGifts: number
  deliveredGifts: number
  reservedGifts: number
  totalReceivedGifts: number
  totalRecipients: number
  totalCategories: number
  totalIssues: number
}
