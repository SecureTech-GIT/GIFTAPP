import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Trash2,
  Upload,
  AlertCircle,
  ImageIcon,
  List,
  ScanBarcode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GiftAPI, CategoryAPI, FileAPI, EventAPI } from "@/services/api";
import type { Gift, GiftImage } from "@/types/gift";
import { toast } from "sonner";
import { config } from "@/config/environment";
import { usePromptDialog } from "@/hooks/usePromptDialog";
import { useRole } from "@/contexts/RoleContext";

// ============ VALIDATION SCHEMA ============
const frappeBoolean = z
  .union([z.boolean(), z.number(), z.string()])
  .transform((val) => {
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val === 1;
    if (typeof val === "string") return val === "1" || val === "true";
    return false;
  });

const giftSchema = (t: any, isAdmin: boolean, isEventCoordinator: boolean) =>
  z
    .object({
      gift_name: z
        .string()
        .min(1, t("gift.validation.giftNameRequired"))
        .max(140, t("gift.validation.nameTooLong")),

      event:
        isEventCoordinator && !isAdmin
          ? z.string().min(1, t("gift.validation.eventRequired"))
          : z.string().optional(),

      category: z.string().min(1, t("gift.validation.categoryRequired")),

      description: z.string().optional(),

      barcode_value: z.string().optional(),

      uae_ring_number: z.string().optional(),

      received_datetime: z.string().optional(),

      received_by_name: z.string().optional(),

      received_by_contact: z.string().optional(),

      table_gvlf: z
        .array(
          z.object({
            attribute_name: z
              .string()
              .min(1, t("gift.validation.attributeNameRequired")),

            attribute_type: z
              .enum(["Text", "Number", "Select", "Date", "Checkbox"])
              .default("Text"),

            default_value: z.string().optional(),

            is_mandatory: frappeBoolean.optional(),

            select_options: z.string().optional(),

            display_order: z
              .union([z.number(), z.string()])
              .optional()
              .transform((val) => {
                if (typeof val === "number") return val;
                if (typeof val === "string") return parseInt(val) || 0;
                return 0;
              }),
          }),
        )
        .default([]),

      gift_images: z
        .array(
          z.object({
            image: z.string(),
          }),
        )
        .default([]),
    })
    .superRefine((data, ctx) => {
      data.table_gvlf.forEach((attr, index) => {
        if (attr.is_mandatory && !attr.default_value?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("gift.validation.valueRequired"),
            path: ["table_gvlf", index, "default_value"],
          });
        }

        if (
          attr.attribute_type === "Select" &&
          attr.select_options &&
          attr.default_value
        ) {
          const options = attr.select_options
            .split(/\n|,/)
            .map((o) => o.trim())
            .filter(Boolean);

          if (!options.includes(attr.default_value)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("gift.validation.invalidSelectOption"),
              path: ["table_gvlf", index, "default_value"],
            });
          }
        }
      });
    });

type GiftFormData = z.infer<ReturnType<typeof giftSchema>>;

interface GiftFormProps {
  mode: "create" | "edit";
}

