import axios, { AxiosInstance, AxiosError } from 'axios'
import { config } from '../config/environment'
import { getAuthHeader } from '../lib/tokenAuth'
import type { 
  Gift, 
  GiftCategory, 
  GiftRecipient, 
  GiftIssue,
  GiftInterest,
  GiftReceipt,
  GiftMaintenance,
  GiftDispatch,
  FrappeListResponse,
  FrappeDocResponse,
  ApiResponse,
  DashboardStats
} from '../types/gift'
import type { GiftEvent } from '../types/event'

export interface ReceivedGift {
  name: string
  status?: string
  received_date?: string
  donor_name?: string
  donor_type?: string
  gift?: string
  gift_name?: string
  category?: string
  [key: string]: any
}

const SPA_BASE = import.meta.env.DEV ? '' : '/gift'
const LOGIN_PATH = `${SPA_BASE}/login`

// ============ Salutation API ==========
export const SalutationAPI = {
  async list(search = '', limit = 50): Promise<ApiResponse<string[]>> {
    try {
      const response = await api.get<{ message: { salutations: string[] } }>(
        '/api/method/gift.gift.api.list_salutations',
        { params: { search: search || undefined, limit } }
      )
      return { success: true, data: response.data.message?.salutations || [] }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch salutations') }
    }
  },
}

export interface GiftDetailBundle {
  gift: Gift
  category?: { name: string; category_name?: string; category_type?: string } | null
  interests: GiftInterest[]
  issues: GiftIssue[]
  dispatches: GiftDispatch[]
  timeline?: Array<{
    kind: string
    doctype: string
    docname: string
    timestamp: string
    user?: string
    user_full_name?: string
    changes?: Array<{ field: string; from: any; to: any }>
    gift_recipient?: string
    guest_full_name?: string
    approval_status?: string
    status?: string
    version?: string
  }>
  event_history?: Array<{
    from_event?: string
    to_event?: string
    moved_on?: string
    moved_by?: string
    remarks?: string
    from_event_name?: string
    from_event_status?: string
    to_event_name?: string
    to_event_status?: string
  }>
  event?: string
  can_approve?: boolean
  pending_interest_requests?: GiftInterest[]
  pending_issue_requests?: GiftIssue[]
  return_history?: GiftIssue[]
}

// Create API instance
const api: AxiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
})

// Request interceptor
api.interceptors.request.use(
  (requestConfig) => {
    // Check for token-based auth first (bypasses cookie issues)
    const authHeader = getAuthHeader()
    if (authHeader) {
      requestConfig.headers['Authorization'] = authHeader
    }
    
    // Add CSRF token (prefer window.csrf_token, fallback to csrf_token cookie)
    // GOOD: Only for POST/PUT/DELETE, not when using token auth
    if (requestConfig.method !== 'get' && !authHeader) {
      const csrfToken = window.csrf_token || getCookie('csrf_token')
      if (csrfToken) {
        requestConfig.headers['X-Frappe-CSRF-Token'] = csrfToken
      }
    }


    // Add timestamp to GET requests to prevent caching
    if (requestConfig.method === 'get') {
      requestConfig.params = { ...requestConfig.params, _t: Date.now() }
    }

    return requestConfig
  },
  (error) => Promise.reject(error)
)

// Response interceptor - only redirect on 401 (not 403)
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status
    const data = error.response?.data as any
    
    // Only redirect on 401 (Unauthorized) - not on 403 (Forbidden/Permission denied)
    // 403 means logged in but lacks permission - don't redirect to login
    if (status === 401 && window.location.pathname !== '/login' && window.location.pathname !== LOGIN_PATH) {
      // Clear local storage and redirect
      localStorage.removeItem('frappe_user')
      localStorage.removeItem('frappe_fullname')
      window.location.href = LOGIN_PATH
    }
    
    return Promise.reject(error)
  }
)

// Helper to parse Frappe-specific error messages from various response formats
const parseFrappeError = (data: any): string | null => {
  if (!data) return null

  // Priority 1: _server_messages (most detailed for validation/link errors)
  if (data._server_messages) {
    try {
      const messages = JSON.parse(data._server_messages)
      if (Array.isArray(messages) && messages.length > 0) {
        const firstMessage = JSON.parse(messages[0])

        // Clean HTML from error message but keep meaningful text
        let cleanMsg = firstMessage.message || ''
        
        // Replace anchor tags with just the text
        cleanMsg = cleanMsg.replace(/<a [^>]*>([^<]+)<\/a>/g, '$1')
        
        // Remove all other HTML tags
        cleanMsg = cleanMsg.replace(/<[^>]*>/g, '')
        
        // Decode HTML entities
        cleanMsg = cleanMsg.replace(/&nbsp;/g, ' ')
        cleanMsg = cleanMsg.replace(/&amp;/g, '&')
        cleanMsg = cleanMsg.replace(/&lt;/g, '<')
        cleanMsg = cleanMsg.replace(/&gt;/g, '>')
        cleanMsg = cleanMsg.replace(/&quot;/g, '"')
        
        if (cleanMsg.trim()) {
          return cleanMsg.trim()
        }
      }
    } catch (e) {
      console.warn('Failed to parse _server_messages:', e)
    }
  }

  // Priority 2: exception field (user-friendly error with HTML)
  if (data.exception) {
    let cleanException = data.exception
    cleanException = cleanException.replace(/<a [^>]*>([^<]+)<\/a>/g, '$1')
    cleanException = cleanException.replace(/<[^>]*>/g, '')
    cleanException = cleanException.trim()
    
    if (cleanException) {
      return cleanException
    }
  }

  // Priority 3: message field (direct error message)
  if (data.message) {
    if (typeof data.message === 'string') {
      const cleanMessage = data.message.replace(/<[^>]*>/g, '').trim()
      if (cleanMessage) {
        return cleanMessage
      }
    }
    // Sometimes message is an object
    if (typeof data.message === 'object' && data.message !== null) {
      return JSON.stringify(data.message)
    }
  }

  // Priority 4: exc field (extract from Python traceback)
  if (data.exc) {
    const excLines = data.exc.split('\n')
    
    // Look for specific error types and their messages
    const errorPatterns = [
      /frappe\.exceptions\.(\w+Error):\s*(.+)/,
      /(\w+Error):\s*(.+)/,
      /Exception:\s*(.+)/
    ]
    
    for (const line of excLines) {
      for (const pattern of errorPatterns) {
        const match = line.match(pattern)
        if (match && match[2]) {
          // Return the error message (group 2)
          return match[2].trim()
        } else if (match && match[1]) {
          // Map specific error types to user-friendly messages
          const errorType = match[1].trim()
          switch (errorType) {
            case 'AuthenticationError':
              return 'Username or password is incorrect'
            case 'PermissionError':
              return 'You do not have permission to perform this action'
            case 'DoesNotExistError':
              return 'Record not found'
            case 'MandatoryError':
              return 'Required field is missing'
            case 'ValidationError':
              return 'Invalid data provided'
            default:
              return errorType
          }
        }
      }
    }
  }

  // Priority 5: exc_type (error class name)
  if (data.exc_type) {
    const errorType = data.exc_type.replace('frappe.exceptions.', '')
    // Map specific error types to user-friendly messages
    switch (errorType) {
      case 'AuthenticationError':
        return 'Username or password is incorrect'
      case 'PermissionError':
        return 'You do not have permission to perform this action'
      case 'DoesNotExistError':
        return 'Record not found'
      case 'MandatoryError':
        return 'Required field is missing'
      case 'ValidationError':
        return 'Invalid data provided'
      default:
        return errorType
    }
  }

  return null
}

// Helper to handle API errors with better Frappe error parsing
const handleError = (error: unknown, defaultMessage = 'An error occurred'): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any
    
    // Try to get Frappe-specific error message FIRST
    const frappeError = parseFrappeError(data)
    if (frappeError) {
      return frappeError
    }

    // Fallback to HTTP status code based messages
    switch (error.response?.status) {
      case 400:
        return data?.message || 'Invalid request. Please check your input.'
      case 401:
        return 'Authentication required. Please log in.'
      case 403:
        // Check if this is likely a cookie/session issue vs real permission issue
        const hasStoredUser = !!localStorage.getItem('frappe_user')
        if (hasStoredUser) {
          return 'Permission denied. Session cookie may not be sent. Try using API Token auth at /debug/connection'
        }
        return 'You do not have permission to perform this action.'
      case 404:
        return 'The requested resource was not found.'
      case 417:
        return 'Query field not permitted. Check your filters/fields.'
      case 500:
        return data?.message || 'Server error. Please try again later.'
      case 503:
        return 'Service temporarily unavailable. Please try again later.'
      default:
        return data?.message || defaultMessage
    }
  }
  
  // Handle non-Axios errors
  if (error instanceof Error) {
    return error.message
  }
  
  return defaultMessage
}


