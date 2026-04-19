/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Edit,
  Calendar,
  MapPin,
  Users,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Bell,
  Tag,
  Gift,
  UserPlus,
  MoreVertical,
  Search,
  X,
  Upload,
  CheckCircle2,
  Clock,
  MailOpen,
  BookOpen,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CategoryAPI,
  EventAPI,
  FileAPI,
  GiftAPI,
  GiftRecipientAPI,
} from "@/services/api";
import { format } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AccordionSection } from "@/components/ui/accordian-section";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import { AddGuestSheet } from "@/components/guest/AddGuestSheet";
import { AddGiftSheet } from "@/components/gift/AddGiftSheet";
import { AssignGuestModal } from "@/components/guest/AssingGuestModal";
import { GuestDetailDialog } from "@/components/guest/GuestDetailDialog";
import { UserAPI } from "@/services/api";
import { getEventStatusColor, getStatusColor } from "@/lib/statusColors";
import { Pagination } from "@/components/Pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDate, formatDateTime, formatTime } from "@/lib/i18n";
import { useRole } from "@/contexts/RoleContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Argentina",
  "Australia",
  "Austria",
  "Bahrain",
  "Bangladesh",
  "Belgium",
  "Brazil",
  "Canada",
  "China",
  "Denmark",
  "Egypt",
  "France",
  "Germany",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Italy",
  "Japan",
  "Jordan",
  "Kuwait",
  "Lebanon",
  "Malaysia",
  "Mexico",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Oman",
  "Pakistan",
  "Palestine",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Russia",
  "Saudi Arabia",
  "Singapore",
  "South Africa",
  "South Korea",
  "Spain",
  "Sweden",
  "Switzerland",
  "Syria",
  "Thailand",
  "Turkey",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Yemen",
];

// ─── Accordion Section ─────────────────────────────────────────────
interface AccordionItem {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  content: React.ReactNode;
}

