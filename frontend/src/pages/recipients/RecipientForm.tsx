/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EventAPI, GiftIssueAPI, GiftRecipientAPI, SalutationAPI } from "@/services/api";
import type { GiftRecipient } from "@/types/gift";
import { toast } from "sonner";
import { usePromptDialog } from "@/hooks/usePromptDialog";
import { useRole } from "@/contexts/RoleContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Austria",
  "Bahrain", "Bangladesh", "Belgium", "Brazil", "Canada", "China", "Denmark",
  "Egypt", "France", "Germany", "India", "Indonesia", "Iran", "Iraq",
  "Ireland", "Italy", "Japan", "Jordan", "Kuwait", "Lebanon", "Malaysia",
  "Mexico", "Netherlands", "New Zealand", "Nigeria", "Norway", "Oman",
  "Pakistan", "Palestine", "Philippines", "Poland", "Portugal", "Qatar",
  "Russia", "Saudi Arabia", "Singapore", "South Africa", "South Korea",
  "Spain", "Sweden", "Switzerland", "Syria", "Thailand", "Turkey",
  "United Arab Emirates", "United Kingdom", "United States", "Yemen",
];

// Define schema
const recipientSchema = (t: any, isAdmin: boolean, isEventCoordinator: boolean) => z.object({
  salutation: z.string().optional(),
  guest_first_name: z.string().min(1, t("recipients.validation.firstNameRequired")),
  guest_last_name: z.string().optional().or(z.literal("")),
  vip_level: z.string().optional().or(z.literal("")),
  preferred_contact_method: z.enum(["", "Email", "Phone"]).optional(),
  guest_nationality: z.string().optional().or(z.literal("")),
  guest_country: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  blocked: z.coerce.boolean().default(false),
  is_active: z.coerce.boolean().default(true),
  event: (isEventCoordinator && !isAdmin) 
    ? z.string().min(1, t("recipients.validation.eventRequired"))
    : z.string().optional().or(z.literal("")),
  coordinator_first_name: z.string().min(1, t("recipients.validation.coordinatorFirstNameRequired")),
  coordinator_last_name: z.string().optional().or(z.literal("")),
  coordinator_email: z.string().email().optional().or(z.literal("")),
  coordinator_mobile_no: z.string().min(1, t("recipients.validation.coordinatorMobileRequired")),
  coordinator_emirates_id: z.string().optional().or(z.literal("")),
});

type RecipientFormData = z.infer<ReturnType<typeof recipientSchema>>;

export default function RecipientForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const queryClient = useQueryClient();
  const [suppressUnsavedPrompt, setSuppressUnsavedPrompt] = useState(false);
  const [showEventChangeConfirm, setShowEventChangeConfirm] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<RecipientFormData | null>(null);
  const eventManuallyClearedRef = useRef(false);
  const { isAdmin, isEventCoordinator, isEventManager, assignedEvents } = useRole();
  
  const { data: events = [] } = useQuery({
    queryKey: ["gift-events", isEventManager, assignedEvents],
    queryFn: async () => {
      // For Event Manager, fetch only assigned events
      if (isEventManager && assignedEvents.length > 0) {
        const managerFilters: any = { name: ["in", assignedEvents] };
        const res = await EventAPI.list(managerFilters, 1, 200);
        return res.success ? res.data || [] : [];
      }
      // For Event Coordinator and Admin, fetch all events
      const res = await EventAPI.list({}, 1, 200);
      return res.success ? res.data || [] : [];
    },
  });


  const deriveCoordinatorParts = (fullName?: string) => {
    const cleaned = (fullName || "").trim();
    if (!cleaned) {
      return { first: "", last: "" };
    }
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return { first: parts[0], last: "" };
    }
    return { first: parts[0], last: parts.slice(1).join(" ") };
  };

  const { data: salutations = [] } = useQuery({
    queryKey: ["salutations"],
    queryFn: async () => {
      const res = await SalutationAPI.list('', 200)
      return res.success ? res.data || [] : []
    },
  });

  const { data: recipient, isLoading } = useQuery({
    queryKey: ["gift-recipient", id],
    queryFn: async () => {
      if (!id) return null;
      const result = await GiftRecipientAPI.get(id);
      return result.success ? result.data : null;
    },
    enabled: isEdit,
  });

  const { data: hasDeliveredAllocations = false } = useQuery({
    queryKey: ["recipient-delivered-allocations", id],
    queryFn: async () => {
      if (!id) return false;
      const res = await GiftIssueAPI.list({ gift_recipient: id, status: "Delivered" }, 1, 1);
      if (!res.success) return false;
      return (res.data || []).length > 0;
    },
    enabled: isEdit && !!id,
  });

  const form = useForm<RecipientFormData>({
    resolver: zodResolver(recipientSchema(t, isAdmin, isEventCoordinator)),
    defaultValues: {
      salutation: "",
      guest_first_name: "",
      guest_last_name: "",
      vip_level: "",
      preferred_contact_method: "",
      guest_nationality: "",
      guest_country: "",
      address: "",
      blocked: false,
      is_active: true,
      event: "",
      coordinator_first_name: "",
      coordinator_last_name: "",
      coordinator_email: "",
      coordinator_mobile_no: "",
      coordinator_emirates_id: "",
    },
  });
  const currentRecipientEvent = String((recipient as any)?.event || "").trim();
