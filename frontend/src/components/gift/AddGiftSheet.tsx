/* eslint-disable @typescript-eslint/no-explicit-any */
// components/event/AddGiftSheet.tsx
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ImagePlus, Plus, ScanBarcode } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";

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
import { Textarea } from "@/components/ui/textarea";
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
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryAPI, EventAPI, FileAPI, GiftAPI } from "@/services/api";
import { toast } from "sonner";
import { Upload, Trash2, ImageIcon } from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
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

interface AddGiftSheetProps {
  children: React.ReactNode;
  eventName?: string;
  linkToEvent?: boolean;
  onSuccess?: () => void;
  onCreated?: (giftData: any) => void;
  initialGift?: any;
}

export function AddGiftSheet({
  children,
  eventName,
  linkToEvent = true,
  onSuccess,
  onCreated,
  initialGift,
}: AddGiftSheetProps) {
  const { t } = useTranslation();
  const { isAdmin } = useRole();
  const [open, setOpen] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [showScanner, setShowScanner] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [giftAccordion, setGiftAccordion] = useState<string[]>(["basic"]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [hasBarcode, setHasBarcode] = useState(false);

  const [newGift, setNewGift] = useState({
    gift_name: "",
    category: "",
    description: "",
    barcode_value: "",
    uae_ring_number: "",
    table_gvlf: [] as any[],
    gift_images: [] as Array<{ image: string }>,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if any field has been filled
  const hasUnsavedChanges =
    newGift.gift_name !== "" ||
    newGift.category !== "" ||
    newGift.description !== "" ||
    newGift.barcode_value !== "" ||
    newGift.uae_ring_number !== "" ||
    newGift.table_gvlf.length > 0 ||
    newGift.gift_images.length > 0;

  const handleOpenChange = (newOpen: boolean) => {
    if (
      !newOpen &&
      open &&
      hasUnsavedChanges &&
      !createGiftMutation.isPending
    ) {
      setShowUnsavedDialog(true);
    } else {
      setOpen(newOpen);
      // Reset form and errors when closing
      if (!newOpen) {
        setNewGift({
          gift_name: "",
          category: "",
          description: "",
          barcode_value: "",
          uae_ring_number: "",
          table_gvlf: [],
          gift_images: [],
        });
        setErrors({});
        setHasBarcode(false);
        setGiftAccordion(["basic"]);
      }
    }
  };

  const wasPrefilledRef = useRef(false);
  useEffect(() => {
    if (!open) {
      wasPrefilledRef.current = false;
      return;
    }
    if (!initialGift || wasPrefilledRef.current) return;
    wasPrefilledRef.current = true;
    setNewGift({
      gift_name: initialGift.gift_name || "",
      category: initialGift.category || "",
      description: initialGift.description || "",
      barcode_value: initialGift.barcode_value || "",
      uae_ring_number: initialGift.uae_ring_number || "",
      table_gvlf: Array.isArray(initialGift.table_gvlf)
        ? initialGift.table_gvlf
        : [],
      gift_images: Array.isArray(initialGift.gift_images)
        ? initialGift.gift_images
        : [],
    });
    setHasBarcode(!!initialGift.barcode_value);
  }, [open, initialGift]);

  const { data: giftCategories = [] } = useQuery({
    queryKey: ["gift-categories"],
    queryFn: async () => {
      const result = await CategoryAPI.list();
      return result.success ? result.data || [] : [];
    },
  });

  const handleGiftCategoryChange = async (categoryValue: string) => {
    setNewGift((g) => ({ ...g, category: categoryValue }));
    if (!categoryValue) {
      setNewGift((g) => ({ ...g, table_gvlf: [] }));
      return;
    }
    const result = await CategoryAPI.getAttributes(categoryValue);
    if (!result.success) {
      toast.error(result.error || t("gift.messages.failedToLoadAttributes"));
      return;
    }
    const categoryAttributes = result.data || [];
    if (Array.isArray(categoryAttributes) && categoryAttributes.length > 0) {
      const mappedAttributes = categoryAttributes.map(
        (attr: any, index: number) => ({
          attribute_name: attr.attribute_name || attr.attribute_label || "",
          attribute_type: attr.attribute_type || "Text",
          default_value: "",
          is_mandatory: !!attr.is_mandatory,
          select_options: attr.select_options || "",
          display_order:
            typeof attr.display_order === "number" ? attr.display_order : index,
          from_category: true, // Mark as category-loaded
        }),
      );
      setNewGift((g) => ({ ...g, table_gvlf: mappedAttributes }));
    } else {
      setNewGift((g) => ({ ...g, table_gvlf: [] }));
    }
  };

  const handleGiftImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
        setNewGift((g) => ({
          ...g,
          gift_images: [...g.gift_images, { image: result.data.file_url }],
        }));
        toast.success(t("gift.messages.imageUploaded"));
      } else {
        toast.error(result.error || t("gift.messages.imageUploadFailed"));
      }
    } catch {
      toast.error(t("gift.messages.imageUploadFailed"));
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const renderGiftAttributeInput = (row: any, idx: number) => {
  const fieldValue = row.default_value || "";
  const setVal = (val: string) => {
    setNewGift((g) => ({
      ...g,
      table_gvlf: g.table_gvlf.map((r, i) =>
        i === idx ? { ...r, default_value: val } : r,
      ),
    }));
    if (errors[`attribute_${idx}`]) {
      setErrors(prev => ({ ...prev, [`attribute_${idx}`]: "" }));
    }
  };

  if (row.attribute_type === "Checkbox")
    return (
      <div className="flex items-center h-10">
        <Checkbox
          checked={fieldValue === "1" || fieldValue === "true"}
          onCheckedChange={(c) => setVal(c ? "1" : "0")}
        />
        <span className="ltr:ml-2 rtl:mr-2 text-sm">
          {fieldValue === "1" || fieldValue === "true"
            ? t("common.yes")
            : t("common.no")}
        </span>
      </div>
    );

  if (row.attribute_type === "Date")
    return (
      <div>   {/* ✅ Wrapped in div */}
        <Input
          type="date"
          value={fieldValue}
          onChange={(e) => setVal(e.target.value)}
          className={errors[`attribute_${idx}`] ? "border-destructive" : ""}
        />
        {errors[`attribute_${idx}`] && (   // ✅ Added error message
          <p className="text-sm text-destructive mt-1">{errors[`attribute_${idx}`]}</p>
        )}
      </div>
    );

  if (row.attribute_type === "Number")
    return (
      <div>   {/* ✅ Wrapped in div */}
        <Input
          type="number"
          value={fieldValue}
          onChange={(e) => setVal(e.target.value)}
          className={errors[`attribute_${idx}`] ? "border-destructive" : ""}
        />
        {errors[`attribute_${idx}`] && (   // ✅ Added error message
          <p className="text-sm text-destructive mt-1">{errors[`attribute_${idx}`]}</p>
        )}
      </div>
    );

  if (row.attribute_type === "Select") {
    const options = (row.select_options || "")
      .split(/\n|,/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    return (
      <div>   {/* ✅ Wrapped in div */}
        <Select value={fieldValue} onValueChange={setVal}>
          <SelectTrigger className={errors[`attribute_${idx}`] ? "border-destructive" : ""}>
            <SelectValue placeholder={t("common.select")} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt: string) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors[`attribute_${idx}`] && (   // ✅ Added error message
          <p className="text-sm text-destructive mt-1">{errors[`attribute_${idx}`]}</p>
        )}
      </div>
    );
  }

  // Default: Text
  return (
    <div>
      <Input
        value={fieldValue}
        onChange={(e) => setVal(e.target.value)}
        className={errors[`attribute_${idx}`] ? "border-destructive" : ""}
      />
      {errors[`attribute_${idx}`] && (
        <p className="text-sm text-destructive mt-1">{errors[`attribute_${idx}`]}</p>
      )}
    </div>
  );
};


  const createGiftMutation = useMutation({
    mutationFn: async () => {
      if (!validateForm()) {
        throw new Error(t("common.validationError"));
      }

      const giftPayload: any = {
        gift_name: newGift.gift_name,
        category: newGift.category || undefined,
        description: newGift.description || undefined,
        barcode_value: newGift.barcode_value || undefined,
        uae_ring_number: newGift.uae_ring_number || undefined,
        event: eventName || undefined,
        table_gvlf: (newGift.table_gvlf || []).map((d, idx) => ({
          idx: idx + 1,
          doctype: "Gift Category Details",
          parentfield: "table_gvlf",
          parenttype: "Gift",
          attribute_name: d.attribute_name,
          attribute_type: d.attribute_type || "Text",
          default_value: d.default_value || "",
          is_mandatory: d.is_mandatory ? 1 : 0,
          select_options: d.select_options || "",
          display_order:
            typeof d.display_order === "number" ? d.display_order : idx,
        })) as any,
        gift_images: (newGift.gift_images || []).map((i, idx) => ({
          idx: idx + 1,
          doctype: "Gift Images",
          parentfield: "gift_images",
          parenttype: "Gift",
          image: i.image,
        })) as any,
      };

      // Draft mode (no event yet): return payload to caller, do not create Gift doc
      if (!eventName) {
        return { draft: true, giftPayload };
      }

      const createRes = await GiftAPI.create(giftPayload);

      if (!createRes.success || !createRes.data?.name)
        throw new Error(createRes.error || t("gift.messages.createFailed"));

      if (linkToEvent) {
        const linkRes = await EventAPI.addGiftToEvent(
          eventName,
          createRes.data.name,
        );
        if (!linkRes.success)
          throw new Error(linkRes.error || t("gift.messages.linkFailed"));
        return { gift: createRes.data, link: linkRes.data };
      }

      return { gift: createRes.data };
    },
    onSuccess: (result: any) => {
      if (result?.draft) {
        toast.success(t("gift.messages.giftQueued"));
        if (result?.giftPayload) {
          onCreated?.(result.giftPayload);
        }
      } else {
        toast.success(t("gift.messages.giftAdded"));
      }
      setNewGift({
        gift_name: "",
        category: "",
        description: "",
        barcode_value: "",
        uae_ring_number: "",
        table_gvlf: [],
        gift_images: [],
      });
      setErrors({});
      setHasBarcode(false);
      wasPrefilledRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
      if (eventName) {
        queryClient.invalidateQueries({ queryKey: ["event-gifts", eventName] });
      }
      setOpen(false);
      onSuccess?.();
    },
    onError: (e: any) =>
      toast.error(String(e?.message || e || t("gift.messages.addFailed"))),
  });

  // Helper function to handle accordion navigation
  const handleNext = (nextStep: string) => {
    setGiftAccordion([nextStep]);
  };

  const addCustomAttribute = () => {
    setNewGift((g) => ({
      ...g,
      table_gvlf: [
        ...(g.table_gvlf || []),
        {
          attribute_name: "",
          attribute_type: "Text",
          default_value: "",
          is_mandatory: false,
          select_options: "",
          display_order: (g.table_gvlf || []).length,
          from_category: false, // Mark as user-added
        },
      ],
    }));
  };

  const removeAttribute = (idx: number) => {
    setNewGift((g) => ({
      ...g,
      table_gvlf: (g.table_gvlf || []).filter((_, i) => i !== idx),
    }));
  };

  const handleBarcodeScanned = (barcode: string) => {
    setShowScanner(false);
    setNewGift((g) => ({ ...g, barcode_value: barcode }));
    toast.success(t("gift.messages.barcodeScanned", { barcode }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!newGift.gift_name.trim()) {
      newErrors.gift_name = t("gift.validation.giftNameRequired");
    }

    if (!newGift.category.trim()) {
      newErrors.category = t("gift.validation.categoryRequired");
    }

    // Add inline validation for each mandatory attribute
    (newGift.table_gvlf || []).forEach((row, idx) => {
      if (row?.is_mandatory && !(row?.default_value || "").toString().trim()) {
        newErrors[`attribute_${idx}`] = t("gift.validation.valueRequired");
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <>
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("gift.messages.unsavedTitle")}
            </AlertDialogTitle>
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
                setNewGift({
                  gift_name: "",
                  category: "",
                  description: "",
                  barcode_value: "",
                  uae_ring_number: "",
                  table_gvlf: [],
                  gift_images: [],
                });
                setErrors({});
                setHasBarcode(false);
                setGiftAccordion(["basic"]);
                setOpen(false);
              }}
            >
              {t("common.leavePage")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>{children}</SheetTrigger>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>{t("gift.buttons.addGift")}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <Accordion
              type="multiple"
              value={giftAccordion}
              onValueChange={setGiftAccordion}
            >
              <AccordionItem value="basic">
                <AccordionTrigger className="text-base font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      1
                    </div>
                    {t("gift.sections.basicDetails")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-4">
                  <div className="space-y-1">
                    <Label>{t("gift.labels.giftName")} <span className="text-destructive">*</span></Label>
                    <Input
                      value={newGift.gift_name}
                      onChange={(e) => {
                        setNewGift((g) => ({ ...g, gift_name: e.target.value }));
                        if (errors.gift_name) {
                          setErrors((prev) => ({ ...prev, gift_name: "" }));
                        }
                      }}
                      className={errors.gift_name ? "border-destructive" : ""}
                    />
                    {errors.gift_name && (
                      <p className="text-sm text-destructive">{errors.gift_name}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>{t("gift.labels.category")} <span className="text-destructive">*</span></Label>
                    <Select
                      value={newGift.category}
                      onValueChange={(value) => {
                        handleGiftCategoryChange(value);
                        if (errors.category) {
                          setErrors((prev) => ({ ...prev, category: "" }));
                        }
                      }}
                    >
                      <SelectTrigger className={errors.category ? "border-destructive" : ""}>
                        <SelectValue
                          placeholder={t("gift.placeholders.selectCategory")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(giftCategories as any[]).map((cat: any) => (
                          <SelectItem key={cat.name} value={cat.name}>
                            {cat.category_name || cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.category && (
                      <p className="text-sm text-destructive">{errors.category}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>{t("gift.labels.description")}</Label>
                    <Textarea
                      value={newGift.description}
                      onChange={(e) =>
                        setNewGift((g) => ({
                          ...g,
                          description: e.target.value,
                        }))
                      }
                      rows={3}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>{t("gift.labels.uaeRing")}</Label>
                    <Input
                      value={newGift.uae_ring_number}
                      onChange={(e) =>
                        setNewGift((g) => ({
                          ...g,
                          uae_ring_number: e.target.value,
                        }))
                      }
                      placeholder={t("gift.placeholders.uaeRing")}
                    />
                  </div>

                  {/* Barcode toggle */}
                  <div className="space-y-2">
                    <div className="flex pt-3 items-center gap-2">
                      <Checkbox
                        id="has-barcode-sheet"
                        checked={hasBarcode}
                        onCheckedChange={(checked) => {
                          setHasBarcode(!!checked);
                          if (!checked)
                            setNewGift((g) => ({ ...g, barcode_value: "" }));
                        }}
                      />
                      <label
                        htmlFor="has-barcode-sheet"
                        className="text-sm font-medium cursor-pointer"
                      >
                        {t("gifts.hasBarcode")}
                      </label>
                    </div>
                    <p className="text-muted-foreground mb-3 block text-xs italic">
                      {t("gifts.autoGenerateIfMissing")}
                    </p>
                    {hasBarcode && (
                      <>
                        <div className="flex gap-2">
                          <Input
                            value={newGift.barcode_value}
                            onChange={(e) =>
                              setNewGift((g) => ({
                                ...g,
                                barcode_value: e.target.value,
                              }))
                            }
                            placeholder={t("gift.placeholders.barcode")}
                            className="flex-1"
                          />
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
                      </>
                    )}
                  </div>
                  <div className="">
                    <Button
                      className="w-max mt-4 bg-primary"
                      onClick={() => handleNext("attributes")}
                    >
                      {t("common.addAttributes")}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="attributes">
                <AccordionTrigger className="text-base font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">
                      2
                    </div>
                    {t("gift.sections.attributes")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-4">
                  {newGift.table_gvlf.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t("gift.messages.selectCategoryForAttributes")}
                    </p>
                  ) : (
                    <>
                      {errors.attributes && (
                        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                          <p className="text-sm text-destructive">{errors.attributes}</p>
                        </div>
                      )}
                      <div className="space-y-4">
                      {newGift.table_gvlf.map((row, idx) => {
                        // Only admin can delete category-loaded attributes
                        // User-added attributes (from_category: false) can be deleted by anyone
                        const canDelete = !row?.from_category || isAdmin;

                        return (
                          <div
                            key={idx}
                            className="border border-border rounded-lg p-3 relative"
                          >
                            {/* Delete button - only show if not mandatory or user is admin */}
                            {canDelete && (
                              <div className="absolute top-2 right-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeAttribute(idx)}
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}

                            {/* Specification Name and Value in same row */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>
                                  {t("gift.labels.attributeName")}
                                  {row?.is_mandatory && (
                                    <span className="text-destructive ml-1">
                                      *
                                    </span>
                                  )}
                                </Label>
                                <Input
                                  value={row.attribute_name || ""}
                                  onChange={(e) =>
                                    setNewGift((g) => ({
                                      ...g,
                                      table_gvlf: g.table_gvlf.map((r, i) =>
                                        i === idx
                                          ? {
                                              ...r,
                                              attribute_name: e.target.value,
                                            }
                                          : r,
                                      ),
                                    }))
                                  }
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>
                                  {t("gift.labels.value")}
                                  {row?.is_mandatory && (
                                    <span className="text-destructive ml-1">
                                      *
                                    </span>
                                  )}
                                </Label>
                                {renderGiftAttributeInput(row, idx)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    </>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={addCustomAttribute}
                  >
                    {t("gift.buttons.addAttribute")}
                  </Button>
                  <div className="">
                    <Button
                      className="w-max mt-4 bg-primary"
                      onClick={() => handleNext("images")}
                    >
                      {t("common.addImages")}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="images">
                <AccordionTrigger className="text-base font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                      3
                    </div>
                    {t("gift.sections.images")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-4">
                  {newGift.gift_images.length === 0 ? (
                    // Show upload div when no images
                    <div
                      className="border-2 border-dashed border-primary/50 rounded-xl p-8 text-center cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => imageInputRef.current?.click()}
                      onDrop={(e: React.DragEvent<HTMLDivElement>) => {
                        e.preventDefault();
                      }}
                      onDragOver={(e: React.DragEvent<HTMLDivElement>) =>
                        e.preventDefault()
                      }
                    >
                      <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Upload className="h-5 w-5 text-amber-400" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {t("gift.placeholders.clickToUpload")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("gift.placeholders.imageFormats")}
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        ref={imageInputRef}
                        onChange={handleGiftImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                      {uploadingImage && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {t("common.uploading")}
                        </p>
                      )}
                    </div>
                  ) : (
                    // Show image grid with extra upload box when images exist
                    <div className="grid grid-cols-4 gap-2">
                      {newGift.gift_images.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative group aspect-square rounded-lg overflow-hidden border border-border"
                        >
                          <img
                            src={img.image}
                            alt={`${t("gift.labels.giftImage")} ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setNewGift((g) => ({
                                ...g,
                                gift_images: g.gift_images.filter(
                                  (_, i) => i !== idx,
                                ),
                              }))
                            }
                            className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {/* extra box */}
                      <div
                        className="aspect-square bg-gray-200 rounded-lg border border-dashed border-border 
  flex flex-col items-center justify-center cursor-pointer 
  hover:bg-gray-200 hover:border-primary transition-all group"
                        onClick={() => imageInputRef.current?.click()}
                      >
                        <ImagePlus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />

                        <p className="text-[11px] text-muted-foreground mt-1">
                          {t("gift.uploadImage")}
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        ref={imageInputRef}
                        onChange={handleGiftImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Button
              className="w-full bg-purple-500 text-white mt-6"
              onClick={() => createGiftMutation.mutate()}
              disabled={createGiftMutation.isPending}
            >
              {createGiftMutation.isPending
                ? t("common.saving")
                : t("common.save")}
            </Button>
          </div>
          {showScanner && (
            <BarcodeScanner
              onScan={handleBarcodeScanned}
              onClose={() => setShowScanner(false)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
