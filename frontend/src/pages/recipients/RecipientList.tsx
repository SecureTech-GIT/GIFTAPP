/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, MoreHorizontal, Search, Eye, Users, X, Grid3x3, List } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenuTrigger,
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
import { Pagination } from "@/components/Pagination";
import { GiftRecipientAPI } from "@/services/api";
import type { GiftRecipient, ApiResponse } from "@/types/gift";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import { GuestDetailDialog } from "@/components/guest/GuestDetailDialog";
import { useRole } from "@/contexts/RoleContext";

export default function RecipientList() {
  const { t } = useTranslation();
  const { isAdmin, isEventManager, isEventCoordinator } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingRecipient, setViewingRecipient] =
    useState<GiftRecipient | null>(null);
  const [nameSort, setNameSort] = useState<"asc" | "desc">("asc");
  const [deleteRecipientName, setDeleteRecipientName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">(
  typeof window !== "undefined" && window.innerWidth < 768 ? "grid" : "table"
);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Debounce search
  const debouncedSearch = useDebounce(search, 500);

  // Fetch recipients with server-side pagination
  const {
    data: recipientsResponse,
    isLoading,
    error,
  } = useQuery<
    ApiResponse<GiftRecipient[]> & {
      total?: number;
      page?: number;
      limit?: number;
    }
  >({
    queryKey: ["gift-recipients-paginated", debouncedSearch, currentPage, itemsPerPage],
    queryFn: async () => {
      const result = await GiftRecipientAPI.list(
        debouncedSearch,
        currentPage,
        itemsPerPage,
      );

      if (!result.success) {
        throw new Error(result.error || t("recipients.errors.fetchFailed"));
      }

      return result;
    },
  });

  const recipients = useMemo(() => {
    const rows = (recipientsResponse?.data || []) as GiftRecipient[];
    const copy = [...rows];
    copy.sort((a: any, b: any) => {
      const an = String(a?.owner_full_name || "").toLowerCase();
      const bn = String(b?.owner_full_name || "").toLowerCase();
      const cmp = an.localeCompare(bn);
      return nameSort === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [recipientsResponse, nameSort]);

  const totalItems = recipientsResponse?.total || recipients.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (name: string) => GiftRecipientAPI.delete(name),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("recipients.messages.deleted"));
        queryClient.invalidateQueries({
          queryKey: ["gift-recipients-paginated"],
        });
      } else {
        toast.error(result.error || t("recipients.errors.deleteFailed"));
      }
    },
    onError: (error) => {
      toast.error(t("recipients.errors.deleteFailed"));
      console.error("Delete error:", error);
    },
  });

  // View recipient details
  const openViewDialog = (recipient: GiftRecipient) => {
    setViewingRecipient(recipient);
    setViewDialogOpen(true);
  };

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, itemsPerPage]);

  // Error handling
  useEffect(() => {
    if (error) {
      console.error("Failed to load recipients:", error);
      toast.error(t("recipients.errors.loadFailed"));
    }
  }, [error]);

  return (
    <div className="space-y-6">
      <Card>
  <CardContent className="pt-6 flex md:flex-row flex-col md:items-center gap-4 justify-between">

    {/* LEFT: Search */}
    <div className="relative md:flex-1">
      <Search className="ltr:absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={t("recipients.placeholders.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="ltr:pl-9 rtl:pr-9 ltr:pr-9 rtl:pl-9"
      />
    </div>

    {/* RIGHT: Buttons */}
    <div className="flex gap-2 justify-end w-full md:w-auto">

      <Button
        variant="outline"
        onClick={() => navigate("/recipients/new")}
        className="whitespace-nowrap"
      >
        <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
        {t("recipients.buttons.add")}
      </Button>

      {/* Toggle */}
      <div className="flex gap-1">
        <Button
          variant={viewMode === "table" ? "underlined" : "ghost"}
          size="icon"
          onClick={() => setViewMode("table")}
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          variant={viewMode === "grid" ? "underlined" : "ghost"}
          size="icon"
          onClick={() => setViewMode("grid")}
        >
          <Grid3x3 className="h-4 w-4" />
        </Button>
      </div>

    </div>
  </CardContent>
</Card>

      <Card>
        <CardContent className="p-0">
          {viewMode === "table" ? (
      <>
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="table-header cursor-pointer select-none"
                  onClick={() =>
                    setNameSort((s) => (s === "asc" ? "desc" : "asc"))
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {t("recipients.labels.guest")}
                    <span className="text-muted-foreground">
                      {nameSort === "asc" ? "▲" : "▼"}
                    </span>
                  </span>
                </TableHead>
                <TableHead className="hidden md:table-cell table-header">
                  {t("recipients.labels.coordinator")}
                </TableHead>
                <TableHead className="hidden lg:table-cell table-header">
                  {t("recipients.labels.coordinatorContact")}
                </TableHead>
                <TableHead className="text-right table-header">
                  {t("common.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      <span className="text-muted-foreground">
                        {t("common.loading")}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : recipients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-muted-foreground font-medium">
                        {t("recipients.messages.noGuests")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {search
                          ? t("recipients.messages.tryAdjusting")
                          : t("recipients.messages.getStarted")}
                      </p>
                      {!search && (
                        <Button asChild size="sm" className="mt-2">
                          <span onClick={() => navigate("/recipients/new")}>
                            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                            {t("recipients.buttons.add")}
                          </span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                recipients.map((r) => (
                  <TableRow
                    key={r.name}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openViewDialog(r)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{r.owner_full_name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {(r as any).coordinator_full_name || "-"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="text-sm">
                        {(r as any).coordinator_email && (
                          <div>{(r as any).coordinator_email}</div>
                        )}
                        {(r as any).coordinator_mobile_no && (
                          <div>{(r as any).coordinator_mobile_no}</div>
                        )}
                        {!(r as any).coordinator_email &&
                          !(r as any).coordinator_mobile_no &&
                          "-"}
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
                          <DropdownMenuItem onClick={() => openViewDialog(r)}>
                            <Eye className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                            {t("common.view")}
                          </DropdownMenuItem>
                          {!isEventCoordinator || isAdmin || isEventManager ? (
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(`/recipients/edit/${r.name}`)
                            }
                          >
                            <Edit className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          ) : null}
                          {(isAdmin || isEventManager) && (
                          <DropdownMenuItem
                            onClick={() => setDeleteRecipientName(r.name)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                            {t("common.delete")}
                          </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
      </>
    ) : (
      <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {recipients.map((r) => (
    <div
  key={r.name}
  className="relative bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-primary/20 transition cursor-pointer"
  onClick={() => openViewDialog(r)}
>

  {/* ✅ ACTION MENU TOP RIGHT */}
  <div
    className="absolute top-2 right-2"
    onClick={(e) => e.stopPropagation()}
  >
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openViewDialog(r)}>
          <Eye className="h-4 w-4 mr-2" />
          {t("common.view")}
        </DropdownMenuItem>

        {!isEventCoordinator || isAdmin || isEventManager ? (
          <DropdownMenuItem
            onClick={() => navigate(`/recipients/edit/${r.name}`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            {t("common.edit")}
          </DropdownMenuItem>
        ) : null}

        {(isAdmin || isEventManager) && (
          <DropdownMenuItem
            onClick={() => setDeleteRecipientName(r.name)}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("common.delete")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  {/* CONTENT */}
  <div className="space-y-2 pr-8">
    <p className="font-semibold">{r.owner_full_name}</p>

    <p className="text-sm text-muted-foreground">
      {(r as any).coordinator_full_name || "-"}
    </p>

    <div className="text-xs text-muted-foreground">
      {(r as any).coordinator_email || ""}
      {(r as any).coordinator_mobile_no && (
        <div>{(r as any).coordinator_mobile_no}</div>
      )}
    </div>
  </div>

</div>
  ))}
</div>)}
          {!isLoading && recipients.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              showItemCount={false}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(items) => {
                setItemsPerPage(items);
                setCurrentPage(1);
              }}
            />
          )}
        </CardContent>
      </Card>
      <GuestDetailDialog
        open={viewDialogOpen}
        onOpenChange={(open) => {
          setViewDialogOpen(open);
          if (!open) setViewingRecipient(null);
        }}
        recipient={viewingRecipient}
        title={t("recipients.titles.details")}
        onEdit={(recipientName) => {
          setViewDialogOpen(false);
          setViewingRecipient(null);
          if (!isEventCoordinator || isAdmin || isEventManager) {
            navigate(`/recipients/edit/${recipientName}`);
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteRecipientName} onOpenChange={(open) => !open && setDeleteRecipientName(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("recipients.messages.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("recipients.messages.deleteWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteRecipientName) {
                  deleteMutation.mutate(deleteRecipientName);
                  setDeleteRecipientName(null);
                }
              }}
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