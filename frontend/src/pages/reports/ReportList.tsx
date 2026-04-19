import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  FileBarChart
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReportConfig, FilterConfig } from '@/types/report'

// Report configurations with filters
// 7 Working Reports as per API documentation
export const reportConfigs: ReportConfig[] = [
  {
    id: 'allocation-report',
    name: 'Allocation Report',
    nameAr: 'تقرير التخصيص',
    description: 'Approved gift issues only',
    descriptionAr: 'عرض طلبات إصدار الهدايا المعتمدة فقط',
    apiMethod: 'get_allocation_report',
    icon: FileBarChart,
    filters: [
      { key: 'from_date', label: 'From Date', type: 'date' },
      { key: 'to_date', label: 'To Date', type: 'date' },
      { key: 'gift', label: 'Gift', type: 'gift-select' },
      { key: 'recipient_name', label: 'Guest', type: 'text', placeholder: 'reports.placeholders.recipient_name' },
      { key: 'event', label: 'Event', type: 'event-select' }
    ]
  },
  {
    id: 'gift-movement-report',
    name: 'Gift Movement Report',
    nameAr: 'تقرير حركة الهدايا',
    description: 'Gift event history',
    descriptionAr: 'سجل حركة الهدية بين الفعاليات',
    apiMethod: 'get_gift_movement_report',
    icon: FileBarChart,
    filters: [
      { key: 'from_date', label: 'From Date', type: 'date' },
      { key: 'to_date', label: 'To Date', type: 'date' },
      { key: 'gift', label: 'Gift', type: 'gift-select' },
      { key: 'event', label: 'Event', type: 'event-select' }
    ]
  },
  {
    id: 'collection-report',
    name: 'Collection Report',
    nameAr: 'تقرير المجموعة',
    description: 'Gift status-wise report',
    descriptionAr: 'تقرير الهدايا حسب الحالة',
    apiMethod: 'get_collection_report',
    icon: FileBarChart,
    filters: [
      { key: 'gift_id', label: 'Gift No', type: 'text', placeholder: 'reports.placeholders.gift_id' },
      { key: 'barcode_value', label: 'Barcode ID', type: 'text', placeholder: 'reports.placeholders.barcode_value' },
      { key: 'category', label: 'Category', type: 'category-select' },
      { key: 'status', label: 'Status', type: 'status-select' },
      { key: 'event', label: 'Event', type: 'event-select' }
    ]
  }
]

export default function ReportList() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language === 'ar'

  // Helper function to get translated label
  const getTranslatedLabel = (filter: FilterConfig) => {
    // For select options, we don't translate the label here as it's handled in the viewer
    return t(`reports.columns.${filter.key}`, { defaultValue: filter.label })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportConfigs.map((report) => {
          const Icon = report.icon
          return (
            <Card 
              key={report.id} 
              className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/50"
              onClick={() => navigate(`/reports/${report.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">
                    {isArabic ? report.nameAr : report.name}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {isArabic ? report.descriptionAr : report.description}
                </CardDescription>
                <div className="mt-3 flex flex-wrap gap-1">
                  {report.filters.slice(0, 3).map((filter) => (
                    <span 
                      key={filter.key} 
                      className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                    >
                      {getTranslatedLabel(filter)}
                    </span>
                  ))}
                  {report.filters.length > 3 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      +{report.filters.length - 3} {t('common.more')}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}