export default function GiftForm({ mode }: GiftFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [hasBarcode, setHasBarcode] = useState(false);
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [showScanner, setShowScanner] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showEventChangeConfirm, setShowEventChangeConfirm] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<GiftFormData | null>(null);
  const { isAdmin, isEventCoordinator, isEventManager, assignedEvents } = useRole();

  // ✅ Tracks which attribute names come from the selected category
  const [categoryAttributeNames, setCategoryAttributeNames] = useState<Set<string>>(new Set());

  const form = useForm<GiftFormData>({
    resolver: zodResolver(giftSchema(t, isAdmin, isEventCoordinator)),
    defaultValues: {
      gift_name: "",
      event: "",
      category: "",
      description: "",
      barcode_value: "",
      uae_ring_number: "",
      received_datetime: "",
      received_by_name: "",
      received_by_contact: "",
      table_gvlf: [],
      gift_images: [],
    },
  });

  // Update form resolver when role changes
  useEffect(() => {
    form.trigger("event");
  }, [isAdmin, isEventCoordinator, form]);

  const {
    fields: attributeFields,
    replace: replaceAttributes,
    append: appendAttribute,
    remove: removeAttribute,
  } = useFieldArray({
    control: form.control,
    name: "table_gvlf",
  });

  const {
    fields: imageFields,
    append: appendImage,
    remove: removeImage,
  } = useFieldArray({
    control: form.control,
    name: "gift_images",
  });

  // ============ DATA FETCHING ============
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["gift-categories"],
    queryFn: async () => {
      const result = await CategoryAPI.list();
      return result.success ? result.data : [];
    },
  });

  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ["gift-events", isEventManager, assignedEvents],
    queryFn: async () => {
      if (isEventManager && assignedEvents.length > 0) {
        const managerFilters: any = { name: ["in", assignedEvents] };
        const res = await EventAPI.list(managerFilters, 1, 200);
        return res.success ? res.data || [] : [];
      }
      const res = await EventAPI.list({}, 1, 200);
      return res.success ? res.data || [] : [];
    },
  });

  const { data: gift, isLoading: isLoadingGift } = useQuery({
    queryKey: ["gift", id],
    queryFn: async () => {
      if (!id) return null;
      const result = await GiftAPI.get(id);
      if (result.success) return result.data;
      throw new Error(result.error);
    },
    enabled: mode === "edit" && !!id,
  });

  const currentGiftEvent = String((gift as any)?.event || "").trim();
  const currentFormEventValue = String(form.watch("event") || "").trim();
  const eventOptions = useMemo(() => {
    const opts = ((events as any[]) || []).map((ev: any) => ({
      value: String(ev?.name || "").trim(),
      label: String(ev?.subject || ev?.name || "").trim(),
    })).filter((opt) => opt.value);

    const fallbackEventValue = currentFormEventValue || currentGiftEvent;
    if (fallbackEventValue && !opts.some((opt) => opt.value === fallbackEventValue)) {
      opts.unshift({ value: fallbackEventValue, label: fallbackEventValue });
    }

    return opts;
  }, [events, currentFormEventValue, currentGiftEvent]);
  const isDeliveredGift = mode === "edit" && (gift as any)?.status === "Delivered";

  // ============ MUTATIONS ============
  const mutation = useMutation({
    mutationFn: async (data: GiftFormData) => {
      const nextEvent = String(data.event || "").trim();
      const payload: Partial<Gift> = {
        gift_name: data.gift_name,
        event: nextEvent || null,
        category: data.category || undefined,
        description: data.description || undefined,
        barcode_value: data.barcode_value || undefined,
        uae_ring_number: data.uae_ring_number || undefined,
        received_datetime: data.received_datetime || undefined,
        received_by_name: data.received_by_name || undefined,
        received_by_contact: data.received_by_contact || undefined,
        table_gvlf: data.table_gvlf.map((d, idx) => ({
          idx: idx + 1,
          doctype: "Gift Category Details",
          parentfield: "table_gvlf",
          parenttype: "Gift",
          attribute_name: d.attribute_name,
          attribute_type: d.attribute_type || "Text",
          default_value: d.default_value || "",
          is_mandatory: d.is_mandatory ? 1 : 0,
          select_options: d.select_options || "",
          display_order: d.display_order || idx,
        })) as any[],
        gift_images: data.gift_images.map((i, idx) => ({
          idx: idx + 1,
          doctype: "Gift Images",
          parentfield: "gift_images",
          parenttype: "Gift",
          image: i.image,
        })) as GiftImage[],
      };

      if (mode === "edit" && id) {
        if (currentGiftEvent !== nextEvent) {
          if (isDeliveredGift) {
            return {
              success: false,
              error: "You cannot change or unassign event for a delivered gift.",
            };
          }

          if (currentGiftEvent) {
            const removeRes = await EventAPI.removeGiftFromEvent(id, currentGiftEvent);
            if (!removeRes.success) {
              return {
                success: false,
                error: removeRes.error || "Failed to unassign gift from current event.",
              };
            }
          }

          if (nextEvent) {
            const addRes = await EventAPI.addGiftToEvent(nextEvent, id);
            if (!addRes.success) {
              return {
                success: false,
                error: addRes.error || "Failed to assign gift to new event.",
              };
            }
          }
        }

        const { event, ...payloadWithoutEvent } = payload as any;
        return GiftAPI.update(id, payloadWithoutEvent);
      }
      return GiftAPI.create(payload);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(
          mode === "edit"
            ? t("gift.messages.updatedSuccessfully")
            : t("gift.messages.createdSuccessfully"),
        );
        queryClient.invalidateQueries({ queryKey: ["gifts"] });
        queryClient.invalidateQueries({ queryKey: ["gift", id] });
        navigate("/gifts");
      } else {
        toast.error(result.error || t("gift.messages.saveFailed"));
      }
    },
    onError: (error) => {
      console.error("Save error:", error);
      toast.error(t("gift.messages.saveFailed"));
    },
  });

  // ============ EFFECTS ============
  const { DialogComponent } = usePromptDialog({
    when: form.formState.isDirty && !mutation.isPending,
    message: t("gift.messages.unsavedChanges"),
    title: t("gift.messages.unsavedTitle"),
  });

  useEffect(() => {
    if (gift && mode === "edit") {
      // ✅ Fetch category attributes to build the protected names set
      if (gift.category) {
        CategoryAPI.getAttributes(gift.category).then((result) => {
          if (result.success && result.data) {
            const names = new Set<string>(
              result.data.map(
                (attr: any) => attr.attribute_name || attr.attribute_label || ""
              )
            );
            setCategoryAttributeNames(names);
          }
        });
      }

      form.reset({
        gift_name: gift.gift_name || "",
        event: (gift as any).event || "",
        category: gift.category || "",
        description: gift.description || "",
        barcode_value: gift?.barcode_value || "",
        uae_ring_number: (gift as any).uae_ring_number || "",
        received_datetime: gift.received_datetime || "",
        received_by_name: gift.received_by_name || "",
        received_by_contact: gift.received_by_contact || "",
        table_gvlf:
          gift.table_gvlf?.map((d) => ({
            attribute_name: d.attribute_name,
            attribute_type: d.attribute_type || "Text",
            default_value: d.default_value || "",
            is_mandatory: !!d.is_mandatory,
            select_options: d.select_options || "",
            display_order:
              typeof d.display_order === "number" ? d.display_order : 0,
          })) || [],
        gift_images:
          gift.gift_images?.map((i) => ({
            image: i.image || "",
          })) || [],
      });
    }
    setHasBarcode(!!gift?.barcode_value);
  }, [gift, mode, form]);

  const handleBarcodeChange = async (value: string) => {
    form.setValue("barcode_value", value, { shouldDirty: true });

    if (!value.trim()) return;

    try {
      const { GiftSearchAPI } = await import("@/services/api");
      const result = await GiftSearchAPI.findByBarcode(value);
      if (result.success && result.data) {
        if (mode === "create" || result.data.name !== id) {
          toast.error(
            t("gift.messages.barcodeAlreadyExists", {
              barcode: value,
              giftName: result.data.gift_name,
            }),
          );
          setTimeout(() => {
            form.setValue("barcode_value", "", { shouldDirty: true });
          }, 100);
        } else {
          toast.info(t("gift.messages.barcodeBelongsToCurrentGift", { value }));
        }
      }
    } catch (error) {
      console.error("Error checking barcode:", error);
    }
  };

  const handleBarcodeScanned = async (barcode: string) => {
    setShowScanner(false);
    await handleBarcodeChange(barcode);
    toast.success(t("gift.messages.barcodeScanned", { barcode }));
  };

  // ============ HANDLERS ============
  const handleCategoryChange = async (categoryValue: string) => {
    form.setValue("category", categoryValue, { shouldDirty: true });

    if (!categoryValue) {
      if (mode === "create") {
        replaceAttributes([]);
        setCategoryAttributeNames(new Set()); // ✅ clear protected set
      }
      return;
    }

    const result = await CategoryAPI.getAttributes(categoryValue);

    if (!result.success) {
      toast.error(result.error || t("gift.messages.failedToLoadAttributes"));
      return;
    }

    const categoryAttributes = result.data || [];

    // ✅ Always update the protected names set when category changes
    const names = new Set<string>(
      categoryAttributes.map(
        (attr: any) => attr.attribute_name || attr.attribute_label || ""
      )
    );
    setCategoryAttributeNames(names);

    if (mode === "create" || attributeFields.length === 0) {
      if (categoryAttributes.length > 0) {
        const mappedAttributes = categoryAttributes.map(
          (attr: any, index: number) => ({
            attribute_name: attr.attribute_name || attr.attribute_label || "",
            attribute_type: attr.attribute_type || "Text",
            default_value: "",
            is_mandatory: !!attr.is_mandatory,
            select_options: attr.select_options || "",
            display_order:
              typeof attr.display_order === "number"
                ? attr.display_order
                : index,
          }),
        );

        replaceAttributes(mappedAttributes);
        toast.success(
          t("gift.messages.attributesLoaded", {
            count: mappedAttributes.length,
          }),
        );
      } else {
        replaceAttributes([]);
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("gift.messages.invalidImageType"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("gift.messages.imageTooLarge"));
      return;
    }

    setUploadingImage(true);

    try {
      const result = await FileAPI.upload(file, false);

      if (result.success && result.data) {
        appendImage({ image: result.data.file_url });
        toast.success(t("gift.messages.imageUploaded"));
      } else {
        toast.error(result.error || t("gift.messages.imageUploadFailed"));
      }
    } catch (error) {
      toast.error(t("gift.messages.imageUploadFailed"));
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const onSubmit = (data: GiftFormData) => {
    const hasBasicErrors =
      !data.gift_name?.trim() || !data.category?.trim();

    const hasMandatoryErrors = data.table_gvlf.some(
      (attr) => attr.is_mandatory && !attr.default_value?.trim()
    );

    if (hasBasicErrors || hasMandatoryErrors) {
      toast.error(t("common.validationError"));
      return;
    }

    if (mode === "edit") {
      const nextEvent = String(data.event || "").trim();
      if (currentGiftEvent !== nextEvent) {
        if (isDeliveredGift) {
          toast.error(t("gifts.cannotChangeDeliveredGiftEvent"));
          return;
        }

        setPendingSubmitData(data);
        setShowEventChangeConfirm(true);
        return;
      }
    }

    mutation.mutate(data);
  };

  const handleSubmitWrapper = (e: React.FormEvent) => {
    e.preventDefault();
    const data = form.getValues();

    const isValid = form.trigger();

    if (isValid) {
      onSubmit(data);
    } else {
      const hasBasicErrors =
        !data.gift_name?.trim() || !data.category?.trim();
      const hasMandatoryErrors = data.table_gvlf.some(
        (attr) => attr.is_mandatory && !attr.default_value?.trim()
      );
      if (hasBasicErrors || hasMandatoryErrors) {
        toast.error(t("common.validationError"));
      }
    }
  };

  const renderAttributeInput = (index: number, placeholder?: string) => {
    const attr = form.watch(`table_gvlf.${index}`);
    const fieldName = `table_gvlf.${index}.default_value` as const;

    switch (attr.attribute_type) {
      case "Select":
        const options = (attr?.select_options || "")
          .split(/\n|,/)
          .map((s) => s.trim())
          .filter(Boolean);
        return (
          <Select
            value={form.watch(fieldName) || ""}
            onValueChange={(val) =>
              form.setValue(fieldName, val, { shouldDirty: true })
            }
          >
            <SelectTrigger>
              <SelectValue
                placeholder={placeholder || t("gift.placeholders.selectValue")}
              />
            </SelectTrigger>
            <SelectContent>
              {options.length > 0 ? (
                options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="__no_options__" disabled>
                  {t("gift.messages.addOptionsFirst")}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        );
      case "Number":
        return (
          <Input
            type="number"
            placeholder={t("gift.placeholders.enterNumber")}
            {...form.register(fieldName)}
          />
        );
      case "Date":
        return <Input type="date" {...form.register(fieldName)} />;
      case "Checkbox":
        return (
          <div className="flex items-center h-10">
            <Checkbox
              checked={
                form.watch(fieldName) === "1" ||
                form.watch(fieldName) === "true"
              }
              onCheckedChange={(checked) =>
                form.setValue(fieldName, checked ? "1" : "0", {
                  shouldDirty: true,
                })
              }
            />
            <span className="ltr:ml-2 rtl:mr-2 text-sm">
              {form.watch(fieldName) === "1" || form.watch(fieldName) === "true"
                ? t("common.yes")
                : t("common.no")}
            </span>
          </div>
        );
      default:
        return (
          <Input
            placeholder={placeholder || t("gift.placeholders.enterValue")}
            {...form.register(fieldName)}
          />
        );
    }
  };

  // ============ LOADING STATES ============
  if (mode === "edit" && isLoadingGift) {
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
            mutation.mutate(pendingSubmitData);
          }
          setShowEventChangeConfirm(false);
          setPendingSubmitData(null);
        }}
        title={t("gifts.confirmEventChangeTitle")}
        subtitle={t("gifts.eventChangeImpactGift")}
        confirmText={t("gifts.confirmEventChangeConfirm")}
        cancelText={t("common.cancel")}
        variant="destructive"
      />
      <div className="flex-1">
        <Form {...form}>
          <form
            onSubmit={handleSubmitWrapper}
            className="space-y-6 max-w-5xl mx-auto lg:px-8 xl:px-12"
          >
            {/* ============ GENERAL INFO ============ */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex md:flex-row flex-col justify-between">
                  {t("gift.sections.generalInfo")}
                </CardTitle>
                <CardDescription>
                  {t("gift.descriptions.generalInfo")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gift_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("gift.labels.giftName")}{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("gift.placeholders.giftName")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("gift.labels.category")}{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={handleCategoryChange}
                          disabled={isLoadingCategories}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t(
                                  "gift.placeholders.selectCategory",
                                )}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories?.map((cat) => (
                              <SelectItem key={cat.name} value={cat.name}>
                                {cat.category_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="uae_ring_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("gift.labels.uaeRing")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("gift.placeholders.uaeRing")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("gift.labels.description")}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t("gift.placeholders.description")}
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem>
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox
                        id="has-barcode"
                        checked={hasBarcode}
                        onCheckedChange={(checked) => {
                          setHasBarcode(!!checked);
                          if (!checked)
                            form.setValue("barcode_value", "", {
                              shouldDirty: true,
                            });
                        }}
                      />
                      <label
                        htmlFor="has-barcode"
                        className="text-sm font-medium cursor-pointer"
                      >
                        {t("gifts.hasBarcode")}
                      </label>
                    </div>
                    <p className="text-muted-foreground block text-xs italic">
                      {t("gifts.autoGenerateIfMissing")}
                    </p>
                    {hasBarcode && (
                      <FormField
                        control={form.control}
                        name="barcode_value"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("gift.labels.barcode")}</FormLabel>
                            <div className="flex gap-2">
                              <FormControl>
                                <Input
                                  placeholder={t("gift.placeholders.barcode")}
                                  value={field.value}
                                  onChange={(e) =>
                                    handleBarcodeChange(e.target.value)
                                  }
                                  className="flex-1"
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="shrink-0 border-blue-200 bg-blue-100 text-blue-700 hover:bg-blue-100 hover:text-blue-700"
                                onClick={() => setShowScanner(true)}
                                title={t("common.scanBarcode")}
                              >
                                <ScanBarcode className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormDescription className="text-xs">
                              {t("gift.descriptions.barcode")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </FormItem>
                </div>
              </CardContent>
            </Card>

            {/* ============ ATTRIBUTES SECTION ============ */}
            <Card>
              <CardHeader className="flex md:flex-row flex-col gap-3 lg:items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {t("gift.sections.attributes")}
                  </CardTitle>
                  <CardDescription>
                    {t("gift.descriptions.attributes")}
                  </CardDescription>
                </div>
                {attributeFields?.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendAttribute({
                        attribute_name: "",
                        attribute_type: "Text",
                        default_value: "",
                        is_mandatory: false,
                        select_options: "",
                        display_order: attributeFields.length,
                      } as any)
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("gift.buttons.addAttribute")}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {attributeFields.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                    <List className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                    <p className="text-sm font-medium text-foreground mb-1">
                      {t("gift.messages.noAttributes")}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {t("gift.descriptions.addAttributes")}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        appendAttribute({
                          attribute_name: "",
                          attribute_type: "Text",
                          default_value: "",
                          is_mandatory: false,
                          select_options: "",
                          display_order: 0,
                        } as any)
                      }
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t("gift.buttons.addAttribute")}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {attributeFields.map((field, index) => {
                      const attr = form.watch(`table_gvlf.${index}`) as any;

                      // ✅ FIX: Check against the server-fetched category attribute names
                      // This works correctly in BOTH create and edit mode
                      const isCategoryAttribute = categoryAttributeNames.has(
                        attr?.attribute_name || ""
                      );
                      const canDelete = !isCategoryAttribute || isAdmin;

                      return (
                        <div
                          key={field.id}
                          className="p-3 border border-border rounded-lg bg-muted/20 relative"
                        >
                          {canDelete && (
                            <div className="absolute top-2 right-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAttribute(index)}
                                className="h-6 w-6 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            {/* Attribute Name */}
                            <div className="space-y-2">
                              <FormField
                                control={form.control}
                                name={`table_gvlf.${index}.attribute_name`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">
                                      {t("gift.labels.attributeName")}
                                      {attr?.is_mandatory && (
                                        <span className="text-destructive ml-1">
                                          *
                                        </span>
                                      )}
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder={t(
                                          "gift.placeholders.attributeName",
                                        )}
                                        {...field}
                                        // ✅ Lock the name field for category attributes
                                        readOnly={isCategoryAttribute && !isAdmin}
                                        className={
                                          isCategoryAttribute && !isAdmin
                                            ? "bg-muted cursor-not-allowed"
                                            : ""
                                        }
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            {/* Value Input */}
                            <div className="space-y-2">
                              <FormField
                                control={form.control}
                                name={`table_gvlf.${index}.default_value`}
                                render={() => (
                                  <FormItem>
                                    <FormLabel className="text-sm">
                                      {t("gift.labels.value")}
                                      {attr?.is_mandatory && (
                                        <span className="text-destructive ml-1">
                                          *
                                        </span>
                                      )}
                                    </FormLabel>
                                    {renderAttributeInput(index)}
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ============ IMAGES SECTION ============ */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {t("gift.sections.images")}
                  </CardTitle>
                  <CardDescription>
                    {t("gift.descriptions.images")}
                  </CardDescription>
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                    disabled={uploadingImage}
                  />
                  {imageFields?.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      asChild
                      disabled={uploadingImage}
                    >
                      <label htmlFor="image-upload" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingImage
                          ? t("common.uploading")
                          : t("gift.buttons.uploadImage")}
                      </label>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {imageFields.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                    <p className="text-sm font-medium text-foreground mb-1">
                      {t("gift.messages.noImages")}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {t("gift.descriptions.addImages")}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      asChild
                      disabled={uploadingImage}
                    >
                      <label htmlFor="image-upload" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        {t("gift.buttons.uploadImage")}
                      </label>
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {imageFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="relative group aspect-square"
                      >
                        <img
                          src={`${config.apiBaseUrl}${form.watch(`gift_images.${index}.image`)}`}
                          alt={`${t("gift.labels.giftImage")} ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg border"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => removeImage(index)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ============ EVENT SECTION ============ */}
            <Card>
              <CardContent className="mt-5">
                <FormField
                  control={form.control}
                  name="event"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("gift.labels.event")}
                        {isEventCoordinator && !isAdmin && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </FormLabel>
                      <div className="relative">
                        <Select
                          value={field.value || ""}
                          onValueChange={(v) =>
                            form.setValue("event", v, { shouldDirty: true })
                          }
                          disabled={isLoadingEvents || isDeliveredGift}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t("gift.placeholders.selectEvent")}
                              />
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
                            className="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-base leading-none"
                            onClick={() =>
                              form.setValue("event", "", { shouldDirty: true })
                            }
                            title={t("common.clear")}
                            disabled={isDeliveredGift}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      {isDeliveredGift && (
                        <Alert variant="destructive" className="mt-3">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {t("gifts.cannotChangeDeliveredGiftEvent")}
                          </AlertDescription>
                        </Alert>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* ============ FOOTER ACTIONS ============ */}
            {form.formState.isDirty && (
              <div className="sticky bottom-0 z-10 bg-background border-t border-border py-4 mt-6">
                <div className="flex items-center justify-end gap-3">
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending
                      ? t("common.saving")
                      : mode === "edit"
                        ? t("gift.buttons.updateGift")
                        : t("gift.buttons.createGift")}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Form>
      </div>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
