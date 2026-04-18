/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Download,
  Filter,
  Loader2,
  X,
  Check,
  ChevronDown,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ReportsAPI, EventAPI, GiftAPI } from "@/services/api";
import { reportConfigs } from "./ReportList";
import type { ReportFilters } from "@/types/report";

const GIFT_STATUSES = [
  "Available",
  "Reserved",
  "Issued",
  "Delivered",
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

// Multi-select searchable popover dropdown
function MultiSelectDropdown({
  values,
  options,
  placeholder,
  onChange,
}: {
  values: string[];
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (vs: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const triggerLabel =
    values.length === 0
      ? placeholder
      : values.length === 1
      ? (options.find((o) => o.value === values[0])?.label ?? values[0])
      : `${values.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
            "hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            values.length === 0 && "text-muted-foreground"
          )}
        >
          <span className="truncate flex items-center gap-1.5">
            {triggerLabel}
            {values.length > 1 && (
              <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold h-4 min-w-4 px-1">
                {values.length}
              </span>
            )}
          </span>
          <div className="flex items-center gap-1 ml-1 shrink-0">
            {values.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                className="rounded-full hover:bg-muted p-0.5"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="flex items-center border-b px-3 py-2 gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {values.length > 0 && (
          <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
            <span className="text-xs text-muted-foreground">{values.length} selected</span>
            <button
              onClick={() => onChange([])}
              className="text-xs text-primary hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
        <div className="max-h-56 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No results</p>
          ) : (
            filtered.map((opt) => {
              const selected = values.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-primary/10",
                    selected && "bg-primary/10"
                  )}
                  onClick={() => toggle(opt.value)}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-sm border",
                      selected
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/40"
                    )}
                  >
                    {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function ReportViewer() {
  const navigate = useNavigate();
  const { reportId } = useParams();
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";

  const report = reportConfigs.find((r) => r.id === reportId);

  // Multi-select filter state: select-type keys store string[], text/date store string
  const [multiValues, setMultiValues] = useState<Record<string, string[]>>({});
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [currentLimit, setCurrentLimit] = useState(50);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({ page: 1, limit: 50 });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasEventFilter = report?.filters.some((f) => f.type === "event-select");
  const hasGiftFilter = report?.filters.some((f) => f.type === "gift-select");
  const hasCategoryFilter = report?.filters.some((f) => f.type === "category-select");

  const [eventOptions, setEventOptions] = useState<{ value: string; label: string }[]>([]);
  const [giftOptions, setGiftOptions] = useState<{ value: string; label: string }[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);
  const statusOptions = GIFT_STATUSES.map((s) => ({ value: s, label: s }));

  useEffect(() => {
    if (!hasEventFilter) return;
    EventAPI.list({}, 1, 200).then((res) => {
      if (res.success && res.data)
        setEventOptions(res.data.map((e: any) => ({ value: e.name, label: e.subject || e.name })));
    });
  }, [hasEventFilter]);

  useEffect(() => {
    if (!hasGiftFilter) return;
    GiftAPI.list({}, 1, 200).then((res) => {
      if (res.success && res.data)
        setGiftOptions(res.data.map((g: any) => ({ value: g.name, label: g.gift_name || g.name })));
    });
  }, [hasGiftFilter]);

  useEffect(() => {
    if (!hasCategoryFilter) return;
    const csrfToken =
      (window as any).csrf_token ||
      (document.cookie.match(/csrf_token=([^;]+)/) || [])[1] ||
      "";
    fetch("/api/method/gift.gift.api.get_gift_categories", {
      credentials: "include",
      headers: csrfToken ? { "X-Frappe-CSRF-Token": csrfToken } : {},
    })
      .then((r) => r.json())
      .then((r) => {
        const list: any[] = r?.message || [];
        setCategoryOptions(
          list.map((c: any) => ({ value: c.name, label: c.category_name || c.name }))
        );
      })
      .catch(() => {});
  }, [hasCategoryFilter]);

  // Build applied filters from multi + text values + page/limit
  const buildApplied = (mv: Record<string, string[]>, tv: Record<string, string>, page: number, limit: number): ReportFilters => {
    const f: ReportFilters = { page, limit };
    Object.entries(mv).forEach(([k, vs]) => {
      if (vs.length > 0) f[k] = vs.join(",");
    });
    Object.entries(tv).forEach(([k, v]) => {
      if (v) f[k] = v;
    });
    return f;
  };

  const applyNow = (mv: Record<string, string[]>, tv: Record<string, string>, page: number, limit: number) => {
    setAppliedFilters(buildApplied(mv, tv, page, limit));
  };

  const handleMultiChange = (key: string, vs: string[]) => {
    const newMv = { ...multiValues, [key]: vs };
    setMultiValues(newMv);
    setCurrentPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyNow(newMv, textValues, 1, currentLimit), 300);
  };

  const handleTextChange = (key: string, value: string) => {
    const newTv = { ...textValues, [key]: value };
    setTextValues(newTv);
    setCurrentPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyNow(multiValues, newTv, 1, currentLimit), 400);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    applyNow(multiValues, textValues, page, currentLimit);
  };

  const handleLimitChange = (limit: number) => {
    setCurrentLimit(limit);
    setCurrentPage(1);
    applyNow(multiValues, textValues, 1, limit);
  };

  const handleClearFilters = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setMultiValues({});
    setTextValues({});
    setCurrentPage(1);
    setAppliedFilters({ page: 1, limit: currentLimit });
  };

  const handleRemoveSingleFilter = (key: string, isMulti: boolean) => {
    if (isMulti) {
      const newMv = { ...multiValues };
      delete newMv[key];
      setMultiValues(newMv);
      applyNow(newMv, textValues, 1, currentLimit);
    } else {
      const newTv = { ...textValues };
      delete newTv[key];
      setTextValues(newTv);
      applyNow(multiValues, newTv, 1, currentLimit);
    }
    setCurrentPage(1);
  };

  const handleDownloadCSV = () => {
    try {
      ReportsAPI.downloadCSV(report!.apiMethod, appliedFilters);
      toast.success(t("reports.downloadStarted"));
    } catch {
      toast.error(t("reports.downloadFailed"));
    }
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["report", reportId, appliedFilters],
    queryFn: async () => {
      if (!report) throw new Error(t("reports.notFound"));
      const result = await ReportsAPI.fetchReport(report.apiMethod, appliedFilters);
      if (result.success) return result.data;
      throw new Error(result.error);
    },
    enabled: !!report,
  });

  if (!report) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{t("reports.notFound")}</p>
        <Button variant="link" onClick={() => navigate("/reports")}>{t("common.back")}</Button>
      </div>
    );
  }

  const isSelectType = (type: string) =>
    ["event-select", "gift-select", "category-select", "status-select", "select"].includes(type);

  const getOptionsForFilter = (type: string, staticOpts?: { value: string; label: string }[]) => {
    if (type === "event-select") return eventOptions;
    if (type === "gift-select") return giftOptions;
    if (type === "category-select") return categoryOptions;
    if (type === "status-select") return statusOptions;
    return staticOpts || [];
  };

  // Active filter summary for badges
  const activeFilters: { key: string; label: string; isMulti: boolean }[] = [];
  report.filters.forEach((fc) => {
    if (isSelectType(fc.type)) {
      const vs = multiValues[fc.key] || [];
      if (vs.length > 0) {
        const opts = getOptionsForFilter(fc.type, fc.options);
        const valLabel = vs.length === 1
          ? (opts.find((o) => o.value === vs[0])?.label ?? vs[0])
          : `${vs.length} selected`;
        activeFilters.push({ key: fc.key, label: `${fc.label}: ${valLabel}`, isMulti: true });
      }
    } else {
      const v = textValues[fc.key];
      if (v) activeFilters.push({ key: fc.key, label: `${fc.label}: ${v}`, isMulti: false });
    }
  });

  const COLUMN_LABEL_OVERRIDES: Record<string, string> = {
    ring_number: "Ring Number",
    barcode_id: "Barcode ID",
    barcode_value: "Barcode ID",
    event_name: "Event",
    from_event: "From Event",
    to_event: "To Event",
    moved_by_name: "Moved By",
    gift_code: "Gift Code",
    issue_id: "Issue ID",
    guest_name: "Guest Name",
  };

  const formatHeader = (key: string) => {
    if (COLUMN_LABEL_OVERRIDES[key]) return COLUMN_LABEL_OVERRIDES[key];
    const translationKey = `reports.columns.${key}`;
    const translated = t(translationKey);
    if (translated === translationKey) return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return translated;
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? t("common.yes") : t("common.no");
    if (typeof value === "number") return value.toLocaleString(isArabic ? "ar-AE" : "en-US");
    return value;
  };

  const columns =
    data?.data && data.data.length > 0
      ? Object.keys(data.data[0])
          .filter((k) => !k.startsWith("_"))
          .filter((k, _, arr) => !(k === "moved_by" && arr.includes("moved_by_name")))
      : [];

  const totalPages = data?.total_pages ?? 1;
  const totalRecords = data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              {t("reports.filters")}
            </CardTitle>
            <div className="flex items-center gap-2">
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {report.filters.map((filter) => {
              const label = t(`reports.columns.${filter.key}`, { defaultValue: filter.label });
              return (
                <div key={filter.key} className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {label}
                  </Label>

                  {isSelectType(filter.type) && (
                    <MultiSelectDropdown
                      values={multiValues[filter.key] || []}
                      options={getOptionsForFilter(filter.type, filter.options)}
                      placeholder={t("common.all")}
                      onChange={(vs) => handleMultiChange(filter.key, vs)}
                    />
                  )}

                  {filter.type === "date" && (
                    <div className="relative">
                      <Input
                        id={filter.key}
                        type="date"
                        value={textValues[filter.key] || ""}
                        min={filter.key === "to_date" ? textValues["from_date"] || undefined : undefined}
                        onChange={(e) => handleTextChange(filter.key, e.target.value)}
                        className="h-9 text-sm pr-7 w-full"
                      />
                      {textValues[filter.key] && (
                        <button
                          type="button"
                          onClick={() => handleTextChange(filter.key, "")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {(filter.type === "text" || filter.type === "number") && (
                    <div className="relative">
                      <Input
                        id={filter.key}
                        type={filter.type === "number" ? "number" : "text"}
                        placeholder={filter.placeholder ? t(filter.placeholder) : `Search ${label}...`}
                        value={textValues[filter.key] || ""}
                        onChange={(e) => handleTextChange(filter.key, e.target.value)}
                        className="h-9 text-sm pr-7 w-full"
                      />
                      {textValues[filter.key] && (
                        <button
                          type="button"
                          onClick={() => handleTextChange(filter.key, "")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active filter badges */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t items-center">
              <span className="text-xs text-muted-foreground self-center mr-1">Active:</span>
              {activeFilters.map(({ key, label, isMulti }) => (
                <Badge
                  key={key}
                  className="text-xs gap-1 pl-2 pr-1 py-0.5 cursor-default bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => handleRemoveSingleFilter(key, isMulti)}
                    className="ml-0.5 rounded-full hover:text-foreground transition-colors p-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-muted-foreground hover:text-foreground hover:font-bold transition-colors ml-1"
              >
                {t("reports.clearFilters")}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">{t("reports.results")}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {totalRecords > 0 && (
                <span className="text-xs text-muted-foreground">
                  {totalRecords} {t("reports.records")}
                </span>
              )}
              {/* Rows per page */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Rows:</span>
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleLimitChange(s)}
                    className={cn(
                      "h-6 min-w-6 px-1.5 rounded text-xs font-medium border transition-colors",
                      currentLimit === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-input hover:bg-accent text-muted-foreground"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {data?.data && data.data.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleDownloadCSV} className="h-7 text-xs">
                  <Download className="h-3.5 w-3.5 mr-1" />
                  {t("reports.exportCSV")}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.data || data.data.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {t("common.noResults")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                        {formatHeader(col)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((row: any, rowIndex: number) => (
                    <TableRow key={rowIndex} className="hover:bg-muted/40">
                      {columns.map((col) => (
                        <TableCell key={col} className="whitespace-nowrap text-sm">
                          {col === "barcode_image" &&
                          typeof row[col] === "string" &&
                          row[col].startsWith("data:image") ? (
                            <img src={row[col]} alt="barcode" className="h-10" />
                          ) : (
                            formatValue(row[col])
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {/* Page number buttons */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pg: number;
                  if (totalPages <= 5) {
                    pg = i + 1;
                  } else if (currentPage <= 3) {
                    pg = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pg = totalPages - 4 + i;
                  } else {
                    pg = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pg}
                      onClick={() => handlePageChange(pg)}
                      className={cn(
                        "h-7 min-w-7 px-1.5 rounded text-xs font-medium border transition-colors",
                        currentPage === pg
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input hover:bg-accent text-muted-foreground"
                      )}
                    >
                      {pg}
                    </button>
                  );
                })}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
