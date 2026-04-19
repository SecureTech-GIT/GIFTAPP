import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Save,
  Truck,
  MapPin,
  FileText,
  User,
  Clock,
  Plus,
  Trash2,
  Upload,
  Info,
  CheckCircle,
  Package,
  Eye,
  X,
  AlertCircle,
  Calendar,
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Progress } from "@/components/ui/progress";
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
import {
  GiftDispatchAPI,
  GiftIssueAPI,
  FileAPI,
  DocTypeAPI,
} from "@/services/api";
import { toast } from "sonner";
import type { GiftDispatch } from "@/types/gift";
import { format } from "date-fns";
import { usePrompt } from "@/hooks/usePrompt";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";

// ============ SCHEMA ============
const documentSchema = z.object({
  document_type: z.string().optional(),
  document_attachment: z.string().optional(),
  description: z.string().optional(),
});

const getFileUrl = (filePath: string) => {
  if (!filePath) return "";
  if (filePath.startsWith("http")) return filePath;
  return `${import.meta.env.VITE_API_URL || ""}${filePath}`;
};

const getFileName = (filePath: string) => {
  if (!filePath) return "";
  return filePath.split("/").pop() || filePath;
};

const dispatchSchema = z.object({
  related_gift_issue: z.string().min(1, "Gift Issue is required"),
  dispatch_date: z.string().min(1, "Dispatch date is required"),
  dispatch_status: z.string().default("Prepared"),
  gift: z.string().optional(),
  gift_name: z.string().optional(),
  gift_recipient: z.string().optional(),
  owner_full_name: z.string().optional(),
  delivery_address: z.string().optional(),
  transport_mode: z.string().optional(),
  vehicle_number: z.string().optional(),
  driver_name: z.string().optional(),
  driver_contact: z.string().optional(),
  estimated_arrival: z.string().optional(),
  actual_delivery_date: z.string().optional(),
  delivery_person_name: z.string().optional(),
  delivery_person_contact: z.string().optional(),
  delivery_person_id: z.string().optional(),
  delivery_person_company: z.string().optional(),
  received_by_name: z.string().optional(),
  receiver_id: z.string().optional(),
  delivery_remarks: z.string().optional(),
  dispatch_documents: z.array(documentSchema).default([]),
});

type DispatchFormData = z.infer<typeof dispatchSchema>;

