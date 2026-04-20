import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  Eye,
  Search,
  FolderOpen,
  Info,
  Check,
  X,
  CheckCircle2,
  Minus,
  AlertCircle,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/Pagination";
import { GiftCategoryAPI, DocTypeAPI } from "@/services/api";
import type { GiftCategory } from "@/types/gift";
import { toast } from "sonner";
import { usePrompt } from "@/hooks/usePrompt";
import { useDebounce } from "@/hooks/useDebounce";
import { useTranslation } from "react-i18next";

const ATTRIBUTE_TYPES = [
  "Text",
  "Number",
  "Select",
  "Date",
  "Checkbox",
] as const;

interface CategoryAttribute {
  attribute_name: string;
  attribute_type: "Text" | "Number" | "Select" | "Date" | "Checkbox";
  is_mandatory: boolean;
  select_options: string;
  display_order: number;
}

interface FormData {
  category_name: string;
  category_type: string;
  description: string;
  requires_maintenance: boolean;
  category_attributes: CategoryAttribute[];
}

const defaultAttribute = (): CategoryAttribute => ({
  attribute_name: "",
  attribute_type: "Text",
  is_mandatory: false,
  select_options: "",
  display_order: 0,
});

// Color mapping for different category types
const TYPE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  Electronics: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-200",
  },
  Other: {
    bg: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-200",
  },
  Artwork: {
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-200",
  },
  Jewelry: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  "Physical Item": {
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-200",
  },
  "Legacy Heritage Assets": {
    bg: "bg-indigo-100",
    text: "text-indigo-800",
    border: "border-indigo-200",
  },
  "Sacred Manuscripts": {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  "Royal Artifact Sculptures": {
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-200",
  },
  "Royal Jewelry Collection": {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  "Imperial Electronics": {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-200",
  },
};

// Fallback colors for unspecified types
const FALLBACK_COLORS = [
  { bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-200" },
  { bg: "bg-pink-100", text: "text-pink-800", border: "border-pink-200" },
  { bg: "bg-cyan-100", text: "text-cyan-800", border: "border-cyan-200" },
  { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-200" },
  { bg: "bg-teal-100", text: "text-teal-800", border: "border-teal-200" },
  { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-200" },
  {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  { bg: "bg-violet-100", text: "text-violet-800", border: "border-violet-200" },
  {
    bg: "bg-fuchsia-100",
    text: "text-fuchsia-800",
    border: "border-fuchsia-200",
  },
];

// Helper function to get badge colors based on type
const getBadgeColors = (type: string, variant: "chip" | "outline" = "chip") => {
  const defaultColors = {
    chip: {
      bg: "bg-gray-100",
      text: "text-gray-800",
      border: "border-gray-200",
    },
    outline: {
      bg: "bg-transparent",
      text: "text-gray-700",
      border: "border-gray-300",
    },
  };

  // Handle undefined, null, or empty type
  if (!type) {
    return variant === "outline"
      ? {
          bg: "bg-transparent",
          text: "text-gray-700",
          border: "border-gray-300",
        }
      : { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-200" };
  }

  if (variant === "outline") {
    return {
      bg: "bg-transparent",
      text: TYPE_COLORS[type]?.text || "text-blue-700",
      border: TYPE_COLORS[type]?.border || "border-blue-300",
    };
  }

  // For chip-style badges
  if (TYPE_COLORS[type]) {
    return TYPE_COLORS[type];
  }

  // Generate consistent fallback color for unspecified types
  const hash = type
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const fallbackIndex = hash % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[fallbackIndex];
};

// Badge component with dynamic colors
const DynamicBadge = ({
  type,
  variant = "chip",
  children,
  className = "",
}: {
  type: string;
  variant?: "chip" | "outline";
  children: React.ReactNode;
  className?: string;
}) => {
  const colors = getBadgeColors(type, variant);

  if (variant === "outline") {
    return (
      <Badge
        variant="outline"
        className={`${colors.text} ${colors.border || "border-blue-600"} ${className}`}
      >
        {children}
      </Badge>
    );
  }

  return (
    <Badge
      className={`${colors.bg} ${colors.text} border ${colors.border || "border-blue-600"} hover:${colors.bg} ${className}`}
    >
      {children}
    </Badge>
  );
};

export default function CategoryList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingCategory, setViewingCategory] = useState<GiftCategory | null>(
    null,
  );
  const [editingCategory, setEditingCategory] = useState<GiftCategory | null>(
    null,
  );
  const [formData, setFormData] = useState<FormData>({
    category_name: "",
    category_type: "",
    description: "",
    requires_maintenance: false,
    category_attributes: [],
  });
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [deleteCategoryName, setDeleteCategoryName] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Debounce search
  const debouncedSearch = useDebounce(search, 500);

  const queryClient = useQueryClient();

  // Fetch category type options from backend
  const { data: categoryTypes = [] } = useQuery({
    queryKey: ["field-options", "Gift Category", "category_type"],
    queryFn: async () => {
      const result = await DocTypeAPI.getFieldOptions(
        "Gift Category",
        "category_type",
      );
      return result.success ? result.data : [];
    },
  });

  // Fetch categories with server-side pagination
  const {
    data: categoriesResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "gift-categories-paginated",
      debouncedSearch,
      currentPage,
      itemsPerPage,
    ],
    queryFn: async () => {
      const result = await GiftCategoryAPI.list(
        debouncedSearch,
        currentPage,
        itemsPerPage,
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch categories");
      }

      return result;
    },
  });

  // Extract categories
  const categories = categoriesResponse?.data || [];
  const totalItems = categoriesResponse?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Validate category name
    if (!formData.category_name.trim()) {
      errors.category_name = t("categories.validation.categoryNameRequired");
    }

    // Validate category type
    if (!formData.category_type.trim()) {
      errors.category_type = t("categories.validation.categoryTypeRequired");
    }

    // Validate attributes
    formData.category_attributes.forEach((attr, index) => {
      if (!attr.attribute_name.trim()) {
        errors[`attribute_name_${index}`] = t("categories.validation.attributeNameRequired");
      }
      if (attr.attribute_type === "Select" && !attr.select_options.trim()) {
        errors[`select_options_${index}`] = t("categories.validation.selectOptionsRequired");
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate form before saving
      if (!validateForm()) {
        return { success: false, error: t("categories.validation.fixAllRequiredFields") };
      }

      const payload: Partial<GiftCategory> = {
        ...(editingCategory ? { name: editingCategory.name } : {}),
        category_name: formData.category_name,
        category_type: formData.category_type,
        description: formData.description,
        requires_maintenance: formData.requires_maintenance ? 1 : 0,
        category_attributes: formData.category_attributes.map((attr, idx) => ({
          attribute_name: attr.attribute_name,
          attribute_type: attr.attribute_type,
          is_mandatory: attr.is_mandatory ? 1 : 0,
          select_options: attr.select_options.trim(),
          display_order: idx,
        })),
      };

      if (editingCategory) {
        return GiftCategoryAPI.update(editingCategory.name, payload);
      }
      return GiftCategoryAPI.create(payload);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(
          editingCategory
            ? t("categories.categoryUpdatedSuccessfully")
            : t("categories.categoryCreatedSuccessfully"),
        );
        // Invalidate all category-related queries to handle name changes
        queryClient.invalidateQueries({
          queryKey: ["gift-categories-paginated"],
        });
        queryClient.invalidateQueries({
          queryKey: ["field-options", "Gift Category", "category_type"],
        });
        // Also invalidate any individual category queries
        queryClient.invalidateQueries({
          queryKey: ["gift-category"],
        });
        setIsFormDirty(false);
        closeDialog();
      } else {
        toast.error(result.error || t("categories.failedToSaveCategory"));
      }
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (name: string) => GiftCategoryAPI.delete(name),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("categories.categoryDeletedSuccessfully"));
        queryClient.invalidateQueries({
          queryKey: ["gift-categories-paginated"],
        });
        setDeleteCategoryName(null);
      } else {
        toast.error(result.error || t("categories.failedToDeleteCategory"));
      }
    },
  });

  usePrompt({
    when: isFormDirty && dialogOpen && !saveMutation.isPending,
    message: t("categories.unsavedChanges"),
  });

  // View category details
  const openViewDialog = async (category: GiftCategory) => {
    const result = await GiftCategoryAPI.get(category.name);
    if (result.success && result.data) {
      setViewingCategory(result.data);
      setViewDialogOpen(true);
    }
  };

  // Open edit dialog
  const openEditDialog = async (category?: GiftCategory) => {
    // Clear validation errors when opening dialog
    setValidationErrors({});
    
    if (category) {
      const result = await GiftCategoryAPI.get(category.name);
      if (result.success && result.data) {
        const fullCategory = result.data;
        setEditingCategory(fullCategory);
        setFormData({
          category_name: fullCategory.category_name,
          category_type: fullCategory.category_type || "",
          description: fullCategory.description || "",
          requires_maintenance: Boolean(fullCategory.requires_maintenance),
          category_attributes:
            fullCategory.category_attributes?.map((attr) => ({
              attribute_name: attr.attribute_name,
              attribute_type: attr.attribute_type || "Text",
              is_mandatory: Boolean(attr.is_mandatory),
              select_options: attr.select_options || "",
              display_order: attr.display_order || 0,
            })) || [],
        });
      }
    } else {
      setEditingCategory(null);
      setFormData({
        category_name: "",
        category_type: categoryTypes[0] || "",
        description: "",
        requires_maintenance: false,
        category_attributes: [],
      });
    }
    setIsFormDirty(false);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    setIsFormDirty(false);
    setValidationErrors({});
  };

  const requestDelete = (name: string) => {
    setDeleteCategoryName(name);
  };

  const handleDelete = (name: string) => {
    deleteMutation.mutate(name);
  };

  const addAttribute = () => {
    setFormData({
      ...formData,
      category_attributes: [
        ...formData.category_attributes,
        defaultAttribute(),
      ],
    });
    setIsFormDirty(true);
  };

  const removeAttribute = (index: number) => {
    setFormData({
      ...formData,
      category_attributes: formData.category_attributes.filter(
        (_, i) => i !== index,
      ),
    });
    setIsFormDirty(true);
  };

  const updateAttribute = <K extends keyof CategoryAttribute>(
    index: number,
    field: K,
    value: CategoryAttribute[K],
  ) => {
    const updated = [...formData.category_attributes];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, category_attributes: updated });
    setIsFormDirty(true);
  };

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, itemsPerPage]);

  // Error handling
  useEffect(() => {
    if (error) {
      console.error("Failed to load categories:", error);
      toast.error(t("categories.failedToLoadCategories"));
    }
  }, [error]);

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6 flex md:flex-row flex-col md:items-center gap-4">
          {/* Search Input */}
          <div className="relative md:flex-1">
            <Search className="ltr:absolute ltr:left-3 rtl:absolute rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("categories.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ltr:pl-9 rtl:pr-9 ltr:pr-9 rtl:pl-9"
            />
            {debouncedSearch !== search ? (
              <div className="ltr:absolute ltr:right-3 rtl:absolute rtl:left-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
              </div>
            ) : search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="ltr:absolute ltr:right-3 rtl:absolute rtl:left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {/* Add Button */}
          <Button variant="outline" onClick={() => openEditDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            {t("categories.addCategory")}
          </Button>
        </CardContent>
      </Card>

      {/* Results Count */}
      {!isLoading && categories.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
          {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}{" "}
          {t("categories.title").toLowerCase()}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="table-header">
                  {t("categories.name")}
                </TableHead>
                <TableHead className="hidden md:table-cell table-header">
                  {t("categories.type")}
                </TableHead>
                <TableHead className="hidden lg:table-cell table-header">
                  {t("categories.specifications")}
                </TableHead>
                <TableHead className="hidden xl:table-cell table-header">
                  {t("categories.description")}
                </TableHead>
                <TableHead className="text-right table-header">
                  {t("categories.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      <span className="text-muted-foreground">
                        {t("categories.loadingCategories")}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : categories?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <p className="text-muted-foreground font-medium">
                      {t("categories.noCategoriesFound")}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {search
                        ? t("categories.tryAdjustingSearch")
                        : t("categories.createFirstCategory")}
                    </p>
                    {!search && (
                      <Button
                        onClick={() => openEditDialog()}
                        size="sm"
                        className="mt-3"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t("categories.addCategory")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                categories?.map((cat) => (
                  <TableRow
                    key={cat.name}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openViewDialog(cat)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{cat.category_name}</p>
                        <div className="flex items-center gap-2 mt-1 md:hidden">
                          <DynamicBadge
                            type={cat.category_type || "Other"}
                            variant="chip"
                          >
                            {cat.category_type || "Other"}
                          </DynamicBadge>
                        </div>
                        {(cat.category_attributes?.length ?? 0) > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 lg:hidden">
                            {cat.category_attributes?.length}{" "}
                            {t("categories.specifications").toLowerCase()}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <DynamicBadge
                        type={cat.category_type || "Other"}
                        variant="outline"
                      >
                        {cat.category_type || "Other"}
                      </DynamicBadge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge
                        className="bg-amber-100 text-amber-800"
                        variant="secondary"
                      >
                        {cat.category_attributes?.length || 0}{" "}
                        {t("categories.specifications").toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground max-w-[200px] truncate">
                      {cat.description || "-"}
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
                          <DropdownMenuItem onClick={() => openViewDialog(cat)}>
                            <Eye className="h-4 w-4 mr-2" />
                            {t("categories.view")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(cat)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t("categories.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => requestDelete(cat.name)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t("categories.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {!isLoading && categories.length > 0 && (
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

      {/* View Dialog */}
      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-[90vw] rounded-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("categories.categoryDetails")}</DialogTitle>
          </DialogHeader>

          {viewingCategory && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">
                    {t("categories.categoryName")}
                  </Label>
                  <p className="font-medium">{viewingCategory.category_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">
                    {t("categories.type")}
                  </Label>
                  <div className="mt-1">
                    <DynamicBadge
                      type={viewingCategory.category_type || "Other"}
                      variant="chip"
                    >
                      {viewingCategory.category_type || "Other"}
                    </DynamicBadge>
                  </div>
                </div>
              </div>

              {viewingCategory.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">
                    {t("categories.description")}
                  </Label>
                  <p className="text-sm">{viewingCategory.description}</p>
                </div>
              )}

              {/* Updated Maintenance Section - Info Badge Style */}
              <div>
                {viewingCategory.requires_maintenance ? (
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-800">
                    {t("categories.requiresRegularMaintenance")}
                  </span>
                </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      {t("categories.doesNotRequireRegularMaintenance")}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">
                  {t("categories.categorySpecifications")} (
                  {viewingCategory.category_attributes?.length || 0})
                </h4>
                {viewingCategory.category_attributes &&
                viewingCategory.category_attributes.length > 0 ? (
                  <>
                    {/* Mobile card list */}
                    <div className="sm:hidden space-y-2">
                      {viewingCategory.category_attributes.map((attr, index) => (
                        <div key={index} className="flex items-start justify-between rounded-lg border p-3 text-sm gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{attr.attribute_name}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-0">
                                {attr.attribute_type}
                              </Badge>
                              {attr.attribute_type === "Select" && attr.select_options && (
                                <span className="text-xs text-muted-foreground">{attr.select_options}</span>
                              )}
                            </div>
                          </div>
                          {attr.is_mandatory ? (
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-medium shrink-0">
                              <Check className="h-3 w-3" />
                              {t("common.yes")}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-300 text-gray-600 rounded-full text-xs font-medium shrink-0">
                              <X className="h-3 w-3" />
                              {t("common.no")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs font-semibold ">
                            {t("categories.specificationName")}
                          </TableHead>
                          <TableHead className="text-xs font-semibold  w-[120px]">
                            {t("categories.type")}
                          </TableHead>
                          <TableHead className="text-xs font-semibold  w-[100px] text-center">
                            {t("gifts.mandatory")}
                          </TableHead>
                          <TableHead className="text-xs font-semibold ">
                            {t("categories.options")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingCategory.category_attributes.map(
                          (attr, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                {attr.attribute_name}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-0"
                                >
                                  {attr.attribute_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                {attr.is_mandatory ? (
                                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-medium">
                                    <Check className="h-3 w-3" />
                                    {t("common.yes")}
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-300 text-gray-600 rounded-full text-xs font-medium">
                                    <X className="h-3 w-3" />
                                    {t("common.no")}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {attr.attribute_type === "Select" &&
                                attr.select_options
                                  ? attr.select_options
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("categories.noAttributesDefined")}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              {t("categories.close")}
            </Button>
            <Button
              onClick={() => {
                setViewDialogOpen(false);
                if (viewingCategory) openEditDialog(viewingCategory);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              {t("categories.editCategory")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* create-edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[90vw] rounded-lg md:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCategory
                ? t("categories.editCategory")
                : t("categories.newCategory")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>
                    {t("categories.categoryName")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={formData.category_name}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        category_name: e.target.value,
                      });
                      setIsFormDirty(true);
                      // Clear validation error when user starts typing
                      if (validationErrors.category_name) {
                        setValidationErrors(prev => ({ ...prev, category_name: "" }));
                      }
                    }}
                    placeholder={t("categories.categoryNamePlaceholder")}
                    className={validationErrors.category_name ? "border-red-500" : ""}
                  />
                  {validationErrors.category_name && (
                    <p className="text-sm text-red-500 mt-1">{validationErrors.category_name}</p>
                  )}
                </div>
                <div>
                  <Label>{t("categories.categoryType")}</Label>
                  <Select
                    value={formData.category_type}
                    onValueChange={(v) => {
                      setFormData({ ...formData, category_type: v });
                      setIsFormDirty(true);
                      // Clear validation error when user selects a type
                      if (validationErrors.category_type) {
                        setValidationErrors(prev => ({ ...prev, category_type: "" }));
                      }
                    }}
                  >
                    <SelectTrigger className={validationErrors.category_type ? "border-red-500" : ""}>
                      <SelectValue placeholder={t("categories.selectType")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validationErrors.category_type && (
                    <p className="text-sm text-red-500 mt-1">{validationErrors.category_type}</p>
                  )}
                </div>
              </div>

              <div>
                <Label>{t("categories.description")}</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    setIsFormDirty(true);
                  }}
                  placeholder={t("categories.descriptionPlaceholder")}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requires_maintenance"
                  checked={formData.requires_maintenance}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      requires_maintenance: !!checked,
                    })
                  }
                />
                <Label htmlFor="requires_maintenance">
                  {t("categories.requiresRegularMaintenance")}
                </Label>
              </div>
            </div>

            <Separator />

            {/* Category Attributes */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-medium">
                    {t("categories.categoryAttributes")}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {t("categories.defineAttributes")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAttribute}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("categories.addAttribute")}
                </Button>
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-lg p-3 bg-muted/20">
                {formData.category_attributes.length === 0 ? (
                  <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground">
                    <p>{t("categories.noAttributesDefinedYet")}</p>
                    <p className="text-sm">{t("categories.clickAddAttribute")}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                  {formData.category_attributes.map((attr, index) => (
                    <div
                      key={index}
                      className="p-3 border relative rounded-lg space-y-3"
                    >
                      <div className="grid relative grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">
                            {t("categories.specificationName")}{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            placeholder={t(
                              "categories.attributeNamePlaceholder",
                            )}
                            value={attr.attribute_name}
                            onChange={(e) => {
                              updateAttribute(
                                index,
                                "attribute_name",
                                e.target.value,
                              );
                              // Clear validation error when user starts typing
                              if (validationErrors[`attribute_name_${index}`]) {
                                setValidationErrors(prev => ({ ...prev, [`attribute_name_${index}`]: "" }));
                              }
                            }}
                            className={validationErrors[`attribute_name_${index}`] ? "border-red-500" : ""}
                          />
                          {validationErrors[`attribute_name_${index}`] && (
                            <p className="text-sm text-red-500 mt-1">{validationErrors[`attribute_name_${index}`]}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs">
                            {t("categories.type")}
                          </Label>
                          <Select
                            value={attr.attribute_type}
                            onValueChange={(v) =>
                              updateAttribute(
                                index,
                                "attribute_type",
                                v as (typeof ATTRIBUTE_TYPES)[number],
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ATTRIBUTE_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {attr.attribute_type === "Select" && (
                        <div>
                          <Label className="text-xs">
                            {t("categories.selectOptions")}{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            placeholder={t(
                              "categories.selectOptionsPlaceholder",
                            )}
                            value={attr.select_options}
                            onChange={(e) => {
                              updateAttribute(
                                index,
                                "select_options",
                                e.target.value,
                              );
                              // Clear validation error when user starts typing
                              if (validationErrors[`select_options_${index}`]) {
                                setValidationErrors(prev => ({ ...prev, [`select_options_${index}`]: "" }));
                              }
                            }}
                            className={validationErrors[`select_options_${index}`] ? "border-red-500" : ""}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("categories.separateOptionsWithCommas")}
                          </p>
                          {validationErrors[`select_options_${index}`] && (
                            <p className="text-sm text-red-500 mt-1">{validationErrors[`select_options_${index}`]}</p>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={attr.is_mandatory}
                            onCheckedChange={(checked) =>
                              updateAttribute(index, "is_mandatory", !!checked)
                            }
                          />
                          <Label className="text-xs">
                            {t("categories.mandatoryField")}
                          </Label>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAttribute(index)}
                        >
                          <Trash2 className="h-4 md:static absolute top-3 right-3 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={closeDialog}>
              {t("categories.cancel")}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? t("categories.saving")
                : t("categories.saveCategory")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCategoryName} onOpenChange={(open) => !open && setDeleteCategoryName(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("categories.deleteCategory")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("categories.deleteCategoryConfirmation")}
              <span className="block mt-2 text-orange-600 dark:text-orange-400 font-medium">
                {t("categories.deleteCategoryWarning")}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCategoryName && handleDelete(deleteCategoryName)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t("categories.deleting") : t("categories.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
