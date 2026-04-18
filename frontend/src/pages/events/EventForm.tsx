/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState, useEffect } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Save,
  Calendar,
  Users,
  Plus,
  Trash2,
  AlertCircle,
  Info,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Pagination } from "@/components/Pagination";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AddGiftSheet } from "@/components/gift/AddGiftSheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EventAPI, DocTypeAPI, GiftWizardAPI, UserAPI, type FrappeUser } from "@/services/api";
import { toast } from "sonner";
import type {
  GiftEvent,
  EventTeamMember,
  EventCategorySelection,
} from "@/types/event";
import { usePromptDialog } from "@/hooks/usePromptDialog";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import { useRole } from '@/contexts/RoleContext';

import { Checkbox } from "@/components/ui/checkbox"; // Assuming you have a Checkbox component

interface GiftsCheckboxTableProps {
  eligibleGifts: any[];
  queuedGiftAdds: string[];
  setQueuedGiftAdds: React.Dispatch<React.SetStateAction<string[]>>;
  id?: string;
  moveGiftMutation?: any;
}

export function GiftsCheckboxTable({
  eligibleGifts,
  queuedGiftAdds,
  setQueuedGiftAdds,
  id,
  moveGiftMutation,
}: GiftsCheckboxTableProps) {
  const { t } = useTranslation();

  const selectableNamesOnPage = useMemo(
    () => eligibleGifts.map((g) => g.name),
    [eligibleGifts],
  );

  const isAllSelectedOnPage = useMemo(() => {
    if (selectableNamesOnPage.length === 0) return false;
    return selectableNamesOnPage.every((n) => queuedGiftAdds.includes(n));
  }, [queuedGiftAdds, selectableNamesOnPage]);

  const toggleSelectAllOnPage = (checked: boolean) => {
    if (selectableNamesOnPage.length === 0) {
      return;
    }

    if (checked) {
      const set = new Set(queuedGiftAdds);
      for (const n of selectableNamesOnPage) set.add(n);
      setQueuedGiftAdds(Array.from(set));
    } else {
      setQueuedGiftAdds(
        queuedGiftAdds.filter((n) => !selectableNamesOnPage.includes(n)),
      );
    }
  };

  const toggleGift = (gift: any) => {
    const name = gift?.name;
    if (!name) return;

    setQueuedGiftAdds((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  return eligibleGifts?.length > 0 ? (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isAllSelectedOnPage}
            onCheckedChange={(checked) =>
              toggleSelectAllOnPage(Boolean(checked))
            }
            className="border-primary focus:ring-primary"
          />
          <span className="text-xs font-medium text-muted-foreground">
            {t("common.selectAll")}
          </span>
        </div>

        {queuedGiftAdds.length > 0 && (
          <span className="text-xs bg-blue-200 text-black rounded-lg font-medium px-2 py-1 ">
            {queuedGiftAdds.length} {t("common.selectedCount")}
          </span>
        )}
      </div>

      {/* Table wrapper with horizontal scroll */}
      <div className="overflow-x-auto">
        <table className="min-w-[600px] w-full text-sm border-collapse">
          {/* Column headers */}
          <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">{t("common.gift")}</th>
              <th className="text-left px-4 py-2">{t("common.category")}</th>
              <th className="text-center px-4 py-2">
                {t("gift.labels.uaeRing")}
              </th>
              <th className="text-right px-4 py-2">{t("common.status")}</th>
            </tr>
          </thead>

          {/* Rows */}
          <tbody>
            {eligibleGifts.map((g) => {
              const isChecked = queuedGiftAdds.includes(g.name);
              const isInThisEvent = Boolean(id) && g.event === id;

              return (
                <tr
                  key={g.name}
                  className="border-t border-border hover:bg-muted/20"
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isChecked || isInThisEvent}
                        onCheckedChange={() => toggleGift(g)}
                        disabled={isInThisEvent}
                        className="border-primary focus:ring-primary"
                      />
                      <span className="font-medium break-words">
                        {g.gift_name || g.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 truncate">{g.category || "-"}</td>
                  <td className="px-4 py-2 text-center truncate">
                    {g?.uae_ring_number || "-"}
                  </td>
                  <td className="px-4 py-2 text-right truncate">
                    {g?.status || "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {/* {eligibleGifts.length === 0 && (
    <div className="text-sm text-center py-12 text-muted-foreground">
      {t("common.noGiftsAdded")}
    </div>
  )} */}
    </div>
  ) : (
    <div className="text-sm text-center py-12 text-muted-foreground">
      {t("common.noGiftsAdded")}
    </div>
  );
}
// ─── Avatar helper ────────────────────────────────────────────────────────────
function TeamAvatar({
  name,
  size = "sm",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  const initials = (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const colors = [
    "bg-orange-400",
    "bg-blue-400",
    "bg-green-500",
    "bg-purple-400",
    "bg-pink-400",
    "bg-teal-400",
  ];
  const idx = (name || "").charCodeAt(0) % colors.length;
  const sz = size === "md" ? "w-8 h-8 text-sm" : "w-7 h-7 text-xs";
  return (
    <div
      className={`${sz} ${colors[idx]} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}
    >
      {initials}
    </div>
  );
}

const FALLBACK_COUNTRIES = [
  "United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Bahrain", "Oman",
  "United States", "United Kingdom", "France", "Germany", "India", "China",
  "Japan", "Canada", "Australia", "Pakistan", "Egypt", "Jordan", "Turkey",
];

export default function EventForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [searchParams] = useSearchParams();
  const { isAdmin, isEventManager } = useRole();

  // ============ SCHEMA ============
  const categorySelectionSchema = z.object({
    category: z.string().min(1, t("events.selectCategory")),
    available_count: z.union([z.number(), z.string()]).optional(),
  });

  const teamMemberSchema = z.object({
    user: z.string().min(1, t("events.selectUser")),
    full_name: z.string().optional(),
    team_role: z.string().optional(),
    assigned_date: z.string().optional(),
    is_primary_contact: z.union([z.boolean(), z.number()]).optional(),
    can_approve: z.union([z.boolean(), z.number()]).optional(),
  });

  const eventSchema = z
    .object({
      subject: z.string().min(1, t("events.validation.eventNameRequired")),
      event_owner: z.string().optional(),
      event_coordinator: z.string().optional(),
      event_type: z.string().optional(),
      event_category: z.string().optional(),
      status: z.string().default("Draft"),
      starts_on: z.string().min(1, t("events.validation.startDateRequired")),
      ends_on: z.string().min(1, t("events.validation.endDateRequired")),
      all_day: z.boolean().default(false),
      description: z.string().optional(),
      address_line_1: z.string().optional(),
      address_line_2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      event_categories: z
        .array(categorySelectionSchema)
        .default([])
        .refine(
          (cats) => {
            const ids = cats.map((c) => c.category).filter(Boolean);
            return ids.length === new Set(ids).size;
          },
          { message: t("events.duplicateCategories") },
        ),
      event_managers: z
        .array(teamMemberSchema)
        .default([])
        .refine(
          (members) => {
            const ids = members.map((m) => m.user).filter(Boolean);
            return ids.length === new Set(ids).size;
          },
          { message: t("events.duplicateTeamMembers") },
        ),
      event_coordinators: z
        .array(teamMemberSchema)
        .default([])
        .refine(
          (members) => {
            const ids = members.map((m) => m.user).filter(Boolean);
            return ids.length === new Set(ids).size;
          },
          { message: t("events.duplicateTeamMembers") },
        ),
    })
  .superRefine((val, ctx) => {
  try {
    const starts = val.starts_on ? new Date(val.starts_on).getTime() : NaN;
    const ends = val.ends_on ? new Date(val.ends_on).getTime() : NaN;

    if (!Number.isNaN(starts) && !Number.isNaN(ends) && ends <= starts) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ends_on"],
        message: t("events.endDateMustBeAfterNow"),
      });
    }
  } catch { /* ignore */ }
});


  type EventFormData = z.infer<typeof eventSchema>;
  const [activeTab, setActiveTab] = useState("details");
  const [giftSearch, setGiftSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [saveMode, setSaveMode] = useState<"draft" | "planned" | "final">(
    "draft",
  );
  const [queuedGiftAdds, setQueuedGiftAdds] = useState<string[]>([]);
  const [queuedNewGifts, setQueuedNewGifts] = useState<any[]>([]);
  const [suppressUnsavedPrompt, setSuppressUnsavedPrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [giftPage, setGiftPage] = useState(1);
  const [giftLimit, setGiftLimit] = useState(20);
  const [giftCategoryFilter, setGiftCategoryFilter] = useState<string>("");

  const wizardTabs = useMemo(() => {
    return ["details", "gifts"];
  }, []);

  const wizardIndex = useMemo(() => {
    const idx = wizardTabs.indexOf(activeTab);
    return idx >= 0 ? idx : 0;
  }, [activeTab, wizardTabs]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && wizardTabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams, wizardTabs]);

  // ── Step heading copy per step ──────────────────────────────────────────────
  const stepHeadings: Record<string, { title: string; subtitle: string }> = {
    details: {
      title: t("events.letsStartBasics"),
      subtitle: t("events.fillEventDetails"),
    },
    gifts: {
      title: t("events.addGifts"),
      subtitle: t("events.browseAndAssignGifts"),
    },
  };

  const saveAndExit = async () => {
    if (id) {
      const data = form.getValues();
      setSaveMode("planned");
      saveMutation.mutate({ ...(data as any), status: "Planned" } as any);
      return;
    }

    const data = form.getValues();
    setSaveMode("planned");
    const res = await EventAPI.createWithGifts(
      {
        ...(data as any),
        status: "Planned",
      },
      queuedGiftAdds,
      queuedNewGifts,
    );
    if (!res.success || !(res as any).data?.event) {
      toast.error(res.error || t("events.failedToCreateEvent"));
      return;
    }
    const createdName = (res as any).data.event;
    setQueuedGiftAdds([]);
    setQueuedNewGifts([]);
    setSuppressUnsavedPrompt(true);
    form.reset(form.getValues());
    setTimeout(() => navigate(`/events/${createdName}`), 0);
  };

  const savePlanned = async () => {
    // no-op: planned saving is handled by saveAndExit() / atomic create on new events
  };

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      subject: "",
      event_owner: "",
      event_coordinator: "",
      event_type: "Private",
      event_category: "Event",
      status: "Draft",
      starts_on: "",
      ends_on: "",
      all_day: false,
      description: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "",
      country: "United Arab Emirates",
      event_categories: [],
      event_managers: [],
      event_coordinators: [],
    },
  });

  const watchedStatus = useWatch({ control: form.control, name: "status" });
  const watchedCategories = useWatch({
    control: form.control,
    name: "event_categories",
  });
  const watchedSubject = useWatch({ control: form.control, name: "subject" });
  const watchedManagers = useWatch({
    control: form.control,
    name: "event_managers",
  });
  const watchedCoordinators = useWatch({
    control: form.control,
    name: "event_coordinators",
  });

  const isDraftEvent = useMemo(() => {
    const s = String(watchedStatus || "");
    return s === "Draft" || s === "Planned";
  }, [watchedStatus]);

  const {
    fields: managerFields,
    append: appendManager,
    remove: removeManager,
  } = useFieldArray({ control: form.control, name: "event_managers" });
  const {
    fields: categoryFields,
    append: appendCategory,
    remove: removeCategory,
  } = useFieldArray({ control: form.control, name: "event_categories" });
  const {
    fields: coordinatorFields,
    append: appendCoordinator,
    remove: removeCoordinator,
  } = useFieldArray({ control: form.control, name: "event_coordinators" });

  // ============ DATA FETCHING ============
  const { data: statusOptions } = useQuery({
    queryKey: ["field-options", "Gift Event", "status"],
    queryFn: async () => {
      const res = await DocTypeAPI.getFieldOptions("Gift Event", "status");
      if (res.success && res.data) return res.data;
      return ["Planned", "Active", "Completed", "Cancelled"];
    },
  });

  const draftStatusValue = useMemo(() => "Draft", [statusOptions]);

  const { data: eventTeamUsersRaw = [], isLoading: usersLoading } = useQuery({
    queryKey: ["event-team-users"],
    queryFn: async () => {
      const res = await UserAPI.listEventTeamUsers();
      return res.success ? res.data || [] : [];
    },
  });

  const {
    data: giftCategoryLinkOptionsRaw = [],
    isLoading: categoriesLoading,
  } = useQuery({
    queryKey: ["link-options", "Gift Category"],
    queryFn: async () => {
      const res = await DocTypeAPI.getLinkOptions("Gift Category", "", {}, 200);
      return res.success ? res.data || [] : [];
    },
  });

  const { data: countryLinkOptionsRaw = [], isLoading: countriesLoading } =
    useQuery({
      queryKey: ["link-options", "Country"],
      queryFn: async () => {
        const res = await DocTypeAPI.getLinkOptions("Country", "", {}, 200);
        return res.success ? res.data || [] : [];
      },
    });

  const userOptions: SearchableSelectOption[] = useMemo(() => {
    return (eventTeamUsersRaw || []).map((u: FrappeUser) => ({
      value: u.name,
      label: u.full_name || u.email || u.name,
      sublabel: u.email || undefined,
    }));
  }, [eventTeamUsersRaw]);

  const managerUserOptions: SearchableSelectOption[] = useMemo(() => {
    return (eventTeamUsersRaw || [])
      .filter((u: FrappeUser) => (u.roles || []).some((r) => r.role === "Event Manager"))
      .map((u: FrappeUser) => ({
        value: u.name,
        label: u.full_name || u.email || u.name,
        sublabel: u.email || undefined,
      }));
  }, [eventTeamUsersRaw]);

  const coordinatorUserOptions: SearchableSelectOption[] = useMemo(() => {
    return (eventTeamUsersRaw || [])
      .filter((u: FrappeUser) =>
        (u.roles || []).some(
          (r) => r.role === "Event Manager" || r.role === "Event Coordinator",
        ),
      )
      .map((u: FrappeUser) => ({
        value: u.name,
        label: u.full_name || u.email || u.name,
        sublabel: u.email || undefined,
      }));
  }, [eventTeamUsersRaw]);

  const selectedTeamUserIds = useMemo(() => {
    const mgr = ((watchedManagers || []) as any[])
      .map((m) => m?.user)
      .filter(Boolean);
    const coord = ((watchedCoordinators || []) as any[])
      .map((m) => m?.user)
      .filter(Boolean);
    return new Set<string>([...mgr, ...coord].map(String));
  }, [watchedManagers, watchedCoordinators]);

  const giftCategoryOptions: SearchableSelectOption[] = useMemo(
    () =>
      (giftCategoryLinkOptionsRaw || []).map((c: any) => ({
        value: c.value || c.name,
        label: c.value || c.name,
        sublabel:
          c.description && c.description !== (c.value || c.name)
            ? c.description
            : undefined,
      })),
    [giftCategoryLinkOptionsRaw],
  );

  const countryOptions: SearchableSelectOption[] = useMemo(() => {
    const raw = (countryLinkOptionsRaw || []).map((c: any) => ({
      value: c.value || c.name,
      label: c.value || c.name,
    })).filter((c) => c.value);
    if (raw.length > 0) return raw;
    if (countriesLoading) return [];
    return FALLBACK_COUNTRIES.map((c) => ({ value: c, label: c }));
  }, [countryLinkOptionsRaw, countriesLoading]);

  const { data: existingEvent, isLoading: isLoadingEvent } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      if (!id) return null;
      const result = await EventAPI.getWithCounts(id, false);
      return result.success ? result.data : null;
    },
    enabled: isEdit,
  });

  const { data: assignedGiftsRes, isLoading: assignedGiftsLoading } = useQuery({
    queryKey: ["event-assigned-gifts", id],
    queryFn: async () => {
      if (!id) return { gifts: [], total: 0 } as any;
      const res = await EventAPI.listEventGiftsByAllowedCategories(
        id,
        "",
        1,
        500,
      );
      if (!res.success)
        throw new Error(res.error || t("events.failedToFetchAssignedGifts"));
      return { gifts: res.data || [], total: res.total || 0 };
    },
    enabled: Boolean(isEdit && id),
  });

  const assignedGiftNames = useMemo(() => {
    const rows = (assignedGiftsRes as any)?.gifts || [];
    if (!Array.isArray(rows)) return new Set<string>();
    return new Set<string>(
      rows
        .map((g: any) => String(g?.gift || g?.name || "").trim())
        .filter(Boolean),
    );
  }, [assignedGiftsRes]);

  const visibleParticipantFields = useMemo(() => {
    return [] as any[];
  }, []);

  // ============ EFFECTS ============
  useEffect(() => {
    if (existingEvent && isEdit) {
      form.reset({
        subject: existingEvent.subject || "",
        event_owner: (existingEvent as any).event_owner || "",
        event_coordinator: (existingEvent as any).event_coordinator || "",
        event_type: (existingEvent as any).event_type || "Private",
        event_category: (existingEvent as any).event_category || "Event",
        status: existingEvent.status || "Draft",
        starts_on: existingEvent.starts_on
          ? existingEvent.starts_on.replace(" ", "T").slice(0, 16)
          : "",
        ends_on: existingEvent.ends_on
          ? existingEvent.ends_on.replace(" ", "T").slice(0, 16)
          : "",
        all_day: existingEvent.all_day || false,
        description: existingEvent.description || "",
        address_line_1: existingEvent.address_line_1 || "",
        address_line_2: existingEvent.address_line_2 || "",
        city: existingEvent.city || "",
        state: existingEvent.state || "",
        country: existingEvent.country || "United Arab Emirates",
        event_categories: (existingEvent as any).event_categories || [],
        event_managers: (existingEvent as any).event_managers || [],
        event_coordinators: (existingEvent as any).event_coordinators || [],
      });
    }
  }, [existingEvent, isEdit, form]);

  useEffect(() => {
    if (!isEdit || !id || !existingEvent) return;
    const rows = (existingEvent as any)?.event_gifts || [];
    if (!Array.isArray(rows)) return;
    // setQueuedGiftAdds(
    //   rows.map((g: any) => String(g?.gift || g?.name || "")).filter(Boolean),
    // );
  }, [existingEvent, isEdit, id]);

  const goPrev = () => {
    const prev = wizardTabs[wizardIndex - 1];
    if (prev) setActiveTab(prev);
  };

  const goNext = async () => {
    if (activeTab === "details") {
      const ok = await form.trigger(["subject", "starts_on", "ends_on"]);
      if (!ok) {
        toast.error(t("common.validationError"));
        return;
      }
    }
    const next = wizardTabs[wizardIndex + 1];
    if (next) setActiveTab(next);
  };

  const onTabChange = (next: string) => {
    const nextIndex = wizardTabs.indexOf(next);
    if (nextIndex <= wizardIndex) {
      setActiveTab(next);
      return;
    }
  };

  const saveDraft = async () => {
    debugger;
    if (isSaving || saveMutation.isPending) return;
    const data = form.getValues();
    setSaveMode("draft");

    if (id) {
      saveMutation.mutate({
        ...(data as any),
        status: draftStatusValue,
      } as any);
      return;
    }
    setIsSaving(true);
    try {
      const res = await EventAPI.createWithGifts(
        {
          ...(data as any),
          status: draftStatusValue,
        },
        queuedGiftAdds,
        queuedNewGifts,
      );
      if (!res.success || !(res as any).data?.event) {
        const errorMessage = res.error;
        if (errorMessage && errorMessage.includes("MandatoryError")) {
          toast.error(t("common.validationError"));
        } else {
          toast.error(errorMessage || t("events.failedToCreateEvent"));
        }
        return;
      }
      const createdName = (res as any).data.event;
      setQueuedGiftAdds([]);
      setQueuedNewGifts([]);
      setSuppressUnsavedPrompt(true);
      form.reset(form.getValues());
      setTimeout(() => navigate(`/events/${createdName}`), 0);
    } finally {
      setIsSaving(false);
    }
  };

  const publishEvent = async () => {
    // Validate all required fields for the first step
    const ok = await form.trigger(["subject", "starts_on", "ends_on"]);
    if (!ok) {
      toast.error(t("common.validationError"));
      return;
    }
    setSaveMode("final");
    if (id) {
      saveMutation.mutate({
        ...(form.getValues() as any),
        status: "Active",
      } as any);
      return;
    }

    const data = form.getValues();
    const res = await EventAPI.createWithGifts(
      {
        ...(data as any),
        status: "Active",
      },
      queuedGiftAdds,
      queuedNewGifts,
    );
    if (!res.success || !(res as any).data?.event) {
      toast.error(res.error || t("events.failedToCreateEvent"));
      return;
    }
    const createdName = (res as any).data.event;
    setQueuedGiftAdds([]);
    setQueuedNewGifts([]);
    setSuppressUnsavedPrompt(true);
    form.reset(form.getValues());
    setTimeout(() => navigate(`/events/${createdName}`), 0);
  };

  const {
    data: eligibleGiftsRes,
    isLoading: eligibleGiftsLoading,
    refetch: refetchEligibleGifts,
  } = useQuery({
    queryKey: ["eligible-gifts", id, giftSearch, giftCategoryFilter, giftPage, giftLimit, isEventManager],
    queryFn: async () => {
      // For event managers, use GiftWizardAPI.listAllAvailable to avoid permission issues
      // For admins, use the original EventAPI.listEligibleGiftsForEvent for better filtering
      if (id && !isEventManager) {
        const res = await EventAPI.listEligibleGiftsForEvent(
          id,
          giftSearch,
          giftCategoryFilter || undefined,
          undefined,
          giftPage,
          giftLimit,
        );
        return {
          success: res.success,
          data: res.data || [],
          total: res.total || 0,
        };
      }
      // For event managers or new events, use GiftWizardAPI which has broader access
      const res = await GiftWizardAPI.listAllAvailable(
        giftSearch,
        giftCategoryFilter || undefined,
        id, // pass current event to exclude gifts already in this event
        giftPage,
        giftLimit,
      );
      if (res.success) {
        let rows = res.data || [];
        let total = res.total || 0;
        return { success: true, data: rows, total };
      }
      return { success: true, data: [], total: 0 };
    },
    enabled: true,
  });

  const eligibleGifts = eligibleGiftsRes?.data || [];
  const totalEligibleGifts = eligibleGiftsRes?.total || 0;
  const totalGiftPages = Math.max(1, Math.ceil(totalEligibleGifts / giftLimit));

  useEffect(() => {
    setGiftPage(1);
  }, [giftSearch, giftCategoryFilter]);

  const addCategory = () => {
    appendCategory({ category: "" });
    setActiveTab("gifts");
  };
  const addCoordinator = () => {
    appendCoordinator({ user: "" });
    setActiveTab("details");
  };

  // ============ MUTATIONS ============
  const saveMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      const cleanCategories = (data.event_categories || []).filter((c) =>
        Boolean((c as any)?.category),
      );
      const cleanManagers = (data.event_managers || []).filter((m) =>
        Boolean((m as any)?.user),
      );
      const cleanCoordinators = (data.event_coordinators || []).filter((m) =>
        Boolean((m as any)?.user),
      );
      const payload: Partial<GiftEvent> = {
        subject: data.subject,
        event_type: (data as any).event_type || "Private",
        event_category: (data as any).event_category || "Event",
        status:
          saveMode === "draft"
            ? draftStatusValue
            : saveMode === "planned"
              ? "Planned"
              : "Active",
        starts_on: data.starts_on || undefined,
        ends_on: data.ends_on || undefined,
        all_day: data.all_day,
        description: data.description || undefined,
        address_line_1: data.address_line_1 || undefined,
        address_line_2: data.address_line_2 || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        country: data.country || undefined,
        event_categories: cleanCategories.map((c, idx) => ({
          idx: idx + 1,
          doctype: "Event Category Selection",
          parentfield: "event_categories",
          parenttype: "Gift Event",
          ...c,
        })) as EventCategorySelection[],
        event_managers: cleanManagers.map((m, idx) => ({
          idx: idx + 1,
          doctype: "Event Team Member",
          parentfield: "event_managers",
          parenttype: "Gift Event",
          ...m,
        })) as EventTeamMember[],
        event_coordinators: cleanCoordinators.map((m, idx) => ({
          idx: idx + 1,
          doctype: "Event Team Member",
          parentfield: "event_coordinators",
          parenttype: "Gift Event",
          ...m,
        })) as EventTeamMember[],
      };
      if (isEdit && id) return EventAPI.update(id, payload);
      return EventAPI.create(payload);
    },
    onSuccess: async (result) => {
      if (result.success) {
        const eventName = (result.data as any)?.name || id;

        if (isEdit && id && eventName) {
          const selected = new Set<string>(
            (queuedGiftAdds || [])
              .map((n) => String(n || "").trim())
              .filter(Boolean),
          );
          const toAdd = Array.from(selected).filter(
            (n) => !assignedGiftNames.has(n),
          );

          if (toAdd.length) {
            const r = await EventAPI.moveGiftsToEvent(eventName, toAdd);
            if (!r.success) {
              toast.error(r.error || t("events.failedToMoveGift"));
            } else {
              const failed = Array.isArray((r as any)?.data?.failed)
                ? (r as any).data.failed
                : [];
              if (failed.length > 0) {
                toast.error(t("events.failedToMoveGift"));
              }
            }

            queryClient.invalidateQueries({ queryKey: ["event-assigned-gifts", id] });
            queryClient.invalidateQueries({ queryKey: ["eligible-gifts", id, giftSearch, giftCategoryFilter, giftPage, giftLimit, isEventManager] });
            queryClient.invalidateQueries({ queryKey: ["event", id] });
          }
        }

        toast.success(
          isEdit ? t("events.eventUpdated") : t("events.eventCreated"),
        );
        // Determine the ID or slug for navigation
        const eventIdOrSlug = isEdit
          ? id
          : result.data?.name || result.data?.id;

        if (eventIdOrSlug) {
          // Navigate after a tiny delay to let toast render
          setTimeout(() => navigate(`/events/${eventIdOrSlug}`), 100);
        }

        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["gift-events"] });
        if (eventName) {
          setSuppressUnsavedPrompt(true);
          form.reset(form.getValues());
          setTimeout(() => navigate(`/events/${eventName}`), 0);
        }
      } else {
        // Show user-friendly error message for mandatory field errors
        const errorMessage = result.error;
        if (errorMessage && errorMessage.includes("MandatoryError")) {
          toast.error(t("common.validationError"));
        } else {
          toast.error(errorMessage || t("events.failedToSaveEvent"));
        }
      }
    },
    onError: (error) => {
      console.error("Save error:", error);
      toast.error(t("events.failedToSaveEvent"));
    },
  });

  const moveGiftMutation = useMutation({
    mutationFn: async (giftName: string) => {
      if (!id) return { success: false, error: "Event is required" } as any;
      return EventAPI.moveGiftToEvent(giftName, id);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("events.giftMovedToEvent"));
        queryClient.invalidateQueries({ queryKey: ["eligible-gifts", id, giftSearch, giftCategoryFilter, giftPage, giftLimit, isEventManager] });
        queryClient.invalidateQueries({ queryKey: ["event", id] });
        queryClient.invalidateQueries({ queryKey: ["gift-events"] });
        refetchEligibleGifts();
      } else {
        toast.error(result.error || t("events.failedToMoveGift"));
      }
    },
    onError: () => toast.error(t("events.failedToMoveGift")),
  });

  const { DialogComponent } = usePromptDialog({
    when:
      !suppressUnsavedPrompt &&
      form.formState.isDirty &&
      !saveMutation.isPending,
    message: t("events.unsavedChangesMessage"),
    title: t("events.unsavedChangesTitle"),
  });

  const onSubmit = (data: EventFormData) => {
    publishEvent();
  };
  const startDate = form.watch("starts_on");
  const minEndDate = startDate ? startDate.split("T")[0] + "T00:00" : undefined;

  const isEditingLoading = isEdit && isLoadingEvent;
  const hasErrors = Object.keys(form.formState.errors).length > 0;
  const selectedCategories = watchedCategories || [];

  const filteredGiftCategoryOptions = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return giftCategoryOptions;
    return giftCategoryOptions.filter((c) => {
      const label = String(c.label || "").toLowerCase();
      const sub = String((c as any).sublabel || "").toLowerCase();
      const val = String(c.value || "").toLowerCase();
      return label.includes(q) || val.includes(q) || sub.includes(q);
    });
  }, [categorySearch, giftCategoryOptions]);

  const stepLabel = (tab: string) => {
    if (tab === "details") return t("common.details").toUpperCase();
    if (tab === "gifts") return t("events.gifts").toUpperCase();
    return tab.toUpperCase();
  };
  // Helper function to calculate min value for end date
  const getEndDateMinValue = (startDate: string, currentEndDate?: string) => {
    if (!startDate) return undefined;

    // If we're editing an existing end date that's already set,
    // we might want to allow keeping it even if it's technically before min
    // This handles the case when loading existing data
    // if (currentEndDate && new Date(currentEndDate) < new Date(startDate)) {
    //   return undefined; // Don't restrict when loading existing data
    // }

    return startDate; // Same date and time, so end must be >= start
  };
  // ============ RENDER ============
  if (isEditingLoading) {
    return (
      <div className="flex items-center justify-center min-h-svh bg-background">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  const currentStepHeading = stepHeadings[activeTab] || stepHeadings.details;

  return (
    <>
      {DialogComponent}

      <div className="min-h-svh bg-background flex flex-col">
        {/* ── Body ─────────────────────────────────────────────────────────────── */}
        <div className="flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="">
                {/* ── Wizard Stepper ───────────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 gap-6">
                  <div className="bg-background border-b border-border pb-0">
                    <div className="mb-4 text-center"></div>
                    {/* Stepper row */}
                    <div className="flex items-center justify-center mb-6">
                      {wizardTabs.map((tab, idx) => {
                        const isDone = idx < wizardIndex;
                        const isActive = idx === wizardIndex;
                        const isPending = idx > wizardIndex;

                        return (
                          <div
                            key={tab}
                            className="flex items-center flex-1 last:flex-none max-w-[520px]"
                          >
                            {/* Circle + label */}
                            <div className="flex flex-col items-center">
                              <button
                                type="button"
                                onClick={() => !isPending && onTabChange(tab)}
                                disabled={isPending}
                                className={[
                                  "h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold transition-all shrink-0",
                                  isActive
                                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                                    : isDone
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-white text-muted-foreground border-2 border-border",
                                  isPending
                                    ? "cursor-not-allowed"
                                    : "cursor-pointer hover:opacity-90",
                                ].join(" ")}
                              >
                                {isDone ? (
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                ) : (
                                  idx + 1
                                )}
                              </button>
                              <span
                                className={[
                                  "text-[10px] font-semibold uppercase tracking-wider mt-1.5 whitespace-nowrap",
                                  isActive
                                    ? "text-primary"
                                    : isDone
                                      ? "text-foreground"
                                      : "text-muted-foreground",
                                ].join(" ")}
                              >
                                {stepLabel(tab)}
                              </span>
                            </div>

                            {/* Connector line */}
                            {idx < wizardTabs.length - 1 && (
                              <div className="flex-1 mx-2 mb-4">
                                <div
                                  className={[
                                    "h-[2px] w-full transition-colors duration-300",
                                    isDone ? "bg-primary" : "bg-border",
                                  ].join(" ")}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* main content */}
                <div className="grid grid-cols-1 gap-6 items-start max-w-5xl mx-auto  lg:px-8 xl:px-12">
                  <Tabs
                    value={activeTab}
                    onValueChange={onTabChange}
                    className="w-full"
                  >
                    {/* ── DETAILS TAB ──────────────────────────────────────────── */}
                    <TabsContent value="details" className="space-y-4 mt-0">
                      {/* General Information */}
                      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-3">
                          {t("events.generalInformation")}
                        </h3>

                        <FormField
                          control={form.control}
                          name="subject"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t("events.eventName")}
                                <span className="text-destructive ml-1">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder={t("events.eventNamePlaceholder")}
                                  className="h-11 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="starts_on"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-foreground">
                                  {t("events.startDate")}
                                  <span className="text-destructive ml-1">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="datetime-local"
                                    {...field}
                                    className="h-11 text-sm w-full max-w-full"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="ends_on"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-foreground">
                                  {t("events.endDate")}
                                  <span className="text-destructive ml-1">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    min={minEndDate}
                                    type="datetime-local"
                                    {...field}
                                    disabled={!form.watch("starts_on")}
                                    className="h-11 text-sm w-full max-w-full"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t("events.eventDescription")}
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder={t(
                                    "common.eventDescriptionPlaceholder",
                                  )}
                                  rows={4}
                                  className="text-sm resize-none"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Location Details */}
                      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            {t("events.locationDetails")}
                          </h3>
                        </div>

                        <FormField
                          control={form.control}
                          name="address_line_1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t("events.location")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder={t("events.locationPlaceholder")}
                                  className="h-11 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-foreground">
                                  {t("events.city")}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder={t("events.cityPlaceholder")}
                                    className="h-11 text-sm"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="state"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-foreground">
                                  {t("events.emirate")}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder={t("events.emiratePlaceholder")}
                                    className="h-11 text-sm"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="country"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-foreground">
                                  {t("events.country")}
                                </FormLabel>
                                <FormControl>
                                  <SearchableSelect
                                    clearable
                                    value={field.value || ""}
                                    onValueChange={field.onChange}
                                    options={countryOptions}
                                    placeholder={t("events.countryPlaceholder")}
                                    searchPlaceholder={t(
                                      "events.countrySearchPlaceholder",
                                    )}
                                    emptyMessage={t("common.noResults")}
                                    isLoading={countriesLoading}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Guest Experience Team */}
                      <div className="bg-card border border-border rounded-xl p-5 space-y-6">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-3">
                          {t("events.guestExperienceTeam")}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between min-h-[24px]">
                              <div className="flex items-center">
                                <h4 className="text-sm font-semibold text-foreground">
                                  {t("events.guestExperienceTeam")}
                                </h4>
                                <span className="text-destructive opacity-0">
                                  *
                                </span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-foreground"
                                    >
                                      <Info className="h-4 w-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {t("events.guestExperienceTeamTooltip")}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>

                            <FormField
                              control={form.control}
                              name="event_coordinators"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <div className="space-y-2">
                                      <SearchableSelect
                                        value=""
                                        onValueChange={(value) => {
                                          const current = (field.value ||
                                            []) as any[];
                                          if (
                                            value &&
                                            !current.some(
                                              (m) => m?.user === value,
                                            )
                                          ) {
                                            field.onChange([
                                              ...(current || []),
                                              { user: value },
                                            ]);
                                          }
                                        }}
                                        options={coordinatorUserOptions.filter(
                                          (opt) =>
                                            !selectedTeamUserIds.has(
                                              String(opt.value),
                                            ) &&
                                            !(
                                              (field.value || []) as any[]
                                            ).some(
                                              (m) => m?.user === opt.value,
                                            ),
                                        )}
                                        placeholder={t(
                                          "events.selectTeamMember",
                                        )}
                                        searchPlaceholder={t(
                                          "events.searchUser",
                                        )}
                                        emptyMessage={t("common.noResults")}
                                        isLoading={usersLoading}
                                      />

                                      {((field.value || []) as any[]).length >
                                        0 && (
                                        <div className="flex flex-wrap gap-2 items-center border border-border rounded-xl px-3 py-2 bg-background">
                                          {((field.value || []) as any[]).map(
                                            (m: any) => (
                                              <div
                                                key={m.user}
                                                className="inline-flex items-center gap-1.5 bg-muted border border-border rounded-full pl-1.5 pr-2 py-1"
                                              >
                                                <TeamAvatar
                                                  name={m.user}
                                                  size="sm"
                                                />
                                                <span className="text-xs font-medium text-foreground">
                                                  {m.user}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    field.onChange(
                                                      (
                                                        (field.value ||
                                                          []) as any[]
                                                      ).filter(
                                                        (v: any) =>
                                                          v?.user !== m.user,
                                                      ),
                                                    );
                                                  }}
                                                  className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                                                >
                                                  <svg
                                                    className="h-3 w-3"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    viewBox="0 0 24 24"
                                                  >
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      d="M6 18L18 6M6 6l12 12"
                                                    />
                                                  </svg>
                                                </button>
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between min-h-[24px]">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-foreground">
                                  {t("events.approver")}
                                </h4>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-foreground"
                                    >
                                      <Info className="h-4 w-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {t("events.approverTooltip")}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>

                            <FormField
                              control={form.control}
                              name="event_managers"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <div className="space-y-2">
                                      <SearchableSelect
                                        value=""
                                        onValueChange={(value) => {
                                          const current = (field.value ||
                                            []) as any[];
                                          if (
                                            value &&
                                            !current.some(
                                              (m) => m?.user === value,
                                            )
                                          ) {
                                            field.onChange([
                                              ...(current || []),
                                              { user: value },
                                            ]);
                                          }
                                        }}
                                        options={managerUserOptions.filter(
                                          (opt) =>
                                            !selectedTeamUserIds.has(
                                              String(opt.value),
                                            ) &&
                                            !(
                                              (field.value || []) as any[]
                                            ).some(
                                              (m) => m?.user === opt.value,
                                            ),
                                        )}
                                        placeholder={t("events.selectApprover")}
                                        searchPlaceholder={t(
                                          "events.searchUser",
                                        )}
                                        emptyMessage={t("common.noResults")}
                                        isLoading={usersLoading}
                                      />

                                      {((field.value || []) as any[]).length >
                                        0 && (
                                        <div className="flex flex-wrap gap-2 items-center border border-border rounded-xl px-3 py-2 bg-background">
                                          {((field.value || []) as any[]).map(
                                            (m: any) => (
                                              <div
                                                key={m.user}
                                                className="inline-flex items-center gap-1.5 bg-muted border border-border rounded-full pl-1.5 pr-2 py-1"
                                              >
                                                <TeamAvatar
                                                  name={m.user}
                                                  size="sm"
                                                />
                                                <span className="text-xs font-medium text-foreground">
                                                  {m.user}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    field.onChange(
                                                      (
                                                        (field.value ||
                                                          []) as any[]
                                                      ).filter(
                                                        (v: any) =>
                                                          v?.user !== m.user,
                                                      ),
                                                    );
                                                  }}
                                                  className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                                                >
                                                  <svg
                                                    className="h-3 w-3"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    viewBox="0 0 24 24"
                                                  >
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      d="M6 18L18 6M6 6l12 12"
                                                    />
                                                  </svg>
                                                </button>
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* ── GIFTS TAB ──────────────────────────────────────────── */}
                    <TabsContent value="gifts" className="space-y-4 mt-0">
                      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                          {id ? (
                            <AddGiftSheet
                              eventName={id}
                              onSuccess={() => {
                                refetchEligibleGifts();
                              }}
                            ></AddGiftSheet>
                          ) : (
                            <AddGiftSheet
                              linkToEvent={false}
                              onCreated={(giftPayload) => {
                                setQueuedNewGifts((prev) => [
                                  ...prev,
                                  giftPayload,
                                ]);
                              }}
                            ></AddGiftSheet>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="relative flex-1">
  <Search className="ltr:absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

  <Input
    placeholder={t("events.searchGifts")}
    value={giftSearch}
    onChange={(e) => setGiftSearch(e.target.value)}
    className="ltr:pl-9 rtl:pr-9 ltr:pr-9 rtl:pl-9"
  />

  {/* ✅ Clear Button */}
  {giftSearch && (
    <button
      type="button"
      onClick={() => setGiftSearch("")}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      aria-label="Clear search"
    >
      <X className="h-4 w-4" />
    </button>
  )}
</div>

                          <div className="flex items-center gap-2">
                            <SearchableSelect
                              clearable
                              value={giftCategoryFilter || ""}
                              onValueChange={(v) =>
                                setGiftCategoryFilter(v || "")
                              }
                              options={giftCategoryOptions}
                              placeholder={t("events.filterByCategory")}
                              searchPlaceholder={t("events.searchCategory")}
                              emptyMessage={t("common.noResults")}
                              isLoading={categoriesLoading}
                              className="flex-1"
                            />

                            {/* {(giftCategoryFilter || giftSearch) && ( */}
                            {/* <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              onClick={() => {
                                setGiftCategoryFilter("");
                                setGiftSearch("");
                              }}
                            >
                              <X className="h-3 w-3" />
                              {t("common.clearAll")}
                            </Button> */}
                            {/* )} */}
                          </div>
                        </div>

                        <GiftsCheckboxTable
                          eligibleGifts={eligibleGifts}
                          queuedGiftAdds={queuedGiftAdds}
                          setQueuedGiftAdds={setQueuedGiftAdds}
                          id={id}
                          moveGiftMutation={moveGiftMutation}
                        />

                        <Pagination
                          currentPage={giftPage}
                          totalPages={totalGiftPages}
                          totalItems={totalEligibleGifts}
                          itemsPerPage={giftLimit}
                          onPageChange={(p) => setGiftPage(p)}
                          onItemsPerPageChange={(n) => {
                            setGiftLimit(n);
                            setGiftPage(1);
                          }}
                        />
                      </div>
                    </TabsContent>

                    {/* ── Sticky Bottom Nav ─────────────────────────────────────────────── */}
                    <div className="sticky bottom-0 z-20 bg-background border-t border-border">
                      <div
                        className={
                          "py-3 flex items-center gap-3 justify-between "
                        }
                      >
                        {/* Left: Save as Draft */}
                        {/* {wizardIndex < wizardTabs.length - 1 ? null : ( */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={saveDraft}
                            disabled={saveMutation.isPending || isSaving}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline disabled:opacity-50"
                          >
                            {t("common.saveDraft")}
                          </button>
                        </div>
                        {/* )} */}

                        {/* Right: Prev / Next */}
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={goPrev}
                            disabled={wizardIndex <= 0}
                            className="h-10 px-5"
                          >
                            {t("common.previous")}
                          </Button>
                          {wizardIndex < wizardTabs.length - 1 && (
                            <Button
                              type="button"
                              onClick={goNext}
                              disabled={saveMutation.isPending}
                              className="h-10 px-6 bg-primary text-primary-foreground font-semibold"
                            >
                              {t("common.nextStep")}
                            </Button>
                          )}
                          {wizardIndex === wizardTabs.length - 1 && (
                            <Button
                              type="button"
                              onClick={saveAndExit}
                              disabled={saveMutation.isPending}
                              className="h-10 px-6 bg-primary text-primary-foreground font-semibold"
                            >
                              {saveMutation.isPending
                                ? t("common.saving")
                                : t("common.finish")}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Tabs>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </>
  );
}