export default function DispatchForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const isEdit = !!id;

  const [activeTab, setActiveTab] = useState("basic");

  // Wizard configuration matching EventForm
  const wizardTabs = useMemo(
    () => ["basic", "transport", "delivery", "documents"],
    [],
  );

  const wizardIndex = useMemo(() => {
    const idx = wizardTabs.indexOf(activeTab);
    return idx >= 0 ? idx : 0;
  }, [activeTab, wizardTabs]);

  const completionPercent = Math.round(
    (wizardIndex / (wizardTabs.length - 1)) * 100,
  );

  const stepHeadings: Record<string, { title: string; subtitle: string }> = {
    basic: {
      title: "Select Gift Issue",
      subtitle:
        "Choose the gift issue to dispatch and verify delivery details.",
    },
    transport: {
      title: "Transport Details",
      subtitle: "Enter vehicle information and estimated arrival time.",
    },
    delivery: {
      title: "Delivery Confirmation",
      subtitle: "Record who received the gift and delivery conditions.",
    },
    documents: {
      title: "Attach Documents",
      subtitle:
        "Upload transport permits, delivery confirmations, and other documents.",
    },
  };

  const stepLabel = (tab: string) => {
    if (tab === "basic") return "ISSUE";
    if (tab === "transport") return "TRANSPORT";
    if (tab === "delivery") return "DELIVERY";
    if (tab === "documents") return "DOCUMENTS";
    return tab.toUpperCase();
  };

  const form = useForm<DispatchFormData>({
    resolver: zodResolver(dispatchSchema),
    defaultValues: {
      dispatch_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      dispatch_status: "Prepared",
      dispatch_documents: [],
    },
  });

  // Watch values for sidebar
  const watchedGiftName = useWatch({
    control: form.control,
    name: "gift_name",
  });
  const watchedIssue = useWatch({
    control: form.control,
    name: "related_gift_issue",
  });
  const watchedStatus = useWatch({
    control: form.control,
    name: "dispatch_status",
  });
  const watchedDispatchDate = useWatch({
    control: form.control,
    name: "dispatch_date",
  });

  const {
    fields: documentFields,
    append: appendDocument,
    remove: removeDocument,
  } = useFieldArray({
    control: form.control,
    name: "dispatch_documents",
  });

  // ============ DATA FETCHING ============
  const { data: dispatchStatuses = [] } = useQuery({
    queryKey: ["field-options", "Gift Dispatch", "dispatch_status"],
    queryFn: async () => {
      const result = await DocTypeAPI.getFieldOptions(
        "Gift Dispatch",
        "dispatch_status",
      );
      return result.success
        ? result.data
        : ["Prepared", "In Transit", "Delivered", "Cancelled"];
    },
  });

  const { data: transportModes = [] } = useQuery({
    queryKey: ["field-options", "Gift Dispatch", "transport_mode"],
    queryFn: async () => {
      const result = await DocTypeAPI.getFieldOptions(
        "Gift Dispatch",
        "transport_mode",
      );
      return result.success
        ? result.data
        : [
            "Company Vehicle",
            "Third Party Courier",
            "Air Transport",
            "Self Pickup",
          ];
    },
  });

  const { data: giftIssues, isLoading: issuesLoading } = useQuery({
    queryKey: ["gift-issues-for-dispatch"],
    queryFn: async () => {
      const result = await GiftIssueAPI.list();
      if (!result.success) return [];
      return (
        result.data?.filter(
          (i) =>
            i.status !== "Delivered" &&
            i.status !== "Cancelled" &&
            (!i.dispatch_reference || i.dispatch_reference === id),
        ) || []
      );
    },
  });

  const { data: existingDispatch, isLoading: isLoadingDispatch } = useQuery({
    queryKey: ["gift-dispatch", id],
    queryFn: async () => {
      if (!id) return null;
      const result = await GiftDispatchAPI.get(id);
      return result.success ? result.data : null;
    },
    enabled: isEdit,
  });

  // ============ EFFECTS ============
  useEffect(() => {
    if (existingDispatch && isEdit) {
      console.log("Loading existing dispatch:", existingDispatch);
      form.reset({
        related_gift_issue: existingDispatch.related_gift_issue || "",
        dispatch_date: existingDispatch.dispatch_date?.replace(" ", "T")?.slice(0, 16) || "",
        dispatch_status: existingDispatch.dispatch_status || "Prepared",
        gift: existingDispatch.gift || "",
        gift_name: existingDispatch.gift_name || "",
        gift_recipient: existingDispatch.gift_recipient || "",
        owner_full_name: existingDispatch.owner_full_name || "",
        delivery_address: existingDispatch.delivery_address || "",
        transport_mode: existingDispatch.transport_mode || "",
        vehicle_number: existingDispatch.vehicle_number || "",
        driver_name: existingDispatch.driver_name || "",
        driver_contact: existingDispatch.driver_contact || "",
        estimated_arrival:
          existingDispatch.estimated_arrival?.replace(" ", "T")?.slice(0, 16) || "",
        actual_delivery_date:
          existingDispatch.actual_delivery_date?.replace(" ", "T")?.slice(0, 16) || "",
        delivery_person_name: existingDispatch.delivery_person_name || "",
        delivery_person_contact: existingDispatch.delivery_person_contact || "",
        delivery_person_id: existingDispatch.delivery_person_id || "",
        delivery_person_company: existingDispatch.delivery_person_company || "",
        received_by_name: existingDispatch.received_by_name || "",
        receiver_id: existingDispatch.receiver_id || "",
        delivery_remarks: existingDispatch.delivery_remarks || "",
        dispatch_documents: existingDispatch.dispatch_documents || [],
      });
    }
  }, [existingDispatch, isEdit, form]);

  // ============ NAVIGATION HANDLERS ============
  const goPrev = () => {
    const prev = wizardTabs[wizardIndex - 1];
    if (prev) setActiveTab(prev);
  };

  const goNext = async () => {
    if (activeTab === "basic") {
      const ok = await form.trigger([
        "related_gift_issue",
        "dispatch_date",
        "dispatch_status",
      ]);
      if (!ok) return;
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
    const data = form.getValues();
    saveMutation.mutate(data);
  };

  const saveAndExit = async () => {
    const data = form.getValues();
    saveMutation.mutate(data);
  };

  // ============ HANDLERS ============
  const handleGiftIssueChange = async (issueId: string) => {
    const result = await GiftIssueAPI.get(issueId);
    if (result.success && result.data) {
      const issue = result.data;
      form.setValue("gift", issue.gift || "");
      form.setValue("gift_name", issue.gift_name || "");
      form.setValue("gift_recipient", issue.gift_recipient || "");
      form.setValue("delivery_address", issue.delivery_address || "");
      form.setValue("delivery_person_name", issue.delivery_person_name || "");
      form.setValue(
        "delivery_person_contact",
        issue.delivery_person_contact || "",
      );
      form.setValue("delivery_person_id", issue.delivery_person_id || "");
      form.setValue(
        "delivery_person_company",
        issue.delivery_person_company || "",
      );
      toast.success(t("dispatchForm.giftIssueDetailsLoaded"));
    }
  };

  const handleFileUpload = async (index: number, file: File) => {
    const result = await FileAPI.upload(file);
    if (result.success && result.data) {
      form.setValue(
        `dispatch_documents.${index}.document_attachment`,
        result.data.file_url,
      );
      toast.success(t("dispatchForm.fileUploaded"));
    } else {
      toast.error(result.error || t("dispatchForm.failedToUpload"));
    }
  };

  const addDocument = () => {
    appendDocument({
      document_type: "",
      document_attachment: "",
      description: "",
    });
    setActiveTab("documents");
  };

  // ============ MUTATIONS ============
  const saveMutation = useMutation({
    mutationFn: async (data: DispatchFormData) => {
      const payload: Partial<GiftDispatch> = {
        related_gift_issue: data.related_gift_issue,
        dispatch_date: data.dispatch_date,
        dispatch_status: data.dispatch_status,
        delivery_address: data.delivery_address,
        transport_mode: data.transport_mode,
        vehicle_number: data.vehicle_number,
        driver_name: data.driver_name,
        driver_contact: data.driver_contact,
        estimated_arrival: data.estimated_arrival || undefined,
        actual_delivery_date: data.actual_delivery_date || undefined,
        delivery_person_name: data.delivery_person_name,
        delivery_person_contact: data.delivery_person_contact,
        delivery_person_id: data.delivery_person_id,
        delivery_person_company: data.delivery_person_company,
        received_by_name: data.received_by_name,
        receiver_id: data.receiver_id,
        delivery_remarks: data.delivery_remarks,
        dispatch_documents: data.dispatch_documents.map((doc, idx) => ({
          idx: idx + 1,
          doctype: "Gift Issue Documents",
          parentfield: "dispatch_documents",
          parenttype: "Gift Dispatch",
          document_type: doc.document_type,
          document_attachment: doc.document_attachment,
          description: doc.description,
        })),
      };

      console.log("Saving dispatch with payload:", payload);

      if (isEdit && id) {
        return GiftDispatchAPI.update(id, payload);
      }
      return GiftDispatchAPI.create(payload);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(
          isEdit
            ? t("dispatchForm.dispatchUpdated")
            : t("dispatchForm.dispatchCreated"),
        );
        queryClient.invalidateQueries({ queryKey: ["gift-dispatch"] });
        queryClient.invalidateQueries({ queryKey: ["gift-dispatches"] });
        queryClient.invalidateQueries({ queryKey: ["gift-issues"] });
        navigate("/dispatch");
      } else {
        toast.error(result.error || t("dispatchForm.failedToSave"));
      }
    },
    onError: (error) => {
      console.error("Save error:", error);
      toast.error(t("dispatchForm.failedToSaveDispatch"));
    },
  });

  usePrompt({
    when: form.formState.isDirty && !saveMutation.isPending,
    message: t("dispatchForm.youHaveUnsavedChanges"),
  });

  const onSubmit = (data: DispatchFormData) => {
    console.log("Form submitted:", data);
    saveMutation.mutate(data);
  };

  // ============ LOADING STATES ============
  if (isEdit && isLoadingDispatch) {
    return (
      <div className="flex items-center justify-center min-h-svh bg-background">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground text-sm">
            {t("dispatchForm.loadingDispatchData")}
          </p>
        </div>
      </div>
    );
  }

  const issueOptions =
    giftIssues?.map((i) => ({
      value: i.name,
      label: `${i.name} - ${i.gift_name || "No Gift"}`,
      sublabel: `${i.owner_full_name || "No Guest"} • ${i.status}`,
    })) || [];

  const hasErrors = Object.keys(form.formState.errors).length > 0;
  const dispatchStatus = watchedStatus;
  const currentStepHeading = stepHeadings[activeTab] || stepHeadings.basic;

  return (
    <div className="min-h-svh bg-background flex flex-col">
      {/* ── Top Nav Bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 md:px-6 h-14">
          <div className="flex items-center gap-3">
            {/* <button
              type="button"
              onClick={() => navigate("/dispatch")}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </button> */}
            <span className="font-semibold text-foreground text-sm truncate max-w-[200px] md:max-w-none">
              {isEdit
                ? t("dispatchForm.editDispatch")
                : t("dispatchForm.newDispatch")}
            </span>
          </div>
          {/* <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Help
          </div> */}
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 md:px-8 py-6">
        {/* {hasErrors && (
          <Alert variant="destructive" className="mb-4 max-w-3xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {form.formState.errors.related_gift_issue?.message || t('dispatchForm.pleaseFixErrors')}
            </AlertDescription>
          </Alert>
        )} */}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
              {/* ── Wizard Stepper ───────────────────────────────────────────────────── */}
              <div className="bg-background border-b border-border px-4 max-w-4xl ">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                  Step {wizardIndex + 1} of {wizardTabs.length}
                </p>

                <div className="flex items-center mb-6">
                  {wizardTabs.map((tab, idx) => {
                    const isDone = idx < wizardIndex;
                    const isActive = idx === wizardIndex;
                    const isPending = idx > wizardIndex;

                    return (
                      <div
                        key={tab}
                        className="flex items-center flex-1 last:flex-none"
                      >
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
                              "text-[10px] font-semibold uppercase tracking-wider mt-1.5 whitespace-nowrap hidden sm:block",
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

                        {idx < wizardTabs.length - 1 && (
                          <div className="flex-1 mx-2 mb-4 sm:mb-5">
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
            {/* ── Main content ───────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start max-w-7xl mx-auto">
              <div>
                {/* Step hero heading */}
                {/* <div className="mb-5">
                  <h1 className="text-2xl font-bold text-foreground">{currentStepHeading.title}</h1>
                  <p className="text-muted-foreground text-sm mt-1">{currentStepHeading.subtitle}</p>
                </div> */}

                {/* BASIC TAB */}
                {activeTab === "basic" && (
                  <div className="space-y-4">
                    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-3">
                        Dispatch Information
                      </h3>

                      <FormField
                        control={form.control}
                        name="related_gift_issue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-foreground">
                              {t("dispatchForm.giftIssueRequired")}
                            </FormLabel>
                            <FormControl>
                              <SearchableSelect
                                value={field.value}
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  handleGiftIssueChange(value);
                                }}
                                options={issueOptions}
                                placeholder={t(
                                  "dispatchForm.searchAndSelectGiftIssue",
                                )}
                                searchPlaceholder={t(
                                  "dispatchForm.searchByIssueIdOrGiftName",
                                )}
                                emptyMessage={t(
                                  "dispatchForm.noEligibleIssuesFound",
                                )}
                                isLoading={issuesLoading}
                                disabled={isEdit}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              {t(
                                "dispatchForm.onlyIssuesWithoutActiveDispatch",
                              )}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="dispatch_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t("dispatchForm.dispatchDateRequired")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="datetime-local"
                                  {...field}
                                  className="h-11 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="dispatch_status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t("dispatchForm.statusRequired")}
                              </FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-11 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {dispatchStatuses.map((status) => (
                                    <SelectItem
                                      key={status}
                                      value={status}
                                      className="text-sm"
                                    >
                                      {status}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Gift Details (Read-only)
                        </h4>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="gift_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-foreground">
                                  {t("dispatchForm.giftName")}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    readOnly
                                    className="h-11 text-sm bg-muted"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="owner_full_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-foreground">
                                  {t("dispatchForm.guestName")}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    readOnly
                                    className="h-11 text-sm bg-muted"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <Separator />

                      <FormField
                        control={form.control}
                        name="delivery_address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-foreground">
                              {t("dispatchForm.deliveryAddress")}
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder={t(
                                  "dispatchForm.fullDeliveryAddress",
                                )}
                                rows={3}
                                className="text-sm resize-none"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              {t("dispatchForm.syncsWithGiftIssue")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* TRANSPORT TAB */}
                {activeTab === "transport" && (
                  <div className="space-y-4">
                    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-3">
                        Transport Details
                      </h3>

                      <FormField
                        control={form.control}
                        name="transport_mode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-foreground">
                              {t("dispatchForm.transportMode")}
                            </FormLabel>
                            <Select
                              value={field.value || ""}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger className="h-11 text-sm">
                                  <SelectValue
                                    placeholder={t(
                                      "dispatchForm.selectTransportMode",
                                    )}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {transportModes.map((mode) => (
                                  <SelectItem
                                    key={mode}
                                    value={mode}
                                    className="text-sm"
                                  >
                                    {mode}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="vehicle_number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t("dispatchForm.vehicleNumber")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="DXB-12345"
                                  className="h-11 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="driver_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t("dispatchForm.driverHandlerName")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Driver's name"
                                  className="h-11 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="driver_contact"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t("dispatchForm.driverContact")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="+971-50-xxx-xxxx"
                                  className="h-11 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Timing
                        </h4>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="estimated_arrival"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-foreground">
                                  {t("dispatchForm.estimatedArrival")}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="datetime-local"
                                    {...field}
                                    className="h-11 text-sm"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="actual_delivery_date"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-foreground">
                                  {t("dispatchForm.actualDeliveryDate")}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="datetime-local"
                                    {...field}
                                    className="h-11 text-sm"
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  {t("dispatchForm.setWhenStatusIsDelivered")}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* DELIVERY TAB */}
                {activeTab === "delivery" && (
                  <div className="space-y-4">
                    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-3">
                        Delivery Person Details
                      </h3>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="delivery_person_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t("dispatchForm.deliveryPersonName")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Full name"
                                  className="h-11 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="delivery_person_contact"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t("dispatchForm.contactNumber")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="+971-50-xxx-xxxx"
                                  className="h-11 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="delivery_person_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t("dispatchForm.emiratesId")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="784-XXXX-XXXXXXX-X"
                                  className="h-11 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="delivery_person_company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t("dispatchForm.companyOrganization")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Company name"
                                  className="h-11 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-3">
                        Delivery Confirmation
                      </h3>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="received_by_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t("dispatchForm.receivedByName")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder={t(
                                    "dispatchForm.whoReceivedTheGift",
                                  )}
                                  className="h-11 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="receiver_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t("dispatchForm.receiverEmiratesId")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="784-XXXX-XXXXXXX-X"
                                  className="h-11 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="delivery_remarks"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-foreground">
                              {t("dispatchForm.deliveryRemarks")}
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder={t(
                                  "dispatchForm.conditionNotesComments",
                                )}
                                rows={3}
                                className="text-sm resize-none"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* DOCUMENTS TAB */}
                {activeTab === "documents" && (
                  <div className="space-y-4">
                    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-border pb-3">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          Dispatch Documents
                        </h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addDocument}
                          className="h-8 gap-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {t("dispatchForm.addDocument")}
                        </Button>
                      </div>

                      {documentFields.length === 0 && (
                        <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
                          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                          <p className="text-sm font-medium text-foreground mb-1">
                            {t("dispatchForm.noDocumentsAddedYet")}
                          </p>
                          <p className="text-xs text-muted-foreground mb-4">
                            Attach certificates, permits, and delivery notes
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addDocument}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            {t("dispatchForm.addDocument")}
                          </Button>
                        </div>
                      )}

                      <div className="space-y-3">
                        {documentFields.map((field, index) => (
                          <div
                            key={field.id}
                            className="p-4 border border-border rounded-xl bg-muted/20 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-foreground">
                                {t("dispatchForm.document")} {index + 1}
                              </h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDocument(index)}
                                className="text-destructive hover:text-destructive h-8"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                {t("dispatchForm.remove")}
                              </Button>
                            </div>

                            <FormField
                              control={form.control}
                              name={`dispatch_documents.${index}.document_type`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs text-muted-foreground">
                                    {t("dispatchForm.documentType")}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Document type (free text)"
                                      className="h-10 text-sm"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`dispatch_documents.${index}.document_attachment`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs text-muted-foreground">
                                    {t("dispatchForm.documentAttachment")}
                                  </FormLabel>
                                  <div className="space-y-2">
                                    {field.value ? (
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 flex items-center gap-2 p-2 bg-muted rounded-md border">
                                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                          <a
                                            href={getFileUrl(field.value)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-primary hover:underline truncate flex-1"
                                            title={field.value}
                                          >
                                            {getFileName(field.value)}
                                          </a>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          className="h-9 w-9 flex-shrink-0"
                                          onClick={() => {
                                            const url = getFileUrl(field.value);
                                            window.open(url, "_blank");
                                          }}
                                          title="View file"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          className="h-9 w-9 flex-shrink-0"
                                          onClick={() => field.onChange("")}
                                          title="Remove file"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex gap-2">
                                        <FormControl>
                                          <Input
                                            value=""
                                            readOnly
                                            placeholder={t(
                                              "dispatchForm.noFileUploaded",
                                            )}
                                            className="flex-1 h-10 text-sm"
                                          />
                                        </FormControl>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          className="h-10 w-10"
                                          onClick={() =>
                                            document
                                              .getElementById(`file-${index}`)
                                              ?.click()
                                          }
                                        >
                                          <Upload className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                    <input
                                      id={`file-${index}`}
                                      type="file"
                                      className="hidden"
                                      onChange={(e) =>
                                        e.target.files?.[0] &&
                                        handleFileUpload(
                                          index,
                                          e.target.files[0],
                                        )
                                      }
                                    />
                                  </div>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`dispatch_documents.${index}.description`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs text-muted-foreground">
                                    {t("dispatchForm.description")}
                                  </FormLabel>
                                  <FormControl>
                                    <Textarea
                                      {...field}
                                      placeholder="Additional notes about this document"
                                      rows={2}
                                      className="text-sm resize-none"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {/* ── Sticky Bottom Nav ─────────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-20 bg-background border-t border-border">
        <div className="px-4 md:px-8 py-3 flex items-center justify-end gap-3 max-w-6xl mx-auto">
          {/* Left: Save as Draft */}
          {/* {wizardIndex < wizardTabs.length - 1 ? (
            <button
              type="button"
              onClick={saveDraft}
              disabled={saveMutation.isPending}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline disabled:opacity-50"
            >
              Save as Draft
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={saveDraft}
                disabled={saveMutation.isPending}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={saveAndExit}
                disabled={saveMutation.isPending}
              >
                Save & Exit
              </Button>
            </div>
          )} */}

          {/* Right: Prev / Next */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={goPrev}
              disabled={wizardIndex <= 0}
              className="h-10 px-5"
            >
              Previous
            </Button>
            {wizardIndex < wizardTabs.length - 1 && (
              <Button
                type="button"
                onClick={goNext}
                disabled={saveMutation.isPending}
                className="h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              >
                Next Step
              </Button>
            )}
            {wizardIndex === wizardTabs.length - 1 && (
              <Button
                type="button"
                onClick={form.handleSubmit(onSubmit)}
                disabled={saveMutation.isPending}
                className="h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              >
                {saveMutation.isPending ? "Saving..." : "Finish"}
              </Button>
            )}
          </div>
        </div>
      </div>
              </div>

              {/* ── Right Sidebar ───────────────────────────────────────────── */}
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  {/* Decorative top area */}
                  <div className="h-20 bg-primary/20 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    <div>
                      <h3 className="text-base font-bold text-foreground">
                        Dispatch Summary
                      </h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        PREVIEW
                      </p>
                    </div>
                    <Separator />

                    {/* Gift Issue */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <Package className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                          GIFT ISSUE
                        </p>
                        <p className="text-sm font-medium text-foreground mt-0.5 italic">
                          {watchedIssue || "Not selected"}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Gift Name */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px]">🎁</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                          GIFT
                        </p>
                        <p className="text-sm font-medium text-foreground mt-0.5">
                          {watchedGiftName || "Not loaded"}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Status */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                          STATUS
                        </p>
                        <div className="mt-0.5">
                          <Badge
                            variant={
                              dispatchStatus === "Delivered"
                                ? "default"
                                : dispatchStatus === "In Transit"
                                  ? "secondary"
                                  : dispatchStatus === "Cancelled"
                                    ? "destructive"
                                    : "outline"
                            }
                            className="text-xs"
                          >
                            {dispatchStatus}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Documents Count */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                          DOCUMENTS
                        </p>
                        <p className="text-sm font-medium text-foreground mt-0.5">
                          {documentFields.length} attached
                        </p>
                      </div>
                    </div>

                    {watchedDispatchDate && (
                      <>
                        <Separator />
                        <div className="flex items-start gap-2.5">
                          <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0 mt-0.5">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                              DISPATCH DATE
                            </p>
                            <p className="text-sm text-foreground mt-0.5">
                              {format(
                                new Date(watchedDispatchDate),
                                "MMM dd, yyyy • h:mm a",
                              )}
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    <Separator />

                    {/* Completion */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">
                          Completion
                        </span>
                        <span className="text-xs font-bold text-primary">
                          {completionPercent}%
                        </span>
                      </div>
                      <Progress value={completionPercent} className="h-1.5" />
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Quick Actions
                  </h3>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start h-10 text-sm"
                    onClick={addDocument}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Document
                  </Button>

                  {isEdit &&
                    dispatchStatus !== "In Transit" &&
                    dispatchStatus !== "Delivered" && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start h-10 text-sm"
                        onClick={() =>
                          form.setValue("dispatch_status", "In Transit")
                        }
                      >
                        <Truck className="h-4 w-4 mr-2" />
                        Mark In Transit
                      </Button>
                    )}

                  {isEdit && dispatchStatus !== "Delivered" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start h-10 text-sm"
                      onClick={() => {
                        form.setValue("dispatch_status", "Delivered");
                        if (!form.watch("actual_delivery_date")) {
                          form.setValue(
                            "actual_delivery_date",
                            format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                          );
                        }
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Delivered
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </Form>
      </div>

      
    </div>
  );
}
