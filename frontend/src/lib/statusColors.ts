// Master status color definitions
export const STATUS_COLORS = {
  // Availability States
  'Available': 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  
  // Positive/Success States
  'Completed': 'bg-green-500 text-white dark:bg-green-600',
  'Delivered': 'bg-emerald-500 text-white dark:bg-emerald-600',
  'Stored': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Converted to Issue': 'bg-green-500 text-white dark:bg-green-600',
  
  // In Progress States
  'Pending': 'bg-amber-200 text-amber-800',
  'Pending Approval': 'bg-amber-200 text-amber-600',
  'Prepared': 'bg-cyan-500 text-white dark:bg-cyan-600',
  'Open': 'bg-blue-500 text-white dark:bg-blue-600',
  
  // Active/Transit States
  'Issued': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'Dispatched': 'bg-indigo-500 text-white dark:bg-indigo-600',
  'In Transit': 'bg-purple-500 text-white dark:bg-purple-600',
  'Received': 'bg-teal-500 text-white dark:bg-teal-600',
  
  // Special States
  'Moved to Inventory': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'New': 'bg-yellow-500 text-white dark:bg-yellow-600',
  
  // Neutral States
  'Closed': 'bg-gray-500 text-white dark:bg-gray-600',
  'Just Browsing': 'bg-gray-500 text-white dark:bg-gray-600',
   'Reserved':'bg-orange-100 text-orange-500'
,
  // Negative States
  'Cancelled': 'bg-red-500 text-white dark:bg-red-600',
  'Rejected': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  
  // event
  
} as const
// Master status color definitions
// Helper function to get status color (others)
export const getStatusColor = (status: string): string => {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
}

// only for event
export const  EVENT_STATUS_COLORS = {
 'Open': 'bg-blue-500 text-white dark:bg-blue-600',
  'Planned':'bg-blue-500 text-white dark:bg-blue-600',
  'Completed': 'bg-green-500 text-white dark:bg-green-600',
  'Draft': 'bg-gray-500 text-white dark:bg-gray-600',
  'Cancelled': 'bg-red-500 text-white dark:bg-red-600',
  'Active': 'bg-amber-500 text-white dark:bg-amber-600',
  'Rejected' : 'bg-red-500 text-white dark:bg-red-600',
  
} as const

export const getEventStatusColor = (status: string): string => {
  return EVENT_STATUS_COLORS[status as keyof typeof EVENT_STATUS_COLORS] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
}