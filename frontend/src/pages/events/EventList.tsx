/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Calendar,
  Users,
  Eye,
  CalendarCheck,
  Clock,
  MoreHorizontal,
  Edit,
  Trash2,
  Grid3x3,
  List,
  Search,
  X,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/Pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { EventAPI, DocTypeAPI } from "@/services/api";
import { format, isToday, isFuture, formatDate } from "date-fns";
import type { GiftEvent } from "@/types/event";
import type { ApiResponse } from "@/types/gift";
import { toast } from "sonner";
import { useRole } from "@/contexts/RoleContext";
import { getEventStatusColor } from "@/lib/statusColors";
import { formatDateTime, parseFrappeDate } from "@/lib/i18n";
import { Input } from "@/components/ui/input";

export default function EventList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isEventManager, isEventCoordinator } = useRole();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [nameSearch, setNameSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<
    "event_id" | "event_name" | "start_date"
  >("start_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"grid" | "table">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "grid" : "table"
  );
  const [deleteEventName, setDeleteEventName] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch event status options from backend
  const { data: eventStatuses = [] } = useQuery({
    queryKey: ["field-options", "Gift Event", "status"],
    queryFn: async () => {
      const result = await DocTypeAPI.getFieldOptions("Gift Event", "status");
      return result.success ? result.data : [];
    },
  });

  const visibleStatusOptions = useMemo(() => {
    if (isAdmin || isEventManager) {
      return eventStatuses;
    }
    if (isEventCoordinator) {
      return eventStatuses.filter((status) =>
        ["Planned", "Active", "Completed"].includes(String(status)),
      );
    }
    return eventStatuses;
  }, [eventStatuses, isAdmin, isEventCoordinator, isEventManager]);

  const requestDelete = (name: string) => {
    if (!isAdmin && !isEventManager) {
      toast.error("Only Admin/System Manager/Event Manager can delete events");
      return;
    }
    setDeleteEventName(name);
  };

  // Fetch events with server-side pagination
  const {
    data: eventsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "gift-events-paginated",
      statusFilter,
      nameSearch,
      sortBy,
      sortDir,
      currentPage,
      itemsPerPage,
    ],
    queryFn: async () => {
      const filters: Record<string, string> = {};
      if (statusFilter && statusFilter !== "all") {
        filters.status = statusFilter;
      }
      if (nameSearch.trim()) {
        filters.search = nameSearch.trim();
      }

      filters.sort_by = sortBy;
      filters.sort_dir = sortDir;

      const result = await EventAPI.list(filters, currentPage, itemsPerPage);

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch events");
      }

      return result;
    },
  });

  const events = useMemo(
    () => (eventsResponse as ApiResponse<GiftEvent[]> | undefined)?.data || [],
    [eventsResponse],
  );

  const totalItems = eventsResponse?.total || events.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  const showDeliveredDeleteBlockToast = () => {
    toast.error(t("events.cannotDeleteEventWithDeliveredAssociations"), {
      description: t("events.cannotDeleteEventWithDeliveredAssociationsDesc"),
      duration: 5000,
      className: "bg-red-50 text-red-700",
    });
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (name: string) => EventAPI.delete(name),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("events.eventDeleted"));
        queryClient.invalidateQueries({ queryKey: ["gift-events-paginated"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        setDeleteEventName(null);
      } else {
        // Handle backend validation errors with user-friendly messages
        const errorMessage = result.error || "";

        if (
          errorMessage.toLowerCase().includes("delivered") ||
          errorMessage.toLowerCase().includes("cannot unassign while a delivered allocation exists")
        ) {
          showDeliveredDeleteBlockToast();
        } else if (
          errorMessage.includes("Follow-up Status") ||
          errorMessage.includes("Cannot delete") ||
          errorMessage.includes("would break") ||
          errorMessage.includes("linked to") ||
          errorMessage.includes("exists")
        ) {
          toast.error(t("events.cannotDeleteEventWithAssociations"), {
            description: t("events.unassignGuestsAndGiftsFirst"),
            duration: 5000,
            className: "bg-red-50 text-red-700",
          });
        } else {
          toast.error(result.error || t("events.failedToDeleteEvent"));
        }
        setDeleteEventName(null);
      }
    },
    onError: (error: any) => {
      // Handle various backend validation errors with user-friendly messages
      const errorMessage = error.message || error.toString();

      if (
        errorMessage.toLowerCase().includes("delivered") ||
        errorMessage.toLowerCase().includes("cannot unassign while a delivered allocation exists")
      ) {
        showDeliveredDeleteBlockToast();
      } else if (
        errorMessage.includes("Follow-up Status") ||
        errorMessage.includes("Cannot delete") ||
        errorMessage.includes("would break") ||
        errorMessage.includes("linked to") ||
        errorMessage.includes("exists")
      ) {
        toast.error(t("events.cannotDeleteEventWithAssociations"), {
          description: t("events.unassignGuestsAndGiftsFirst"),
          duration: 5000,
          className: "bg-red-50 text-red-700",
        });
      } else {
        toast.error(t("events.failedToDeleteEvent"));
      }
      console.error("Delete error:", error);
      setDeleteEventName(null);
    },
  });

  const handleDelete = async (name: string) => {
    // Basic frontend validation - let backend handle detailed validation
    const eventToDelete = events.find((event) => event.name === name);

    if (eventToDelete) {
      const detailed = await EventAPI.getWithCounts(name);
      if (detailed.success && detailed.data) {
        const eventDetail = detailed.data as any;
        const hasDeliveredAssignedGifts = Array.isArray(eventDetail?.event_gifts)
          ? eventDetail.event_gifts.some(
              (g: any) =>
                String(g?.display_status || g?.status || "").toLowerCase() ===
                "delivered",
            )
          : false;

        if (hasDeliveredAssignedGifts) {
          showDeliveredDeleteBlockToast();
          setDeleteEventName(null);
          return;
        }
      }
    }

    if (eventToDelete) {
      const giftsCount = Array.isArray(eventToDelete.event_gifts)
        ? eventToDelete.event_gifts.length
        : typeof (eventToDelete as any).event_gifts_count === "number"
          ? (eventToDelete as any).event_gifts_count
          : 0;

      const participantsCount = Array.isArray(
        (eventToDelete as any).event_participants,
      )
        ? (eventToDelete as any).event_participants.length
        : 0;

      if (giftsCount > 0 || participantsCount > 0) {
        toast.error(t("events.cannotDeleteEventWithAssociations"), {
          description: t("events.unassignGuestsAndGiftsFirst"),
          duration: 5000,
          className: "bg-red-50 text-red-700",
        });
        setDeleteEventName(null);
        return;
      }
    }

    deleteMutation.mutate(name);
  };

  // Calculate dashboard metrics with safe date parsing
  const safeParseDate = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    try {
      const dt = parseFrappeDate(dateStr);
      return Number.isNaN(dt.getTime()) ? null : dt;
    } catch {
      return null;
    }
  };

  const dashboardMetrics = {
    // Do not include Draft in total-events summary card
    totalEvents: events.filter((e: GiftEvent) => e.status !== "Draft").length,

    upcomingEvents: events.filter((e: GiftEvent) => {
      const date = safeParseDate(e.starts_on);
      return date && isFuture(date) && e.status !== "Draft";
    }).length,

    todayEvents: events.filter((e: GiftEvent) => {
      const date = safeParseDate(e.starts_on);
      return date && isToday(date) && e.status !== "Draft";
    }).length,

    completedEvents: events.filter((e: GiftEvent) => e.status === "Completed")
      .length,

    totalParticipants: events.reduce(
      (sum: number, e: GiftEvent) =>
        sum +
        (Array.isArray(e.event_participants) ? e.event_participants.length : 0),
      0,
    ),

    openEvents: events.filter((e: GiftEvent) => e.status === "Open").length,
  };

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, itemsPerPage, nameSearch, sortBy, sortDir]);

  const toggleSort = (next: "event_id" | "event_name" | "start_date") => {
    setCurrentPage(1);
    setSortBy((prev) => {
      if (prev !== next) {
        setSortDir("asc");
        return next;
      }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return prev;
    });
  };

  // Error handling
  useEffect(() => {
    if (error) {
      console.error("Failed to load events:", error);
      toast.error(t("events.failedToLoadEvents"));
    }
  }, [error, t]);

  return (
    <div className="space-y-6">
      {/* Dashboard Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("events.totalEvents")}
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardMetrics.totalEvents}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboardMetrics.openEvents} {t("events.currentlyOpen")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("events.upcomingEvents")}
            </CardTitle>
            <CalendarCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardMetrics.upcomingEvents}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("events.scheduledFuture")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("events.todaysEvents")}
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardMetrics.todayEvents}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("events.happeningToday")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("events.totalParticipants")}
            </CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardMetrics.totalParticipants}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("events.acrossAllEvents")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and View Toggle */}
      <Card>
        <CardContent className="pt-6 flex gap-4 flex-wrap items-center justify-between">
          <div className="flex flex-1 gap-3">
            <div className="relative w-full">
              <Search className="ltr:absolute ltr:left-3 rtl:absolute rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                placeholder={t("common.search")}
                className="pl-8 rtl:pr-8 ltr:pr-9 rtl:pl-9"
              />
              {nameSearch && (
                <button
                  type="button"
                  onClick={() => setNameSearch("")}
                  className="ltr:absolute ltr:right-3 rtl:absolute rtl:left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder={t("events.allStatuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("events.allStatuses")}</SelectItem>
                  {visibleStatusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 items-center w-full sm:w-auto justify-end">
            {(isAdmin || isEventManager) && (
              <Button asChild variant="outline">
                <Link to="/events/new">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("events.newEvent")}
                </Link>
              </Button>
            )}

            {/* View Toggle */}
            <div className="flex gap-2">
              <Button
                variant={viewMode === "table" ? "underlined" : "ghost"}
                size="icon"
                onClick={() => setViewMode("table")}
                title="Table view"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "underlined" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                title="Grid view"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Filters */}
      {(nameSearch || statusFilter !== "all") && (
        <div className="flex items-center gap-2 flex-wrap -mt-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Filter className="h-3 w-3" />
            {t("common.activeFilters")}:
          </span>
          {nameSearch && (
            <Badge className="gap-1 bg-muted text-muted-foreground border border-border hover:bg-muted/80">
              {t("common.search")}: {nameSearch}
              <button type="button" onClick={() => setNameSearch("")} className="ml-1 rounded-full hover:text-foreground transition-colors"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {statusFilter !== "all" && (
            <Badge className={cn("gap-1 bg-muted text-muted-foreground border border-border hover:bg-muted/80")}>
              {statusFilter}
              <button type="button" onClick={() => setStatusFilter("all")} className="ml-1 rounded-full hover:text-foreground transition-colors"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          <button
            type="button"
            onClick={() => { setNameSearch(""); setStatusFilter("all"); }}
            className="text-xs text-muted-foreground hover:text-foreground hover:font-bold transition-colors"
          >
            {t("common.clearAll")}
          </button>
        </div>
      )}

      {/* Results Count */}
      {/* {!isLoading && events.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {t('events.showingResults', {
            from: ((currentPage - 1) * itemsPerPage) + 1,
            to: Math.min(currentPage * itemsPerPage, totalItems),
            total: totalItems,
          })}
        </div>
      )} */}

      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-muted-foreground">{t("events.loadingEvents")}</p>
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {t("events.failedToLoadEvents")}
          </CardContent>
        </Card>
      )}

      {!isLoading && events.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">
              {t("events.noEventsFound")}
            </h3>
            {(isAdmin || isEventManager) && (
            <p className="text-muted-foreground mb-4">
              {statusFilter === "all"
                ? t("events.createFirstEvent")
                : t("events.noEventsMatchFilter")}
            </p>
            )}
            {(isAdmin || isEventManager) && (
            <Button asChild>
              <Link to="/events/new">
                <Plus className="h-4 w-4 mr-2" />
                {t("events.newEvent")}
              </Link>
            </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grid View */}
      {!isLoading && events.length > 0 && viewMode === "grid" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event: GiftEvent) => {
              const participantCount = Array.isArray(event.event_participants)
                ? event.event_participants.length
                : 0;

              const giftsCount =
                typeof (event as any).event_gifts_count === "number"
                  ? (event as any).event_gifts_count
                  : Array.isArray((event as any).event_gifts)
                    ? ((event as any).event_gifts as any[]).length
                    : 0;

              return (
                <Link
                  key={event.name}
                  to={`/events/${event.name}`}
                  className="group"
                >
                  <div className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all duration-200 hover:shadow-lg hover:border-primary/20">
                    <div className="flex items-center justify-between mb-3">
                      <Badge
                        className={getEventStatusColor(event?.status || "Open")}
                      >
                        {event.status || "Open"}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              to={`/events/${event.name}`}
                              className="cursor-pointer"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              {t("events.eventDetails")}
                            </Link>
                          </DropdownMenuItem>
                          {(isAdmin || isEventManager) && event.status !== "Completed" && (
                            <DropdownMenuItem asChild>
                              <Link
                                to={`/events/${event.name}/edit`}
                                className="cursor-pointer"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                {t("common.edit")}
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {(isAdmin || isEventManager) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  requestDelete(event.name);
                                }}
                                className="text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t("common.delete")}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h3 className="font-semibold text-foreground line-clamp-2 mb-1">
                          {event.subject || t("events.untitledEvent")}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {event.description ||
                            t("events.noDescriptionAvailable")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span>
                          {event.starts_on
                            ? formatDateTime(event.starts_on)
                            : t("events.noDate")}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-4 w-4 shrink-0" />
                          <span>
                            {participantCount} {t("events.participants")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{t("events.giftsTab")}:</span>
                          <span>{giftsCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {events.length > 0 && (
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
        </>
      )}

      {/* Table View */}
      {!isLoading && events.length > 0 && viewMode === "table" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="table-header">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("event_id")}
                      >
                        {t("events.eventId")}
                        {sortBy === "event_id"
                          ? sortDir === "asc"
                            ? "▲"
                            : "▼"
                          : ""}
                      </button>
                    </TableHead>
                    <TableHead className="table-header">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("event_name")}
                      >
                        {t("events.eventName")}
                        {sortBy === "event_name"
                          ? sortDir === "asc"
                            ? "▲"
                            : "▼"
                          : ""}
                      </button>
                    </TableHead>
                    <TableHead className="hidden lg:table-cell table-header">
                      {t("events.status")}
                    </TableHead>
                    <TableHead className="hidden md:table-cell table-header">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("start_date")}
                      >
                        {t("events.startDate")}
                        {sortBy === "start_date"
                          ? sortDir === "asc"
                            ? "▲"
                            : "▼"
                          : ""}
                      </button>
                    </TableHead>
                    <TableHead className="hidden lg:table-cell table-header">
                      {t("events.participants")}
                    </TableHead>
                    <TableHead className="text-right table-header">
                      {t("common.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event: GiftEvent) => {
                    const participantCount = Array.isArray(
                      event.event_participants,
                    )
                      ? event.event_participants.length
                      : 0;

                    const giftsCount =
                      typeof (event as any).event_gifts_count === "number"
                        ? (event as any).event_gifts_count
                        : Array.isArray((event as any).event_gifts)
                          ? ((event as any).event_gifts as any[]).length
                          : 0;

                    return (
                      <TableRow
                        key={event.name}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/events/${event.name}`)}
                      >
                        <TableCell>
                          <p className="font-medium">{event.name || "-"}</p>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {event.subject || t("events.untitledEvent")}
                            </p>
                            <div className="flex items-center gap-2 mt-1 lg:hidden">
                              <Badge className={getEventStatusColor(event?.status || "open")} >
                                {event.status || "Open"}
                              </Badge>
                              {event.starts_on && (
                                <span className="text-xs text-muted-foreground hidden md:inline">
                                  {formatDateTime(event.starts_on)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground md:hidden mt-0.5">
                              {t("events.giftsTab")}: {giftsCount}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge
                            className={getEventStatusColor(
                              event?.status || "open",
                            )}
                          >
                            {event.status || "Open"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {event.starts_on ? (
                            <span className="text-sm">
                              {formatDateTime(event.starts_on)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{participantCount}</span>
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link
                                  to={`/events/${event.name}`}
                                  className="cursor-pointer"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  {t("events.eventDetails")}
                                </Link>
                              </DropdownMenuItem>
                              {(isAdmin || isEventManager) && event.status !== "Completed" && (
                                <DropdownMenuItem asChild>
                                  <Link
                                    to={`/events/${event.name}/edit`}
                                    className="cursor-pointer"
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    {t("common.edit")}
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              {(isAdmin || isEventManager) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => requestDelete(event.name)}
                                    className="text-destructive focus:text-destructive cursor-pointer"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {t("common.delete")}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {events.length > 0 && (
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
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteEventName}
        onOpenChange={(open) => !open && setDeleteEventName(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("events.deleteEventConfirm")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("events.deleteEventDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("events.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEventName && handleDelete(deleteEventName)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending
                ? t("events.deleting")
                : t("events.deleteEvent")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
