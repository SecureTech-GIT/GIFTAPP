/* eslint-disable @typescript-eslint/no-explicit-any */
// components/event/AddGuestSheet.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { GiftRecipientAPI, EventAPI, SalutationAPI } from "@/services/api";
import { toast } from "sonner";

interface AddGuestSheetProps {
  children: React.ReactNode;
  eventName?: string;
  defaultGuestName?: string;
  onSuccess?: (guest?: { id: string; name: string }) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddGuestSheet({
  children,
  eventName,
  onSuccess,
  defaultGuestName,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AddGuestSheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    controlledOnOpenChange?.(next);
    if (controlledOpen === undefined) setUncontrolledOpen(next);
  };
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [salutations, setSalutations] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const res = await SalutationAPI.list('', 200)
      if (res.success) setSalutations(res.data || [])
    })()
  }, [])

  const [participantAccordion, setGuestAccordion] = useState<string[]>([
    "basic",
  ]);

  const [newGuest, setNewGuest] = useState({
    salutation: "",
    guest_first_name: defaultGuestName || "",
    guest_last_name: "",
    vip_level: "",
    preferred_contact_method: "",
    blocked: false,
    is_active: true,
    coordinator_first_name: "",
    coordinator_last_name: "",
    coordinator_email: "",
    coordinator_mobile_no: "",
    coordinator_emirates_id: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if any field has been filled
  const hasUnsavedChanges = 
    newGuest.salutation !== "" ||
    newGuest.guest_first_name !== "" ||
    newGuest.guest_last_name !== "" ||
    newGuest.vip_level !== "" ||
    newGuest.preferred_contact_method !== "" ||
    newGuest.coordinator_first_name !== "" ||
    newGuest.coordinator_last_name !== "" ||
    newGuest.coordinator_email !== "" ||
    newGuest.coordinator_mobile_no !== "" ||
    newGuest.coordinator_emirates_id !== "";

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && open && hasUnsavedChanges && !createGuestMutation.isPending) {
      setShowUnsavedDialog(true);
    } else {
      setOpen(newOpen);
      // Reset form and errors when closing
      if (!newOpen) {
        setNewGuest({
          salutation: "",
          guest_first_name: defaultGuestName || "",
          guest_last_name: "",
          vip_level: "",
          preferred_contact_method: "",
          blocked: false,
          is_active: true,
          coordinator_first_name: "",
          coordinator_last_name: "",
          coordinator_email: "",
          coordinator_mobile_no: "",
          coordinator_emirates_id: "",
        });
        setErrors({});
        setGuestAccordion(["basic"]);
      }
    }
  };

  useEffect(() => {
    if (!open) {
      setGuestAccordion(["basic"]);
    }
  }, [open]);

  useEffect(() => {
    if (defaultGuestName) {
      setNewGuest((prev) => ({
        ...prev,
        guest_first_name: defaultGuestName,
      }));
    }
  }, [defaultGuestName]);

  // Clear preferred contact method if email is removed and Email was selected
  useEffect(() => {
    if (newGuest.preferred_contact_method === "Email" && !newGuest.coordinator_email) {
      setNewGuest((prev) => ({
        ...prev,
        preferred_contact_method: "",
      }));
    }
  }, [newGuest.coordinator_email, newGuest.preferred_contact_method]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!newGuest.guest_first_name.trim()) {
      newErrors.guest_first_name = t("recipients.validation.firstNameRequired");
    }

    if (!newGuest.coordinator_first_name.trim()) {
      newErrors.coordinator_first_name = t("recipients.validation.coordinatorFirstNameRequired");
    }

    if (!newGuest.coordinator_last_name.trim()) {
      // Coordinator last name is optional, so no validation needed
    }

    if (!newGuest.coordinator_mobile_no.trim()) {
      newErrors.coordinator_mobile_no = t("recipients.validation.coordinatorMobileRequired");
    }

    if (newGuest.preferred_contact_method === "Email" && !newGuest.coordinator_email.trim()) {
      newErrors.preferred_contact_method = t("recipients.validation.emailRequiredForEmailContact");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createGuestMutation = useMutation({
    mutationFn: async () => {
      if (!validateForm()) {
        throw new Error(t("common.validationError"));
      }

      const coordinator_full_name =
        `${newGuest.coordinator_first_name || ""} ${newGuest.coordinator_last_name || ""}`.trim();
      if (!coordinator_full_name)
        throw new Error(t("recipients.errors.coordinatorNameRequired"));

      const payload: any = {
        ...newGuest,
        event: eventName || undefined,
        coordinator_full_name,
        preferred_contact_method: (newGuest as any).preferred_contact_method || undefined,
      };

      if (!payload.event) delete payload.event;

      if (typeof payload.coordinator_email === "string") {
        payload.coordinator_email = payload.coordinator_email.trim();
      }
      if (!payload.coordinator_email) delete payload.coordinator_email;

      if (typeof payload.coordinator_emirates_id === "string") {
        payload.coordinator_emirates_id = payload.coordinator_emirates_id.trim();
      }
      if (!payload.coordinator_emirates_id) delete payload.coordinator_emirates_id;

      const createRes = await GiftRecipientAPI.create(payload);
      if (!createRes.success || !createRes.data?.name)
        throw new Error(createRes.error || t("recipients.errors.createFailed"));

      let linkData: any = null;
      if (eventName) {
        const linkRes = await EventAPI.addParticipantToEvent(
          eventName,
          createRes.data.name,
          "Invited",
        );

        if (!linkRes.success) {
          const err = String(linkRes.error || "");
          if (!err.toLowerCase().includes("already added")) {
            throw new Error(linkRes.error || t("recipients.errors.linkFailed"));
          }
        }
        linkData = linkRes.data;
      }

      return { recipient: createRes.data, link: linkData };
    },
    onSuccess: (result: any) => {
      toast.success(t("recipients.messages.guestAdded"));
      setNewGuest({
        salutation: "",
        guest_first_name: "",
        guest_last_name: "",
        vip_level: "",
        preferred_contact_method: "",
        blocked: false,
        is_active: true,
        coordinator_first_name: "",
        coordinator_last_name: "",
        coordinator_email: "",
        coordinator_mobile_no: "",
        coordinator_emirates_id: "",
      });
      setErrors({});
      queryClient.invalidateQueries({ queryKey: ["event-detail", id] });

      if (eventName) {
        queryClient.invalidateQueries({
          queryKey: ["event-participants", eventName],
        });
      }

      queryClient.invalidateQueries({ queryKey: ["gift-recipients"] });
      setOpen(false);
      const recipientId = result?.recipient?.name;
      const displayName =
        result?.recipient?.owner_full_name ||
        `${result?.recipient?.guest_first_name || ""} ${result?.recipient?.guest_last_name || ""}`.trim() ||
        recipientId;
      if (recipientId) {
        onSuccess?.({ id: String(recipientId), name: String(displayName || recipientId) });
      } else {
        onSuccess?.();
      }
    },
    onError: (e: any) =>
      toast.error(String(e?.message || e || t("recipients.errors.addFailed"))),
  });

  // Helper function to handle accordion navigation
  const handleNext = (currentStep: string, nextStep: string) => {
    setGuestAccordion([nextStep]);
  };

  return (
    <>
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("gift.messages.unsavedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("gift.messages.unsavedChanges")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedDialog(false)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowUnsavedDialog(false);
                // Reset form when user chooses to leave
                setNewGuest({
                  salutation: "",
                  guest_first_name: defaultGuestName || "",
                  guest_last_name: "",
                  vip_level: "",
                  preferred_contact_method: "",
                  blocked: false,
                  is_active: true,
                  coordinator_first_name: "",
                  coordinator_last_name: "",
                  coordinator_email: "",
                  coordinator_mobile_no: "",
                  coordinator_emirates_id: "",
                });
                setErrors({});
                setGuestAccordion(["basic"]);
                setOpen(false);
              }}
            >
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>{children}</SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("recipients.buttons.addGuest")}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <Accordion
              type="multiple"
              value={participantAccordion}
              onValueChange={setGuestAccordion}
            >
              <AccordionItem value="basic">
                <AccordionTrigger className="text-base font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      1
                    </div>
                    {t("recipients.sections.basicInfo")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-4">
                  <div className="space-y-1">
                    <Label>{t("recipients.labels.salutation")}</Label>
                    <Select
                      value={newGuest.salutation}
                      onValueChange={(v) =>
                        setNewGuest((p) => ({ ...p, salutation: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("common.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        {salutations.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t("recipients.labels.firstName")} <span className="text-destructive">*</span></Label>
                      <Input
                        value={newGuest.guest_first_name}
                        onChange={(e) => {
                          setNewGuest((p) => ({
                            ...p,
                            guest_first_name: e.target.value,
                          }));
                          if (errors.guest_first_name) {
                            setErrors((prev) => ({ ...prev, guest_first_name: "" }));
                          }
                        }}
                        className={errors.guest_first_name ? "border-destructive" : ""}
                      />
                      {errors.guest_first_name && (
                        <p className="text-sm text-destructive">{errors.guest_first_name}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>{t("recipients.labels.lastName")}</Label>
                      <Input
                        value={newGuest.guest_last_name}
                        onChange={(e) =>
                          setNewGuest((p) => ({
                            ...p,
                            guest_last_name: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>{t("recipients.labels.vipLevel")}</Label>
                    <Input
                      value={newGuest.vip_level}
                      onChange={(e) =>
                        setNewGuest((p) => ({ ...p, vip_level: e.target.value }))
                      }
                      placeholder={t("recipients.placeholders.vipLevel")}
                    />
                  </div>
                  <div className="">
                    <Button
                      className="w-max mt-4 bg-primary"
                      onClick={() => handleNext("basic", "coordinator")}
                    >
                      {t("events.addCoordinator")}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="coordinator">
                <AccordionTrigger className="text-base font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                      2
                    </div>
                    {t("recipients.sections.coordinatorDetails")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t("recipients.labels.coordinatorFirstName")} <span className="text-destructive">*</span></Label>
                      <Input
                        value={newGuest.coordinator_first_name}
                        onChange={(e) => {
                          setNewGuest((p) => ({
                            ...p,
                            coordinator_first_name: e.target.value,
                          }));
                          if (errors.coordinator_first_name) {
                            setErrors((prev) => ({ ...prev, coordinator_first_name: "" }));
                          }
                        }}
                        placeholder={t("common.required")}
                        className={errors.coordinator_first_name ? "border-destructive" : ""}
                      />
                      {errors.coordinator_first_name && (
                        <p className="text-sm text-destructive">{errors.coordinator_first_name}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>{t("recipients.labels.coordinatorLastName")}</Label>
                      <Input
                        value={newGuest.coordinator_last_name}
                        onChange={(e) => {
                          setNewGuest((p) => ({
                            ...p,
                            coordinator_last_name: e.target.value,
                          }));
                          if (errors.coordinator_last_name) {
                            setErrors((prev) => ({ ...prev, coordinator_last_name: "" }));
                          }
                        }}
                        placeholder={t("common.optional")}
                        className={errors.coordinator_last_name ? "border-destructive" : ""}
                      />
                      {errors.coordinator_last_name && (
                        <p className="text-sm text-destructive">{errors.coordinator_last_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t("recipients.labels.coordinatorEmail")}</Label>
                      <Input
                        type="email"
                        value={newGuest.coordinator_email}
                        onChange={(e) => {
                          setNewGuest((p) => ({
                            ...p,
                            coordinator_email: e.target.value,
                          }));
                          if (errors.preferred_contact_method) {
                            setErrors((prev) => ({ ...prev, preferred_contact_method: "" }));
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("recipients.labels.coordinatorMobile")} <span className="text-destructive">*</span></Label>
                      <Input
                        value={newGuest.coordinator_mobile_no}
                        onChange={(e) => {
                          setNewGuest((p) => ({
                            ...p,
                            coordinator_mobile_no: e.target.value,
                          }));
                          if (errors.coordinator_mobile_no) {
                            setErrors((prev) => ({ ...prev, coordinator_mobile_no: "" }));
                          }
                        }}
                        className={errors.coordinator_mobile_no ? "border-destructive" : ""}
                      />
                      {errors.coordinator_mobile_no && (
                        <p className="text-sm text-destructive">{errors.coordinator_mobile_no}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>{t("recipients.labels.coordinatorEmiratesId")}</Label>
                    <Input
                      value={newGuest.coordinator_emirates_id}
                      onChange={(e) =>
                        setNewGuest((p) => ({
                          ...p,
                          coordinator_emirates_id: e.target.value,
                        }))
                      }
                      placeholder={t("common.optional")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("recipients.labels.preferredContactMethod")}</Label>
                    <Select
                      value={newGuest.preferred_contact_method || undefined}
                      onValueChange={(v) => {
                        setNewGuest((p) => ({
                          ...p,
                          preferred_contact_method: v,
                        }));
                        if (errors.preferred_contact_method) {
                          setErrors((prev) => ({ ...prev, preferred_contact_method: "" }));
                        }
                      }}
                    >
                      <SelectTrigger className={errors.preferred_contact_method ? "border-destructive" : ""}>
                        <SelectValue placeholder={t("recipients.placeholders.selectContactMethod")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Email" disabled={!newGuest.coordinator_email}>{t("common.email")}</SelectItem>
                        <SelectItem value="Phone">{t("common.phone")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.preferred_contact_method && (
                      <p className="text-sm text-destructive">{errors.preferred_contact_method}</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Button
              className="w-full bg-purple-500 mt-6"
              onClick={() => createGuestMutation.mutate()}
              disabled={createGuestMutation.isPending}
            >
              {createGuestMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}