// Basic cookie reader (for csrf_token)
const getCookie = (name: string): string | undefined => {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift()
  return undefined
}

// URL encode doctype name for Frappe REST API
const encodeDoctype = (doctype: string): string => encodeURIComponent(doctype)

// ============ Auth API ============
export const AuthAPI = {
  /**
   * Login using Frappe's standard login endpoint
   * Session is maintained via cookies (sid, csrf_token)
   */
  async login(username: string, password: string): Promise<ApiResponse<{ user: string; fullName?: string }>> {
    try {
      const body = new URLSearchParams({ usr: username, pwd: password })
      const loginRes = await api.post<{ message: string; full_name?: string }>('/api/method/login', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      // Login successful - extract user info from response
      const user = username
      const fullName = loginRes.data?.full_name || username
      
      // Get CSRF token from cookie (set by Frappe after login)
      const csrf = getCookie('csrf_token')
      if (csrf) window.csrf_token = csrf

      // Store user info in localStorage for UI display only (not for auth)
      localStorage.setItem('frappe_user', user)
      localStorage.setItem('frappe_fullname', fullName)

      // Verify session is working by calling get_logged_user
      try {
        const verifyRes = await api.get<{ message: string }>('/api/method/frappe.auth.get_logged_user')
        void verifyRes
      } catch (verifyErr) {
        console.warn('Session verification failed:', verifyErr)
      }

      // Check user roles and block login if no event role
      try {
        const permRes = await api.get<{ message: { roles: string[]; is_admin: boolean; is_event_manager: boolean } }>('/api/method/gift.gift.api.get_user_permission_context')
        const msg = permRes.data?.message
        const userRoles = msg?.roles || []
        const isAdmin = msg?.is_admin || false
        const isEventManager = msg?.is_event_manager || false
        const hasEventRole = isAdmin || isEventManager || userRoles.includes('Event Coordinator')
        if (!hasEventRole) {
          // Logout the user immediately
          await this.logout()
          return { success: false, error: 'You do not have access to the system. Please contact your administrator.' }
        }
      } catch (roleErr) {
        console.warn('Role check failed:', roleErr)
        // If role check fails, allow login but this could be logged
      }

      return { success: true, data: { user, fullName } }
    } catch (error: any) {
  const message = error?.response?.data?.message?.toLowerCase() ?? ''

  if (
    message.includes('user disabled or missing') ||
    message.includes('disabled or missing')
  ) {
    return { success: false, error: 'user disabled or missing' }
  }

  if (
    message.includes('invalid login credentials') ||
    error?.response?.data?.exc_type === 'AuthenticationError'
  ) {
    return { success: false, error: 'invalid login credentials' }
  }

  return { success: false, error: handleError(error, 'Login failed') }
}

  },

  /**
   * Logout using Frappe's standard logout endpoint
   */
  async logout(): Promise<ApiResponse<void>> {
    try {
      await api.post('/api/method/logout')
      window.csrf_token = undefined
      localStorage.removeItem('frappe_user')
      localStorage.removeItem('frappe_fullname')
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Logout failed') }
    }
  },

  /**
   * Check if session is valid by making a lightweight REST API call
   * Uses frappe.auth.get_logged_user (permission-neutral) so users without Gift DocType
   * read permission can still log in and load the app shell.
   */
  async getLoggedUser(): Promise<ApiResponse<string>> {
    try {
      const res = await api.get<{ message: string }>('/api/method/frappe.auth.get_logged_user')
      const user = res.data?.message

      if (user) {
        localStorage.setItem('frappe_user', user)
        return { success: true, data: user }
      }

      return { success: false, error: 'Not logged in' }
    } catch (error: any) {
      return { success: false, error: handleError(error, 'Not logged in') }
    }
  },
}

// ============ Gift API ============
export const GiftAPI = {

  // In your GiftAPI class

  async list(
    filters: Record<string, string> = {}, 
    page = 1, 
    limit = 20
  ): Promise<ApiResponse<Gift[]> & { total?: number; page?: number; limit?: number }> {
    try {
      const response = await api.get<{ message: any }>('/api/method/gift.gift.api.list_gifts', {
        params: {
          filters: JSON.stringify(filters),
          page,
          limit
        }
      })
      
      if (response.data.message) {
        const data = response.data.message
        
        // Check if it's the new paginated format
        if (data.gifts && Array.isArray(data.gifts)) {
          return {
            success: true,
            data: data.gifts,
            total: data.total || 0,
            page: data.page || page,
            limit: data.limit || limit
          }
        }
        
        // Fallback for old format (array directly)
        if (Array.isArray(data)) {
          return {
            success: true,
            data: data,
            total: data.length,
            page: 1,
            limit: data.length
          }
        }
      }
      
      return { success: false, error: 'Invalid response format' }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch gifts') }
    }
  },


  async get(name: string): Promise<ApiResponse<Gift>> {
    try {
      const response = await api.get<FrappeDocResponse<Gift>>(`/api/resource/Gift/${encodeURIComponent(name)}`)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch gift') }
    }
  },

  async getDetailBundle(name: string): Promise<ApiResponse<GiftDetailBundle>> {
    try {
      const response = await api.get<{ message: GiftDetailBundle }>(
        '/api/method/gift.gift.api.get_gift_detail_bundle',
        { params: { gift_name: name } }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch gift details') }
    }
  },

  async recordInterest(payload: {
    gift: string
    gift_recipient: string
    interest_source?: string
    remarks?: string
  }): Promise<ApiResponse<{ name: string; approval_status?: string; message?: string }>> {
    try {
      const response = await api.post<{ message: { name: string; approval_status?: string; message?: string } }>(
        '/api/method/gift.gift.api.record_gift_interest',
        payload
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to record interest') }
    }
  },

  async recordInterestsBulk(payload: {
    gift: string
    gift_recipients: string[]
    interest_source?: string
    remarks?: string
  }): Promise<ApiResponse<{ results: Array<{ gift_recipient: string; success: boolean; name?: string; approval_status?: string; error?: string }>; created: number; failed: number }>> {
    try {
      const response = await api.post<{ message: { results: Array<{ gift_recipient: string; success: boolean; name?: string; approval_status?: string; error?: string }>; created: number; failed: number } }>(
        '/api/method/gift.gift.api.record_gift_interests_bulk',
        { ...payload, gift_recipients: JSON.stringify(payload.gift_recipients) }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to record interests') }
    }
  },

  async approveInterestAndIssue(interest_name: string): Promise<ApiResponse<{ interest: string; issue: string }>> {
    try {
      const response = await api.post<{ message: { interest: string; issue: string } }>(
        '/api/method/gift.gift.api.approve_interest_and_issue',
        { interest_name }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to approve interest') }
    }
  },

  async rejectInterest(interest_name: string, reason?: string): Promise<ApiResponse<{ interest: string }>> {
    try {
      const response = await api.post<{ message: { interest: string } }>(
        '/api/method/gift.gift.api.reject_interest',
        { interest_name, reason }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to reject interest') }
    }
  },

  async createIssueFromInterest(
    interest_name: string,
    delivery_method = 'Direct Handover'
  ): Promise<ApiResponse<{ issue: string; approval_status?: string }>> {
    try {
      const response = await api.post<{ message: { issue: string; approval_status?: string } }>(
        '/api/method/gift.gift.api.create_issue_from_interest',
        { interest_name, delivery_method }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to create issue') }
    }
  },

  async approveIssue(issue_name: string): Promise<ApiResponse<{ issue: string }>> {
    try {
      const response = await api.post<{ message: { issue: string } }>(
        '/api/method/gift.gift.api.approve_gift_issue',
        { issue_name }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to approve issue') }
    }
  },

  async rejectIssue(issue_name: string, reason: string): Promise<ApiResponse<{ issue: string }>> {
    try {
      const response = await api.post<{ message: { issue: string } }>(
        '/api/method/gift.gift.api.reject_gift_issue',
        { issue_name, reason }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to reject issue') }
    }
  },

  async sendIssueForApprovalAgain(issue_name: string): Promise<ApiResponse<{ issue: string }>> {
    try {
      const response = await api.post<{ message: { issue: string } }>(
        '/api/method/gift.gift.api.send_issue_for_approval_again',
        { issue_name }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to send issue for approval again') }
    }
  },

  async bulkApproveIssues(issue_names: string[]): Promise<ApiResponse<{ success: string[]; failed: { issue: string; error: string }[]; message: string }>> {
    try {
      const response = await api.post<{ message: { success: string[]; failed: { issue: string; error: string }[]; message: string } }>(
        '/api/method/gift.gift.api.bulk_approve_gift_issues',
        { issue_names }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to bulk approve issues') }
    }
  },

  async bulkRejectIssues(issue_names: string[], reason: string): Promise<ApiResponse<{ success: string[]; failed: { issue: string; error: string }[]; message: string }>> {
    try {
      const response = await api.post<{ message: { success: string[]; failed: { issue: string; error: string }[]; message: string } }>(
        '/api/method/gift.gift.api.bulk_reject_gift_issues',
        { issue_names, reason }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to bulk reject issues') }
    }
  },

  async unissueGift(issue_name: string, reason: string): Promise<ApiResponse<{ issue: string }>> {
    try {
      const response = await api.post<{ message: { issue: string } }>(
        '/api/method/gift.gift.api.unissue_gift',
        { issue_name, reason }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to unissue gift') }
    }
  },

  async removeGiftInterest(interest_name: string): Promise<ApiResponse<{ interest: string }>> {
    try {
      const response = await api.post<{ message: { interest: string } }>(
        '/api/method/gift.gift.api.remove_gift_interest',
        { interest_name }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to remove interest') }
    }
  },

  async removeAllocationRequest(issue_name: string): Promise<ApiResponse<{ issue: string }>> {
    try {
      const response = await api.post<{ message: { issue: string } }>(
        '/api/method/gift.gift.api.remove_allocation_request',
        { issue_name }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to remove allocation request') }
    }
  },

  async create(data: Partial<Gift>): Promise<ApiResponse<Gift>> {
    try {
      const response = await api.post<FrappeDocResponse<Gift>>('/api/resource/Gift', data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to create gift') }
    }
  },

  async update(name: string, data: Partial<Gift>): Promise<ApiResponse<Gift>> {
    try {
      const response = await api.put<FrappeDocResponse<Gift>>(`/api/resource/Gift/${encodeURIComponent(name)}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to update gift') }
    }
  },

  async delete(name: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/api/resource/Gift/${encodeURIComponent(name)}`)
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to delete gift') }
    }
  },
}

// ============ Gift Wizard API (pre-save) ============
export const GiftWizardAPI = {
  async listByCategories(
    categories: string[],
    search = '',
    page = 1,
    limit = 50
  ): Promise<ApiResponse<any[]> & { total?: number; page?: number; limit?: number; total_pages?: number }> {
    try {
      const response = await api.get<{ message: any }>(
        '/api/method/gift.gift.api.list_gifts_by_categories',
        {
          params: {
            categories: JSON.stringify(categories || []),
            search: search || undefined,
            page,
            limit,
          },
        }
      )

      const msg = response.data.message || {}
      return {
        success: true,
        data: msg.gifts || [],
        total: msg.total,
        page: msg.page,
        limit: msg.limit,
        total_pages: msg.total_pages,
      }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch gifts') }
    }
  },

  async listAllAvailable(
    search = '',
    category?: string,
    currentEvent?: string,
    page = 1,
    limit = 50
  ): Promise<ApiResponse<any[]> & { total?: number; page?: number; limit?: number; total_pages?: number }> {
    try {
      const response = await api.get<{ message: any }>(
        '/api/method/gift.gift.api.list_all_available_gifts',
        {
          params: {
            search: search || undefined,
            category,
            current_event: currentEvent,
            page,
            limit,
          },
        }
      )

      const msg = response.data.message || {}
      return {
        success: true,
        data: msg.gifts || [],
        total: msg.total,
        page: msg.page,
        limit: msg.limit,
        total_pages: msg.total_pages,
      }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch gifts') }
    }
  },
}

// ============ Gift Category API ============
// ============ Gift Category API (ONLY for category management page) ============
export const GiftCategoryAPI = {

    async list(
    search = '',
    page = 1,
    limit = 20
  ): Promise<ApiResponse<GiftCategory[]> & { total?: number; page?: number; limit?: number }> {
    try {
      const response = await api.get<{ message: any }>('/api/method/gift.gift.api.list_gift_categories', {
        params: { search, page, limit }
      })

      if (response.data.message) {
        const data = response.data.message

        return {
          success: true,
          data: data.categories || [],
          total: data.total || 0,
          page: data.page || page,
          limit: data.limit || limit
        }
      }

      return { success: false, error: 'Invalid response format' }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch categories') }
    }
  },

  /**
   * Get single category with comma-separated options
   */
  async get(name: string): Promise<ApiResponse<GiftCategory>> {
    try {
      const response = await api.get<{ message: GiftCategory[] }>(
        '/api/method/gift.gift.api.get_categories_with_comma_options'
      )
      
      const categories = response.data.message || []
      const category = categories.find(c => c.name === name)
      
      if (category) {
        return { success: true, data: category }
      } else {
        return { success: false, error: 'Category not found' }
      }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch category') }
    }
  },

  /**
   * Create category (with comma-separated options)
   */
  async create(data: Partial<GiftCategory>): Promise<ApiResponse<GiftCategory>> {
    try {
      const response = await api.post<{ message: GiftCategory }>(
        '/api/method/gift.gift.api.save_category_with_comma_options',
        { category_data: data }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to create category') }
    }
  },

  /**
   * Update category (with comma-separated options)
   */
  async update(name: string, data: Partial<GiftCategory>): Promise<ApiResponse<GiftCategory>> {
    try {
      const response = await api.post<{ message: GiftCategory }>(
        '/api/method/gift.gift.api.save_category_with_comma_options',
        { category_data: { ...data, name } }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to update category') }
    }
  },

  async delete(name: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/api/resource/${encodeDoctype('Gift Category')}/${encodeURIComponent(name)}`)
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to delete category') }
    }
  },
}


// ============ Gift Recipient API ============
export const GiftRecipientAPI = {
  // In your GiftRecipientAPI class

  async list(
    search = '', 
    page = 1, 
    limit = 20
  ): Promise<ApiResponse<GiftRecipient[]> & { total?: number; page?: number; limit?: number }> {
    try {
      const response = await api.get<{ message: any }>('/api/method/gift.gift.api.list_recipients', {
        params: {
          search,
          page,
          limit
        }
      })
      
      if (response.data.message) {
        const data = response.data.message
        
        // Check if it's the new paginated format
        if (data.recipients && Array.isArray(data.recipients)) {
          return {
            success: true,
            data: data.recipients,
            total: data.total || 0,
            page: data.page || page,
            limit: data.limit || limit
          }
        }
        
        // Fallback for old format (array directly)
        if (Array.isArray(data)) {
          return {
            success: true,
            data: data,
            total: data.length,
            page: 1,
            limit: data.length
          }
        }
      }
      
      return { success: false, error: 'Invalid response format' }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch recipients') }
    }
  },

  async get(name: string): Promise<ApiResponse<GiftRecipient>> {
    try {
      const response = await api.get<FrappeDocResponse<GiftRecipient>>(`/api/resource/${encodeDoctype('Gift Recipient')}/${encodeURIComponent(name)}`)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch recipient') }
    }
  },

  async create(data: Partial<GiftRecipient>): Promise<ApiResponse<GiftRecipient>> {
    try {
      const response = await api.post<FrappeDocResponse<GiftRecipient>>(`/api/resource/${encodeDoctype('Gift Recipient')}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to create recipient') }
    }
  },

  async update(name: string, data: Partial<GiftRecipient>): Promise<ApiResponse<GiftRecipient>> {
    try {
      const response = await api.put<FrappeDocResponse<GiftRecipient>>(`/api/resource/${encodeDoctype('Gift Recipient')}/${encodeURIComponent(name)}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to update recipient') }
    }
  },

  async delete(name: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/api/resource/${encodeDoctype('Gift Recipient')}/${encodeURIComponent(name)}`)
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to delete recipient') }
    }
  },

  async listForGiftInterest(
    gift: string,
    search = '',
    page = 1,
    limit = 20
  ): Promise<ApiResponse<GiftRecipient[]> & { total?: number; page?: number; limit?: number }> {
    try {
      const response = await api.get<{ message: any }>('/api/method/gift.gift.api.list_recipients_for_gift_interest', {
        params: {
          gift,
          search: search || undefined,
          page,
          limit
        }
      })

      if (response.data.message) {
        const data = response.data.message
        
        return {
          success: true,
          data: data.recipients || [],
          total: data.total || 0,
          page: data.page || page,
          limit: data.limit || limit
        }
      }

      return { success: false, error: 'Invalid response format' }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch recipients for gift interest') }
    }
  },
}

// ============ Gift Issue API ============
export const GiftIssueAPI = {
  async list(
    filters: Record<string, string> = {},
    page = 1,
    limit = 20
  ): Promise<ApiResponse<GiftIssue[]> & { total?: number; page?: number; limit?: number }> {
    try {
      const response = await api.get<{ message: any }>('/api/method/gift.gift.api.list_gift_issues', {
        params: {
          filters: JSON.stringify(filters),
          page,
          limit
        }
      })

      if (response.data.message) {
        const data = response.data.message
        return {
          success: true,
          data: data.issues || [],
          total: data.total || 0,
          page: data.page || page,
          limit: data.limit || limit
        }
      }

      return { success: false, error: 'Invalid response format' }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch issues') }
    }
  },

  async get(name: string): Promise<ApiResponse<GiftIssue>> {
    try {
      const response = await api.get<FrappeDocResponse<GiftIssue>>(`/api/resource/${encodeDoctype('Gift Issue')}/${encodeURIComponent(name)}`)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch gift issue') }
    }
  },

  async create(data: Partial<GiftIssue>): Promise<ApiResponse<GiftIssue>> {
    try {
      const response = await api.post<FrappeDocResponse<GiftIssue>>(`/api/resource/${encodeDoctype('Gift Issue')}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to create gift issue') }
    }
  },

  async update(name: string, data: Partial<GiftIssue>): Promise<ApiResponse<GiftIssue>> {
    try {
      const response = await api.put<FrappeDocResponse<GiftIssue>>(`/api/resource/${encodeDoctype('Gift Issue')}/${encodeURIComponent(name)}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to update gift issue') }
    }
  },

  async delete(name: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/api/resource/${encodeDoctype('Gift Issue')}/${encodeURIComponent(name)}`)
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to delete gift issue') }
    }
  },
}

// ============ Approval API (Issue Approvals) ============
export const ApprovalAPI = {
  async listPendingIssueApprovals(
    search = '',
    page = 1,
    limit = 20
  ): Promise<ApiResponse<any[]> & { total?: number; page?: number; limit?: number; total_pages?: number }> {
    try {
      const response = await api.get<{ message: any }>(
        '/api/method/gift.gift.api.list_pending_issue_approvals',
        {
          params: {
            search: search || undefined,
            page,
            limit,
          },
        }
      )

      const msg = response.data.message || {}
      return {
        success: true,
        data: msg.requests || [],
        total: msg.total,
        page: msg.page,
        limit: msg.limit,
        total_pages: msg.total_pages,
      }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch approval requests') }
    }
  },
}

// ============ Gift Interest API ============
export const GiftInterestAPI = {
  async list(
    filters: Record<string, string> = {},
    page = 1,
    limit = 20
  ): Promise<ApiResponse<GiftInterest[]> & { total?: number; page?: number; limit?: number }> {
    try {
      const response = await api.get<{ message: any }>('/api/method/gift.gift.api.list_gift_interests', {
        params: {
          filters: JSON.stringify(filters),
          page,
          limit
        }
      })

      if (response.data.message) {
        const data = response.data.message
        return {
          success: true,
          data: data.interests || [],
          total: data.total || 0,
          page: data.page || page,
          limit: data.limit || limit
        }
      }

      return { success: false, error: 'Invalid response format' }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch interests') }
    }
  },

  async get(name: string): Promise<ApiResponse<GiftInterest>> {
    try {
      const response = await api.get<FrappeDocResponse<GiftInterest>>(
        `/api/resource/${encodeDoctype('Gift Interest')}/${encodeURIComponent(name)}`
      )
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch gift interest') }
    }
  },

  async create(data: Partial<GiftInterest>): Promise<ApiResponse<GiftInterest>> {
    try {
      const response = await api.post<FrappeDocResponse<GiftInterest>>(`/api/resource/${encodeDoctype('Gift Interest')}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to create gift interest') }
    }
  },

  async update(name: string, data: Partial<GiftInterest>): Promise<ApiResponse<GiftInterest>> {
    try {
      const response = await api.put<FrappeDocResponse<GiftInterest>>(`/api/resource/${encodeDoctype('Gift Interest')}/${encodeURIComponent(name)}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to update gift interest') }
    }
  },

  async delete(name: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/api/resource/${encodeDoctype('Gift Interest')}/${encodeURIComponent(name)}`)
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to delete gift interest') }
    }
  },
}

// ============ Gift Receipt API ============
export const GiftReceiptAPI = {
  async list(filters: Record<string, string> = {}): Promise<ApiResponse<GiftReceipt[]>> {
    try {
      const params: Record<string, string | number> = {
        fields: JSON.stringify(['*']),
        limit_page_length: 0,
        order_by: 'creation desc'
      }
      
      if (Object.keys(filters).length > 0) {
        const filterArray = Object.entries(filters).map(([key, value]) => [key, '=', value])
        params.filters = JSON.stringify(filterArray)
      }
      
      const response = await api.get<FrappeListResponse<GiftReceipt>>(`/api/resource/${encodeDoctype('Gift Receipt')}`, { params })
      return { success: true, data: response.data.data || [] }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch gift receipts') }
    }
  },

  async get(name: string): Promise<ApiResponse<GiftReceipt>> {
    try {
      const response = await api.get<FrappeDocResponse<GiftReceipt>>(`/api/resource/${encodeDoctype('Gift Receipt')}/${encodeURIComponent(name)}`)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch gift receipt') }
    }
  },

  async create(data: Partial<GiftReceipt>): Promise<ApiResponse<GiftReceipt>> {
    try {
      const response = await api.post<FrappeDocResponse<GiftReceipt>>(`/api/resource/${encodeDoctype('Gift Receipt')}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to create gift receipt') }
    }
  },

  async update(name: string, data: Partial<GiftReceipt>): Promise<ApiResponse<GiftReceipt>> {
    try {
      const response = await api.put<FrappeDocResponse<GiftReceipt>>(`/api/resource/${encodeDoctype('Gift Receipt')}/${encodeURIComponent(name)}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to update gift receipt') }
    }
  },

  async delete(name: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/api/resource/${encodeDoctype('Gift Receipt')}/${encodeURIComponent(name)}`)
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to delete gift receipt') }
    }
  },
}

// ============ Gift Maintenance API ============
export const GiftMaintenanceAPI = {
  async list(
    filters: Record<string, string> = {},
    page = 1,
    limit = 20
  ): Promise<ApiResponse<GiftMaintenance[]> & { total?: number; page?: number; limit?: number }> {
    try {
      const response = await api.get<{ message: any }>('/api/method/gift.gift.api.list_gift_maintenance', {
        params: {
          filters: JSON.stringify(filters),
          page,
          limit
        }
      })

      if (response.data.message) {
        const data = response.data.message
        return {
          success: true,
          data: data.maintenance_records || [],
          total: data.total || 0,
          page: data.page || page,
          limit: data.limit || limit
        }
      }

      return { success: false, error: 'Invalid response format' }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch maintenance') }
    }
  },

  async get(name: string): Promise<ApiResponse<GiftMaintenance>> {
    try {
      const response = await api.get<FrappeDocResponse<GiftMaintenance>>(`/api/resource/${encodeDoctype('Gift Maintenance')}/${encodeURIComponent(name)}`)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch maintenance record') }
    }
  },

  async create(data: Partial<GiftMaintenance>): Promise<ApiResponse<GiftMaintenance>> {
    try {
      const response = await api.post<FrappeDocResponse<GiftMaintenance>>(`/api/resource/${encodeDoctype('Gift Maintenance')}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to create maintenance record') }
    }
  },

  async update(name: string, data: Partial<GiftMaintenance>): Promise<ApiResponse<GiftMaintenance>> {
    try {
      const response = await api.put<FrappeDocResponse<GiftMaintenance>>(`/api/resource/${encodeDoctype('Gift Maintenance')}/${encodeURIComponent(name)}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to update maintenance record') }
    }
  },

  async delete(name: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/api/resource/${encodeDoctype('Gift Maintenance')}/${encodeURIComponent(name)}`)
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to delete maintenance record') }
    }
  },
}

// ============ Gift Dispatch API ============
export const GiftDispatchAPI = {
  async list(
    filters: Record<string, string> = {},
    page = 1,
    limit = 20
  ): Promise<ApiResponse<GiftDispatch[]> & { total?: number; page?: number; limit?: number }> {
    try {
      const response = await api.get<{ message: any }>('/api/method/gift.gift.api.list_gift_dispatches', {
        params: {
          filters: JSON.stringify(filters),
          page,
          limit
        }
      })

      if (response.data.message) {
        const data = response.data.message
        return {
          success: true,
          data: data.dispatches || [],
          total: data.total || 0,
          page: data.page || page,
          limit: data.limit || limit
        }
      }

      return { success: false, error: 'Invalid response format' }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch dispatches') }
    }
  },

  async get(name: string): Promise<ApiResponse<GiftDispatch>> {
    try {
      const response = await api.get<FrappeDocResponse<GiftDispatch>>(`/api/resource/${encodeDoctype('Gift Dispatch')}/${encodeURIComponent(name)}`)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch dispatch') }
    }
  },

  async create(data: Partial<GiftDispatch>): Promise<ApiResponse<GiftDispatch>> {
    try {
      const response = await api.post<FrappeDocResponse<GiftDispatch>>(`/api/resource/${encodeDoctype('Gift Dispatch')}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to create dispatch') }
    }
  },

  async update(name: string, data: Partial<GiftDispatch>): Promise<ApiResponse<GiftDispatch>> {
    try {
      const response = await api.put<FrappeDocResponse<GiftDispatch>>(`/api/resource/${encodeDoctype('Gift Dispatch')}/${encodeURIComponent(name)}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to update dispatch') }
    }
  },

  async delete(name: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/api/resource/${encodeDoctype('Gift Dispatch')}/${encodeURIComponent(name)}`)
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to delete dispatch') }
    }
  },
}

// ============ Dashboard Stats ============
export const DashboardAPI = {
  async getStats(): Promise<ApiResponse<DashboardStats>> {
    try {
      const response = await api.get<{ message: DashboardStats }>(
        '/api/method/gift.api.gift.get_dashboard_counts'
      )
      
      return {
        success: true,
        data: response.data.message
      }
    } catch (error) {
      console.error('Dashboard stats error:', error)
      return { 
        success: false, 
        error: handleError(error, 'Failed to fetch dashboard stats') 
      }
    }
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  total_pages: number
}



// ============ Event API (Gift Event doctype) ============
export const EventAPI = {
  async list(
      filters: Record<string, string> = {},
      page = 1,
      limit = 20
    ): Promise<ApiResponse<GiftEvent[]> & { total?: number; page?: number; limit?: number }> {
      try {
        const response = await api.get<{ message: any }>('/api/method/gift.gift.api.list_gift_events', {
          params: {
            filters: JSON.stringify(filters),
            page,
            limit
          }
        })

        if (response.data.message) {
          const data = response.data.message

          return {
            success: true,
            data: data.events || [],
            total: data.total || 0,
            page: data.page || page,
            limit: data.limit || limit
          }
        }

        return { success: false, error: 'Invalid response format' }
      } catch (error) {
        return { success: false, error: handleError(error, 'Failed to fetch events') }
      }
    },

  async get(name: string): Promise<ApiResponse<GiftEvent>> {
    try {
      const response = await api.get<FrappeDocResponse<GiftEvent>>(
        `/api/resource/${encodeDoctype('Gift Event')}/${encodeURIComponent(name)}`
      )
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch event') }
    }
  },

  async exportCsv(name: string): Promise<ApiResponse<void>> {
    try {
      const url = `${config.apiBaseUrl}/api/method/gift.gift.api.export_gift_event_csv?name=${encodeURIComponent(name)}`
      window.open(url, '_blank', 'noopener,noreferrer')
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to export event CSV') }
    }
  },

  async getWithCounts(name: string, includeGifts = true): Promise<ApiResponse<GiftEvent>> {
    try {
      const response = await api.get<{ message: GiftEvent }>(
        '/api/method/gift.gift.api.get_gift_event_with_counts',
        {
          params: { name, include_gifts: includeGifts ? 1 : 0 }
        }
      )

      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch event') }
    }
  },

  async listEventParticipants(
    event: string,
    search = '',
    page = 1,
    limit = 20
  ): Promise<ApiResponse<any> & { total?: number; page?: number; limit?: number; total_pages?: number }> {
    try {
      const response = await api.get<{ message: any }>(
        '/api/method/gift.gift.api.list_event_participants',
        {
          params: {
            event,
            search: search || undefined,
            page,
            limit,
          },
        }
      )

      const msg = response.data.message || {}
      return {
        success: true,
        data: msg.participants || [],
        total: msg.total,
        page: msg.page,
        limit: msg.limit,
        total_pages: msg.total_pages,
      }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch participants') }
    }
  },

  async getAllowedCategories(event: string): Promise<ApiResponse<{ event: string; categories: string[] }>> {
    try {
      const response = await api.get<{ message: any }>(
        '/api/method/gift.gift.api.get_event_allowed_categories',
        { params: { event } }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch event categories') }
    }
  },

  async listEventGiftsByAllowedCategories(
    event: string,
    search = '',
    page = 1,
    limit = 20
  ): Promise<ApiResponse<any> & { total?: number; page?: number; limit?: number }> {
    try {
      const response = await api.get<{ message: any }>(
        '/api/method/gift.gift.api.list_event_gifts_by_allowed_categories',
        { params: { event, search, page, limit } }
      )

      const data = response.data.message
      return {
        success: true,
        data: data.gifts || [],
        total: data.total || 0,
        page: data.page || page,
        limit: data.limit || limit,
      }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch event gifts') }
    }
  },

  async listEventGifts(
    event: string,
    search = '',
    page = 1,
    limit = 20
  ): Promise<ApiResponse<any> & { total?: number; page?: number; limit?: number }> {
    try {
      const response = await api.get<{ message: any }>(
        '/api/method/gift.gift.api.list_event_gifts_by_allowed_categories',
        { params: { event, search, page, limit } }
      )

      const data = response.data.message
      return {
        success: true,
        data: data.gifts || [],
        total: data.total || 0,
        page: data.page || page,
        limit: data.limit || limit,
      }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch event gifts') }
    }
  },

  async listEligibleGiftsForEvent(
    event: string,
    search = '',
    category?: string,
    currentEvent?: string,
    page = 1,
    limit = 20
  ): Promise<ApiResponse<any> & { total?: number; page?: number; limit?: number }> {
    try {
      const response = await api.get<{ message: any }>(
        '/api/method/gift.gift.api.list_eligible_gifts_for_event',
        {
          params: {
            event,
            search,
            category,
            current_event: currentEvent,
            page,
            limit,
          },
        }
      )

      const data = response.data.message
      return {
        success: true,
        data: data.gifts || [],
        total: data.total || 0,
        page: data.page || page,
        limit: data.limit || limit,
      }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch eligible gifts') }
    }
  },

  async moveGiftToEvent(
    gift: string,
    event: string,
    remarks?: string
  ): Promise<ApiResponse<{ gift: string; event: string }>> {
    try {
      const response = await api.post<{ message: any }>(
        '/api/method/gift.gift.api.move_gift_to_event',
        { gift, event, remarks }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      const e: any = error as any
      const serverMsg = e?.response?.data?._error_message || e?.response?.data?.exception || e?.response?.data?.message
      if (serverMsg) {
        return { success: false, error: String(serverMsg) }
      }
      return { success: false, error: handleError(error, 'Failed to move gift to event') }
    }
  },

  async moveGiftsToEvent(
    event: string,
    gifts: string[],
    remarks?: string
  ): Promise<ApiResponse<{ event: string; requested: number; moved: string[]; failed: any[]; success: boolean }>> {
    try {
      const response = await api.post<{ message: any }>(
        '/api/method/gift.gift.api.move_gifts_to_event',
        { event, gifts, remarks }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      const e: any = error as any
      const serverMsg = e?.response?.data?._error_message || e?.response?.data?.exception || e?.response?.data?.message
      if (serverMsg) {
        return { success: false, error: String(serverMsg) }
      }
      return { success: false, error: handleError(error, 'Failed to move gifts to event') }
    }
  },

  async removeGiftFromEvent(
    gift: string,
    event: string
  ): Promise<ApiResponse<{ gift: string; event: null; removed_from: string }>> {
    try {
      const response = await api.post<{ message: any }>(
        '/api/method/gift.gift.api.remove_gift_from_event',
        { gift, event }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      const e: any = error as any
      const serverMsg = e?.response?.data?._error_message || e?.response?.data?.exception || e?.response?.data?.message
      if (serverMsg) {
        return { success: false, error: String(serverMsg) }
      }
      return { success: false, error: handleError(error, 'Failed to remove gift from event') }
    }
  },

  async removeParticipantFromEvent(
    event: string,
    gift_recipient: string
  ): Promise<ApiResponse<{ event: string; gift_recipient: string; removed_from: string }>> {
    try {
      const response = await api.post<{ message: any }>(
        '/api/method/gift.gift.api.remove_participant_from_event',
        { event, gift_recipient }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      const e: any = error as any
      const serverMsg = e?.response?.data?._error_message || e?.response?.data?.exception || e?.response?.data?.message
      if (serverMsg) {
        return { success: false, error: String(serverMsg) }
      }
      return { success: false, error: handleError(error, 'Failed to remove participant from event') }
    }
  },

  async removeGiftsFromEvent(
    event: string,
    gifts: string[]
  ): Promise<ApiResponse<{ event: string; requested: number; removed: string[]; failed: any[]; skipped?: any[]; success: boolean }>> {
    try {
      const response = await api.post<{ message: any }>(
        '/api/method/gift.gift.api.remove_gifts_from_event',
        { event, gifts }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      const e: any = error as any
      const serverMsg = e?.response?.data?._error_message || e?.response?.data?.exception || e?.response?.data?.message
      if (serverMsg) {
        return { success: false, error: String(serverMsg) }
      }
      return { success: false, error: handleError(error, 'Failed to remove gifts from event') }
    }
  },

  async removeParticipantsFromEvent(
    event: string,
    gift_recipients: string[]
  ): Promise<ApiResponse<{ event: string; requested: number; removed: string[]; failed: any[]; success: boolean }>> {
    try {
      const response = await api.post<{ message: any }>(
        '/api/method/gift.gift.api.remove_participants_from_event',
        { event, gift_recipients }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      const e: any = error as any
      const serverMsg = e?.response?.data?._error_message || e?.response?.data?.exception || e?.response?.data?.message
      if (serverMsg) {
        return { success: false, error: String(serverMsg) }
      }
      return { success: false, error: handleError(error, 'Failed to remove participants from event') }
    }
  },

  async addGiftToEvent(
    event: string,
    gift: string,
    remarks?: string
  ): Promise<ApiResponse<{ gift: string; event: string }>> {
    try {
      const response = await api.post<{ message: any }>(
        '/api/method/gift.gift.api.add_gift_to_event',
        { event, gift, remarks }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      const e: any = error as any
      const serverMsg = e?.response?.data?._error_message || e?.response?.data?.exception || e?.response?.data?.message
      if (serverMsg) {
        return { success: false, error: String(serverMsg) }
      }
      return { success: false, error: handleError(error, 'Failed to add gift to event') }
    }
  },

  async addParticipantToEvent(
    event: string,
    giftRecipient: string,
    attending: string = 'Invited'
  ): Promise<ApiResponse<{ event: string; gift_recipient: string }>> {
    try {
      const response = await api.post<{ message: any }>(
        '/api/method/gift.gift.api.add_participant_to_event',
        { event, gift_recipient: giftRecipient, attending }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to add participant') }
    }
  },

  async createWithGifts(
    eventData: any,
    giftNames: string[] = [],
    newGifts: any[] = []
  ): Promise<ApiResponse<any>> {
    try {
      const response = await api.post<{ message: any }>(
        '/api/method/gift.gift.api.create_event_with_gifts',
        {
          event_data: eventData,
          gift_names: giftNames,
          new_gifts: newGifts,
        }
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      const e: any = error as any
      const serverMsg = e?.response?.data?._error_message || e?.response?.data?.exception || e?.response?.data?.message
      if (serverMsg) {
        return { success: false, error: String(serverMsg) }
      }
      return { success: false, error: handleError(error, 'Failed to create event') }
    }
  },

  async create(data: Partial<GiftEvent>): Promise<ApiResponse<GiftEvent>> {
    try {
      const response = await api.post<FrappeDocResponse<GiftEvent>>(`/api/resource/${encodeDoctype('Gift Event')}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to create event') }
    }
  },

  async update(name: string, data: Partial<GiftEvent>): Promise<ApiResponse<GiftEvent>> {
    try {
      const response = await api.put<FrappeDocResponse<GiftEvent>>(`/api/resource/${encodeDoctype('Gift Event')}/${encodeURIComponent(name)}`, data)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to update event') }
    }
  },

  async delete(name: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/api/resource/${encodeDoctype('Gift Event')}/${encodeURIComponent(name)}`)
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to delete event') }
    }
  },
}

// ============ File Upload API ============
export const FileAPI = {
  async upload(file: File, isPrivate = false): Promise<ApiResponse<{ file_url: string }>> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('is_private', isPrivate ? '1' : '0')
      formData.append('folder', 'Home/Attachments')
      
      const response = await api.post<{ message: { file_url: string } }>('/api/method/upload_file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to upload file') }
    }
  }
}

// ============ Gift Search by Barcode ============
export const GiftSearchAPI = {
  async findByBarcode(barcode: string): Promise<ApiResponse<Gift | null>> {
    try {
      // Search by barcode_value field
      const response = await api.get<FrappeListResponse<Gift>>('/api/resource/Gift', {
        params: {
          fields: JSON.stringify(['*']),
          filters: JSON.stringify([['barcode_value', '=', barcode]]),
          limit_page_length: 1
        }
      })
      
      if (response.data.data && response.data.data.length > 0) {
        return { success: true, data: response.data.data[0] }
      }
      
      // Try searching by QR code value
      const qrResponse = await api.get<FrappeListResponse<Gift>>('/api/resource/Gift', {
        params: {
          fields: JSON.stringify(['*']),
          filters: JSON.stringify([['qr_code_value', '=', barcode]]),
          limit_page_length: 1
        }
      })
      
      if (qrResponse.data.data && qrResponse.data.data.length > 0) {
        return { success: true, data: qrResponse.data.data[0] }
      }
      
      return { success: true, data: null }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to search gift') }
    }
  }
}

export { api }

// ============ Reports API ============
export interface ReportResult {
  data: Record<string, any>[]
  total: number
  page?: number
  total_pages?: number
}

export const ReportsAPI = {
  // Generic report fetcher - uses GET with query params
  async fetchReport(method: string, filters: Record<string, any> = {}): Promise<ApiResponse<ReportResult>> {
    try {
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')
      )
      // Use GET request with query parameters as per API docs
      const response = await api.get(`/api/method/gift.api.reports.${method}`, {
        params: cleanFilters
      })
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch report') }
    }
  },

  // Download CSV - uses separate export endpoint
  downloadCSV(method: string, filters: Record<string, any> = {}) {
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')
    )
    // Remove page/limit for CSV export (exports all records)
    delete cleanFilters.page
    delete cleanFilters.limit
    
    // Convert get_*_report to export_*_to_csv
    const csvMethod = method.replace('get_', 'export_').replace('_report', '_to_csv')
    const params = new URLSearchParams(cleanFilters as Record<string, string>)
    const url = `${config.apiBaseUrl}/api/method/gift.api.reports.${csvMethod}?${params.toString()}`
    window.open(url, '_blank')
  },

  // Convenience methods for specific reports
  getGiftInterestReport: (filters: Record<string, any> = {}) =>
    ReportsAPI.fetchReport('get_gift_interest_report', filters),
  
  getGiftIssueReport: (filters: Record<string, any> = {}) =>
    ReportsAPI.fetchReport('get_gift_issue_report', filters),
  
  getGiftRecipientReport: (filters: Record<string, any> = {}) =>
    ReportsAPI.fetchReport('get_gift_recipient_report', filters),
  
  getBarcodePrintReport: (filters: Record<string, any> = {}) =>
    ReportsAPI.fetchReport('get_barcode_print_report', filters),
  
  getGiftMaintenanceReport: (filters: Record<string, any> = {}) =>
    ReportsAPI.fetchReport('get_gift_maintenance_report', filters),
  
  getGiftDispatchReport: (filters: Record<string, any> = {}) =>
    ReportsAPI.fetchReport('get_gift_dispatch_report', filters),
  
  getPendingDeliveryReport: (filters: Record<string, any> = {}) =>
    ReportsAPI.fetchReport('get_pending_delivery_report', filters),
}

// ============ Notification Log Types ============
export interface NotificationLog {
  name: string
  subject: string
  email_content?: string
  document_type?: string
  document_name?: string
  type?: string
  read?: number
  creation: string
  for_user?: string
}

// ============ Notification API ============
export const NotificationAPI = {
  async list(forUser?: string): Promise<ApiResponse<NotificationLog[]>> {
    try {
      const user = forUser || localStorage.getItem('frappe_user') || undefined

      const response = await api.get<FrappeListResponse<NotificationLog>>(`/api/resource/${encodeDoctype('Notification Log')}`, {
        params: {
          fields: JSON.stringify(['*']),
          filters: user ? JSON.stringify([['Notification Log', 'for_user', '=', user]]) : undefined,
          limit_page_length: 50,
          order_by: 'creation desc'
        }
      })
      return { success: true, data: response.data.data || [] }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch notifications') }
    }
  },

  async markRead(name: string): Promise<ApiResponse<NotificationLog>> {
    try {
      // Use Frappe's built-in method to mark notification as read
      const response = await api.post('/api/method/frappe.desk.doctype.notification_log.notification_log.mark_as_read', {
        docname: name
      })
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to mark notification as read') }
    }
  },

  async markAllRead(): Promise<ApiResponse<void>> {
    try {
      await api.post('/api/method/frappe.desk.doctype.notification_log.notification_log.mark_all_as_read')
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to mark all notifications as read') }
    }
  },

  async clearAll(): Promise<ApiResponse<{ deleted_count: number; message: string }>> {
    try {
      // Use the new bulk backend API
      const response = await api.post<{ message: { deleted_count: number; message: string } }>(
        '/api/method/gift.gift.api.clear_all_notifications'
      )
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to clear notifications') }
    }
  },

  async delete(name: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/api/resource/${encodeDoctype('Notification Log')}/${encodeURIComponent(name)}`)
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to delete notification') }
    }
  }
}

// ============ User Types ============
export interface FrappeUser {
  name: string
  email: string
  full_name: string
  enabled: number
  roles?: { role: string }[]
}

// ============ User API ============
export const UserAPI = {
  // Get current user's roles from Frappe
  async getRoles(): Promise<ApiResponse<string[]>> {
  try {
    // Get current user email first
    const userRes = await api.get<{ message: string }>('/api/method/frappe.auth.get_logged_user')
    const userEmail = userRes.data.message
    
    // Fetch user document with roles
    const response = await api.get<{ data: FrappeUser }>(`/api/resource/User/${encodeURIComponent(userEmail)}`, {
      params: {
        fields: JSON.stringify(['name', 'roles'])
      }
    })
    
    const roles = response.data.data.roles?.map(r => r.role) || []
    return { success: true, data: roles }
  } catch (error) {
    return { success: false, error: handleError(error, 'Failed to fetch roles') }
  }
},

  // Get current user with full name (for OAuth logins where full_name isn't in login response)
  async getCurrentUser(): Promise<ApiResponse<{ name: string; email: string; full_name: string }>> {
    try {
      const userRes = await api.get<{ message: string }>('/api/method/frappe.auth.get_logged_user')
      const userEmail = userRes.data.message
      
      // Fetch user document with full_name
      const response = await api.get<{ data: FrappeUser }>(`/api/resource/User/${encodeURIComponent(userEmail)}`, {
        params: {
          fields: JSON.stringify(['name', 'email', 'full_name'])
        }
      })
      
      const user = response.data.data
      return { 
        success: true, 
        data: { 
          name: user.name, 
          email: user.email, 
          full_name: user.full_name || user.name 
        } 
      }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch user info') }
    }
  },

  // Get user permission context (roles, assigned events, global visibility)
  async getPermissionContext(): Promise<ApiResponse<{
    user: string
    roles: string[]
    is_admin: boolean
    is_event_manager: boolean
    assigned_events: string[]
    has_global_visibility: boolean
  }>> {
    try {
      const response = await api.get<{ message: any }>('/api/method/gift.gift.api.get_user_permission_context')
      return { success: true, data: response.data.message }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch permission context') }
    }
  },


  // Get list of all users (admin only)
  async list(): Promise<ApiResponse<FrappeUser[]>> {
    try {
      const response = await api.get<{ message: FrappeUser[] }>('/api/method/gift.gift.api.list_users')
      return { success: true, data: response.data.message || [] }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch users') }
    }
  },

  // Get event team eligible users with role metadata
  async listEventTeamUsers(): Promise<ApiResponse<FrappeUser[]>> {
    try {
      const response = await api.get<{ message: FrappeUser[] }>('/api/method/gift.gift.api.list_event_team_users')
      return { success: true, data: response.data.message || [] }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch event team users') }
    }
  },

  // Get a single user with their roles
  async get(name: string): Promise<ApiResponse<FrappeUser>> {
    try {
      const response = await api.get<FrappeDocResponse<FrappeUser>>(`/api/resource/User/${encodeURIComponent(name)}`)
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch user') }
    }
  },

  // Update user full name
  async updateFullName(userId: string, fullName: string): Promise<ApiResponse<FrappeUser>> {
    try {
      const response = await api.put<FrappeDocResponse<FrappeUser>>(`/api/resource/User/${encodeURIComponent(userId)}`, {
        full_name: fullName
      })
      // Update localStorage if it's the current user
      const currentUser = localStorage.getItem('frappe_user')
      if (currentUser === userId) {
        localStorage.setItem('frappe_fullname', fullName)
      }
      return { success: true, data: response.data.data }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to update name') }
    }
  },

  // Update password using Frappe's password update method
  async updatePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    try {
      await api.post('/api/method/frappe.core.doctype.user.user.update_password', {
        old_password: currentPassword,
        new_password: newPassword
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to update password') }
    }
  },

  // Add role to user (admin only)
  async addRole(userId: string, role: string): Promise<ApiResponse<void>> {
    try {
      await api.post('/api/method/frappe.client.insert', {
        doc: {
          doctype: 'Has Role',
          parent: userId,
          parenttype: 'User',
          parentfield: 'roles',
          role: role
        }
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to add role') }
    }
  },

  // Remove role from user (admin only) 
  async removeRole(userId: string, role: string): Promise<ApiResponse<void>> {
    try {
      // First get the user to find the role entry
      const userRes = await api.get<FrappeDocResponse<any>>(`/api/resource/User/${encodeURIComponent(userId)}`)
      const user = userRes.data.data
      const roleEntry = user.roles?.find((r: any) => r.role === role)
      
      if (roleEntry) {
        await api.post('/api/method/frappe.client.delete', {
          doctype: 'Has Role',
          name: roleEntry.name
        })
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to remove role') }
    }
  },

  // Create a new user (admin only)
  async create(email: string, fullName: string, roles: string[] = []): Promise<ApiResponse<FrappeUser>> {
    try {
      // Split full name into first_name and last_name
      const nameParts = fullName.trim().split(' ')
      const firstName = nameParts[0] || fullName
      const lastName = nameParts.slice(1).join(' ') || ''
      
      // Create user with minimal required fields
      const response = await api.post<FrappeDocResponse<FrappeUser>>('/api/resource/User', {
        email: email,
        first_name: firstName,
        last_name: lastName,
        user_type: 'System User'
      })
      
      const user = response.data.data
      
      // Then assign roles one by one using Has Role insert
      for (const role of roles) {
        const addResult = await this.addRole(user.name, role)
        if (!addResult.success) {
          console.error('Failed to add role:', role, 'Error:', addResult.error)
          // Continue trying other roles
        }
      }
      
      return { success: true, data: user }
    } catch (error: any) {
      console.error('User creation error:', error)
      console.error('Error response:', error.response?.data)
      return { success: false, error: handleError(error, 'Failed to create user') }
    }
  },
  // Disable user (admin only)
  async disable(userId: string): Promise<ApiResponse<void>> {
    try {
      await api.put(`/api/resource/User/${encodeURIComponent(userId)}`, {
        enabled: 0
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to disable user') }
    }
  },

  // Enable user (admin only)
  async enable(userId: string): Promise<ApiResponse<void>> {
    try {
      await api.put(`/api/resource/User/${encodeURIComponent(userId)}`, {
        enabled: 1
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to enable user') }
    }
  }
}

// ============ DocType Metadata API ============
export const DocTypeAPI = {
  /**
   * Get select field options from backend dynamically
   * No hardcoded fallbacks - always fetches from Frappe
   */
  async getFieldOptions(doctype: string, fieldname: string): Promise<ApiResponse<string[]>> {
    try {
      const response = await api.get<{ message: string[] }>(
        '/api/method/gift.gift.api.get_field_options',
        {
          params: { doctype, fieldname }
        }
      )
      
      return { 
        success: true, 
        data: response.data.message || [] 
      }
    } catch (error) {
      return { 
        success: false, 
        error: handleError(error, `Failed to fetch options for ${doctype}.${fieldname}`) 
      }
    }
  },

  /**
   * Get options for multiple fields at once (more efficient)
   */
  async getMultipleFieldOptions(doctype: string, fields: string[]): Promise<ApiResponse<Record<string, string[]>>> {
    try {
      const response = await api.get<{ message: Record<string, string[]> }>(
        '/api/method/gift.gift.api.get_multiple_field_options',
        {
          params: { 
            doctype, 
            fields: JSON.stringify(fields) 
          }
        }
      )
      
      return { 
        success: true, 
        data: response.data.message || {} 
      }
    } catch (error) {
      return { 
        success: false, 
        error: handleError(error, `Failed to fetch multiple field options for ${doctype}`) 
      }
    }
  },

  /**
   * Get all fields metadata for a doctype (for building dynamic forms)
   */
  async getFields(doctype: string): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get<{ message: any[] }>(
        '/api/method/gift.gift.api.get_doctype_fields',
        {
          params: { doctype }
        }
      )
      
      return { 
        success: true, 
        data: response.data.message || [] 
      }
    } catch (error) {
      return { 
        success: false, 
        error: handleError(error, `Failed to fetch fields for ${doctype}`) 
      }
    }
  },

  /**
   * Get autocomplete options for Link fields
   */
  async getLinkOptions(doctype: string, txt = '', filters: Record<string, any> = {}, limit = 20): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get<{ message: any[] }>(
        '/api/method/gift.gift.api.get_link_options',
        {
          params: { 
            doctype,
            txt,
            filters: JSON.stringify(filters),
            limit
          }
        }
      )
      
      return { 
        success: true, 
        data: response.data.message || [] 
      }
    } catch (error) {
      return { 
        success: false, 
        error: handleError(error, `Failed to fetch link options for ${doctype}`) 
      }
    }
  },
}

// ============ Enhanced Category API ============
export const CategoryAPI = {
  /**
   * Get categories with optional type filter
   */
  async list(categoryType?: string): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get<{ message: any[] }>(
        '/api/method/gift.gift.api.get_gift_categories',
        {
          params: categoryType ? { category_type: categoryType } : {}
        }
      )
      return { success: true, data: response.data.message || [] }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch categories') }
    }
  },

  /**
   * Get category attributes (Gift Category Details child table)
   */
  async getAttributes(category: string): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get<{ message: any[] }>(
        '/api/method/gift.gift.api.get_category_attributes',
        {
          params: { category }
        }
      )
      return { success: true, data: response.data.message || [] }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch category attributes') }
    }
  },
}

export const ReceivedGiftAPI = {
  async list(
    filters: Record<string, string> = {},
    page = 1,
    limit = 20
  ): Promise<ApiResponse<ReceivedGift[]> & { total?: number; page?: number; limit?: number }> {
    try {
      const response = await api.get<{ message: any }>('/api/method/gift.gift.api.list_received_gifts', {
        params: {
          filters: JSON.stringify(filters),
          page,
          limit
        }
      })

      if (response.data.message) {
        const data = response.data.message

        return {
          success: true,
          data: data.received_gifts || [],
          total: data.total || 0,
          page: data.page || page,
          limit: data.limit || limit
        }
      }

      return { success: false, error: 'Invalid response format' }
    } catch (error) {
      return { success: false, error: handleError(error, 'Failed to fetch received gifts') }
    }
  },


  get: async (id: string): Promise<ApiResponse<ReceivedGift>> => {
    try {
      const response = await api.get(`/api/resource/Gift Received/${id}`)
      return {
        success: true,
        data: response.data.data,
      }
    } catch (error: any) {
      console.error('Failed to fetch received gift:', error)
      return {
        success: false,
        error: error.message || 'Failed to fetch received gift',
      }
    }
  },

  create: async (data: Partial<ReceivedGift>): Promise<ApiResponse<ReceivedGift>> => {
    try {
      const response = await api.post('/api/resource/Gift Received', data)
      return {
        success: true,
        data: response.data.data,
      }
    } catch (error: any) {
      console.error('Failed to create received gift:', error)
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to create received gift',
      }
    }
  },

  update: async (id: string, data: Partial<ReceivedGift>): Promise<ApiResponse<ReceivedGift>> => {
    try {
      const response = await api.put(`/api/resource/Gift Received/${id}`, data)
      return {
        success: true,
        data: response.data.data,
      }
    } catch (error: any) {
      console.error('Failed to update received gift:', error)
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to update received gift',
      }
    }
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    try {
      await api.delete(`/api/resource/Gift Received/${id}`)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to delete received gift:', error)
      return {
        success: false,
        error: error.message || 'Failed to delete received gift',
      }
    }
  },

  getCategoryAttributes: async (category: string): Promise<ApiResponse<any[]>> => {
    try {
      const response = await api.post(
        '/api/method/gift.gift.doctype.gift_received.gift_received.get_category_attributes',
        {},
        {
          params: { category }
        }
      )
      return {
        success: true,
        data: response.data.message || [],
      }
    } catch (error: any) {
      console.error('Failed to fetch category attributes:', error)
      return {
        success: false,
        error: error.message || 'Failed to fetch category attributes',
      }
    }
  },

  getFormOptions: async () => {
    const response = await api.post('/api/method/gift.gift.doctype.gift_received.gift_received.get_form_options')
    return response.data.message
  },

  moveToInventory: async (id: string): Promise<ApiResponse<string>> => {
  try {
    // Direct method call on document
    const response = await api.post(
      `/api/method/run_doc_method`,
      {
        dt: 'Gift Received',
        dn: id,
        method: 'move_to_main_inventory'
      }
    )
    
    if (response.data.message) {
      return {
        success: true,
        data: response.data.message,
      }
    }
    
    return {
      success: false,
      error: 'Failed to move gift to inventory',
    }
  } catch (error: any) {
    console.error('Move to inventory error:', error)
    return {
      success: false,
      error: error.response?.data?.exception || error.response?.data?.message || error.message || 'Failed to move gift to inventory',
    }
  }
},
}