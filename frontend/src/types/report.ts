import type { LucideIcon } from 'lucide-react'

export interface FilterConfig {
  key: string
  label: string
  type: 'text' | 'date' | 'select' | 'number' | 'event-select' | 'gift-select' | 'category-select' | 'status-select'
  options?: { value: string; label: string }[]
  placeholder?: string
}

export interface ReportConfig {
  id: string
  name: string
  nameAr: string
  description: string
  descriptionAr: string
  apiMethod: string
  icon: LucideIcon
  filters: FilterConfig[]
}

export interface ReportResult {
  data: Record<string, any>[]
  total: number
  page?: number
  total_pages?: number
}

export interface ReportFilters {
  [key: string]: string | number | string[] | undefined
  page?: number
  limit?: number
  from_date?: string
  to_date?: string
}