const recipientSalutationValue = String((recipient as any)?.salutation || "").trim();
const recipientEventValue = String((recipient as any)?.event || "").trim();
const currentSalutationValue = String(form.watch("salutation") || "").trim();
const currentEventValue = String(form.watch("event") || "").trim();
const salutationOptions = useMemo(() => {
  const opts = (salutations || [])
    .map((s) => String(s || "").trim())
    .filter(Boolean);

  if (recipientSalutationValue && !opts.includes(recipientSalutationValue)) {
    opts.unshift(recipientSalutationValue);
  }

  if (currentSalutationValue && !opts.includes(currentSalutationValue)) {
    opts.unshift(currentSalutationValue);
  }

  return Array.from(new Set(opts));
}, [salutations, recipientSalutationValue, currentSalutationValue]);

const eventOptions = useMemo(() => {
  const opts = ((events as any[]) || []).map((ev: any) => ({
    value: String(ev?.name || "").trim(),
    label: String(ev?.subject || ev?.name || "").trim(),
  })).filter((opt) => opt.value);

  const fallbackEventValue = currentEventValue || recipientEventValue;
  if (fallbackEventValue && !opts.some((opt) => opt.value === fallbackEventValue)) {
    opts.unshift({ value: fallbackEventValue, label: fallbackEventValue });
  }

  return opts;
}, [events, currentEventValue, recipientEventValue]);
  
  // Update form when role changes
  useEffect(() => {
    form.trigger("event");
  }, [isAdmin, isEventCoordinator, form]);

  // Load recipient data in edit mode
  useEffect(() => {
    if (recipient) {
      eventManuallyClearedRef.current = false;
      const derived = deriveCoordinatorParts((recipient as any).coordinator_full_name);
      const legacyMobile = (recipient as any).mobile_number;
      const legacyEmail = (recipient as any).email;

      form.reset({
        salutation: String(recipient.salutation || "").trim(),
        guest_first_name: recipient.guest_first_name || "",
        guest_last_name: recipient.guest_last_name || "",
        vip_level: recipient.vip_level || "",
        guest_nationality: recipient.guest_nationality || "",
        guest_country: recipient.guest_country || "",
        address: recipient.address || "",
        blocked: Boolean((recipient as any).blocked),
        is_active: Boolean((recipient as any).is_active ?? 1),
        event: (recipient as any).event || "",
        coordinator_first_name:
          recipient.coordinator_first_name ||
          derived.first ||
          recipient.guest_first_name ||
          "",
        coordinator_last_name: recipient.coordinator_last_name || derived.last,
        coordinator_email: recipient.coordinator_email || legacyEmail || "",
        coordinator_mobile_no:
          recipient.coordinator_mobile_no ||
          legacyMobile ||
          "",
        coordinator_emirates_id: recipient.coordinator_emirates_id || "",
        preferred_contact_method: (recipient.preferred_contact_method as any) || "",
      });
    }
  }, [recipient, form]);

  useEffect(() => {
    if (!recipient) return;
    if (eventManuallyClearedRef.current) return;

    const expectedSalutation = String((recipient as any)?.salutation || "").trim();
    const expectedEvent = String((recipient as any)?.event || "").trim();
    const formSalutation = String(form.getValues("salutation") || "").trim();
    const formEvent = String(form.getValues("event") || "").trim();

    if (expectedSalutation && !formSalutation) {
      form.setValue("salutation", expectedSalutation, {
        shouldDirty: false,
        shouldTouch: false,
      });
    }

    if (expectedEvent && !formEvent) {
      form.setValue("event", expectedEvent, {
        shouldDirty: false,
        shouldTouch: false,
      });
    }
  }, [recipient, salutationOptions, eventOptions, form]);
  
  const coordinator_email = form.watch('coordinator_email')
  // Auto-fill country from nationality
  useEffect(() => {
    const nationality = form.watch("guest_nationality");
    const country = form.watch("guest_country");
    
    if (nationality && !country) {
      form.setValue("guest_country", nationality);
    }
  }, [form.watch("guest_nationality")]);

  const saveMutation = useMutation({
    mutationFn: async (data: RecipientFormData) => {
      console.log("[RecipientForm] submit", { id, isEdit, event: data.event, data });

      const dataToSend: Partial<GiftRecipient> = { ...data };

      const coordinatorFullName =
        `${data.coordinator_first_name || ""} ${data.coordinator_last_name || ""}`.trim();
      (dataToSend as any).coordinator_full_name = coordinatorFullName || undefined;

      // coordinator_first_name / coordinator_last_name are actual DocType fields.
      // Do not delete them; coordinator_first_name is mandatory on the backend.

      if (typeof (dataToSend as any).event === "string") {
        (dataToSend as any).event = (dataToSend as any).event.trim();
      }
      // Frappe Link fields should be cleared with null (empty string may be ignored).
      if (!(dataToSend as any).event) {
        (dataToSend as any).event = null;
      }

      const nextEvent = String((dataToSend as any).event || "").trim();

      console.log("[RecipientForm] payload", { id, isEdit, payload: dataToSend });

      if (typeof (dataToSend as any).coordinator_email === "string") {
        (dataToSend as any).coordinator_email = (dataToSend as any).coordinator_email.trim();
      }
      if (!(dataToSend as any).coordinator_email) {
        delete (dataToSend as any).coordinator_email;
      }

      if (typeof (dataToSend as any).coordinator_emirates_id === "string") {
        (dataToSend as any).coordinator_emirates_id = (dataToSend as any).coordinator_emirates_id.trim();
      }
      if (!(dataToSend as any).coordinator_emirates_id) {
        delete (dataToSend as any).coordinator_emirates_id;
      }

      if (typeof (dataToSend as any).preferred_contact_method === "string") {
        (dataToSend as any).preferred_contact_method = (dataToSend as any).preferred_contact_method.trim();
      }
      if (!(dataToSend as any).preferred_contact_method) {
        delete (dataToSend as any).preferred_contact_method;
      }

      let res;
      if (isEdit) {
        if (currentRecipientEvent !== nextEvent) {
          if (hasDeliveredAllocations) {
            return {
              success: false,
              error: t("recipients.cannotChangeEventDeliveredAllocations"),
            };
          }

          if (currentRecipientEvent) {
            const removeRes = await EventAPI.removeParticipantFromEvent(currentRecipientEvent, id!);
            if (!removeRes.success) {
              return {
                success: false,
                error: removeRes.error || "Failed to unassign guest from current event.",
              };
            }
          }

          if (nextEvent) {
            const addRes = await EventAPI.addParticipantToEvent(nextEvent, id!);
            if (!addRes.success) {
              return {
                success: false,
                error: addRes.error || "Failed to assign guest to new event.",
              };
            }
          }
        }

        const { event, ...payloadWithoutEvent } = dataToSend as any;
        res = await GiftRecipientAPI.update(id!, payloadWithoutEvent);
      } else {
        res = await GiftRecipientAPI.create(dataToSend);
      }

      console.log("[RecipientForm] save response", res);
      return res;
    },
    onSuccess: (result) => {
      console.log("[RecipientForm] onSuccess", result);
      if (result.success) {
        toast.success(
          isEdit
            ? t("recipients.messages.updated")
            : t("recipients.messages.created"),
        );
        queryClient.invalidateQueries({ queryKey: ["gift-recipients"] });
        setSuppressUnsavedPrompt(true);
        form.reset(form.getValues());
        navigate("/recipients", { replace: true });
      } else {
        toast.error(result.error || t("recipients.errors.saveFailed"));
      }
    },
    onError: (error) => {
      console.error("[RecipientForm] onError", error);
      toast.error(t("recipients.errors.saveError"));
      console.error(error);
    },
  });

  const { DialogComponent } = usePromptDialog({
    when: !suppressUnsavedPrompt && form.formState.isDirty && !saveMutation.isPending,
    message: t("common.unsavedChangesMessage"),
    title: t("common.unsavedChanges"),
  });

  const onSubmit = (data: RecipientFormData) => {
    console.log("[RecipientForm] onSubmit called", { id, isEdit, event: data.event });

    if (isEdit) {
      const nextEvent = String(data.event || "").trim();
      if (currentRecipientEvent !== nextEvent) {
        if (hasDeliveredAllocations) {
          toast.error(t("recipients.cannotChangeEventDeliveredAllocations"));
          return;
        }

        setPendingSubmitData(data);
        setShowEventChangeConfirm(true);
        return;
      }
    }

    saveMutation.mutate(data);
  };

  const onInvalid = (errors: any) => {
    console.warn("[RecipientForm] onInvalid (validation blocked submit)", {
      id,
      isEdit,
      errors,
      values: form.getValues(),
    });
    toast.error(t("common.validationError") || "Validation error")
  };

  const handleCancel = () => {
    if (form.formState.isDirty) {
      setSuppressUnsavedPrompt(true);
    }
    navigate("/recipients", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-svh bg-background">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background flex flex-col">
      {DialogComponent}
      <ConfirmDialog
        open={showEventChangeConfirm}
        onClose={() => {
          setShowEventChangeConfirm(false);
          setPendingSubmitData(null);
        }}
        onConfirm={() => {
          if (pendingSubmitData) {
            saveMutation.mutate(pendingSubmitData);
          }
          setShowEventChangeConfirm(false);
          setPendingSubmitData(null);
        }}
        title={t("recipients.confirmEventChangeTitle")}
        subtitle={t("recipients.eventChangeImpactRecipient")}
        confirmText={t("recipients.confirmEventChangeConfirm")}
        cancelText={t("common.cancel")}
        variant="destructive"
      />

      {/* Body */}
      <div className="flex-1 max-w-5xl  md:mx-auto  md:px-8 xl:px-12 py-6">
        <Form {...form}>
          <form
            onSubmit={(e) => {
              console.log("[RecipientForm] form submit event", {
                id,
                isEdit,
                defaultPrevented: e.defaultPrevented,
              });
              return form.handleSubmit(onSubmit, onInvalid)(e);
            }}
            className="space-y-5"
          >
          {/* Guest Info */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-3">
              {t("recipients.sections.guestInfo")}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  {t("recipients.labels.salutation")}
                </Label>
                <Select
                  value={form.watch("salutation")}
                  onValueChange={(v) => form.setValue("salutation", v, { shouldDirty: true })}
                >
                  <SelectTrigger className="h-11 text-sm">
                    <SelectValue placeholder={t("common.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {salutationOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  {t("recipients.labels.firstName")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...form.register("guest_first_name")}
                  placeholder={t("common.required")}
                  className="h-11 text-sm"
                />
                {form.formState.errors.guest_first_name && (
                  <p className="text-sm text-destructive">{form.formState.errors.guest_first_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  {t("recipients.labels.lastName")}
                </Label>
                <Input
                  {...form.register("guest_last_name")}
                  placeholder={t("common.optional")}
                  className="h-11 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                {t("recipients.labels.vipLevel")}
              </Label>
              <Input
                {...form.register("vip_level")}
                placeholder={t("recipients.placeholders.vipLevel")}
                className="h-11 text-sm"
              />
            </div>
          </div>

          {/* Coordinator Info */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-3">
              {t("recipients.sections.coordinatorInfo")}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  {t("recipients.labels.coordinatorFirstName")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...form.register("coordinator_first_name")}
                  placeholder={t("common.required")}
                  className="h-11 text-sm"
                />
                {form.formState.errors.coordinator_first_name && (
                  <p className="text-sm text-destructive">{form.formState.errors.coordinator_first_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  {t("recipients.labels.coordinatorLastName")}{" "}
                  {/* <span className="text-destructive">*</span> */}
                </Label>
                <Input
                  {...form.register("coordinator_last_name")}
                  placeholder={t("common.required")}
                  className="h-11 text-sm"
                />
                {form.formState.errors.coordinator_last_name && (
                  <p className="text-sm text-destructive">{form.formState.errors.coordinator_last_name.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  {t("recipients.labels.coordinatorEmail")}
                </Label>
                <Input
                  type="email"
                  {...form.register("coordinator_email")}
                  placeholder={t("common.optional")}
                  className="h-11 text-sm"
                />
                {form.formState.errors.coordinator_email && (
                  <p className="text-sm text-destructive">{form.formState.errors.coordinator_email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  {t("recipients.labels.coordinatorPhone")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...form.register("coordinator_mobile_no")}
                  placeholder={t("common.required")}
                  className="h-11 text-sm"
                />
                {form.formState.errors.coordinator_mobile_no && (
                  <p className="text-sm text-destructive">{form.formState.errors.coordinator_mobile_no.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                {t("recipients.labels.preferredContactMethod")}
              </Label>
              <Select
                value={form.watch("preferred_contact_method")}
                onValueChange={(v) => form.setValue("preferred_contact_method", v as any, { shouldDirty: true })}
              >
                <SelectTrigger className="h-11 text-sm">
                  <SelectValue placeholder={t("recipients.placeholders.selectContactMethod")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Email" disabled={!coordinator_email}>{t("common.email")}</SelectItem>
                  <SelectItem value="Phone" >{t("common.phone")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                {t("recipients.labels.coordinatorEmiratesId")}
              </Label>
              <Input
                {...form.register("coordinator_emirates_id")}
                placeholder={t("recipients.placeholders.emiratesId")}
                className="h-11 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {t("recipients.hints.emiratesIdFormat")}
              </p>
            </div>
          </div>

          {/* Event Info */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-3">
              {t("recipients.sections.eventInfo")}
            </h3>

            <div className="space-y-2">
              <FormField
                control={form.control}
                name="event"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">
                      {t("recipients.labels.event")}
                      {isEventCoordinator && !isAdmin && <span className="text-destructive ml-1">*</span>}
                    </FormLabel>
                    <div className="relative">
                      <Select
                        value={field.value || ""}
                        onValueChange={(v) => field.onChange(v)}
                        disabled={hasDeliveredAllocations}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11 text-sm">
                            <SelectValue placeholder={t("recipients.placeholders.selectEvent")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {eventOptions.map((ev) => (
                            <SelectItem key={ev.value} value={ev.value}>
                              {ev.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {field.value && (
                        <button
                          type="button"
                          className="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-base leading-none z-10"
                          onClick={() => {
                            eventManuallyClearedRef.current = true;
                            field.onChange("");
                          }}
                          title={t("common.clear")}
                          disabled={hasDeliveredAllocations}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {hasDeliveredAllocations && (
                      <p className="text-xs text-destructive">
                        {t("recipients.cannotChangeEventDeliveredAllocations")}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Sticky Bottom Nav */}
          <div className="sticky bottom-0 z-20 bg-background border-t border-border -mx-6 lg:-mx-8 xl:-mx-12 px-6 lg:px-8 xl:px-12">
            <div className="py-3 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="h-10 px-5"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="h-10 px-6 bg-primary text-primary-foreground font-semibold"
                onClick={() => {
                  console.log("[RecipientForm] submit button click", {
                    id,
                    isEdit,
                    isDirty: form.formState.isDirty,
                    isValid: form.formState.isValid,
                    pending: saveMutation.isPending,
                    values: form.getValues(),
                  });
                }}
              >
                {saveMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ltr:mr-2 rtl:ml-2" />
                    {t("common.saving")}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {isEdit
                      ? t("recipients.buttons.update")
                      : t("recipients.buttons.create")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
        </Form>
      </div>
    </div>
  );
}