import { useState, useEffect } from 'react'
import { parseFrappeDate } from '@/lib/i18n'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Eye, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination } from '@/components/Pagination'
import { GiftReceiptAPI, DocTypeAPI } from '@/services/api'
import { format } from 'date-fns'

const statusColors: Record<string, string> = {
  'Pending Inspection': 'bg-yellow-500 text-white dark:bg-yellow-600',
  'Approved': 'bg-green-500 text-white dark:bg-green-600',
  'Quarantine': 'bg-orange-500 text-white dark:bg-orange-600',
  'Rejected': 'bg-red-500 text-white dark:bg-red-600',
}

export default function ReceiptList() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const navigate = useNavigate()
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Fetch receipt status options from backend
  const { data: receiptStatuses = [] } = useQuery({
    queryKey: ['field-options', 'Gift Receipt', 'receipt_status'],
    queryFn: async () => {
      const result = await DocTypeAPI.getFieldOptions('Gift Receipt', 'receipt_status')
      return result.success ? result.data : []
    },
  })

  const { data: receipts, isLoading } = useQuery({
    queryKey: ['gift-receipts', statusFilter],
    queryFn: async () => {
      const filters: Record<string, string> = {}
      if (statusFilter && statusFilter !== 'all') filters.receipt_status = statusFilter
      const result = await GiftReceiptAPI.list(filters)
      return result.success ? result.data : []
    },
  })

  // Pagination logic
  const totalItems = receipts?.length || 0
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const paginatedReceipts = receipts?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gift Receipts</h1>
          <p className="text-muted-foreground">Record receiving gifts into inventory</p>
        </div>
        <Button asChild>
          <Link to="/receipts/new">
            <Plus className="h-4 w-4 mr-2" />
            New Receipt
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {receiptStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden md:table-cell table-header">Receipt ID</TableHead>
                <TableHead className="table-header">Received From</TableHead>
                <TableHead className="hidden lg:table-cell table-header">Gift</TableHead>
                <TableHead className="hidden xl:table-cell table-header">Warehouse</TableHead>
                <TableHead className="table-header">Status</TableHead>
                <TableHead className="hidden md:table-cell table-header">Date</TableHead>
                <TableHead className="text-right table-header">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : paginatedReceipts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Package className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No receipts found</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedReceipts?.map((r) => (
                  <TableRow 
                    key={r.name} 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => navigate(`/receipts/${r.name}`)}
                  >
                    <TableCell className="hidden md:table-cell font-mono text-sm">{r.name}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{r.received_from}</p>
                        {/* Show gift on mobile */}
                        <p className="text-xs text-muted-foreground lg:hidden">{r.gift_name || r.gift || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{r.gift_name || r.gift || '-'}</TableCell>
                    <TableCell className="hidden xl:table-cell">{r.assign_to_warehouse || '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[r.receipt_status || ''] || 'bg-gray-500 text-white'}>
                        {r.receipt_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {r.receipt_date ? (() => { try { const dt = parseFrappeDate(r.receipt_date); return Number.isNaN(dt.getTime()) ? r.receipt_date : format(dt, 'dd MMM yyyy') } catch { return r.receipt_date } })() : '-'}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/receipts/${r.name}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(items) => {
              setItemsPerPage(items)
              setCurrentPage(1)
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
