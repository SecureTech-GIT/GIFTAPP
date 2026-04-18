/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Gift,
  Users,
  Send,
  ArrowRight,
  ScanBarcode,
  Package,
  TrendingUp,
  CheckCircle,
  Bookmark,
  Tag,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardAPI, GiftAPI, GiftSearchAPI } from "@/services/api";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { toast } from "sonner";
import {
  format,
  formatDistanceToNow,
  formatDistanceToNowStrict,
} from "date-fns";
import { getStatusColor } from "@/lib/statusColors";
import { ar, enUS } from "date-fns/locale";

// Update TABS to use translation keys
const TABS = [
  "All",
  "Available",
  "Reserved",
  "Allocated",
  "Delivered",
] as const;
type Tab = (typeof TABS)[number];

// Map tab label → gift status filter value
const TAB_STATUS_MAP: Record<Tab, string | null> = {
  All: null,
  Available: "Available",
  Allocated: "Issued",
  // 'Delivered': 'Delivered',
  Reserved: "Reserved",
  // 'Pending':'Pending',
  Delivered: "Delivered",
};

// Distinct colors for each tab
const TAB_COLORS: Record<Tab, { active: string; hover: string }> = {
  All: {
    active: "bg-slate-600 text-white",
    hover: "hover:bg-slate-100 hover:text-slate-700",
  },
  Available: {
    active: "bg-gray-600 text-white",
    hover: "hover:bg-gray-100 hover:text-gray-700",
  },
  Allocated: {
    active: "bg-blue-600 text-white",
    hover: "hover:bg-blue-100 hover:text-blue-700",
  },
  // 'Dispatched': { active: 'bg-purple-600 text-white', hover: 'hover:bg-purple-100 hover:text-purple-700' },
  Reserved: {
    active: "bg-orange-600 text-white",
    hover: "hover:bg-orange-100 hover:text-orange-500",
  },
  // 'Pending': { active: 'bg-amber-600 text-white', hover: 'hover:bg-amber-200 hover:text-amber-800' },
  Delivered: {
    active: "bg-emerald-500 text-white",
    hover: "hover:bg-emerald-200 hover:text-emerald-800",
  },
};

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showScanner, setShowScanner] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const { i18n } = useTranslation();
  const statusFilter = TAB_STATUS_MAP[activeTab];

  const parseServerDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const raw = String(dateStr).trim();
    if (!raw) return null;

    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const dt = new Date(`${raw}T00:00:00Z`);
        return Number.isNaN(dt.getTime()) ? null : dt;
      }

      if (
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)
      ) {
        let iso = raw.replace(" ", "T");
        iso = iso.replace(/\.(\d{3})\d+$/, ".$1");
        if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) iso = `${iso}Z`;
        const dt = new Date(iso);
        return Number.isNaN(dt.getTime()) ? null : dt;
      }

      const dt = new Date(raw);
      return Number.isNaN(dt.getTime()) ? null : dt;
    } catch {
      return null;
    }
  };

  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const result = await DashboardAPI.getStats();
      if (result.success && result.data) return result.data;
      throw new Error(result.error);
    },
  });

  // Fetch recent gifts (Gift doctype only) filtered by tab status
  const { data: recentGifts } = useQuery({
    queryKey: ["recent-gifts-dashboard", statusFilter],
    queryFn: async () => {
      const filters = statusFilter ? { status: statusFilter } : {};
      const result = await GiftAPI.list(filters, 1, 5);
      return result.success ? result.data : [];
    },
  });

  const statCards = [
    {
      title: t("common.totalGifts"),
      value: stats?.totalGifts ?? 0,
      icon: Gift,
      color: "text-primary",
      bgColor: "bg-primary/10",
      href: "/gifts",
    },
    {
      title: t("common.available"),
      value: stats?.availableGifts ?? 0,
      icon: Package,
      color: "text-gray-600 dark:text-gray-400",
      bgColor: "bg-gray-100 dark:bg-gray-900/30",
      href: "/gifts?status=Available",
    },
     {
      title: t("common.reserved"),
      value: stats?.reservedGifts ?? 0,
      icon: Clock,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      href: "/gifts?status=Reserved",
    },
    {
      title: t("common.allocated"),
      value: stats?.issuedGifts ?? 0,
      icon: TrendingUp,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      href: "/gifts?status=Issued",
    },
    {
      title: t("common.delivered"),
      value: stats?.deliveredGifts ?? 0,
      icon: CheckCircle,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
      href: "/gifts?status=Delivered",
    },
    {
      title: t("common.guests"),
      value: stats?.totalRecipients ?? 0,
      icon: Users,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
      href: "/recipients",
    },
   
  ];

  const handleBarcodeScanned = async (barcode: string) => {
    setShowScanner(false);
    // toast.info(t('common.searchingForBarcode', { barcode }))
    const result = await GiftSearchAPI.findByBarcode(barcode);
    if (result.success && result.data) {
      // toast.success(t('giftFound', { name: result.data.gift_name }))
      navigate(`/gifts/${result.data.name}`);
    } else {
      toast.error(t("common.giftNotFound"));
    }
  };

  const getRelativeTime = (dateStr?: string) => {
    if (!dateStr) return "";

    // Debug: Log the raw date string from server
    console.log('Raw server date:', dateStr, 'Current timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    const serverDate = parseServerDate(dateStr);
    const nowIso = new Date().toISOString();
    console.log(
      'Parsed server date:',
      serverDate ? serverDate.toISOString() : 'Invalid Date',
      'Current time:',
      nowIso,
    );
    if (!serverDate) return dateStr;

    // Use date-fns formatDistanceToNow which handles timezones better
    // It uses the current time of the system but handles date parsing correctly
    const locale = i18n.language === "ar" ? ar : enUS;
    
    try {
      const relativeTime = formatDistanceToNow(serverDate, { 
        addSuffix: true,
        locale 
      });
      
      // Handle edge case where date might be in the future due to timezone issues
      const now = new Date();
      const diff = now.getTime() - serverDate.getTime();
      
      if (diff < -60000) { // If more than 1 minute in the future
        return i18n.language === "ar" ? "الآن" : "Just now";
      }
      
      return relativeTime;
    } catch (error) {
      console.warn('Error formatting relative time:', error);
      // Fallback to manual calculation
      const now = new Date();
      const diff = Math.floor((now.getTime() - serverDate.getTime()) / 1000);
      
      if (diff < 0) {
        return i18n.language === "ar" ? "الآن" : "Just now";
      }
      
      const isArabic = i18n.language === "ar";

      const formatNumber = (num: number) =>
        isArabic ? num.toLocaleString("ar-EG") : num.toString();

      const buildArabic = (num: number, singular: string, plural: string) => {
        if (num === 1) return `منذ ${singular}`;
        if (num === 2) return `منذ ${plural}`;
        return `منذ ${formatNumber(num)} ${plural}`;
      };

      if (diff < 60) {
        const sec = diff;
        return isArabic
          ? buildArabic(sec, "ثانية", "ثوانٍ")
          : `${sec} ${sec === 1 ? "second" : "seconds"} ago`;
      }

      const minutes = Math.floor(diff / 60);
      if (minutes < 60) {
        return isArabic
          ? buildArabic(minutes, "دقيقة", "دقائق")
          : `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
      }

      const hours = Math.floor(minutes / 60);
      if (hours < 24) {
        return isArabic
          ? buildArabic(hours, "ساعة", "ساعات")
          : `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
      }

      const days = Math.floor(hours / 24);
      if (days < 30) {
        return isArabic
          ? buildArabic(days, "يوم", "أيام")
          : `${days} ${days === 1 ? "day" : "days"} ago`;
      }

      const months = Math.floor(days / 30);
      if (months < 12) {
        return isArabic
          ? buildArabic(months, "شهر", "أشهر")
          : `${months} ${months === 1 ? "month" : "months"} ago`;
      }

      const years = Math.floor(months / 12);
      return isArabic
        ? buildArabic(years, "سنة", "سنوات")
        : `${years} ${years === 1 ? "year" : "years"} ago`;
    }
  };

  const filteredItems = (recentGifts || []).map((gift) => ({
    key: `gift-${gift.name}`,
    name: gift.name,
    title: gift.gift_name,
    subtitle: gift.creation
      ? getRelativeTime(gift.creation)
      : t("common.uncategorized"),
    status: gift.status || t("common.available"),
    href: `/gifts/${gift.name}`,
  }));
  // useEffect(() => {
  //   toast.error(t("common.giftNotFound"));
  // }, []);

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Welcome Card */}
      <Card className="bg-sidebar text-sidebar-foreground">
        <CardContent className="py-4 md:py-6">
          <h2 className="text-xl md:text-2xl font-bold">
            {t("common.welcomeToGiftManager")}
          </h2>
          <p className="mt-1 text-sm md:text-base">
            {new Date().toLocaleDateString(i18n.language, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              numberingSystem: i18n.language === "ar" ? "arab" : undefined, // Arabic numerals
            })}
          </p>
        </CardContent>
      </Card>

      {/* ── Stat Cards: horizontal compact row — icon left, number + label right */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {statCards.map((stat) => (
          <Link key={stat.title} to={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg flex-shrink-0 ${stat.bgColor}`}
                  >
                    <stat.icon
                      className={`h-4 w-4 md:h-5 md:w-5 ${stat.color}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg md:text-2xl font-bold text-foreground leading-none">
                      {isLoading ? "–" : stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {stat.title}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Main content + Quick Actions sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* LEFT: Tabbed gift list (3 cols) */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              {/* Tab bar */}
              <div className="flex items-center gap-1 px-3 pt-3 pb-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab
                        ? TAB_COLORS[tab].active
                        : `text-muted-foreground ${TAB_COLORS[tab].hover}`
                    }`}
                  >
                    {t(`common.${tab.toLowerCase()}`)}
                  </button>
                ))}
              </div>

              {/* Divider below tabs */}
              <div className="border-b border-border mt-3" />

              {/* Activity rows */}
              <div className="divide-y divide-border">
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <Link
                      key={item.key}
                      to={item.href}
                      className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/40 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>
                      <Badge
                        className={`ml-3 flex-shrink-0 uppercase text-[10px] tracking-wide font-semibold ${
                          getStatusColor(item.status) || "bg-muted"
                        }`}
                      >
                        {item.status === "Issued" ? "Allocated" : item.status}
                      </Badge>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Gift className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">
                      {t("common.noActivityInCategory")}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer — view all link */}
              {filteredItems.length > 0 && (
                <div className="p-3 border-t border-border">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                  >
                    <Link
                      to={
                        statusFilter
                          ? `/gifts?status=${statusFilter}`
                          : "/gifts"
                      }
                    >
                      {t("common.viewAll")}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Quick Actions - Narrower width (1 col) */}
        <div className="lg:col-span-1 space-y-4">
          {/* Quick Actions - Smaller width with colorized buttons */}
          <div className="bg-card rounded-xl border border-border p-3">
            <p className="text-sm font-semibold text-foreground mb-3">
              {t("common.quickActions")}
            </p>
            <div className="space-y-2">
              {/* Scan Barcode - red */}
              <button
                onClick={() => setShowScanner(true)}
                className="w-full flex lg:justify-start justify-center items-center gap-2.5 px-3 py-2.5 rounded-lg border border-blue-500 bg-transparent text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors"
              >
                <ScanBarcode className="h-4 w-4 text-blue-600" />
                {t("common.scanBarcode")}
              </button>

              {/* Add Gift - Emerald */}
              <Link to="/gifts/new" className="block">
                <div className="w-full lg:justify-start justify-center flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-emerald-500 bg-transparent text-emerald-600 text-sm font-medium hover:bg-emerald-50 transition-colors">
                  <Gift className="h-4 w-4 text-emerald-600" />
                  {t("common.addGift")}
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
