// Environment configuration for Frappe backend
// Single source of truth: VITE_API_BASE_URL from .env file

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';;

export const config = {
  // Use same-origin relative URLs so Frappe session cookies work reliably
  // (e.g. avoid localhost vs 127.0.0.1 mismatch which breaks cookie sending)
  apiBaseUrl: '',
  
  // Full backend URL (always available for reference)
  backendUrl: BACKEND_URL,
  
  // Full API endpoint for Frappe REST API
  get apiEndpoint() {
    return `${this.apiBaseUrl}/api/resource`
  },
  
  // Method endpoint for custom API calls
  get methodEndpoint() {
    return `${this.apiBaseUrl}/api/method`
  },
  
  // Check environment
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
}

// Extend window interface for Frappe CSRF token
declare global {
  interface Window {
    csrf_token?: string
  }
}
