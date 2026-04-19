import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Printer,
  Grid3x3,
  List,
  Package,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  Filter,
  X,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { GiftAPI, GiftCategoryAPI, DashboardAPI } from "@/services/api";
import type { ApiResponse, Gift } from "@/types/gift";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { getStatusColor } from "@/lib/statusColors";
import { useRole } from "@/contexts/RoleContext";

export default function GiftList() {
  const { t } = useTranslation();
  const { isAdmin, isEventManager, isEventCoordinator } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const handlePrintBarcode = (gift: Gift) => {
    const value = String((gift as any)?.barcode_value || "").trim();
    const imageUrl = String((gift as any)?.barcode || "");
    const giftId = String(gift?.gift_id || gift?.name || "");

    const resolvedImageUrl =
      imageUrl ||
      (value
        ? `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(value)}&code=Code128&multiplebarcodes=false&translate-esc=false&unit=Fit&dpi=96&imagetype=Gif&rotation=0&color=%23000000&bgcolor=%23ffffff&codepage=&qunit=Mm&quiet=0`
        : "");

    if (!resolvedImageUrl && !value) return;

    const printContent = `
      <!doctype html>
      <html>
        <head>
          <title>Barcode</title>
          <style>
            @media print {
              @page { margin: 0; size: auto; }
              body { margin: 0; padding: 20px; }
            }
            body { margin: 0; padding: 20px; text-align: center; font-family: Arial, sans-serif; }
            .barcode-container { display: inline-block; }
            .barcode-image { max-width: 300px; height: auto; }
            .barcode-value { font-family: monospace; font-size: 16px; margin-top: 8px; }
            .gift-id { font-size: 14px; margin-top: 4px; color: #666; }
          </style>
        </head>
        <body>
          <div class="barcode-container">
            ${resolvedImageUrl ? `<img src="${resolvedImageUrl}" class="barcode-image" />` : ""}
            ${value ? `<div class="barcode-value">${value}</div>` : ""}
            ${giftId ? `<div class="gift-id">ID: ${giftId}</div>` : ""}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    const w = window.open("", "_blank");
    if (!w) return;

    w.document.open();
    w.document.write(printContent);
    w.document.close();
  };

  // State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "all",
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "grid" : "list"
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [deleteGiftName, setDeleteGiftName] = useState<string | null>(null);
  const [deleteGiftDetails, setDeleteGiftDetails] = useState<{
    name: string;
    id: string;
  }>({ name: "", id: "" });

  const debouncedSearch = useDebounce(search, 500);

  useEffect(() => {
    const urlStatus = searchParams.get("status");
    if (urlStatus && urlStatus !== "all") setStatusFilter(urlStatus);
  }, [searchParams]);

  const { data: dashboardStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const result = await DashboardAPI.getStats();
      return result.success ? result.data : null;
    },
    staleTime: 30000,
  });

  const stats = {
    total: dashboardStats?.totalGifts || 0,
    available: dashboardStats?.availableGifts || 0,
    issued: dashboardStats?.issuedGifts || 0,
    inTransit: dashboardStats?.inTransitGifts || 0,
    deliveredGifts: dashboardStats?.deliveredGifts || 0,
    reservedGifts:dashboardStats?.reservedGifts || 0,
  };

  const {
    data: giftsResponse,
    isLoading,
    error,
  } = useQuery<
    ApiResponse<Gift[]> & { total?: number; page?: number; limit?: number }
  >({
    queryKey: [
      "gifts-paginated",
      statusFilter,
      categoryFilter,
      debouncedSearch,
      currentPage,
      itemsPerPage,
    ],
    queryFn: async () => {
      const filters: Record<string, string> = {};
      if (statusFilter && statusFilter !== "all") filters.status = statusFilter;
      if (categoryFilter && categoryFilter !== "all") filters.category = categoryFilter;
      if (debouncedSearch) filters.search = debouncedSearch;

      const result = await GiftAPI.list(filters, currentPage, itemsPerPage);
      if (!result.success) throw new Error(result.error || t("gifts.messages.saveFailed"));
      return result;
    },
  });

  const gifts = useMemo(() => giftsResponse?.data || [], [giftsResponse]);
  const totalItems = giftsResponse?.total || gifts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  const { data: categories = [] } = useQuery({
    queryKey: ["gift-categories"],
    queryFn: async () => {
      const result = await GiftCategoryAPI.list();
      return result.success ? result.data || [] : [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => GiftAPI.delete(name),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("gifts.messages.giftDeletedSuccessfully"));
        queryClient.invalidateQueries({ queryKey: ["gifts-paginated"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        setDeleteGiftName(null);
        setDeleteGiftDetails({ name: "", id: "" });
      } else {
        toast.error(result.error || t("gifts.messages.saveFailed"));
      }
    },
    onError: (error) => {
      toast.error(t("gifts.messages.saveFailed"));
      console.error("Delete error:", error);
    },
  });

  const handleDelete = (name: string) => deleteMutation.mutate(name);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter, debouncedSearch, itemsPerPage]);

  useEffect(() => {
    if (error) {
      console.error("Failed to load gifts:", error);
      toast.error(t("gifts.messages.saveFailed"));
    }
  }, [error, t]);

  const hasActiveFilters =
    statusFilter !== "all" || categoryFilter !== "all" || search !== "";

  const clearFilters = () => {
    setStatusFilter("all");
    setCategoryFilter("all");
    setSearch("");
  };

  return (
    <div className="space-y-6 pb-8">

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card onClick={() => setStatusFilter("all")} className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("common.totalGifts")}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("common.allGiftsInInventory")}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStatusFilter("Available")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("common.available")}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.available}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("common.readyToIssue")}</p>
          </CardContent>
        </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStatusFilter("Delivered")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("common.reserved")}
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.reservedGifts}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("common.giftReserved")}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStatusFilter("Issued")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("common.allocated")}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.issued}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("common.currentlyIssued")}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStatusFilter("Delivered")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("common.delivered")}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.deliveredGifts}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("common.completedDeliveries")}</p>
          </CardContent>
        </Card>
      
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="ltr:absolute ltr:left-3 rtl:absolute rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("common.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ltr:pl-9 rtl:pr-9 ltr:pr-9 rtl:pl-9"
                />
                {debouncedSearch !== search ? (
                  <div className="ltr:absolute ltr:right-3 rtl:absolute rtl:left-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  </div>
                ) : search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="ltr:absolute ltr:right-3 rtl:absolute rtl:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder={t("common.allStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.allStatus")}</SelectItem>
                  <SelectItem value="Available">{t("common.available")}</SelectItem>
                  <SelectItem value="Issued">{t("common.allocated")}</SelectItem>
                  <SelectItem value="Delivered">{t("common.delivered")}</SelectItem>
                  <SelectItem value="Reserved">{t("common.reserved")}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder={t("common.allCategories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.allCategories")}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>
                      {cat.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button
                  variant={viewMode === "list" ? "underlined" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  title={t("common.listView")}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "underlined" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  title={t("common.gridView")}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
              </div>

              <Button asChild variant="outline" size="default" className="w-full sm:w-auto">
                <Link to="/gifts/new">
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("gift.addNewGift")}
                </Link>
              </Button>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  {t("common.activeFilters")}:
                </span>
                {search && (
                  <Badge className="gap-1 bg-muted text-muted-foreground border border-border hover:bg-muted/80">
                    {t("common.search")}: {search}
                    <button type="button" onClick={() => setSearch("")} className="ml-1 rounded-full hover:text-foreground transition-colors"><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {statusFilter && statusFilter !== "all" && (
                  <Badge className={cn("gap-1", getStatusColor(statusFilter))}>
                    {statusFilter === "Issued" ? t("common.allocated") : t(`common.${statusFilter.toLowerCase()}`)}
                    <button type="button" onClick={() => setStatusFilter("all")} className="ml-1 rounded-full hover:opacity-70 transition-opacity"><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {categoryFilter && categoryFilter !== "all" && (
                  <Badge className="gap-1 bg-muted text-muted-foreground border border-border hover:bg-muted/80">
                    {t("common.category")}:{" "}
                    {categories.find((c) => c.name === categoryFilter)?.category_name || categoryFilter}
                    <button type="button" onClick={() => setCategoryFilter("all")} className="ml-1 rounded-full hover:text-foreground transition-colors"><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground hover:font-bold transition-colors"
                >
                  {t("common.clearAll")}
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {viewMode === "list" ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {/* ✅ w-full ensures table fills card, no stretching */}
              <table className="w-full caption-bottom text-sm">
                {/* ✅ Fixed column widths via colgroup — Name gets only what it needs */}
                <colgroup>
                  <col style={{ width: "96px" }} />   {/* ID */}
                  <col style={{ width: "220px" }} />  {/* Name */}
                  <col style={{ width: "120px" }} />  {/* Category */}
                  <col style={{ width: "180px" }} />  {/* Barcode */}
                  <col style={{ width: "120px" }} />  {/* Status */}
                  <col style={{ width: "60px" }} />   {/* Actions */}
                </colgroup>
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    <th className="hidden md:table-cell h-12 px-4 text-left align-middle font-medium text-muted-foreground table-header">
                      {t("gifts.id")}
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground table-header">
                      {t("common.name")}
                    </th>
                    <th className="hidden lg:table-cell h-12 px-4 text-left align-middle font-medium text-muted-foreground table-header">
                      {t("common.category")}
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground table-header">
                      {t("gifts.barcode")}
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground table-header">
                      {t("common.status")}
                    </th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground table-header">
                      {t("common.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                          <span className="text-muted-foreground">{t("common.loading")}</span>
                        </div>
                      </td>
                    </tr>
                  ) : gifts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="h-12 w-12 text-muted-foreground/50" />
                          <p className="text-muted-foreground font-medium">{t("common.noResults")}</p>
                          <p className="text-sm text-muted-foreground">
                            {hasActiveFilters ? t("common.tryAdjustingSearch") : t("common.getStarted")}
                          </p>
                          {hasActiveFilters ? (
                            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
                              {t("common.clearAll")}
                            </Button>
                          ) : (
                            <Button asChild variant="outline" size="sm" className="mt-2">
                              <Link to="/gifts/new">
                                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {t("gift.addNewGift")}
                              </Link>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    gifts.map((gift) => (
                      <tr
                        key={gift.name}
                        className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/gifts/${gift.name}`)}
                      >
                        <td className="hidden md:table-cell px-4 py-3 font-mono text-sm whitespace-nowrap">
                          {gift.gift_id || gift.name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="block font-medium truncate max-w-[200px]">{gift.gift_name}</span>
                          {gift.category && (
                            <span className="text-xs text-muted-foreground lg:hidden">{gift.category}</span>
                          )}
                        </td>
                        <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {gift.category || "-"}
                        </td>
                        {/* ✅ Barcode: fixed width, taller height */}
                        <td className="px-4 py-2">
                          {(gift as any)?.barcode ? (
                            <img
                              src={(gift as any).barcode}
                              alt="barcode"
                              style={{ width: "150px", height: "44px", objectFit: "contain" }}
                            />
                          ) : (gift as any)?.barcode_value ? (
                            <span className="font-mono text-xs text-muted-foreground">
                              {(gift as any).barcode_value}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={cn(getStatusColor(gift.status || "Available") || "bg-muted")}>
                            {gift.status === "Issued" ? "Allocated" : gift?.status}
                          </Badge>
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/gifts/${gift.name}`)}>
                                <Eye className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {t("common.view")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handlePrintBarcode(gift)}
                                disabled={!(gift as any)?.barcode_value && !(gift as any)?.barcode}
                              >
                                <Printer className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {t("gifts.printBarcode")}
                              </DropdownMenuItem>
                              {(gift.status !== "Delivered" && !isEventCoordinator) || isAdmin || isEventManager ? (
                                <DropdownMenuItem onClick={() => navigate(`/gifts/${gift.name}/edit`)}>
                                  <Edit className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                  {t("common.edit")}
                                </DropdownMenuItem>
                              ) : null}
                              {(isAdmin || isEventManager) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setDeleteGiftName(gift.name);
                                      setDeleteGiftDetails({
                                        name: gift.gift_name || t("common.unknown"),
                                        id: gift.gift_id || gift.name,
                                      });
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                    {t("common.delete")}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!isLoading && gifts.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(items) => {
                  setItemsPerPage(items);
                  setCurrentPage(1);
                }}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        /* Grid View */
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  <span className="text-muted-foreground">{t("common.loading")}</span>
                </div>
              </CardContent>
            </Card>
          ) : gifts.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-2">
                  <Package className="h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground font-medium">{t("common.noResults")}</p>
                  <p className="text-sm text-muted-foreground">
                    {hasActiveFilters ? t("common.tryAdjustingSearch") : t("common.getStarted")}
                  </p>
                  {hasActiveFilters ? (
                    <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
                      {t("common.clearAll")}
                    </Button>
                  ) : (
                    <Button asChild size="sm" className="mt-2">
                      <Link to="/gifts/new">
                        <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                        {t("gift.addNewGift")}
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {gifts.map((gift) => (
                  <Card
                    key={gift.name}
                    className="hover:shadow-lg transition-all cursor-pointer group"
                    onClick={() => navigate(`/gifts/${gift.name}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate group-hover:text-primary transition-colors">
                            {gift.gift_name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
                            {gift.gift_id || gift.name}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/gifts/${gift.name}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              {t("common.view")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handlePrintBarcode(gift)}
                              disabled={!(gift as any)?.barcode_value && !(gift as any)?.barcode}
                            >
                              <Printer className="h-4 w-4 mr-2" />
                              {t("gifts.printBarcode")}
                            </DropdownMenuItem>
                            {(gift.status !== "Delivered" && !isEventCoordinator) || isAdmin || isEventManager ? (
                              <DropdownMenuItem onClick={() => navigate(`/gifts/${gift.name}/edit`)}>
                                <Edit className="h-4 w-4 mr-2" />
                                {t("common.edit")}
                              </DropdownMenuItem>
                            ) : null}
                            {(isAdmin || isEventManager) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteGiftName(gift.name);
                                    setDeleteGiftDetails({
                                      name: gift.gift_name || t("common.unknown"),
                                      id: gift.gift_id || gift.name,
                                    });
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t("common.delete")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t("common.status")}</span>
                        <Badge className={cn("text-xs", getStatusColor(gift.status || "Available") || "bg-muted")}>
                          {gift.status === "Issued" ? "Allocated" : gift?.status}
                        </Badge>
                      </div>
                      {gift.category && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{t("common.category")}</span>
                          <span className="text-xs font-medium truncate max-w-[150px]">{gift.category}</span>
                        </div>
                      )}
                      {gift.warehouse && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{t("common.warehouse")}</span>
                          <span className="text-xs font-medium truncate max-w-[150px]">{gift.warehouse}</span>
                        </div>
                      )}
                      {/* Barcode */}
                      {(gift as any)?.barcode ? (
                        <div className="flex flex-col items-center">
                          <img
                            src={(gift as any).barcode}
                            alt="barcode"
                            style={{
                              width: "140px",
                              height: "40px",
                              objectFit: "contain",
                            }}
                          />
                        </div>
                      ) : (gift as any)?.barcode_value ? (
                        <div className="text-center">
                          <span className="font-mono text-xs text-muted-foreground">
                            {(gift as any).barcode_value}
                          </span>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {gifts.length > 0 && (
                <Card>
                  <CardContent className="p-0">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={(items) => {
                        setItemsPerPage(items);
                        setCurrentPage(1);
                      }}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteGiftName}
        onOpenChange={(open) => !open && setDeleteGiftName(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("gifts.deleteGift")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("gifts.deleteGiftConfirmation").replace("{name}", deleteGiftDetails.name)}
              {/* <span className="block mt-2 text-orange-600 dark:text-orange-400 font-medium">
                ⚠️ {t("common.warning")}: {t("gifts.messages.unsavedChanges")}
              </span> */}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGiftName && handleDelete(deleteGiftName)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t("common.deleting") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