// ─── Avatar ─────────────────────────────────────────────────────────
function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const colors = [
    "bg-orange-400",
    "bg-blue-400",
    "bg-green-400",
    "bg-purple-400",
    "bg-pink-400",
  ];
  const idx = name.charCodeAt(0) % colors.length;
  const sz = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";

  return (
    <div
      className={`${sz} ${colors[idx]} rounded-full flex items-center justify-center text-white font-semibold`}
    >
      {initials}
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-green-100 text-green-700 border-green-200",
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    invited: "bg-gray-100 text-gray-600 border-gray-200",
    draft: "bg-gray-100 text-gray-700 border-gray-200",
    published: "bg-green-100 text-green-700 border-green-200",
  };

  const key = status.toLowerCase();
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${map[key] || "bg-gray-100 text-gray-600 border-gray-200"}`}
    >
      {status}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function EventDetail() {
  const [openAccordion, setOpenAccordion] = useState<string>("eventDetails");
  // Add these states at the top with your other useState declarations
  const [selectedGifts, setSelectedGifts] = useState<string[]>([]);
  const [selectedGuests, setSelectedGuests] = useState<string[]>([]);

  // Add these handler functions
  const handleSelectAllGifts = (checked: boolean) => {
    if (checked) {
      setSelectedGifts(gifts.map((gift: any) => gift.name || gift.gift));
    } else {
      setSelectedGifts([]);
    }
  };

  const handleSelectGift = (giftId: string, checked: boolean) => {
    if (checked) {
      setSelectedGifts((prev) => [...prev, giftId]);
    } else {
      setSelectedGifts((prev) => prev.filter((id) => id !== giftId));
    }
  };

  const handleSelectAllGuests = (checked: boolean) => {
    if (checked) {
      setSelectedGuests(selectableGuestIds);
    } else {
      setSelectedGuests([]);
    }
  };

  const handleSelectGuest = (guestId: string, checked: boolean) => {
    if (checked) {
      setSelectedGuests((prev) => [...prev, guestId]);
    } else {
      setSelectedGuests((prev) => prev.filter((id) => id !== guestId));
    }
  };

  const handleDeleteSelectedGifts = async () => {
    if (!eventName) return;

    // Only unassign selected gifts, not all gifts
    const giftIds = selectedGifts;
    const cleanGiftIds: string[] = Array.from(
      new Set((giftIds || []).filter(Boolean).map((x: any) => String(x))),
    );
    
    if (cleanGiftIds.length === 0) {
      toast.error(t("events.noGiftsToUnassign"));
      return;
    }

    const bulkResult = await EventAPI.removeGiftsFromEvent(
      String(eventName),
      cleanGiftIds,
    );

    if (!bulkResult?.success) {
      toast.error(bulkResult?.error || t("common.error"));
      return;
    }

    const failedRows = Array.isArray((bulkResult as any)?.data?.failed)
      ? (bulkResult as any).data.failed
      : [];
    const failed = failedRows.length;
    const deliveredErrorCount = failedRows.filter((row: any) =>
      String(row?.error || "").includes("Cannot unassign delivered gifts"),
    ).length;

    queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["event-gifts", eventName] });
    queryClient.invalidateQueries({ queryKey: ["gift-events"] });
    queryClient.invalidateQueries({ queryKey: ["gift-detail"] });
    queryClient.invalidateQueries({ queryKey: ["gifts"] });
    setSelectedGifts([]);

    if (failed > 0) {
      if (deliveredErrorCount > 0) {
        // Show specific error for delivered gifts
        toast.error(t("events.cannotUnassignDeliveredGifts"), {
          duration: 5000,
          className: "bg-red-50 text-red-700",
        });
      } else {
        // Show general error for other failures
        toast.error(t("common.error"));
      }
    } else {
      toast.success(t("common.unAssignGiftsMessage"));
    }
  };

  const handleDeleteSelectedGuests = async () => {
    if (!eventName) return;

    // Only unassign selected guests, not all guests
    const guestIds = selectedGuests;

    const cleanGuestIds = Array.from(
      new Set((guestIds || []).filter(Boolean).map(String)),
    );

    if (cleanGuestIds.length === 0) {
      toast.error(t("events.noGuestsToUnassign"));
      return;
    }

    const bulkResult = await EventAPI.removeParticipantsFromEvent(
      String(eventName),
      cleanGuestIds,
    );

    if (!bulkResult?.success) {
      toast.error(bulkResult?.error || t("common.error"));
      return;
    }

    const failed = Array.isArray((bulkResult as any)?.data?.failed)
      ? (bulkResult as any).data.failed.length
      : 0;

    queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
    queryClient.invalidateQueries({ 
      queryKey: ["event-participants"],
    });
    setSelectedGuests([]);

    if (failed > 0) {
      toast.error(t("common.error"));
    } else {
      toast.success(t("common.unAssignGuestsMessage"));
    }
  };

  const { t } = useTranslation();
  const { isAdmin, isEventManager, isEventCoordinator } = useRole();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [participantSearch, setGuestSearch] = useState("");
  const [participantLimit, setParticipantLimit] = useState(20);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [viewGuestDialogOpen, setViewGuestDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<"gifts" | "guests" | null>(
    null,
  );
  const [participantAccordion, setGuestAccordion] = useState<string[]>([
    "basic",
  ]);
  const [giftAccordion, setGiftAccordion] = useState<string[]>(["basic"]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [assignGuestModalOpen, setAssignGuestModalOpen] = useState(false);
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  const [addGuestSheetOpen, setAddGuestSheetOpen] = useState(false);
  const [managerSelectValue, setManagerSelectValue] = useState("");
  const [coordinatorSelectValue, setCoordinatorSelectValue] = useState("");

  const [pendingManagers, setPendingManagers] = useState<any[]>([]);
  const [pendingCoordinators, setPendingCoordinators] = useState<any[]>([]);
  const [giftSearch, setGiftSearch] = useState("");
  const [giftPage, setGiftPage] = useState(1);
  const [giftLimit, setGiftLimit] = useState(20);
  const [participantPage, setParticipantPage] = useState(1);
  // ── Fetch event ────────────────────────────────────────────────────────────
  const {
    data: event,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["event-detail", id],
    queryFn: async () => {
      if (!id) throw new Error("No event ID");
      const res = await EventAPI.getWithCounts(id, false);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!id,
  });

  const eventName = (event as any)?.name as string | undefined;
  const [deleteEventDialogOpen, setDeleteEventDialogOpen] = useState(false);
  const { data: participantsRes, isLoading: participantsLoading } = useQuery({
    queryKey: [
      "event-participants",
      eventName,
      participantSearch,
      participantPage,
      participantLimit,
    ],
    queryFn: async () => {
      if (!eventName) throw new Error("No event name");
      const res = await EventAPI.listEventParticipants(
        eventName,
        participantSearch,
        participantPage,
        participantLimit,
      );
      if (!res.success) throw new Error(res.error);
      return res;
    },
    enabled: !!eventName,
  });

  const { data: giftsRes, isLoading: giftsLoading } = useQuery({
    queryKey: ["event-gifts", eventName, giftSearch, giftPage, giftLimit],
    queryFn: async () => {
      if (!eventName) throw new Error("No event name");
      const res = await EventAPI.listEventGifts(eventName, giftSearch, giftPage, giftLimit);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    enabled: !!eventName,
  });

  const statusColors: Record<string, string> = {
    Open: "bg-blue-500 text-white dark:bg-blue-600",
    Planned: "bg-orange-500 text-white dark:bg-blue-600",
    Completed: "bg-green-500 text-white dark:bg-green-600",
    Draft: "bg-gray-500 text-white dark:bg-gray-600",
    Cancelled: "bg-red-500 text-white dark:bg-red-600",
    Active: "bg-blue-500 text-white dark:bg-blue-600",
  };
  const { data: giftCategories = [] } = useQuery({
    queryKey: ["gift-categories"],
    queryFn: async () => {
      const result = await CategoryAPI.list();
      return result.success ? result.data || [] : [];
    },
  });

  const { data: selectedGuest, isLoading: isLoadingSelectedGuest } = useQuery({
    queryKey: ["gift-recipient", selectedGuestId],
    queryFn: async () => {
      if (!selectedGuestId) return null;
      const res = await GiftRecipientAPI.get(selectedGuestId);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: Boolean(selectedGuestId),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!eventName) throw new Error("No event");
      const res = await EventAPI.update(eventName, { status: "Active" } as any);
      if (!res.success) throw new Error(res.error || "Failed to publish event");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["gift-events"] });
      toast.success(t("events.eventUpdated"));
    },
    onError: (e: any) =>
      toast.error(String(e?.message || e || t("events.failedToSaveEvent"))),
  });

  const { data: eventTeamUsersRaw = [], isLoading: usersLoading } = useQuery({
    queryKey: ["event-team-users"],
    queryFn: async () => {
      const res = await UserAPI.listEventTeamUsers();
      return res.success ? res.data || [] : [];
    },
  });

  const userOptions: SearchableSelectOption[] = useMemo(() => {
    return (eventTeamUsersRaw || []).map((u: any) => ({
      value: u.name,
      label: u.full_name || u.email || u.name,
      sublabel: u.email || undefined,
    }));
  }, [eventTeamUsersRaw]);

  const managerUserOptions: SearchableSelectOption[] = useMemo(() => {
    return (eventTeamUsersRaw || [])
      .filter((u: any) => (u.roles || []).some((r: any) => r.role === "Event Manager"))
      .map((u: any) => ({
        value: u.name,
        label: u.full_name || u.email || u.name,
        sublabel: u.email || undefined,
      }));
  }, [eventTeamUsersRaw]);

  const coordinatorUserOptions: SearchableSelectOption[] = useMemo(() => {
    return (eventTeamUsersRaw || [])
      .filter((u: any) =>
        (u.roles || []).some(
          (r: any) => r.role === "Event Manager" || r.role === "Event Coordinator",
        ),
      )
      .map((u: any) => ({
        value: u.name,
        label: u.full_name || u.email || u.name,
        sublabel: u.email || undefined,
      }));
  }, [eventTeamUsersRaw]);

  const selectedTeamUserIds = useMemo(() => {
    const ids = new Set<string>();
    (pendingManagers || []).forEach(
      (m: any) => m?.user && ids.add(String(m.user)),
    );
    (pendingCoordinators || []).forEach(
      (m: any) => m?.user && ids.add(String(m.user)),
    );
    return ids;
  }, [pendingManagers, pendingCoordinators]);

  const saveTeamMutation = useMutation({
    mutationFn: async () => {
      if (!eventName) throw new Error("No event");

      const cleanManagers = (pendingManagers || []).filter((m: any) =>
        Boolean(m?.user),
      );
      const cleanCoordinators = (pendingCoordinators || []).filter((m: any) =>
        Boolean(m?.user),
      );

      const payload: any = {
        event_managers: cleanManagers.map((m: any, idx: number) => ({
          idx: idx + 1,
          doctype: "Event Team Member",
          parenttype: "Gift Event",
          parentfield: "event_managers",
          user: m.user,
        })),
        event_coordinators: cleanCoordinators.map((m: any, idx: number) => ({
          idx: idx + 1,
          doctype: "Event Team Member",
          parenttype: "Gift Event",
          parentfield: "event_coordinators",
          user: m.user,
        })),
      };

      const res = await EventAPI.update(eventName, payload);
      if (!res.success) throw new Error(res.error || "Failed to update team");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
      setTeamSheetOpen(false);
      toast.success(t("events.eventUpdated"));
    },
    onError: (e: any) =>
      toast.error(String(e?.message || e || t("events.failedToSaveEvent"))),
  });

  const participants = useMemo(() => {
    if (!Array.isArray((participantsRes as any)?.data)) return [];
    return (participantsRes as any).data;
  }, [participantsRes]);

  const participantsCount = Number((participantsRes as any)?.total || participants.length || 0);

  const selectableGuestIds = useMemo(() => {
    return (participants || [])
      .filter((p: any) => Number(p?.issued_gifts_count || 0) <= 0)
      .map((p: any) => String(p?.gift_recipient || p?.recipient || ""))
      .filter(Boolean);
  }, [participants]);

  const gifts = useMemo(() => {
    if (!Array.isArray((giftsRes as any)?.data)) return [];
    return (giftsRes as any).data;
  }, [giftsRes]);
  const giftsCount = Number((giftsRes as any)?.total || 0);
  const pagedGifts = gifts;

  const getGiftStatus = (gift: any) =>
    String(gift?.display_status || gift?.status || "").trim();

  const isGiftDelivered = (gift: any) =>
    getGiftStatus(gift).toLowerCase() === "delivered";

  const allEventParticipants = useMemo(() => {
    return Array.isArray((event as any)?.event_participants)
      ? ((event as any).event_participants as any[])
      : [];
  }, [event]);

  const hasDeliveredAssignedGifts = useMemo(() => {
    const allEventGifts = Array.isArray((event as any)?.event_gifts)
      ? ((event as any).event_gifts as any[])
      : [];
    return allEventGifts.some(
      (g: any) =>
        String(g?.display_status || g?.status || "").toLowerCase() === "delivered",
    );
  }, [event]);

  const selectedGiftRows = useMemo(() => {
    const selectedSet = new Set((selectedGifts || []).map(String));
    return (gifts || []).filter((row: any) =>
      selectedSet.has(String(row?.name || row?.gift || "")),
    );
  }, [gifts, selectedGifts]);

  const highRiskGiftCount = useMemo(() => {
    return selectedGiftRows.filter((row: any) => {
      const rawStatus = getGiftStatus(row);
      return ["Reserved", "Issued", "In Transit", "Delivered"].includes(rawStatus);
    }).length;
  }, [selectedGiftRows]);

  const selectedGuestRows = useMemo(() => {
    const selectedSet = new Set((selectedGuests || []).map(String));
    return (participants || []).filter((row: any) =>
      selectedSet.has(String(row?.gift_recipient || row?.recipient || "")),
    );
  }, [participants, selectedGuests]);

  const highRiskGuestCount = useMemo(() => {
    return selectedGuestRows.filter((row: any) => {
      const interested = Number(row?.interested_gifts_count || 0);
      const issued = Number(row?.issued_gifts_count || 0);
      return interested > 0 || issued > 0;
    }).length;
  }, [selectedGuestRows]);

  const confirmSubtitleText = useMemo(() => {
    if (confirmType === "gifts") {
      const base = t("confirm.deleteGifts.subtitle", { count: selectedGifts.length });
      if (!highRiskGiftCount) return base;
      return `${base} Warning: ${highRiskGiftCount} selected gift(s) are reserved/allocated. Continuing will remove related interests, allocation requests, and allocations from this event.`;
    }

    if (confirmType === "guests") {
      const base = t("confirm.deleteGuests.subtitle", { count: selectedGuests.length });
      if (!highRiskGuestCount) return base;
      return `${base} Warning: ${highRiskGuestCount} selected guest(s) have active interests or allocation activity. Continuing will remove those links from this event.`;
    }

    return "";
  }, [
    confirmType,
    highRiskGiftCount,
    highRiskGuestCount,
    selectedGifts.length,
    selectedGuests.length,
    t,
  ]);

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="p-8 space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            {String(error || t("events.failedToLoadEvents"))}
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => navigate("/events")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common.back")}
        </Button>
      </div>
    );
  }

  const handleDeleteEvent = async () => {
    if (!eventName) return;

    try {
      const res = await EventAPI.delete(eventName);
      if (res.success) {
        toast.success(t("events.eventDeleted"));
        navigate("/events");
      } else {
        toast.error(res.error || t("common.error"));
      }
    } catch (error) {
      toast.error(t("common.error"));
    }
  };
  // ── Derived data ───────────────────────────────────────────────────────────
  const managers = (event as any).event_managers || [];
  const coordinators = (event as any).event_coordinators || [];
  const categories = (event as any).event_categories || [];

  const eventStatus = String((event as any)?.status || "Draft");
  const canPublish = eventStatus.trim().toLowerCase() === "draft";

  // const formatDate = (v?: string) => {
  //   if (!v) return "-";
  //   try {
  //     return format(new Date(v), "MMMM d, yyyy");
  //   } catch {
  //     return v;
  //   }
  // };
  // const formatTime = (v?: string) => {
  //   if (!v) return "";
  //   try {
  //     return format(new Date(v), "h:mm a");
  //   } catch {
  //     return "";
  //   }
  // };

  const locationParts = [
    (event as any).address_line_1,
    (event as any).address_line_2,
    event.city,
    event.state,
    (event as any).postal_code,
    event.country,
  ].filter(Boolean);

  // Mock readiness for now (API doesn't expose it)
  const readiness = 85;

  return (
    <div className="min-h-svh bg-background">
      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-10 bg-background border-b border-border py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* <button
            onClick={() => navigate("/events")}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button> */}
          <div>
            <div className="flex items-center gap-2"></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(isAdmin || isEventManager) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(isAdmin || isEventManager) && canPublish && (
                  <DropdownMenuItem
                    onClick={() => publishMutation.mutate()}
                    disabled={publishMutation.isPending}
                    className="cursor-pointer"
                  >
                    <BarChart2 className="h-4 w-4 mr-2" />
                    {t("events.publish")}
                  </DropdownMenuItem>
                )}

                {(isAdmin || isEventManager) && eventStatus !== "Completed" && (
                  <DropdownMenuItem asChild>
                    <Link
                      to={`/events/${encodeURIComponent(event.name)}/edit`}
                      className="cursor-pointer"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {t("events.editEvent")}
                    </Link>
                  </DropdownMenuItem>
                )}

                {(isAdmin || isEventManager) && (
                  <>
                    {(canPublish || eventStatus !== "Completed") && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={() => {
                        if (hasDeliveredAssignedGifts) {
                          toast.error(
                            t("events.cannotDeleteEventWithDeliveredAssociations"),
                            {
                              description: t(
                                "events.cannotDeleteEventWithDeliveredAssociationsDesc",
                              ),
                              duration: 5000,
                              className: "bg-red-50 text-red-700",
                            },
                          );
                        } else if (giftsCount > 0 || participantsCount > 0) {
                          toast.error(t("events.cannotDeleteEventWithAssociations"), {
                            description: t("events.unassignGuestsAndGiftsFirst"),
                            duration: 5000,
                            className: "bg-red-50 text-red-700",
                          });
                        } else {
                          setDeleteEventDialogOpen(true);
                        }
                      }}
                      className="text-destructive focus:text-destructive cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t("confirm.deleteEvent.title")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="py-5 mx-auto">
        <div className="flex flex-col lg:flex-row gap-5">
          {/* ── Left Column ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Event Details section */}
            <AccordionSection
              icon={<BookOpen className="h-4 w-4" />}
              title={t("events.eventDetails")}
              badge={
                <Badge className={getEventStatusColor(event?.status)}>
                  {event?.status}
                </Badge>
              }
              defaultOpen={true}
            >
              <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    {t("events.eventName")}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {(event as any).subject || event.name}
                  </p>
                  <div className="mt-2 flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {locationParts.length
                          ? locationParts.join(", ")
                          : t("events.noLocationSet")}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    {t("events.dateTime")}
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t("events.startLabel")}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                         {formatDateTime((event as any).starts_on)}
                        </p>
                      </div>
                    </div>

                    {(event as any).ends_on && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("events.endLabel")}
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {formatDateTime((event as any).ends_on)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </AccordionSection>

            {/* Guest Experience Team section */}
            <AccordionSection
              icon={<Users className="h-4 w-4" />}
              title={t("events.guestExperienceTeam")}
              badge={
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  {managers.length + coordinators.length}
                </Badge>
              }
            >
              <div className="px-5 py-4 space-y-4">
                {managers.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                      • {t("events.approvers")}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-3">
                      {managers.map((m: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border bg-blue-50/50 dark:bg-blue-950/20"
                        >
                          <Avatar name={m.full_name || "User"} />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {m.full_name || "-"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {m.email ||
                                `${(m.user_name || m.user || "")
                                }`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {coordinators.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                      • {t("events.experienceTeam")}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-3">
                      {coordinators.map((c: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border bg-green-50/50 dark:bg-green-950/20"
                        >
                          <Avatar name={c.full_name  || "User"} />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {c.full_name || "-"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {c.email ||
                                `${(c.user_name || c.user || "")
                                }`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {managers.length === 0 && coordinators.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("events.noTeamMembersAssigned")}
                  </p>
                )}

                {(isAdmin || isEventManager) && (
                <button
                  type="button"
                  onClick={() => {
                    setPendingManagers([...(managers || [])]);
                    setPendingCoordinators([...(coordinators || [])]);
                    setManagerSelectValue("");
                    setCoordinatorSelectValue("");
                    setTeamSheetOpen(true);
                  }}
                  className="text-xs text-primary font-medium hover:underline flex justify-end w-max ml-auto m-3 items-center gap-1 mt-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("events.editGuestExperienceTeam")}
                </button>
                )}
              </div>
            </AccordionSection>

            <Sheet open={teamSheetOpen} onOpenChange={setTeamSheetOpen}>
              <SheetContent
                side="right"
                className="w-full sm:max-w-lg overflow-y-auto"
              >
                <SheetHeader>
                  <SheetTitle>{t("events.editGuestExperienceTeam")}</SheetTitle>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">
                      {t("events.approvers")}
                    </h4>

                    <SearchableSelect
                      value={managerSelectValue}
                      onValueChange={(userId) => {
                        if (!userId) return;
                        if (
                          (pendingManagers || []).some(
                            (m: any) => m?.user === userId,
                          )
                        )
                          return;
                        setPendingManagers((prev) => [
                          ...(prev || []),
                          { user: userId },
                        ]);
                        setManagerSelectValue(""); // Reset the select after adding
                      }}
                      options={managerUserOptions.filter(
                        (opt) =>
                          !selectedTeamUserIds.has(String(opt.value)),
                      )}
                      placeholder={t("events.addApproverPlaceholder")}
                      searchPlaceholder={t("events.searchUser")}
                      emptyMessage={t("common.noResults")}
                      isLoading={usersLoading}
                    />

                    {pendingManagers.length > 0 && (
                      <div className="space-y-2">
                        {pendingManagers.map((m: any) => {
                          // Find the user details from userOptions
                          const userDetail = userOptions.find(u => u.value === m.user);
                          return (
                          <div
                            key={m.user}
                            className="flex items-center justify-between gap-2 border border-border rounded-xl px-3 py-2"
                          >
                            <div className="flex flex-col truncate">
                              <span className="text-sm text-foreground truncate">
                                {m.full_name || userDetail?.label || m.user}
                              </span>
                              {userDetail?.sublabel && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {userDetail.sublabel}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setPendingManagers((prev) =>
                                  (prev || []).filter(
                                    (x: any) => x?.user !== m.user,
                                  ),
                                )
                              }
                              className="text-xs text-destructive"
                            >
                              {t("common.remove")}
                            </button>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">
                      {t("events.experienceTeam")}
                    </h4>
                    <SearchableSelect
                      value={coordinatorSelectValue}
                      onValueChange={(userId) => {
                        if (!userId) return;
                        if (
                          (pendingCoordinators || []).some(
                            (m: any) => m?.user === userId,
                          )
                        )
                          return;
                        setPendingCoordinators((prev) => [
                          ...(prev || []),
                          { user: userId },
                        ]);
                        setCoordinatorSelectValue(""); // Reset the select after adding
                      }}
                      options={coordinatorUserOptions.filter(
                        (u) => !selectedTeamUserIds.has(String(u.value)),
                      )}
                      placeholder={t("events.addTeamMemberPlaceholder")}
                      searchPlaceholder={t("events.searchUser")}
                      emptyMessage={t("common.noResults")}
                      isLoading={usersLoading}
                    />

                    {pendingCoordinators.length > 0 && (
                      <div className="space-y-2">
                        {pendingCoordinators.map((m: any) => {
                          // Find the user details from userOptions
                          const userDetail = userOptions.find(u => u.value === m.user);
                          return (
                          <div
                            key={m.user}
                            className="flex items-center justify-between gap-2 border border-border rounded-xl px-3 py-2"
                          >
                            <div className="flex flex-col truncate">
                              <span className="text-sm text-foreground truncate">
                                {m.full_name || userDetail?.label || m.user}
                              </span>
                              {userDetail?.sublabel && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {userDetail.sublabel}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setPendingCoordinators((prev) =>
                                  (prev || []).filter(
                                    (x: any) => x?.user !== m.user,
                                  ),
                                )
                              }
                              className="text-xs text-destructive"
                            >
                              {t("common.remove")}
                            </button>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setTeamSheetOpen(false)}
                      disabled={saveTeamMutation.isPending}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => saveTeamMutation.mutate()}
                      disabled={saveTeamMutation.isPending}
                    >
                      {t("common.save")}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            {/* Gifts */}
            <AccordionSection
              icon={<Gift className="h-4 w-4" />}
              title={t("events.gifts")}
              badge={
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  {giftsCount}
                </Badge>
              }
              // badge={
              //   <AddGiftSheet eventName={eventName}>
              //     <button className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
              //       <Plus className="h-3.5 w-3.5" />
              //       {t("events.addGift")}
              //     </button>
              //   </AddGiftSheet>
              // }
            >
              {giftsLoading || giftsCount > 0 || giftSearch ? (
                <div className="px-5 py-2">
                  {/* Gift Search */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder={t("common.search")}
                      value={giftSearch}
                      onChange={(e) => {
                        setGiftSearch(e.target.value);
                        setGiftPage(1);
                        setSelectedGifts([]);
                      }}
                      className="pl-9 pr-9 h-9 text-sm"
                    />
                    {giftSearch && (
                      <button
                        type="button"
                        onClick={() => { setGiftSearch(""); setGiftPage(1); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {giftsLoading && (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                  )}
                  {!giftsLoading && (
                  <div className="overflow-x-auto -mx-5 px-5">
                    <table className="min-w-[600px] w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="">
                          {(isAdmin || isEventManager || isEventCoordinator) && (
                            <Checkbox
                              checked={
                                pagedGifts.filter((g) => !isGiftDelivered(g)).length > 0 &&
                                pagedGifts.filter((g) => !isGiftDelivered(g)).every(g => 
                                  selectedGifts.includes(g.name || g.gift)
                                )
                              }
                              onCheckedChange={(checked) => {
                                const pageSelectableGiftIds = pagedGifts
                                  .filter((g) => !isGiftDelivered(g))
                                  .map((g: any) => g.name || g.gift)
                                  .filter(Boolean);
                                if (checked) {
                                  setSelectedGifts((prev) =>
                                    Array.from(
                                      new Set([...prev, ...pageSelectableGiftIds]),
                                    ),
                                  );
                                } else {
                                  setSelectedGifts((prev) =>
                                    prev.filter(
                                      (id) => !pageSelectableGiftIds.includes(id),
                                    ),
                                  );
                                }
                              }}
                              aria-label="Select all gifts"
                            />
                          )}
                        </th>
                        <th className="text-left py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("common.name")}
                        </th>
                        <th className="text-left py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("common.category")}
                        </th>
                        <th className="text-left py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("common.status")}
                        </th>
                        <th className="text-left py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("events.barcodeValue")}
                        </th>
                        <th className="text-left py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("gift.labels.uaeRing")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pagedGifts.map((gift: any) => (
                        <tr
                          key={gift.name || gift.gift}
                          onClick={() => {
                            const giftId = gift.gift || gift.name;
                            if (!giftId) return;
                            navigate(`/gifts/${giftId}`);
                          }}
                          className={`hover:bg-muted/30 cursor-pointer transition-colors ${
                            selectedGifts.includes(gift.name || gift.gift)
                              ? "bg-muted/50"
                              : ""
                          }`}
                        >
                          <td
                            className="py-3 w-10 pl-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Only show checkbox for non-delivered gifts and admin/manager/coordinator */}
                            {!isGiftDelivered(gift) && (isAdmin || isEventManager || isEventCoordinator) && (
                              <Checkbox
                                checked={selectedGifts.includes(gift.name || gift.gift)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedGifts((prev) => [
                                      ...new Set([...prev, gift.name || gift.gift]),
                                    ]);
                                  } else {
                                    setSelectedGifts((prev) =>
                                      prev.filter((id) => id !== (gift.name || gift.gift)),
                                    );
                                  }
                                }}
                                aria-label={`Select gift ${gift.gift_name}`}
                              />
                            )}
                            {isGiftDelivered(gift) && (
                              <div className="w-4 h-4 flex items-center justify-center text-xs text-muted-foreground">
                                ✓
                              </div>
                            )}
                          </td>
                          <td className="py-3">
                            <p className="text-sm font-medium text-foreground">
                              {gift.gift_name || gift.gift}
                            </p>
                          </td>
                          <td className="py-3">
                            <p className="text-xs text-muted-foreground">
                              {gift.category || "-"}
                            </p>
                          </td>
                          <td className="py-3">
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(getGiftStatus(gift) || "Available")}`}>
                              {getGiftStatus(gift) === "Issued" ? "Allocated" : (getGiftStatus(gift) || "Available")}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                              {gift.barcode_value || "-"}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                              {gift.uae_ring_number || "-"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>
                  )}

                  {/* Pagination and Delete All */}
                  <div className="flex lg:flex-row flex-col gap-3 items-center justify-between pt-4 border-t border-border mt-2">
                    <div className="flex items-center gap-2">
                      {/* {selectedGifts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-destructive text-destructive text-xs"
              onClick={() => {
                // Add your delete selected gifts logic here
                console.log("Delete gifts:", selectedGifts);
                setSelectedGifts([]);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {t("common.deleteSelected", { count: selectedGifts.length })}
            </Button>
          )} */}
                      {(isAdmin || isEventManager || isEventCoordinator) && selectedGifts.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-destructive mr-3 hover:text-destructive text-destructive text-xs"
                          onClick={() => {
                            setConfirmType("gifts");
                            setConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          {t("common.unAssignSelectedGifts", { 
                            count: selectedGifts.filter(giftId => {
                              const gift = gifts.find(g => (g.name || g.gift) === giftId);
                              return gift && !isGiftDelivered(gift);
                            }).length 
                          })}
                        </Button>
                      )}
                    </div>

                    <div className="flex lg:flex-row flex-col items-center gap-4">
                      <p className="text-xs text-muted-foreground">
                        {t("events.showing")} {pagedGifts.length}{" "}
                        {t(giftsCount === 1 ? "events.gift" : "events.gifts")}
                        {selectedGifts.length > 0 &&
                          ` • ${selectedGifts.length} selected`}
                      </p>
                      <Pagination
                        currentPage={giftPage}
                        totalPages={Math.ceil(giftsCount / giftLimit)}
                        totalItems={giftsCount}
                        itemsPerPage={giftLimit}
                        onPageChange={setGiftPage}
                        onItemsPerPageChange={(items) => {
                          setGiftLimit(items);
                          setGiftPage(1);
                          setSelectedGifts([]); // Clear selection on page change
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <Gift className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    {t("events.noGifts")}
                  </p>
                  {/* <p className="text-xs text-muted-foreground mb-4">
                    {t("common.addGift")}
                  </p> */}
                  <AddGiftSheet eventName={eventName}>
                    <Button size="sm">
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      {t("events.addGift")}
                    </Button>
                  </AddGiftSheet>
                </div>
              )}
            </AccordionSection>

            {/* Guests */}
            <AccordionSection
              icon={<Users className="h-4 w-4" />}
              title={t("nav.recipients")}
              badge={
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  {participantsCount}
                </Badge>
              }
              // badge={
              //   <button
              //     onClick={() => setAddGuestSheetOpen(true)}
              //     className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
              //   >
              //     <Plus className="h-3.5 w-3.5" />
              //     {t("recipients.buttons.addGuest")}
              //   </button>
              // }
            >
              <div className="px-5 py-4">
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={t("common.search")}
                    value={participantSearch}
                    onChange={(e) => {
                      setGuestSearch(e.target.value);
                      setParticipantPage(1);
                      setSelectedGuests([]);
                    }}
                    className="pl-9 pr-9 h-9 text-sm"
                  />
                  {participantSearch && (
                    <button
                      type="button"
                      onClick={() => { setGuestSearch(""); setParticipantPage(1); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {participantsLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                )}

                {!participantsLoading && participants.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-[700px] w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="">
                            {(isAdmin || isEventManager || isEventCoordinator) && (
                              <Checkbox
                                checked={
                                  selectableGuestIds.length > 0 &&
                                  selectableGuestIds.every((guestId) =>
                                    selectedGuests.includes(guestId),
                                  )
                                }
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedGuests(selectableGuestIds);
                                  } else {
                                    setSelectedGuests([]);
                                  }
                                }}
                                aria-label="Select all guests"
                              />
                            )}
                          </th>
                          <th className="text-left py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {t("recipients.guest")}
                          </th>
                          <th className="text-left py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {t("recipients.coordinator")}
                          </th>
                          <th className="text-left py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {t("common.status")}
                          </th>
                          <th className="text-left py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {t("recipients.coordinatorContact")}
                          </th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {participants.map((p: any) => {
                          const guestId = p.gift_recipient || p.recipient;
                          const canSelectGuest =
                            (isAdmin || isEventManager || isEventCoordinator) &&
                            Number(p?.issued_gifts_count || 0) <= 0;
                          return (
                            <tr
                              key={p.name}
                              onClick={() => {
                                setSelectedGuestId(String(guestId));
                                setViewGuestDialogOpen(true);
                              }}
                              className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                                selectedGuests.includes(guestId)
                                  ? "bg-muted/50"
                                  : ""
                              }`}
                            >
                              <td
                                className="py-3 w-10 pl-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {canSelectGuest && (
                                  <Checkbox
                                    checked={selectedGuests.includes(guestId)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedGuests((prev) => [
                                          ...new Set([...prev, guestId]),
                                        ]);
                                      } else {
                                        setSelectedGuests((prev) =>
                                          prev.filter((id) => id !== guestId),
                                        );
                                      }
                                    }}
                                    aria-label={`Select guest ${guestId}`}
                                  />
                                )}
                                {!canSelectGuest &&
                                  Number(p?.issued_gifts_count || 0) > 0 && (
                                    <div className="w-4 h-4 flex items-center justify-center text-xs text-muted-foreground">
                                      ✓
                                    </div>
                                  )}
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-3">
                                  <Avatar
                                    name={
                                      p.recipient_name || p.recipient || "Guest"
                                    }
                                    size="sm"
                                  />
                                  <div>
                                    <p className="text-sm font-medium text-foreground">
                                      {p.recipient_name || p.recipient}
                                    </p>
                                    {p.organization && (
                                      <p className="text-xs text-muted-foreground">
                                        {p.organization}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3">
                                <p className="text-xs text-muted-foreground">
                                  {p?.coordinator_name || "-"}
                                </p>
                              </td>
                              <td className="py-3">
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  p.issued_gifts_count > 0 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {p.issued_gifts_count > 0 ? "Has Gifts" : "Available"}
                                </span>
                              </td>
                              <td className="py-3">
                                <p className="text-xs text-muted-foreground">
                                  {p?.contact_number || "-"}
                                </p>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Pagination and Delete All */}
                    <div className="flex lg:flex-row flex-col gap-3 mt-2  items-center lg:justify-between pt-4 border-t border-border ">
                      <div className="flex items-center gap-2">
                        {/* {selectedGuests.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="border-destructive text-destructive text-xs"
                onClick={() => {
                  // Add your delete selected guests logic here
                  console.log("Delete guests:", selectedGuests);
                  setSelectedGuests([]);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t("common.deleteSelected", { count: selectedGuests.length })}
              </Button>
            )} */}
                        {(isAdmin || isEventManager || isEventCoordinator) && selectedGuests.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-destructive mr-3 hover:text-destructive text-destructive text-xs"
                            onClick={() => {
                              setConfirmType("guests");
                              setConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            {t("common.unAssignSelectedGuests", { count: selectedGuests.length })}
                          </Button>
                        )}
                      </div>

                      <div className="flex lg:flex-row flex-col items-center gap-4">
                        <p className="text-xs text-muted-foreground">
                          {t("events.showing")} {participants.length}{" "}
                          {t("common.guests")}
                          {selectedGuests.length > 0 &&
                            ` • ${selectedGuests.length} selected`}
                        </p>
                        <Pagination
                          currentPage={participantPage}
                          totalPages={Math.ceil(
                            participantsCount / participantLimit,
                          )}
                          totalItems={participantsCount}
                          itemsPerPage={participantLimit}
                          onPageChange={setParticipantPage}
                          onItemsPerPageChange={(items) => {
                            setParticipantLimit(items);
                            setParticipantPage(1);
                            setSelectedGuests([]); // Clear selection on page change
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!participantsLoading && participants.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      {t("events.noParticipants")}
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setAddGuestSheetOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      {t("common.addGuest")}
                    </Button>
                  </div>
                )}
              </div>
            </AccordionSection>

            <AddGuestSheet
              eventName={eventName}
              open={addGuestSheetOpen}
              onOpenChange={setAddGuestSheetOpen}
              onSuccess={() => {
                queryClient.invalidateQueries({
                  queryKey: [
                    "event-participants",
                    eventName,
                    participantSearch,
                    participantPage,
                    participantLimit,
                  ],
                });
                queryClient.invalidateQueries({
                  queryKey: ["event-detail", id],
                });
              }}
            >
              <span />
            </AddGuestSheet>

            <GuestDetailDialog
              open={viewGuestDialogOpen}
              onOpenChange={(open) => {
                setViewGuestDialogOpen(open);
                if (!open) setSelectedGuestId(null);
              }}
              recipient={selectedGuest}
              title={t("recipients.guestDetails")}
              onEdit={(recipientName) => {
                setViewGuestDialogOpen(false);
                setSelectedGuestId(null);
                navigate(`/recipients/edit/${recipientName}`);
              }}
            />
          </div>

          {/* ── Right Sidebar ── */}
          <div className="lg:w-[280px] xl:w-[300px] shrink-0 space-y-4">
            {/* Quick Actions Sidebar */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {t("common.quickActions")}
              </h3>

              <AddGuestSheet
                eventName={eventName}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["event-participants", eventName] });
                  queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
                }}
              >
                <button className="w-full flex lg:justify-start justify-center  items-center gap-3 px-4 py-3 rounded-lg border  transition-colors text-sm font-medium border-blue-600 hover:bg-blue-50 text-blue-600">
                  <UserPlus className="h-4 w-4" />
                  {t("common.addParticipant")}
                </button>
              </AddGuestSheet>

              <AddGiftSheet
                eventName={eventName}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["event-gifts", eventName] });
                  queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
                }}
              >
                <button className="w-full lg:justify-start justify-center  flex items-center gap-3 px-4 py-3 rounded-lg border border-border transition-colors text-sm font-medium border-emerald-600 hover:bg-emerald-50 text-emerald-600">
                  <Gift className="h-4 w-4" />
                  {t("events.addGift")}
                </button>
              </AddGiftSheet>
            </div>

            {/* Event Summary */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-primary">
                    {t("common.eventSummary")}
                  </h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {t("receivedGiftDetail.overview").toUpperCase()}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart2 className="h-4 w-4 text-primary" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-muted/50 border border-border p-3 text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    {t("nav.recipients").toUpperCase()}
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {participantsCount}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 border border-border p-3 text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    {t("nav.gifts").toUpperCase()}
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {giftsCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    
    
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (confirmType === "gifts") {
            handleDeleteSelectedGifts();
          } else if (confirmType === "guests") {
            handleDeleteSelectedGuests();
          }
          setConfirmOpen(false);
        }}
        title={
          confirmType === "gifts"
            ? t("confirm.deleteGifts.title")
            : t("confirm.deleteGuests.title")
        }
        subtitle={
          confirmSubtitleText
        }
        confirmText={
          confirmType === "gifts"
            ? t("common.unAssignSelectedGifts", { count: selectedGifts.length })
            : t("common.unAssignSelectedGuests", { count: selectedGuests.length })
        }
        cancelText={t("common.cancel")}
        variant="destructive"
      />

      {/* Delete Event Confirmation Dialog */}
      <ConfirmDialog
        open={deleteEventDialogOpen}
        onClose={() => setDeleteEventDialogOpen(false)}
        onConfirm={handleDeleteEvent}
        title={t("confirm.deleteEvent.title")}
        subtitle={t("confirm.deleteEvent.subtitle")}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        variant="destructive"
      />
    </div>
  );
}
