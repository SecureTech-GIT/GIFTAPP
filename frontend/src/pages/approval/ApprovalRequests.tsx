/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { parseFrappeDate } from "@/lib/i18n";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCheck, CheckCircle2, Search, X, XCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/Pagination";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { ApprovalAPI, GiftAPI } from "@/services/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

type PendingIssueApproval = {
  issue: string;
  gift?: string;
  gift_name?: string;
  category?: string;
  gift_status?: string;
  event?: string;
  event_name?: string;
  gift_recipient?: string;
  guest_full_name?: string;
  coordinator_full_name?: string;
  mobile_number?: string;
  requested_by?: string;
  creation?: string;
  date?: string;
};

export default function ApprovalRequests() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedGifts, setSelectedGifts] = useState<string[]>([]);
  const [giftChosenIssue, setGiftChosenIssue] = useState<
    Record<string, string>
  >({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargets, setRejectTargets] = useState<string[]>([]);

  const {
    data: res,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["approval-requests", searchQuery, currentPage, itemsPerPage],
    queryFn: async () => {
      const out = await ApprovalAPI.listPendingIssueApprovals(
        searchQuery,
        currentPage,
        itemsPerPage,
      );
      if (!out.success) throw new Error(out.error);
      return out;
    },
  });

  const requests: PendingIssueApproval[] = (res?.data as any) || [];
  const totalItems = res?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  const grouped = useMemo(() => {
    const byGift = new Map<string, PendingIssueApproval[]>();
    for (const r of requests) {
      const giftId = String(r.gift || r.gift_name || r.issue);
      const list = byGift.get(giftId) || [];
      list.push(r);
      byGift.set(giftId, list);
    }

    const rows = Array.from(byGift.entries()).map(([giftId, list]) => {
      const sorted = [...list].sort(
        (a, b) =>
          parseFrappeDate(String(b.creation || 0)).getTime() -
          parseFrappeDate(String(a.creation || 0)).getTime(),
      );
      return {
        giftId,
        requests: sorted,
        primary: sorted[0],
      };
    });

    return rows;
  }, [requests]);

  const selectedGiftSet = useMemo(
    () => new Set(selectedGifts),
    [selectedGifts],
  );
  const multiGiftIds = useMemo(
    () => grouped.filter((g) => g.requests.length > 1).map((g) => g.giftId),
    [grouped],
  );
  const singleGiftIds = useMemo(
    () => grouped.filter((g) => g.requests.length === 1).map((g) => g.giftId),
    [grouped],
  );
  const visibleGiftIds = useMemo(() => grouped.map((g) => g.giftId), [grouped]);
  const selectAllTargetIds =
    singleGiftIds.length > 0 ? singleGiftIds : visibleGiftIds;
  const allVisibleSelected =
    selectAllTargetIds.length > 0 &&
    selectAllTargetIds.every((id) => selectedGiftSet.has(id));

  const getGiftStatusColor = (status?: string) => {
    const s = (status || "").toLowerCase();
    if (s === "available")
      return "bg-green-100 text-green-700 border-green-200";
    if (s === "reserved")
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    if (s === "issued") return "bg-blue-100 text-blue-700 border-blue-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
  };
  const isReasonValid = rejectReason.trim().length > 0;
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedGifts([]);
    } else {
      setSelectedGifts(selectAllTargetIds);
    }
  };

  const toggleSelectGift = (giftId: string) => {
    setSelectedGifts((prev) =>
      prev.includes(giftId)
        ? prev.filter((x) => x !== giftId)
        : [...prev, giftId],
    );
  };

  const approveMutation = useMutation({
    mutationFn: async (issueNames: string[]) => {
      const result = await GiftAPI.bulkApproveIssues(issueNames);
      if (!result.success) {
        throw new Error(result.error || t("common.error"));
      }
      return result.data || { success: [], failed: [] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["approval-requests"] });
      setSelectedGifts([]);
      if (data.failed.length > 0) {
        toast.error(t("common.error"));
      } else {
        toast.success(t("common.approved"));
      }
    },
    onError: (e: any) =>
      toast.error(String(e?.message || e || t("common.error"))),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      issueNames,
      reason,
    }: {
      issueNames: string[];
      reason: string;
    }) => {
      const result = await GiftAPI.bulkRejectIssues(issueNames, reason);
      if (!result.success) {
        throw new Error(result.error || t("common.error"));
      }
      return result.data || { success: [], failed: [] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["approval-requests"] });
      setSelectedGifts([]);
      setRejectTargets([]);
      setRejectReason("");
      setRejectDialogOpen(false);
      if (data.failed.length > 0) {
        toast.error(t("common.error"));
      } else {
        toast.success(t("common.rejected"));
      }
    },
    onError: (e: any) =>
      toast.error(String(e?.message || e || t("common.error"))),
  });

  const resolveChosenIssue = (giftId: string) => {
    const g = grouped.find((x) => x.giftId === giftId);
    if (!g || g.requests.length === 0) return undefined;
    const chosen = giftChosenIssue[giftId];
    if (chosen && g.requests.some((r) => r.issue === chosen)) return chosen;
    return g.requests[0].issue;
  };

  const resolveChosenRequest = (giftId: string) => {
    const g = grouped.find((x) => x.giftId === giftId);
    if (!g || g.requests.length === 0) return undefined;
    const chosenIssue = resolveChosenIssue(giftId);
    return (
      g.requests.find((r) => r.issue === chosenIssue) ||
      g.primary ||
      g.requests[0]
    );
  };

  const handleBulkApprove = () => {
    const issueIds = Array.from(selectedGifts)
      .map((giftId) => {
        const g = grouped.find((x) => x.giftId === giftId);
        if (!g || g.requests.length === 0) return null;

        // Get the chosen issue for this gift, or use the first one
        const chosenIssue = giftChosenIssue[giftId] || g.requests[0]?.issue;
        return chosenIssue;
      })
      .filter(Boolean) as string[];

    if (issueIds.length === 0) return;
    approveMutation.mutate(issueIds);
  };

  const openRejectDialogFor = (issueNames: string[]) => {
    const clean = Array.from(
      new Set((issueNames || []).filter(Boolean).map(String)),
    );
    if (clean.length === 0) return;
    setRejectTargets(clean);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleBulkReject = () => {
    // Get all selected gifts and for each gift, get the CHOSEN ISSUE ID (not the guest name)
    const issueIds = Array.from(selectedGifts)
      .map((giftId) => {
        const g = grouped.find((x) => x.giftId === giftId);
        if (!g || g.requests.length === 0) return null;

        // Get the chosen issue for this gift, or use the first one
        const chosenIssue = giftChosenIssue[giftId] || g.requests[0]?.issue;
        return chosenIssue;
      })
      .filter(Boolean) as string[];

    openRejectDialogFor(issueIds);
  };
  const handleApproveGift = (giftId: string) => {
    const g = grouped.find((x) => x.giftId === giftId);
    if (!g || g.requests.length === 0) return;

    // Get the chosen issue for this gift, or use the first one
    const chosenIssue = giftChosenIssue[giftId] || g.requests[0]?.issue;
    if (!chosenIssue) return;

    approveMutation.mutate([chosenIssue]);
  };
  const handleRejectGift = (giftId: string) => {
    const g = grouped.find((x) => x.giftId === giftId);
    if (!g || g.requests.length === 0) return;

    // Get the chosen issue for this gift, or use the first one
    const chosenIssue = giftChosenIssue[giftId] || g.requests[0]?.issue;
    if (!chosenIssue) return;

    openRejectDialogFor([chosenIssue]);
  };

  return (
    <div className="min-h-svh bg-background ">
      {/* Header */}
      {/* <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          {t("approvals.workspace")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("approvals.description")}
        </p>
      </div> */}

      {/* Search and Filter */}
      {/* <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
              setSelectedGifts([]);
            }}
            className="pl-9 h-10"
          />
        </div>
      </div> */}
      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6 flex md:flex-row flex-col md:items-center gap-4">
          {/* Search Input */}
          <div className="relative md:flex-1">
            <Search className="ltr:absolute ltr:left-3 rtl:absolute rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.searchAllocationReq")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
                setSelectedGifts([]);
              }}
              className="ltr:pl-9 rtl:pr-9 ltr:pr-9 rtl:pl-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                  setSelectedGifts([]);
                }}
                className="ltr:absolute ltr:right-3 rtl:absolute rtl:left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <div className="bg-card mt-3 border border-border rounded-xl p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={toggleSelectAll}
              className="border-primary"
            />
            <span className="text-sm font-medium text-foreground">
              {selectedGifts.length} {t("common.selected")}
            </span>
          </div>

          {selectedGifts.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleBulkApprove}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                <CheckCheck className="h-4 w-4 mr-1.5" />
                {t("approvals.bulkApprove")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleBulkReject}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                <X className="h-4 w-4 mr-1.5" />
                {t("approvals.bulkReject")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] lg:min-w-full table-auto">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-12 px-4 py-3">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleSelectAll}
                    className="border-primary"
                  />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground capitalize whitespace-nowrap">
                  {t("gifts.giftName")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground capitalize whitespace-nowrap">
                  {t("common.category")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground  whitespace-nowrap">
                  {t("events.eventName")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground  whitespace-nowrap">
                  {t("common.availability")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground  whitespace-nowrap">
                  {t("approvals.requestedBy")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground  whitespace-nowrap">
                  {t("common.guests")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground  whitespace-nowrap">
                  {t("recipients.coordinator")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground  whitespace-nowrap">
                  {t("common.date")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground  whitespace-nowrap">
                  {t("common.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {grouped.map((g) => (
                <tr
                  key={g.giftId}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    {g.requests.length > 1 ? (
                      <div className="w-4 h-4" />
                    ) : (
                      <Checkbox
                        checked={selectedGiftSet.has(g.giftId)}
                        onCheckedChange={() => toggleSelectGift(g.giftId)}
                        className="border-primary"
                      />
                    )}
                  </td>
                  <td
                    onClick={() => navigate(`/gifts/${g?.primary?.gift}`)}
                    className="px-4 py-3 cursor-pointer"
                  >
                    <div>
                      <span className="text-sm font-medium text-primary hover:text-primary/80 hover:underline whitespace-nowrap">
                        {g.primary?.gift_name || g.primary?.gift || g.giftId}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {g.primary?.category || "-"}
                    </span>
                  </td>
                  <td
                    onClick={() =>
                      g.primary?.event &&
                      navigate(`/events/${g.primary?.event}`)
                    }
                    className={`px-4 py-3 ${g.primary?.event ? "cursor-pointer" : ""}`}
                  >
                    <span
                      className={`text-sm font-medium whitespace-nowrap ${
                        g.primary?.event
                          ? "text-primary hover:text-primary/80 hover:underline"
                          : "text-foreground"
                      }`}
                    >
                      {g.primary?.event
                        ? g.primary?.event_name || g.primary?.event
                        : "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={`${getGiftStatusColor(g.primary?.gift_status)} border-0 whitespace-nowrap`}
                    >
                      {g.primary?.gift_status == "Issued"
                        ? t("common.allocated")
                        : g.primary?.gift_status || "-"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {resolveChosenRequest(g.giftId)?.requested_by || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {g.requests.length > 1 ? (
                      <div className="min-w-[220px]">
                        <Select
                          value={resolveChosenIssue(g.giftId)}
                          onValueChange={(issueName) =>
                            setGiftChosenIssue((prev) => ({
                              ...prev,
                              [g.giftId]: issueName,
                            }))
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue
                              placeholder={t("common.select") as any}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {g.requests.map((r) => (
                              <SelectItem key={r.issue} value={r.issue}>
                                {r.guest_full_name ||
                                  r.gift_recipient ||
                                  r.issue}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-muted-foreground mt-1">
                          {t("common.requests") || "Requests"}:{" "}
                          {g.requests.length}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {g.primary?.guest_full_name || "-"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {resolveChosenRequest(g.giftId)?.coordinator_full_name ||
                        "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {(() => {
                        const d = resolveChosenRequest(g.giftId)?.creation
                        if (!d) return "-"
                        try {
                          const dt = parseFrappeDate(String(d))
                          if (Number.isNaN(dt.getTime())) return String(d)
                          return `${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`
                        } catch { return String(d) }
                      })()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {g.requests.length > 1 && !giftChosenIssue[g.giftId] ? (
                      <div className="w-4 h-4" />
                    ) : (
                      <div className="flex items-center gap-1 min-w-[120px]">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-green-600 border-green-600 border flex items-center gap-1"
                          onClick={() => handleApproveGift(g.giftId)}
                          disabled={
                            approveMutation.isPending || rejectMutation.isPending
                          }
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs">{t("common.approve")}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-destructive border-destructive border  flex items-center gap-1"
                          onClick={() => handleRejectGift(g.giftId)}
                          disabled={
                            approveMutation.isPending || rejectMutation.isPending
                          }
                        >
                          <XCircle className="h-4 w-4" />
                          <span className="text-xs">{t("common.reject")}</span>
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {!isLoading && requests.length === 0 && (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {t("approvals.noPending")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("approvals.allProcessed")}
            </p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-sm text-destructive">{String(error)}</p>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && requests.length > 0 && (
          <div className="border-t  border-border px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground order-2 sm:order-1">
              {t("common.showing")} {`${totalItems}`}
            </p>
            <div className="order-1 sm:order-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(items) => {
                  setItemsPerPage(items);
                  setCurrentPage(1);
                  setSelectedGifts([]);
                }}
              />
            </div>
          </div>
        )}
      </div>
<Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
  <DialogContent
    className="max-w-md p-0 overflow-hidden rounded-2xl"
    aria-describedby={undefined}
  >
    <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex flex-row items-center gap-3">
      <DialogTitle className="text-base font-semibold">
        {t("gifts.rejectionReason")}
      </DialogTitle>
    </DialogHeader>

    <div className="px-6 py-5 space-y-4">
      <p className="text-sm text-muted-foreground">
        {rejectTargets.length > 1
          ? (() => {
              // Get guest names for the selected issues
              const guestNames = rejectTargets
                .map((issueName) => {
                  // Find the request with this issue name
                  for (const group of grouped) {
                    const request = group.requests.find(
                      (r) => r.issue === issueName,
                    );
                    if (request) {
                      return (
                        request.guest_full_name ||
                        request.gift_recipient ||
                        issueName
                      );
                    }
                  }
                  return issueName; // fallback to issue name if not found
                })
                .filter(
                  (name, index, self) => self.indexOf(name) === index,
                ); // Remove duplicates

              const displayNames = guestNames.slice(0, 3);
              const remainingCount = guestNames.length - 3;
              const totalRequests = rejectTargets?.length;

              return (
                <>
                  <span>{t("gifts.rejectionBulkStart", { count: totalRequests })} </span>
                  {displayNames.map((name, index) => (
                    <span key={name}>
                      <strong className="text-foreground font-bold">{name}</strong>
                      {index < displayNames.length - 1 ? ", " : ""}
                    </span>
                  ))}
                  {remainingCount > 0 && (
                    <span> {t("gifts.rejectionAndOthers", { count: remainingCount })}</span>
                  )}
                  <span>. {t("gifts.rejectionProvideReason")}</span>
                </>
              );
            })()
          : rejectTargets.length === 1 &&
            (() => {
              const issueName = rejectTargets[0];
              let guestName = issueName;

              // Find the guest name for this issue
              for (const group of grouped) {
                const request = group.requests.find(
                  (r) => r.issue === issueName,
                );
                if (request) {
                  guestName =
                    request.guest_full_name ||
                    request.gift_recipient ||
                    issueName;
                  break;
                }
              }

              return (
                <>
                  <span>{t("gifts.rejectionSingleStart")} </span>
                  <strong className="text-foreground font-bold">{guestName}</strong>
                  <span>. {t("gifts.rejectionProvideReason")}</span>
                </>
              );
            })()}
      </p>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1 block">
          {t("gifts.additionalComments")} <span className="text-red-500">*</span>
        </label>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder={t("gifts.rejectionPlaceholder")}
          rows={4}
          className="w-full border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
        {!isReasonValid && rejectReason.length > 0 && (
          <p className="text-xs text-red-500 mt-1">
            {t("gifts.rejectionReasonRequired")}
          </p>
        )}
      </div>
    </div>

    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
      <Button
        variant="outline"
        onClick={() => {
          setRejectDialogOpen(false);
          setRejectTargets([]);
          setRejectReason("");
        }}
        disabled={rejectMutation.isPending}
      >
        {t("common.cancel")}
      </Button>
      <Button
        className={`${
          isReasonValid
            ? "bg-red-600 text-white hover:bg-red-700 border-red-600"
            : "bg-red-400 text-white hover:bg-red-500 cursor-not-allowed"
        }`}
        disabled={!isReasonValid || rejectMutation.isPending}
        onClick={() => {
          const reason = (rejectReason || "").trim();
          if (!reason) {
            toast.error(t("gifts.rejectionReasonRequired"));
            return;
          }
          rejectMutation.mutate({ issueNames: rejectTargets, reason });
        }}
      >
        {rejectMutation.isPending
          ? t("gifts.rejecting")
          : t("gifts.confirmRejection")}
      </Button>
    </div>
  </DialogContent>
</Dialog>
    </div>
  );
}
