/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Edit,
  Trash2,
  MapPin,
  Truck,
  Send,
  Clock,
  Heart,
  Plus,
  MoreVertical,
  AlertCircle,
  Scan,
  Info,
  List,
  FileText,
  ExternalLink,
  ImageIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle,
  User,
  Search,
  X,
  Upload,
  AlertTriangle,
  RotateCcw,
  Users,
  Shield,
  Eye,
  XCircle,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  FileAPI,
  GiftAPI,
  GiftIssueAPI,
  GiftRecipientAPI,
} from "@/services/api";
import { toast } from "sonner";
import { config } from "@/config/environment";
import { format } from "date-fns";
import { parseFrappeDate } from "@/lib/i18n";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccordionSection } from "@/components/ui/accordian-section";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddGuestSheet } from "@/components/guest/AddGuestSheet";
import { GuestDetailDialog } from "@/components/guest/GuestDetailDialog";
import { SystemInfo } from "@/components/gift/SystemInfo";
import { useRole } from "@/contexts/RoleContext";

import type {
  Gift,
  GiftInterest,
  GiftIssue,
  GiftIssueDocument,
} from "@/types/gift";
import type { GiftDetailBundle } from "@/services/api";

function IssueDetailsDialog({
  open,
  onClose,
  issue,
  formatDateTime,
}: {
  open: boolean;
  onClose: () => void;
  issue: GiftIssue | null;
  formatDateTime: (d: string | undefined) => string;
}) {
  const { t } = useTranslation();
  if (!issue) return null;

  const person =
    issue.owner_full_name ||
    issue.guest_name ||
    issue.gift_recipient ||
    issue.name;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("gifts.viewIssueDetails")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("issueList.issueId")}>{issue.name}</Field>
            <Field label={t("common.status")}>{issue.status || "-"}</Field>
            <Field label={t("dispatchForm.receivedByName")}>{person}</Field>
            <Field label={t("issueForm.mobile")}>
              {issue.mobile_number || "-"}
            </Field>
            <Field label={t("recipients.emiratesId")}>
              {issue.receiver_id || "-"}
            </Field>
            <Field label={t("issueForm.relatedEvent")}>
              {issue.event || "-"}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("dispatch.dispatchStatus")}>
              {issue.dispatch_status || "-"}
            </Field>
            <Field label={t("dispatchForm.transportMode")}>
              {issue.transport_mode || "-"}
            </Field>
            <Field label={t("issueForm.deliveryDate")}>
              {formatDateTime(issue.delivery_date)}
            </Field>
            <Field label={t("dispatchForm.estimatedArrival")}>
              {issue.estimated_arrival || "-"}
            </Field>
          </div>
          {(issue.delivery_address || issue.address) && (
            <Field label={t("issueForm.deliveryAddress")}>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {issue.delivery_address || issue.address}
              </p>
            </Field>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getEventStatusColor, getStatusColor } from "@/lib/statusColors";
function IssueDispatchDetailsSheet({
  open,
  onClose,
  issue,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  issue: GiftIssue | null;
  onSave: (payload: Partial<GiftIssue>) => void;
  isSaving?: boolean;
}) {
  const { t } = useTranslation();
  const [dispatchDate, setDispatchDate] = useState<string>("");
  const [receivedByName, setReceivedByName] = useState<string>("");
  const [receiverContact, setReceiverContact] = useState<string>("");
  const [receiverId, setReceiverId] = useState<string>("");

  const [deliveryPersonName, setDeliveryPersonName] = useState<string>("");
  const [deliveryPersonContact, setDeliveryPersonContact] =
    useState<string>("");
  const [deliveryPersonId, setDeliveryPersonId] = useState<string>("");

  const [deliveryRemarks, setDeliveryRemarks] = useState<string>("");
  const [documents, setDocuments] = useState<GiftIssueDocument[]>([]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const dispatchDateInputRef = useRef<HTMLInputElement | null>(null);

  // Add state for unsaved changes dialog
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const wasPrefilledRef = useRef(false);

  const getFileUrl = (filePath: string) => {
    if (!filePath) return "";
    if (filePath.startsWith("http")) return filePath;
    return `${config.apiBaseUrl}${filePath.startsWith("/") ? "" : "/"}${filePath}`;
  };

  const getFileName = (filePath: string) => {
    if (!filePath) return "";
    return filePath.split("/").pop() || filePath;
  };

  // Check if any field has been filled (compare with initial values from issue)
  const hasUnsavedChanges = () => {
    if (!issue) return false;

    const currentValues = {
      dispatch_date: dispatchDate,
      received_by_name: receivedByName,
      receiver_contact: receiverContact,
      receiver_id: receiverId,
      delivery_person_name: deliveryPersonName,
      delivery_person_contact: deliveryPersonContact,
      delivery_person_id: deliveryPersonId,
      delivery_remarks: deliveryRemarks,
      documents: documents,
    };

    const initialValues = {
      dispatch_date: (issue as any)?.dispatch_date?.replace(" ", "T")?.slice(0, 16) || "",
      received_by_name: issue?.received_by_name || "",
      receiver_contact: issue?.receiver_contact || "",
      receiver_id: issue?.receiver_id || "",
      delivery_person_name: issue?.delivery_person_name || "",
      delivery_person_contact: issue?.delivery_person_contact || "",
      delivery_person_id: issue?.delivery_person_id || "",
      delivery_remarks: issue?.delivery_remarks || "",
      documents: issue?.documents || [],
    };

    // Compare each field
    return (
      currentValues.dispatch_date !== initialValues.dispatch_date ||
      currentValues.received_by_name !== initialValues.received_by_name ||
      currentValues.receiver_contact !== initialValues.receiver_contact ||
      currentValues.receiver_id !== initialValues.receiver_id ||
      currentValues.delivery_person_name !==
        initialValues.delivery_person_name ||
      currentValues.delivery_person_contact !==
        initialValues.delivery_person_contact ||
      currentValues.delivery_person_id !== initialValues.delivery_person_id ||
      currentValues.delivery_remarks !== initialValues.delivery_remarks ||
      JSON.stringify(currentValues.documents) !==
        JSON.stringify(initialValues.documents)
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && open && hasUnsavedChanges() && !isSaving) {
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (!open) {
      wasPrefilledRef.current = false;
      return;
    }
    if (!issue || wasPrefilledRef.current) return;

    wasPrefilledRef.current = true;
    setDispatchDate((issue as any)?.dispatch_date?.replace(" ", "T")?.slice(0, 16) || "");
    setReceivedByName(issue?.received_by_name || "");
    setReceiverContact(issue?.receiver_contact || "");
    setReceiverId(issue?.receiver_id || "");
    setDeliveryPersonName(issue?.delivery_person_name || "");
    setDeliveryPersonContact(issue?.delivery_person_contact || "");
    setDeliveryPersonId(issue?.delivery_person_id || "");
    setDeliveryRemarks(issue?.delivery_remarks || "");
    setDocuments(issue?.documents || []);
  }, [open, issue]);

  const updateDocument = (index: number, patch: Partial<GiftIssueDocument>) => {
    setDocuments((prev) =>
      prev.map((doc, i) => (i === index ? { ...doc, ...patch } : doc)),
    );
  };

  const addDocument = () => {
    setDocuments((prev) => [
      ...prev,
      { document_type: "", document_attachment: "", description: "" },
    ]);
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (index: number, file: File) => {
    setUploadingIndex(index);
    const result = await FileAPI.upload(file);
    setUploadingIndex(null);
    if (result.success && result.data?.file_url) {
      updateDocument(index, { document_attachment: result.data.file_url });
      toast.success(t("dispatch.documentUploaded"));
      return;
    }
    toast.error(result.error || t("dispatch.failedToUploadDocument"));
  };

  const openDispatchDatePicker = () => {
    const input = dispatchDateInputRef.current;
    if (!input) return;
    input.focus();
    if ("showPicker" in input) {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    }
  };

  const handleSave = () => {
    const payload: Partial<GiftIssue> = {
      dispatch_date: dispatchDate || undefined,
      dispatch_status: dispatchDate ? "Delivered" : undefined,
      delivery_method: "Direct Handover",
      dispatch_type: undefined,
      tracking_number: undefined,
      delivery_address: undefined,
      transport_mode: undefined,
      transport_company: undefined,
      vehicle_number: undefined,
      estimated_arrival: undefined,
      receiver_id: receiverId || undefined,
      received_by_type: undefined,
      received_by_name: receivedByName || undefined,
      receiver_contact: receiverContact || undefined,
      receiver_relationship: undefined,
      delivery_person_name: deliveryPersonName || undefined,
      delivery_person_contact: deliveryPersonContact || undefined,
      delivery_person_id: deliveryPersonId || undefined,
      delivery_person_company: undefined,
      delivery_remarks: deliveryRemarks || undefined,
      documents: documents
        .filter(
          (doc) =>
            doc.document_type || doc.document_attachment || doc.description,
        )
        .map((doc, idx) => ({
          ...doc,
          idx: idx + 1,
          doctype: "Gift Issue Documents",
          parentfield: "documents",
          parenttype: "Gift Issue",
        })),
    };
    onSave(payload);
  };

  const baseValid = Boolean(dispatchDate);
  const receiverInfoValid = Boolean(receivedByName && receiverContact);
  const giverInfoValid = Boolean(deliveryPersonName && deliveryPersonContact);
  const isValid = baseValid && receiverInfoValid && giverInfoValid;

  if (!issue) return null;

  return (
    <>
      {/* Add AlertDialog for unsaved changes */}
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
                onClose();
              }}
            >
              {t("common.leavePage")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="w-full px-0 pb-0 sm:max-w-2xl overflow-y-auto"
        >
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-start justify-between">
              <SheetTitle className="text-xl font-bold text-foreground">
                {t("dispatchIssueDetails.dispatchDetails")}
              </SheetTitle>
              {/* <span className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Info className="h-3.5 w-3.5" />
              {t("common.enterOperationalDetails")}
            </span> */}
            </div>
          </SheetHeader>

          <div className="px-6 py-5 space-y-6 ">
            <Accordion
              type="multiple"
              defaultValue={["details", "attachments"]}
              className="space-y-6"
            >
              {/* ========================= */}
              {/* Receiver & Delivery Block */}
              {/* ========================= */}
              <AccordionItem
                value="details"
                className="rounded-2xl  bg-card shadow-sm overflow-hidden"
              >
                <AccordionTrigger className="px-5 border-0 py-4 text-sm font-semibold hover:no-underline">
                  <span className="inline-flex items-center gap-2.5 text-foreground">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    {t("dispatch.receiverDeliveredDetails")}
                  </span>
                </AccordionTrigger>

                <AccordionContent className="px-5 pb-6 space-y-6">
                  {/* Dispatch Date */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-foreground">
                      {t("dispatchIssueDetails.dispatchDate")}{" "}
                      <span className="text-red-500">*</span>
                    </Label>

                    <Input
                      ref={dispatchDateInputRef}
                      type="datetime-local"
                      value={dispatchDate}
                      onChange={(e) => setDispatchDate(e.target.value)}
                      className="h-10 bg-background border-border sm:max-w-xs"
                    />
                  </div>

                  {/* ========================= */}
                  {/* RECEIVED BY (NO ACCORDION) */}
                  {/* ========================= */}
                  <div className="rounded-xl bg-blue-50 p-5 space-y-4">
                    <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
                      <User className="h-4 w-4" />
                      {t("dispatchIssueDetails.receiverDetails")}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">
                          {t("dispatchIssueDetails.receiverName")}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={receivedByName}
                          onChange={(e) => setReceivedByName(e.target.value)}
                          placeholder={t("dispatchIssueDetails.receiverName")}
                          className="h-10 bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">
                          {t("dispatchIssueDetails.receiverContact")}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={receiverContact}
                          onChange={(e) => setReceiverContact(e.target.value)}
                          placeholder={t(
                            "dispatchIssueDetails.receiverContact",
                          )}
                          className="h-10 bg-white"
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-sm font-medium">
                          {t("dispatchIssueDetails.receiverId")}
                        </Label>
                        <Input
                          value={receiverId}
                          onChange={(e) => setReceiverId(e.target.value)}
                          placeholder={t("common.enterIdPlaceholder")}
                          className="h-10 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ========================= */}
                  {/* DELIVERED BY (NO ACCORDION) */}
                  {/* ========================= */}
                  <div className="rounded-xl bg-emerald-50 p-5 space-y-4">
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                      <Truck className="h-4 w-4" />
                      {t("dispatchIssueDetails.handoverDetails")}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">
                          {t("dispatchIssueDetails.deliveryPersonName")}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={deliveryPersonName}
                          onChange={(e) =>
                            setDeliveryPersonName(e.target.value)
                          }
                          placeholder={t("common.driverNamePlaceholder")}
                          className="h-10 bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">
                          {t("dispatchIssueDetails.deliveryPersonContact")}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={deliveryPersonContact}
                          onChange={(e) =>
                            setDeliveryPersonContact(e.target.value)
                          }
                          placeholder={t("common.driverContactPlaceholder")}
                          className="h-10 bg-white"
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-sm font-medium">
                          {t("dispatchIssueDetails.deliveryPersonId")}
                        </Label>
                        <Input
                          value={deliveryPersonId}
                          onChange={(e) => setDeliveryPersonId(e.target.value)}
                          placeholder={t("common.enterIdPlaceholder")}
                          className="h-10 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Remarks */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      {t("dispatchIssueDetails.deliveryRemarks")}
                    </Label>
                    <Textarea
                      value={deliveryRemarks}
                      onChange={(e) => setDeliveryRemarks(e.target.value)}
                      placeholder={t("common.deliveryRemarksPlaceholder")}
                      rows={3}
                      className="bg-background resize-none"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* ========================= */}
              {/* Attachments */}
              {/* ========================= */}
              <AccordionItem
                value="attachments"
                className="rounded-2xl bg-amber-50  shadow-sm overflow-hidden border border-border"
              >
                <AccordionTrigger className="px-5 border-0 py-4 text-sm font-semibold hover:no-underline hover:bg-muted/20  transition-colors">
                  <span className="inline-flex items-center gap-2.5 text-foreground">
                    <FileText className="h-4 w-4  text-amber-600" />
                    {t("common.attachments")}
                  </span>
                </AccordionTrigger>

                <AccordionContent className="px-5 pb-6 space-y-4">
                  {/* Header with title and add button */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t("dispatchIssueDetails.dispatchDocuments")}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addDocument}
                      className="h-8 px-3 text-xs border-amber-500 gap-1 border "
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t("dispatchIssueDetails.addDocument")}
                    </Button>
                  </div>

                  {/* Document List */}
                  <div className="space-y-3">
                    {documents.map((doc, index) => (
                      <div
                        key={doc.name || index}
                        className="rounded-xl border border-border p-4 space-y-3 bg-white"
                      >
                        {/* Document header with number and remove button */}
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">
                            {t("common.document")} {index + 1}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeDocument(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            {t("common.remove")}
                          </Button>
                        </div>

                        {/* Document Type Input */}
                        <Input
                          value={doc.document_type || ""}
                          onChange={(e) =>
                            updateDocument(index, {
                              document_type: e.target.value,
                            })
                          }
                          placeholder={t("dispatchIssueDetails.documentType")}
                          className="h-9 bg-background border-border"
                        />

                        {/* File Upload Area */}
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Input
                              value={
                                doc.document_attachment
                                  ? getFileName(doc.document_attachment)
                                  : ""
                              }
                              readOnly
                              placeholder={t("common.noFileUploaded")}
                              className="h-9 bg-background border-border pr-9"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                              disabled={uploadingIndex === index}
                              onClick={() =>
                                document
                                  .getElementById(`issue-doc-file-${index}`)
                                  ?.click()
                              }
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          </div>

                          {doc.document_attachment && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 px-3 border-border"
                              onClick={() =>
                                window.open(
                                  getFileUrl(doc.document_attachment || ""),
                                  "_blank",
                                )
                              }
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {t("common.view")}
                            </Button>
                          )}
                        </div>

                        {/* Hidden file input */}
                        <input
                          id={`issue-doc-file-${index}`}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(index, file);
                            e.currentTarget.value = "";
                          }}
                        />

                        {/* Description Textarea */}
                        <Textarea
                          value={doc.description || ""}
                          onChange={(e) =>
                            updateDocument(index, {
                              description: e.target.value,
                            })
                          }
                          placeholder={t("dispatchIssueDetails.description")}
                          rows={2}
                          className="bg-background border-border resize-none text-sm"
                        />
                      </div>
                    ))}

                    {/* Empty State */}
                    {documents.length === 0 && (
                      <div className="text-center py-8 border border-dashed border-border rounded-xl bg-muted/5">
                        <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {t("dispatchIssueDetails.noDispatchDocuments")}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {t("common.clickAddToUpload")}
                        </p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="px-6 min-w-28 rounded-xl h-10"
              >
                {t("common.cancel")}
              </Button>

              <Button
                disabled={!isValid || !!isSaving}
                onClick={handleSave}
                className="px-6 min-w-28 rounded-xl h-10 bg-primary text-white font-semibold shadow-sm"
              >
                {isSaving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Status Colors ───────
const statusColors: Record<string, string> = {
  Available: "bg-green-100 text-green-700 border border-green-200",
  Issued: "bg-blue-100 text-blue-700 border border-blue-200",
  "In Transit": "bg-orange-100 text-orange-700 border border-orange-200",
  Delivered: "bg-purple-100 text-purple-700 border border-purple-200",
};

type GiftHistoryType =
  | "created"
  | "modified"
  | "interest"
  | "issued"
  | "dispatched"
  | "delivered"
  | "rejected";

const giftHistoryStyle: Record<GiftHistoryType, { icon: any; color: string }> =
  {
    created: { icon: Plus, color: "bg-green-500" },
    modified: { icon: Edit, color: "bg-blue-500" },
    interest: { icon: Heart, color: "bg-pink-500" },
    issued: { icon: Send, color: "bg-purple-500" },
    dispatched: { icon: Truck, color: "bg-indigo-500" },
    delivered: { icon: CheckCircle, color: "bg-green-600" },
    rejected: { icon: XCircle, color: "bg-red-500" },
  };

interface GiftHistoryEvent {
  type: GiftHistoryType;
  date: string;
  text: string | React.ReactNode;
  link?: string;
}

// ─── Avatar Helper ───────
const avatarColors = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-red-500",
  "bg-indigo-500",
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : "w-9 h-9 text-sm";
  return (
    <div
      className={`${sizeClass} ${getAvatarColor(name)} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Label/Value Pair
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </p>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

// ─── Full-Screen Lightbox ─────────────────────────────────────────────────────
interface LightboxProps {
  images: { url: string; alt: string }[];
  initialIndex: number;
  giftName: string;
  giftDescription?: string;
  onClose: () => void;
}

function Lightbox({
  images,
  initialIndex,
  giftName,
  giftDescription,
  onClose,
}: LightboxProps) {
  const [current, setCurrent] = useState(initialIndex);

  const prev = useCallback(
    () => setCurrent((i) => (i - 1 + images.length) % images.length),
    [images.length],
  );
  const next = useCallback(
    () => setCurrent((i) => (i + 1) % images.length),
    [images.length],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "rgba(15,23,42,0.97)" }}
    >
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-10">
        <p className="text-white/50 text-sm font-medium tracking-wide">
          {giftName}
        </p>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
      >
        <ChevronLeft className="h-5 w-5 text-white" />
      </button>

      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl px-16">
        <div
          className="rounded-2xl overflow-hidden w-full flex items-center justify-center"
          style={{ maxHeight: "60vh" }}
        >
          <img
            src={images[current].url}
            alt={images[current].alt}
            className="max-h-[60vh] max-w-full object-contain"
          />
        </div>
      </div>

      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
      >
        <ChevronRight className="h-5 w-5 text-white" />
      </button>

      <div className="pb-6 flex flex-col items-center gap-3 w-full shrink-0">
        <p className="text-white/40 text-xs font-medium tabular-nums">
          {current + 1} / {images.length}
        </p>
        <div className="flex items-center gap-2 px-4 max-w-xl scrollbar-none">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                i === current
                  ? "border-primary opacity-100 scale-105 shadow-lg"
                  : "border-white/15 opacity-45 hover:opacity-70 hover:border-white/30"
              }`}
            >
              <img
                src={img.url}
                alt={img.alt}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Photo Carousel (in-page) ─────────────────────────────────────────────────
interface PhotoCarouselProps {
  images: { url: string; alt: string }[];
  giftName: string;
  giftDescription?: string;
}

function PhotoCarousel({
  images,
  giftName,
  giftDescription,
}: PhotoCarouselProps) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const prev = () => setCurrent((i) => (i - 1 + images.length) % images.length);
  const next = () => setCurrent((i) => (i + 1) % images.length);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <Accordion type="single" collapsible>
        <AccordionItem
          value="images"
          className=" rounded-xl border-b-0 overflow-hidden bg-white"
        >
          <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-muted/20 [&[data-state=open]>div>svg]:rotate-180">
            <div className="flex items-center gap-2 flex-1">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm text-foreground">
                {t("gifts.images")}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {images.length}{" "}
                {t("gifts.photoCount", { count: images.length })}
              </span>
              {/* <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" /> */}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-0">
            <div
              className="relative bg-muted/20 flex items-center justify-center"
              style={{ height: "260px" }}
            >
              <img
                src={images[current].url}
                alt={images[current].alt}
                className="max-h-full max-w-full object-contain p-4 cursor-zoom-in transition-opacity duration-200"
                onClick={() => openLightbox(current)}
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  t.src =
                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23e2e8f0" width="200" height="200"/%3E%3Ctext x="100" y="100" text-anchor="middle" dy=".3em" fill="%2394a3b8" font-size="14"%3ENo Image%3C/text%3E%3C/svg%3E';
                }}
              />

              {images.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/90 hover:bg-white shadow-md border border-border flex items-center justify-center transition-all hover:scale-105"
                  >
                    <ChevronLeft className="h-4 w-4 text-foreground" />
                  </button>
                  <button
                    onClick={next}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/90 hover:bg-white shadow-md border border-border flex items-center justify-center transition-all hover:scale-105"
                  >
                    <ChevronRight className="h-4 w-4 text-foreground" />
                  </button>
                </>
              )}

              <button
                onClick={() => openLightbox(current)}
                className="absolute bottom-3 right-3 bg-black/40 hover:bg-black/60 text-white text-[10px] px-2 py-1 rounded-md transition-colors flex items-center gap-1"
              >
                <ImageIcon className="h-3 w-3" /> {t("gifts.viewFullSize")}
              </button>
            </div>

            {images.length > 1 && (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-3 border-t border-border">
                <div className="flex items-center justify-center gap-2">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrent(i)}
                      className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                        i === current
                          ? "border-primary shadow-sm scale-105"
                          : "border-border opacity-55 hover:opacity-90"
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={img.alt}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {lightboxOpen && (
        <Lightbox
          images={images}
          initialIndex={lightboxIndex}
          giftName={giftName}
          giftDescription={giftDescription}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

interface RecordInterestModalProps {
  open: boolean;
  onClose: () => void;
  giftName?: string;
  eventName?: string;
  onRecordInterest?: (recipientNames: string[]) => void;
  isRecording?: boolean;
}

export function RecordInterestModal({
  open,
  onClose,
  giftName = "Vintage Rolex 1978",
  eventName,
  onRecordInterest,
  isRecording,
}: RecordInterestModalProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedGuests, setSelectedGuests] = useState<
    { id: string; name: string }[]
  >([]);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const pendingCloseRef = useRef(false);

  // Reset state when modal is closed
  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedGuests([]);
      setShowUnsavedDialog(false);
      pendingCloseRef.current = false;
    }
  }, [open]);

  const { data: guestsRes, isLoading: guestsLoading } = useQuery({
    queryKey: ["gift-recipients-for-interest", giftName, search],
    queryFn: async () => {
      const res = await GiftRecipientAPI.listForGiftInterest(giftName, search, 1, 5);
      if (!res.success) throw new Error(res.error);
      return res.data || [];
    },
    enabled: open && giftName && search.trim().length > 0,
  });

  const filtered = (Array.isArray(guestsRes) ? guestsRes : []).slice(0, 5);
  const showAddNew = search.trim().length > 0;

  const handleGuestCreated = (guest?: { id: string; name: string }) => {
    if (!guest?.id) return;
    setSelectedGuests((prev) => {
      if (prev.some((x) => x.id === guest.id)) return prev;
      return [...prev, { id: guest.id, name: guest.name }];
    });
    setSearch("");
  };

  const hasUnsavedChanges =
    selectedGuests.length > 0 || search.trim().length > 0;

  const resetState = () => {
    setSearch("");
    setSelectedGuests([]);
  };

  const requestClose = () => {
    if (hasUnsavedChanges) {
      pendingCloseRef.current = true;
      setShowUnsavedDialog(true);
      return;
    }
    resetState();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) return;
        requestClose();
      }}
    >
      <DialogContent
        className="max-w-[420px] max-h-[95vh] p-0 overflow-auto rounded-2xl border border-border shadow-2xl"
        style={{ "--dialog-close-display": "none" } as React.CSSProperties}
        aria-describedby={undefined}
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-[17px] font-semibold text-foreground leading-tight">
            {t("gifts.recordInterest")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-0.5">
            {t("gifts.associateGuestWith")}{" "}
            <span className="text-primary font-medium">{giftName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              {t("gifts.findOrAddGuest")}
            </label>

            {selectedGuests.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedGuests.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      setSelectedGuests((prev) =>
                        prev.filter((x) => x.id !== g.id),
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <span className="max-w-[240px] truncate">{g.name}</span>
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
                placeholder={t("common.searchPlaceholder")}
                className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            {search && (
              <div className="mt-1 border border-border rounded-xl overflow-hidden bg-white shadow-md">
                {filtered.length > 0 && (
                  <div className="px-4 py-2 bg-muted/40 border-b border-border">
                    <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
                      {t("gifts.existingGuests")}
                    </span>
                  </div>
                )}

                {filtered.map((g: any) => {
                  const displayName =
                    g.owner_full_name ||
                    `${g.guest_first_name || ""} ${g.guest_last_name || ""}`.trim() ||
                    g.name;

                  const meta = [g.vip_level, g.mobile_number]
                    .filter(Boolean)
                    .join(" • ");

                  const isSelected = selectedGuests.some(
                    (x) => x.id === g.name,
                  );

                  return (
                    <button
                      key={g.name}
                      type="button"
                      onClick={() => {
                        setSelectedGuests((prev) => {
                          if (prev.some((x) => x.id === g.name)) {
                            return prev.filter((x) => x.id !== g.name);
                          }
                          return [...prev, { id: g.name, name: displayName }];
                        });
                        setSearch("");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border last:border-0 text-left"
                    >
                      <Avatar name={displayName} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {displayName}
                        </p>
                        {meta && (
                          <p className="text-xs text-muted-foreground">
                            {meta}
                          </p>
                        )}
                      </div>
                      <div className="ml-auto">
                        {isSelected ? (
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-border" />
                        )}
                      </div>
                    </button>
                  );
                })}

                {guestsLoading && (
                  <div className="px-4 py-3 text-xs text-muted-foreground">
                    {t("common.loading")}
                  </div>
                )}

                {showAddNew && (
                  <AddGuestSheet
                    defaultGuestName={search.trim()}
                    eventName={eventName}
                    onSuccess={handleGuestCreated}
                  >
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="h-8 w-8 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center flex-shrink-0">
                        <Plus className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary">
                          {t("gifts.addAsNewGuest", { name: search })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("gifts.createProfileAndRecordInterest")}
                        </p>
                      </div>
                    </button>
                  </AddGuestSheet>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 mt-2 border-t border-border bg-muted/10">
          <Button
            variant="outline"
            onClick={requestClose}
            className="text-sm font-medium"
          >
            {t("common.cancel")}
          </Button>

          <Button
            disabled={
              selectedGuests.length === 0 || !onRecordInterest || !!isRecording
            }
            className="bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium disabled:opacity-40"
            onClick={() => {
              if (selectedGuests.length === 0 || !onRecordInterest) return;
              onRecordInterest(selectedGuests.map((g) => g.id));
            }}
          >
            {isRecording ? t("gifts.recording") : t("gifts.recordInterest")}
          </Button>
        </div>

        <AlertDialog
          open={showUnsavedDialog}
          onOpenChange={(next) => {
            setShowUnsavedDialog(next);
            if (!next) pendingCloseRef.current = false;
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("common.unsavedChangesTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("common.unsavedChangesMessage")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  pendingCloseRef.current = false;
                  setShowUnsavedDialog(false);
                }}
              >
                {t("common.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!pendingCloseRef.current) return;
                  pendingCloseRef.current = false;
                  setShowUnsavedDialog(false);
                  resetState();
                  onClose();
                }}
              >
                {t("common.leavePage")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

export function Demo() {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <Button
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground"
      >
        Open Modal
      </Button>
      <RecordInterestModal
        open={open}
        onClose={() => setOpen(false)}
        giftName="Vintage Rolex 1978"
      />
    </div>
  );
}

// ─── Confirm Issue Modal
function ConfirmIssueModal({
  open,
  onClose,
  guestName,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  guestName: string;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-sm p-0 overflow-hidden rounded-2xl"
        aria-describedby={undefined}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("gifts.confirmAllocationRequest")}</DialogTitle>
          <DialogDescription>
            {t("gifts.confirmAllocationRequestDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pt-6 pb-5 space-y-3">
          <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {t("gifts.confirmAllocationRequest")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1.5">
              {t("gifts.confirmAllocationRequestQuestion")}{" "}
              <strong className="text-foreground">{guestName}</strong>?
            </p>
            {/* <p className="text-sm text-muted-foreground mt-1">
              {t("gifts.confirmIssueNote")}
            </p> */}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={onConfirm}
          >
            {t("gifts.sendAllocationRequest")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rejection Modal
function RejectionModal({
  open,
  onClose,
  requesterName,
  onConfirm,
  isRejecting,
}: {
  open: boolean;
  onClose: () => void;
  requesterName: string;
  onConfirm: (reason: string) => void;
  isRejecting?: boolean;
}) {
  const { t } = useTranslation();
  const [comments, setComments] = useState("");

  const isReasonValid = comments.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
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
            {t("gifts.rejectionAbout")}{" "}
            <strong className="text-foreground">{requesterName}</strong>.{" "}
            {t("gifts.rejectionProvideReason")}
          </p>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1 block">
              {t("gifts.additionalComments")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={t("gifts.rejectionPlaceholder")}
              rows={4}
              className="w-full border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            {/* {!isReasonValid && (
              <p className="text-xs text-red-500 mt-1">
                {t("gifts.rejectionReasonRequired")}
              </p>
            )} */}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            className={`${
              isReasonValid
                ? "bg-red-600 text-white hover:bg-red-700 border-red-600"
                : "bg-red-500 text-white hover:bg-red-200 border-red-200 cursor-not-allowed"
            }`}
            disabled={!isReasonValid || isRejecting}
            onClick={() => onConfirm(comments)}
          >
            {isRejecting ? t("gifts.rejecting") : t("gifts.confirmRejection")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Gift Panel
export function EditGiftPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("gifts.editGift")}</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <Accordion type="multiple">
            <AccordionItem value="details">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">
                    1
                  </div>
                  {t("gifts.giftDetails")}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-4">
                <div className="space-y-1">
                  <Label>{t("gifts.giftName")} *</Label>
                  <Input placeholder={t("gifts.giftNamePlaceholder")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{t("gifts.quantity")}</Label>
                    <Input type="number" placeholder="1" />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("gifts.estimatedValue")}</Label>
                    <Input type="number" placeholder="0" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{t("gifts.description")}</Label>
                  <Textarea
                    rows={3}
                    placeholder={t("gifts.descriptionPlaceholder")}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="attributes">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                    2
                  </div>
                  {t("gifts.attributes")}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-4">
                <p className="text-sm text-muted-foreground">
                  {t("gifts.noAttributesAdded")}
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="images">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                    3
                  </div>
                  {t("gifts.images")}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-4">
                <div className="border-2 border-dashed border-primary/50 rounded-xl p-8 text-center">
                  <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Upload className="h-5 w-5 text-amber-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {t("gifts.clickToUploadImages")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("gifts.uploadImageFormats")}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-lg bg-muted border border-border overflow-hidden"
                    >
                      <div className="w-full h-full bg-gray-200" />
                    </div>
                  ))}
                  <div className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <div className="flex items-center justify-end gap-3 mt-6">
            <Button variant="outline">{t("common.cancel")}</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              {t("gifts.updateGift")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Gift Interests Sidebar Card ──────────────────────────────────────────────
interface GiftInterestsSidebarProps {
  displayInterests: GiftInterest[];
  issues: GiftIssue[];
  timelineEntries?: any[];
  isIssued: boolean;
  canApprove: boolean;
  canCoordinatorManage?: boolean;
  formatDateTime: (d: string | undefined) => string;
  onIssue: (name: string) => void;
  onAllocateInterestDirect?: (interestName: string) => void;
  onViewIssue: (issueName: string) => void;
  onApproveIssue: (issueName: string) => void;
  onRejectIssue: (issueName: string, label: string) => void;
  onSendIssueForApprovalAgain: (issueName: string) => void;
  onUnissueIssue?: (issueName: string, issueLabel: string) => void;
  onRemoveInterest?: (interestName: string, label: string) => void;
  onRemoveAllocationRequest?: (issueName: string, label: string) => void;
}

function GiftInterestsSidebar({
  displayInterests,
  issues,
  timelineEntries,
  isIssued,
  canApprove,
  canCoordinatorManage,
  formatDateTime,
  onIssue,
  onAllocateInterestDirect,
  onViewIssue,
  onApproveIssue,
  onRejectIssue,
  onSendIssueForApprovalAgain,
  onUnissueIssue,
  onRemoveInterest,
  onRemoveAllocationRequest,
}: GiftInterestsSidebarProps) {
  const { t } = useTranslation();
  const issueByName = useMemo(() => {
    const map = new Map<string, GiftIssue>();
    (issues || []).forEach((i: any) => {
      if (i?.name) map.set(String(i.name), i);
    });
    return map;
  }, [issues]);

  const latestRequestByIssue = useMemo(() => {
    const map = new Map<string, { requestedBy: string; requestedOn: string }>();
    const toMs = (value: string) => {
      const ms = Date.parse(value);
      return Number.isNaN(ms) ? 0 : ms;
    };

    (timelineEntries || []).forEach((row: any) => {
      if (String(row?.kind || "") !== "issue_created") return;

      const docname = String(row?.docname || "").trim();
      const timestamp = String(row?.timestamp || "").trim();
      if (!docname || !timestamp) return;

      const requestedBy =
        row?.user_full_name ||
        (row?.user && row.user.includes("@")
          ? row.user.split("@")[0]
          : row?.user) ||
        t("common.unknown");

      const existing = map.get(docname);
      if (!existing || toMs(timestamp) >= toMs(existing.requestedOn)) {
        map.set(docname, {
          requestedBy,
          requestedOn: timestamp,
        });
      }
    });

    return map;
  }, [timelineEntries, t]);

  const activeIssueForGift = useMemo(() => {
    return (issues || []).find((row: any) => {
      const approvalStatus = String((row as any)?.approval_status || "");
      const lifecycleStatus = String((row as any)?.status || "");
      return (
        ["Awaiting Approval", "Approved"].includes(approvalStatus) &&
        !["Cancelled", "Returned"].includes(lifecycleStatus)
      );
    });
  }, [issues]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [guestDetails, setGuestDetails] = useState<Record<string, any>>({});
  const [loadingGuest, setLoadingGuest] = useState<Record<string, boolean>>({});

  const fetchGuestDetails = async (recipientId: string) => {
    if (guestDetails[recipientId] || loadingGuest[recipientId]) return;

    setLoadingGuest((prev) => ({ ...prev, [recipientId]: true }));
    try {
      const response = await fetch(
        `/api/method/gift.gift.doctype.gift_recipient.gift_recipient.get_recipient_details?name=${recipientId}`,
      );
      const result = await response.json();

      if (result.message) {
        setGuestDetails((prev) => ({ ...prev, [recipientId]: result.message }));
      }
    } catch (error) {
      console.error("Error fetching guest details:", error);
    } finally {
      setLoadingGuest((prev) => ({ ...prev, [recipientId]: false }));
    }
  };

  useEffect(() => {
    if (expandedId) {
      const interest = displayInterests.find((i: any) => i.name === expandedId);
      if (interest?.gift_recipient) {
        fetchGuestDetails(interest.gift_recipient);
      }
    }
  }, [expandedId, displayInterests]);

  return (
    <AccordionSection
      icon={<Users />}
      title={t("gifts.giftInterests")}
      badge={displayInterests.length.toString()}
    >
      {displayInterests.length === 0 ? (
        <div className="px-4 py-4">
          <p className="text-sm text-gray-500 mb-1">
            {t("gifts.noInterestsRecorded")}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {displayInterests.map((interest: any, index: number) => {
            const name =
              interest.guest_name || interest.name || t("gifts.unknownGuest");
            const convertedIssue =
              interest.converted_to_issue ||
              interest.issue ||
              interest.gift_issue;
            const linkedIssue =
              (issues || []).find(
                (i: any) => (i as any)?.from_gift_interest === interest.name,
              ) ||
              (convertedIssue
                ? issueByName.get(String(convertedIssue))
                : undefined);
            const isGiftIssued =
              interest.follow_up_status === "Converted to Issue" ||
              !!convertedIssue ||
              !!linkedIssue;
            const issue = linkedIssue as GiftIssue | undefined;
            const issueStatus = String((issue as any)?.status || "");
            const isPendingApproval =
              !!issue &&
              (issue as any)?.approval_status === "Awaiting Approval" &&
              !["Cancelled", "Returned"].includes(issueStatus);
            const isApprovedIssue =
              !!issue && (issue as any)?.approval_status === "Approved";
            const isRequestState =
              !!issue &&
              (issue as any)?.approval_status === "Awaiting Approval" &&
              !["Cancelled", "Returned"].includes(issueStatus);
            const isRejectedRequest =
              !!issue &&
              (issue as any)?.approval_status === "Rejected" &&
              !["Cancelled", "Returned"].includes(issueStatus);
            const canManageRemovals = !!(canApprove || canCoordinatorManage);
            const canApproveOrRejectRequest =
              isRequestState && (issue as any)?.name && canApprove;
            const canRemoveAllocationRequestAction =
              isRequestState &&
              (issue as any)?.name &&
              canManageRemovals;
            const canRemoveAllocationAction =
              isApprovedIssue &&
              (issue as any)?.name &&
              canApprove &&
              (issue as any)?.status !== "Delivered";
            const canRemoveInterestAction =
              (
                !issue ||
                ["Cancelled", "Returned"].includes(issueStatus) ||
                isRejectedRequest  // ← add this
              ) &&
              canManageRemovals;
            const canRequestAllocation =
              !isIssued &&
              (!issue ||
                isRejectedRequest ||
                ["Cancelled", "Returned"].includes(issueStatus)) &&
              (!activeIssueForGift ||
                String((activeIssueForGift as any)?.from_gift_interest || "") ===
                  String(interest.name));
            const hasInterestActions =
              canRequestAllocation ||
              canApproveOrRejectRequest ||
              canRemoveAllocationRequestAction ||
              canRemoveAllocationAction ||
              canRemoveInterestAction;
            const isRejected =
              (interest.approval_status === "Rejected" &&
                !["Cancelled", "Returned"].includes(String(issueStatus || ""))) ||
              ((issue as any)?.approval_status === "Rejected" &&
                !["Cancelled", "Returned"].includes(String(issueStatus || "")));
            const latestRequestMeta = issue?.name
              ? latestRequestByIssue.get(String(issue.name))
              : undefined;
            const allocationRequestedBy =
              latestRequestMeta?.requestedBy ||
              (issue as any)?.created_by_full_name ||
              interest.created_by_full_name;
            const allocationRequestedOn =
              latestRequestMeta?.requestedOn ||
              (issue as any)?.date ||
              (issue as any)?.modified ||
              (issue as any)?.creation ||
              interest.interest_date ||
              interest.creation;
            const allocationApprovedBy =
              (issue as any)?.approved_by_full_name ||
              (issue as any)?.approved_by ||
              (interest as any)?.approved_by_full_name ||
              (interest as any)?.approved_by;
            const allocationApprovedOn =
              (issue as any)?.approved_on || (interest as any)?.approved_on;
            const allocationRejectedBy =
              (issue as any)?.approved_by_full_name ||
              (issue as any)?.approved_by ||
              (interest as any)?.approved_by_full_name ||
              (interest as any)?.approved_by;
            const allocationRejectedOn =
              (issue as any)?.approved_on || (interest as any)?.approved_on;
            const allocationRejectionReason =
              interest.rejection_reason ||
              (issue as any)?.rejection_reason ||
              t("common.noReasonProvided");
            const isDirectAllocation =
              isApprovedIssue &&
              !!(
                (interest as any)?.approved_by ||
                (interest as any)?.approved_by_full_name
              );
            const showAllocationRequestMeta =
              !!issue &&
              !isDirectAllocation &&
              (isPendingApproval || isRejectedRequest || isApprovedIssue);
            const key = interest.name || String(index);
            const isExpanded = expandedId === key;

            const recipientId = interest.gift_recipient;
            const details = recipientId ? guestDetails[recipientId] : null;
            const isLoading = recipientId ? loadingGuest[recipientId] : false;

            let statusLabel = "";
            let statusClass = "";
            if (isApprovedIssue) {
              statusLabel = t("common.allocated");
              statusClass = "bg-green-100 text-green-700 border-green-200";
            } else if (isPendingApproval) {
              statusLabel = t("gifts.pendingApproval");
              statusClass = "bg-amber-100 text-amber-700 border-amber-200";
            } else if (isRejected) {
              statusLabel = t("gifts.allocationRejected");
              statusClass = "bg-red-100 text-red-700 border-red-200";
            } else {
              statusLabel = "Interested";
              statusClass = "bg-slate-100 text-slate-700 border-slate-200";
            }

            return (
              <div key={key}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(isExpanded ? null : key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedId(isExpanded ? null : key);
                    }
                  }}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={name} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {name}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {hasInterestActions && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-foreground border border-border hover:bg-muted"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {canRequestAllocation && (
                            <DropdownMenuItem
                              className="text-blue-700 focus:text-blue-800"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (canApprove && onAllocateInterestDirect) {
                                  onAllocateInterestDirect(interest.name);
                                  return;
                                }
                                onIssue(interest.name);
                              }}
                            >
                              {canApprove ? t("common.allocate") : t("gifts.sendAllocationRequest")}
                            </DropdownMenuItem>
                          )}

                          {canApproveOrRejectRequest && (
                            <>
                              <DropdownMenuItem
                                className="text-emerald-700 focus:text-emerald-800"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onApproveIssue((issue as any).name);
                                }}
                              >
                                {t("interests.approve")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-700 focus:text-red-800"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRejectIssue(
                                    (issue as any).name,
                                    (interest as any).owner_full_name ||
                                      (interest as any).gift_recipient ||
                                      (issue as any).name,
                                  );
                                }}
                              >
                                {t("interests.reject")}
                              </DropdownMenuItem>
                            </>
                          )}

                          {canRemoveAllocationRequestAction && (
                            <DropdownMenuItem
                              className="text-amber-700 focus:text-amber-800"
                              onClick={(e) => {
                                e.stopPropagation();
                                const issueLabel =
                                  (interest as any)?.guest_name ||
                                  (interest as any)?.gift_recipient ||
                                  (issue as any).name;
                                onRemoveAllocationRequest?.((issue as any).name, issueLabel);
                              }}
                            >
                              {t("gifts.removeAllocationRequest")}
                            </DropdownMenuItem>
                          )}

                          {canRemoveAllocationAction && (
                            <DropdownMenuItem
                              className="text-orange-700 focus:text-orange-800"
                              onClick={(e) => {
                                e.stopPropagation();
                                const issueLabel =
                                  (interest as any)?.guest_name ||
                                  (interest as any)?.gift_recipient ||
                                  (issue as any).name;
                                onUnissueIssue?.((issue as any).name, issueLabel);
                              }}
                            >
                              Remove Allocation
                            </DropdownMenuItem>
                          )}

                          {canRemoveInterestAction && (
                            <DropdownMenuItem
                              className="text-red-700 focus:text-red-800"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveInterest?.(
                                  interest.name,
                                  (interest as any)?.guest_name ||
                                    (interest as any)?.gift_recipient ||
                                    interest.name,
                                );
                              }}
                            >
                              {t("gifts.removeInterest")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-4 bg-muted/20 border-t border-border rounded-xl">
                    <div className="pt-4 space-y-6">
                      {/* Guest Details Section */}
                      {recipientId && (
                        <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("recipients.guestDetails")}
                          </p>

                          {isLoading ? (
                            <p className="text-xs text-muted-foreground">
                              {t("common.loading")}...
                            </p>
                          ) : details ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                              {/* Guest Name */}
                              <div>
                                <p className="text-muted-foreground">
                                  {t("recipients.fullName")}
                                </p>
                                <p className="font-medium">
                                  {details.guest_name ||
                                    `${details.guest_first_name || ""} ${details.guest_last_name || ""}`.trim() ||
                                    "-"}
                                </p>
                              </div>

                              {/* Coordinator */}
                              <div>
                                <p className="text-muted-foreground">
                                  {t("recipients.coordinator")}
                                </p>
                                <p className="font-medium">
                                  {details.coordinator_full_name || "-"}
                                </p>
                              </div>

                              {/* Coordinator Phone */}
                              <div>
                                <p className="text-muted-foreground">
                                  {t("recipients.coordinatorPhone")}
                                </p>
                                <p className="font-medium">
                                  {details.coordinator_mobile_no ||
                                    details.mobile_number ||
                                    "-"}
                                </p>
                              </div>

                              {/* Coordinator Email */}
                              <div>
                                <p className="text-muted-foreground">
                                  {t("recipients.coordinatorEmail")}
                                </p>
                                <p className="font-medium truncate">
                                  {details.coordinator_email || "-"}
                                </p>
                              </div>

                              {/* Preferred Contact */}
                              <div>
                                <p className="text-muted-foreground">
                                  {t("recipients.preferredContact")}
                                </p>
                                <p className="font-medium">
                                  {details.preferred_contact_method || "-"}
                                </p>
                              </div>

                              {/* Emirates ID */}
                              <div>
                                <p className="text-muted-foreground">
                                  {t("recipients.coordinatorEmiratesId")}
                                </p>
                                <p className="font-medium">
                                  {details.coordinator_emirates_id || "-"}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {t("recipients.noDetailsFound")}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Interest Details Section */}
                      <div className="space-y-2 p-4 bg-muted/50 rounded-lg border border-border">
                        {/* Interest Date */}
                        <p className="text-xs text-gray-600 flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0" />
                          {t("gifts.interestedOn")}{" "}
                          {formatDateTime(
                            interest.interest_date || interest.creation,
                          )}
                        </p>

                        {/* Created By / Approval Requester */}
                        {showAllocationRequestMeta && allocationRequestedBy && (
                          <p className="text-xs text-gray-600 flex items-center gap-1.5">
                            <User className="h-3 w-3 shrink-0" />{" "}
                            {t("gifts.requestedBy")}:{" "}
                            <span className="font-bold">
                              {allocationRequestedBy}
                            </span>
                          </p>
                        )}

                        {/* Allocation Requested Date */}
                        {showAllocationRequestMeta && allocationRequestedOn && (
                          <p className="text-xs text-gray-600 flex items-center gap-1.5">
                            <Clock className="h-3 w-3 shrink-0" />{" "}
                            {t("gifts.allocationRequestedOn")}{" "}
                            <span className="font-bold">
                              {formatDateTime(allocationRequestedOn)}
                            </span>
                          </p>
                        )}

                        {/* Coordinator (if exists) */}
                        {interest.coordinator && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <User className="h-3 w-3 shrink-0" />{" "}
                            {t("recipients.coordinator")}:{" "}
                            <span className="font-bold">
                              {interest.coordinator}
                            </span>
                          </p>
                        )}

                        {/* Processed By */}
                        {interest.processed_by && (
                          <p className="text-xs text-green-600 flex items-center gap-1.5">
                            <CheckCircle className="h-3 w-3 shrink-0" />{" "}
                            {t("gifts.processedBy")}{" "}
                            <span className="font-bold">
                              {interest.processed_by}
                            </span>
                          </p>
                        )}

                        {/* Rejection Reason (if rejected) */}
                        {isApprovedIssue && allocationApprovedBy && (
                          <p className="text-xs text-green-700 flex items-center gap-1.5">
                            <CheckCircle className="h-3 w-3 shrink-0" />
                            {t("gifts.allocationApprovedBy")}:
                            <span className="font-bold">{allocationApprovedBy}</span>
                          </p>
                        )}
                        {isApprovedIssue && allocationApprovedOn && (
                          <p className="text-xs text-green-700 flex items-center gap-1.5">
                            <Clock className="h-3 w-3 shrink-0" />
                            {t("gifts.allocationApprovedOn")}:
                            <span className="font-bold">
                              {formatDateTime(allocationApprovedOn)}
                            </span>
                          </p>
                        )}

                        {isRejected && (
                          <div className="text-xs text-red-600 space-y-1.5">
                            {allocationRejectedOn && (
                              <p className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3 shrink-0" />
                                {t("gifts.allocationRejectedOn")}:
                                <span className="font-bold">
                                  {formatDateTime(allocationRejectedOn)}
                                </span>
                              </p>
                            )}
                            {allocationRejectedBy && (
                              <p className="flex items-center gap-1.5">
                                <User className="h-3 w-3 shrink-0" />
                                {t("gifts.allocationRejectedBy")}:
                                <span className="font-bold">{allocationRejectedBy}</span>
                              </p>
                            )}
                            <p className="flex items-start gap-1.5">
                              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                              <span>
                                {t("gifts.allocationRejectedReason")}:
                                <span className="font-bold ml-1">{allocationRejectionReason}</span>
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AccordionSection>
  );
}

export default function GiftDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { roles, isAdmin, isEventManager } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [showAssignEventDialog, setShowAssignEventDialog] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showConfirmIssue, setShowConfirmIssue] = useState<{
    interestName: string;
    guestName: string;
  } | null>(null);
  const [showRejectionModal, setShowRejectionModal] = useState(false);

  const [showUnissueModal, setShowUnissueModal] = useState(false);
  const [unissueTarget, setUnissueTarget] = useState<{
    issueName: string;
    issueLabel: string;
  } | null>(null);
  const [showRemoveInterestModal, setShowRemoveInterestModal] = useState(false);
  const [removeInterestTarget, setRemoveInterestTarget] = useState<{
    interestName: string;
    label: string;
  } | null>(null);
  const [showRemoveRequestModal, setShowRemoveRequestModal] = useState(false);
  const [removeRequestTarget, setRemoveRequestTarget] = useState<{
    issueName: string;
    label: string;
  } | null>(null);
  const [unissueReason, setUnissueReason] = useState("");

  const [issueDetailsOpen, setIssueDetailsOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<GiftIssue | null>(null);

  const [dispatchDetailsOpen, setDispatchDetailsOpen] = useState(false);
  const [dispatchIssue, setDispatchIssue] = useState<GiftIssue | null>(null);
  const [allocatedRecipientDialogOpen, setAllocatedRecipientDialogOpen] = useState(false);
  const [allocatedRecipientId, setAllocatedRecipientId] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<{
    type: "interest" | "issue";
    name: string;
    label: string;
  } | null>(null);

  const {
    data: bundle,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["gift-detail-bundle", id],
    queryFn: async () => {
      if (!id) throw new Error("No gift ID");
      const result = await GiftAPI.getDetailBundle(id);
      if (result.success) return result.data;
      throw new Error(result.error);
    },
    enabled: !!id,
  });

  const gift = (bundle as GiftDetailBundle | undefined)?.gift as
    | Gift
    | undefined;
  const categoryData = bundle?.category;
  const giftIssues = bundle?.issues || [];
  const giftInterests = bundle?.interests || [];
  const canApprove = !!bundle?.can_approve || !gift?.event;

  const primaryIssue = giftIssues?.[0] as GiftIssue | undefined;
  const primaryApprovedIssue =
    (giftIssues as any[])?.find(
      (i: any) => (i as any)?.approval_status === "Approved",
    ) || primaryIssue;

  const openIssueDetails = useCallback(
    async (issueName: string) => {
      if (!issueName) return;
      const existing = (giftIssues || []).find(
        (i: any) => i?.name === issueName,
      ) as GiftIssue | undefined;
      if (existing) {
        setSelectedIssue(existing);
        setIssueDetailsOpen(true);
        return;
      }
      const res = await GiftIssueAPI.get(issueName);
      console.log("Issue data:", res);
      if (res.success) {
        setSelectedIssue(res.data || null);
        setIssueDetailsOpen(true);
      } else {
        toast.error(res.error || t("gifts.failedToLoadGift"));
      }
    },
    [giftIssues, t],
  );

  const { data: allocatedRecipient } = useQuery({
    queryKey: ["gift-recipient", allocatedRecipientId],
    queryFn: async () => {
      if (!allocatedRecipientId) return null;
      const res = await GiftRecipientAPI.get(allocatedRecipientId);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: Boolean(allocatedRecipientId),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No gift ID");
      return GiftAPI.delete(id);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("gifts.giftDeletedSuccessfully"));
        queryClient.invalidateQueries({ queryKey: ["gifts"] });
        navigate("/gifts");
      } else {
        toast.error(result.error || t("gifts.failedToDeleteGift"));
      }
    },
  });

  const recordInterestMutation = useMutation<
    { success: boolean; data?: any; error?: string; results?: Array<{ guest: string; success: boolean; message?: string }> },
    any,
    string[]
  >({
    mutationFn: async (recipientNames: string[]) => {
      if (!id) throw new Error("No gift ID");
      const normalized = (recipientNames || []).filter(Boolean);
      if (normalized.length === 0) {
        return { success: false, error: "No recipient selected" };
      }

      const bulkRes = await GiftAPI.recordInterestsBulk({
        gift: id,
        gift_recipients: normalized,
        interest_source: "Manual Entry",
      });

      if (!bulkRes.success) {
        return { success: false, error: bulkRes.error };
      }

      const bulkData = bulkRes.data!;
      const results = bulkData.results.map((r) => ({
        guest: r.gift_recipient,
        success: r.success,
        message: r.success ? t("interests.interestRecorded") : (r.error || t("interests.failedToSaveInterest")),
        name: r.name,
        approval_status: r.approval_status,
      }));

      const hasAnySuccess = bulkData.created > 0;

      // If any single-recipient was auto-approved, create its issue
      let lastIssueName: string | null = null;
      for (const r of bulkData.results) {
        if (r.success && r.approval_status === "Approved" && r.name) {
          const issueRes = await GiftAPI.createIssueFromInterest(r.name);
          lastIssueName = (issueRes as any)?.data?.issue || null;
        }
      }

      return {
        success: hasAnySuccess,
        data: lastIssueName ? { issue: lastIssueName } : undefined,
        error: hasAnySuccess ? undefined : results[0]?.message,
        results,
      };
    },
    onSuccess: (result) => {
      if (result.results) {
        result.results.forEach(({ guest, success, message }) => {
          if (success) {
            toast.success(`${guest}: ${message}`);
          } else {
            toast.error(`${guest}: ${message}`);
          }
        });
      }

      if (result.success) {
        setShowInterestModal(false);
        queryClient.invalidateQueries({ queryKey: ["gift-detail-bundle", id] });
        const issueName = (result.data as any)?.issue;
        if (issueName) openIssueDetails(issueName);
      }
    },
    onError: (e: any) => toast.error(String(e?.message || e)),
  });

  const removeInterestMutation = useMutation({
    mutationFn: async (interestName: string) => {
      return GiftAPI.removeGiftInterest(interestName);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("gifts.interestRemovedSuccessfully"));
        queryClient.invalidateQueries({ queryKey: ["gift-detail-bundle", id] });
      } else {
        toast.error(result.error || t("gifts.failedToRemoveInterest"));
      }
    },
    onError: (e: any) => toast.error(String(e?.message || e)),
  });

  const removeAllocationRequestMutation = useMutation({
    mutationFn: async (issueName: string) => {
      return GiftAPI.removeAllocationRequest(issueName);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("gifts.allocationRequestRemovedSuccessfully"));
        queryClient.invalidateQueries({ queryKey: ["gift-detail-bundle", id] });
      } else {
        toast.error(result.error || t("gifts.failedToRemoveAllocationRequest"));
      }
    },
    onError: (e: any) => toast.error(String(e?.message || e)),
  });

  const allocateInterestDirectMutation = useMutation({
    mutationFn: async (interestName: string) => {
      if (!interestName) throw new Error("No interest name");
      return GiftAPI.approveInterestAndIssue(interestName);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("common.allocated"));
        queryClient.invalidateQueries({ queryKey: ["gift-detail-bundle", id] });
      } else {
        toast.error(result.error || t("interests.failedToSaveInterest"));
      }
    },
    onError: (e: any) => toast.error(String(e?.message || e)),
  });

  const sendIssueForApprovalAgainMutation = useMutation({
    mutationFn: async (issueName: string) => {
      if (!issueName) throw new Error("No issue name");
      return GiftAPI.sendIssueForApprovalAgain(issueName);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("gifts.requestSentForApprovalAgain"));
        queryClient.invalidateQueries({ queryKey: ["gift-detail-bundle", id] });
      } else {
        toast.error(result.error || t("gifts.failedToSendRequestForApprovalAgain"));
      }
    },
    onError: (e: any) => toast.error(String(e?.message || e)),
  });

  const unissueGiftMutation = useMutation({
    mutationFn: async (payload: { issueName: string; reason: string }) => {
      return GiftAPI.unissueGift(payload.issueName, payload.reason);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("gifts.allocationRemovedSuccessfully"));
        queryClient.invalidateQueries({ queryKey: ["gift-detail-bundle", id] });
      } else {
        toast.error(result.error || t("gifts.failedToRemoveAllocation"));
      }
    },
    onError: (e: any) => toast.error(String(e?.message || e)),
  });

  const approveIssueMutation = useMutation({
    mutationFn: async (issueName: string) => {
      if (!issueName) throw new Error("No issue name");
      return GiftAPI.approveIssue(issueName);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("gifts.approvedSuccessfully"));
        queryClient.invalidateQueries({ queryKey: ["gift-detail-bundle", id] });
      } else {
        toast.error(result.error || t("gifts.failedToApprove"));
      }
    },
    onError: (e: any) => toast.error(String(e?.message || e)),
  });

  const rejectPendingMutation = useMutation({
    mutationFn: async (payload: {
      type: "interest" | "issue";
      name: string;
      reason: string;
    }) => {
      return payload.type === "interest"
        ? GiftAPI.rejectInterest(payload.name, payload.reason)
        : GiftAPI.rejectIssue(payload.name, payload.reason);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("gifts.requestRejectedSuccessfully"));
        setShowRejectionModal(false);
        setRejectTarget(null);
        queryClient.invalidateQueries({ queryKey: ["gift-detail-bundle", id] });
      } else {
        toast.error(result.error || t("gifts.failedToRejectRequest"));
      }
    },
    onError: (e: any) => toast.error(String(e?.message || e)),
  });

  const createIssueFromInterestMutation = useMutation({
    mutationFn: async (interestName: string) => {
      return GiftAPI.createIssueFromInterest(interestName);
    },
    onSuccess: (result) => {
      if (result.success) {
        const approvalStatus = (result.data as any)?.approval_status;
        if (approvalStatus === "Approved") {
          toast.success(t("gifts.approvedSuccessfully"));
        } else {
          toast.success(t("gifts.giftSentForApproval"));
        }
        setShowConfirmIssue(null);
        queryClient.invalidateQueries({ queryKey: ["gift-detail-bundle", id] });
        const issueName = (result.data as any)?.issue;
        if (issueName) openIssueDetails(issueName);
      } else {
        // Handle specific error for timestamp mismatch
        if ((result.data as any)?.error === "timestamp_mismatch") {
          toast.error(t("gifts.interestModifiedByAnotherUser"));
        } else {
          toast.error(result.error || t("gifts.failedToCreateIssue"));
        }
      }
    },
    onError: (e: any) => toast.error(String(e?.message || e)),
  });

  const updateIssueDispatchMutation = useMutation({
    mutationFn: async (payload: {
      issueName: string;
      data: Partial<GiftIssue>;
    }) => {
      return GiftIssueAPI.update(payload.issueName, payload.data);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("gifts.dispatchDetailsUpdated"));
        setDispatchDetailsOpen(false);
        setDispatchIssue(null);
        queryClient.invalidateQueries({ queryKey: ["gift-detail-bundle", id] });
      } else {
        toast.error(result.error || t("gifts.failedToUpdateDispatch"));
      }
    },
    onError: (e: any) => toast.error(String(e?.message || e)),
  });

  const getImageUrl = (path: string | undefined) => {
    if (!path) return "";
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    return `${config.apiBaseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return "-";
    try {
      const dt = parseFrappeDate(date);
      if (Number.isNaN(dt.getTime())) return date;
      return format(dt, "dd MMM yyyy, hh:mm a");
    } catch {
      return date;
    }
  };

  const formatDateOnly = (date: string | undefined) => {
    if (!date) return "-";
    try {
      const dt = parseFrappeDate(date);
      if (Number.isNaN(dt.getTime())) return date;
      return format(dt, "dd MMM yyyy");
    } catch {
      return date;
    }
  };

  const formatDateTime = (date: string | undefined) => {
    if (!date) return "-";
    try {
      const dt = parseFrappeDate(date);
      if (Number.isNaN(dt.getTime())) return date;
      return format(dt, "dd MMM yyyy 'at' hh:mm a");
    } catch {
      return date;
    }
  };

  const eventHistoryRows = useMemo(() => {
    if (!gift) return [];

    const fromGift = (gift.gift_event_history || []).map((row: any) => ({
      fromEvent: row.from_event,
      toEvent: row.to_event,
      fromEventName: row.from_event_name || row.from_event,
      toEventName: row.to_event_name || row.to_event,
      movedOn: row.moved_on,
      movedBy: row.moved_by,
      remarks: row.remarks,
      status: row.to_event_status || row.from_event_status,
    }));

    const legacy = (bundle?.event_history || []).map((row: any) => ({
      fromEvent: row.from_event,
      toEvent: row.to_event,
      fromEventName: row.from_event_name || row.from_event,
      toEventName: row.to_event_name || row.to_event,
      movedOn: row.moved_on,
      movedBy: row.moved_by,
      remarks: row.remarks,
      status: row.to_event_status || row.from_event_status,
    }));

    const rows = (fromGift.length ? fromGift : legacy)
      .filter((row: any) => !!(row.toEvent || row.fromEvent))
      .sort(
        (a: any, b: any) =>
          parseFrappeDate(String(b.movedOn || 0)).getTime() -
          parseFrappeDate(String(a.movedOn || 0)).getTime(),
      );

    if (rows.length === 0 && gift.event) {
      return [
        {
          fromEvent: undefined,
          toEvent: gift.event,
          fromEventName: undefined,
          toEventName: gift.event_name || gift.event,
          movedOn: gift.modified || gift.creation,
          movedBy: gift.modified_by || gift.owner,
          remarks: undefined,
          status: undefined,
        },
      ];
    }

    return rows;
  }, [gift, bundle?.event_history]);

  // Create a map of event IDs to event names for quick lookup
  const eventNamesMap = useMemo(() => {
    const map = new Map<string, string>();
    
    // From event history rows
    eventHistoryRows.forEach(row => {
      if (row.fromEvent && row.fromEventName && row.fromEvent !== row.fromEventName) {
        map.set(row.fromEvent, row.fromEventName);
      }
      if (row.toEvent && row.toEventName && row.toEvent !== row.toEventName) {
        map.set(row.toEvent, row.toEventName);
      }
    });
    
    // From current gift
    if (gift?.event && gift?.event_name && gift.event !== gift.event_name) {
      map.set(gift.event, gift.event_name);
    }
    
    return map;
  }, [eventHistoryRows, gift]);

  const giftHistory = useMemo((): GiftHistoryEvent[] => {
    const persistedTimeline = Array.isArray((bundle as any)?.timeline)
      ? (bundle as any).timeline
      : Array.isArray((gift as any)?.timeline)
        ? (gift as any).timeline
        : [];
    const timelineSeen = new Set<string>();
    const timeline = persistedTimeline.filter((row: any) => {
      const key = `${String(row?.kind || "")}|${String(row?.docname || "")}|${String(row?.timestamp || "")}|${String(row?.notes || "")}`;
      if (timelineSeen.has(key)) return false;
      timelineSeen.add(key);
      return true;
    });
    const events: GiftHistoryEvent[] = [];

    const stringifyVal = (v: any) => {
      if (v === null || v === undefined || v === "") return "-";
      if (typeof v === "string") return v;
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    };

    const labelField = (field: string) => {
      if (!field) return "-";
      return String(field)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
    };

    const parseStructuredChanges = (summary: string) => {
      const segments = String(summary || "")
        .split(";")
        .map((segment) => segment.trim())
        .filter(Boolean);
      
      let currentDocName: string | null = null;
      
      return segments.map((segment) => {
        // Check for "Document Updated (docname): Field: old -> new" pattern
        const docUpdateMatch = segment.match(/^Document Updated \(([^)]+)\):\s*(.+)$/);
        if (docUpdateMatch) {
          currentDocName = String(docUpdateMatch[1] || "").trim();
          const fieldChange = String(docUpdateMatch[2] || "").trim();
          // Parse the field change: "Type: old -> new" or "Description: old -> new"
          const fieldMatch = fieldChange.match(/^([^:]+):\s*(.*?)\s*->\s*(.*)$/);
          if (fieldMatch) {
            return {
              field: currentDocName, // Use document name as the heading
              subField: String(fieldMatch[1] || "").trim(), // Type/Description/etc
              from: String(fieldMatch[2] || "").trim() || "-",
              to: String(fieldMatch[3] || "").trim() || "-",
            };
          }
          return {
            field: currentDocName,
            subField: null,
            from: fieldChange,
            to: "-",
          };
        }
        
        // If no document update prefix but we have a current doc, this field belongs to it
        if (currentDocName) {
          const fieldMatch = segment.match(/^([^:]+):\s*(.*?)\s*->\s*(.*)$/);
          if (fieldMatch) {
            return {
              field: currentDocName,
              subField: String(fieldMatch[1] || "").trim(),
              from: String(fieldMatch[2] || "").trim() || "-",
              to: String(fieldMatch[3] || "").trim() || "-",
            };
          }
        }
        
        // Standard pattern: "Field: old -> new"
        const matched = segment.match(/^([^:]+):\s*(.*?)\s*->\s*(.*)$/);
        if (!matched) return null;
        return {
          field: String(matched[1] || "").trim(),
          subField: null,
          from: String(matched[2] || "").trim() || "-",
          to: String(matched[3] || "").trim() || "-",
        };
      }).filter(Boolean) as Array<{ field: string; subField: string | null; from: string; to: string }>;
    };

    const directAllocationIssueNames = new Set(
      timeline
        .filter((row: any) => {
          if (String(row?.kind || "") !== "issue_created") return false;
          const approvalStatus = String(row?.approval_status || "").toLowerCase();
          const notes = String(row?.notes || "");
          return approvalStatus === "approved" || /approval status:\s*approved/i.test(notes);
        })
        .map((row: any) => String(row?.docname || ""))
        .filter(Boolean),
    );

    const singleIssueEventKinds = new Set([
      "issue_created",
      "issue_approved",
      "issue_delivered",
      "allocation_rejected",
      "allocation_removed",
      "allocation_request_removed",
    ]);
    const seenSingleIssueEvent = new Set<string>();

    timeline.forEach((item: any) => {
      const kind = String(item?.kind || "");
      const ts = String(item?.timestamp || "");

      if (!ts) return;

      // Process allocation-related events from timeline
      if (["issue_created", "issue_approved", "issue_delivered", "allocation_rejected", "allocation_removed", "allocation_request_removed", "dispatch_details_updated"].includes(kind)) {
        if (singleIssueEventKinds.has(kind)) {
          const dedupeKey = `${kind}|${String(item?.docname || "")}`;
          if (seenSingleIssueEvent.has(dedupeKey)) {
            return;
          }
          seenSingleIssueEvent.add(dedupeKey);
        }

        const userName =
          item?.user_full_name || 
          (item?.user && item.user.includes('@') ? item.user.split('@')[0] : item.user) || 
          t("common.unknown");
        const guestName =
          item?.guest_full_name || item?.gift_recipient || t("common.unknown");
        
        if (kind === "issue_created") {
          const hasExplicitApprovalEvent = timeline.some(
            (row: any) =>
              String(row?.docname || "") === String(item?.docname || "") &&
              String(row?.kind || "") === "issue_approved",
          );
          const hasAllocationRemovedEvent = timeline.some(
            (row: any) =>
              String(row?.docname || "") === String(item?.docname || "") &&
              String(row?.kind || "") === "allocation_removed",
          );
          const hasAllocationRequestRemovedEvent = timeline.some(
            (row: any) =>
              String(row?.docname || "") === String(item?.docname || "") &&
              String(row?.kind || "") === "allocation_request_removed",
          );
          const isApprovedOnCreate =
            (String(item?.approval_status || "").toLowerCase() === "approved" ||
              (hasAllocationRemovedEvent && !hasAllocationRequestRemovedEvent)) &&
            !hasExplicitApprovalEvent;
          const isDirectAllocation = directAllocationIssueNames.has(
            String(item?.docname || ""),
          );
          events.push({
            type: "issued",
            date: ts,
            text: (
              <>
                <div className="space-y-1">
                  <div>
                    <span className="font-semibold text-black">
                      {isDirectAllocation
                        ? t("gifts.historyGiftAllocated")
                        : isApprovedOnCreate
                          ? t("gifts.historyAllocationApproved")
                          : t("gifts.historyAllocationRequestRaised")}
                    </span>{" "}
                    {isDirectAllocation ? t("gifts.to") : t("gifts.for")}
                    <span className="font-bold ml-1">{guestName}</span>
                    <span className="font ml-1">{t("gifts.historyBy")}</span>
                    <span className="font-bold ml-1">{userName}</span>
                  </div>
                </div>
              </>
            ),
            link: item?.docname,
          });
        } else if (kind === "issue_approved") {
          if (directAllocationIssueNames.has(String(item?.docname || ""))) {
            return;
          }
          events.push({
            type: "issued",
            date: ts,
            text: (
              <>
                <div className="space-y-1">
                  <div>
                    <span className="font-semibold text-black">{t("gifts.historyAllocationApproved")}</span> {t("gifts.for")}
                    <span className="font-bold ml-1">{guestName}</span>
                    <span className="font ml-1">{t("gifts.historyBy")}</span>
                    <span className="font-bold ml-1">{userName}</span>
                  </div>
                </div>
              </>
            ),
            link: item?.docname,
          });
        } else if (kind === "issue_delivered") {
          events.push({
            type: "delivered",
            date: ts,
            text: (
              <>
                {t("gifts.historyDelivered")}
                <span className="ml-1">{t("gifts.for")}</span>
                <span className="font-bold ml-1">{guestName}</span>
              </>
            ),
            link: item?.docname,
          });
        } else if (kind === "allocation_rejected") {
          const normalizedReason = String(item?.notes || "")
            .replace(/^(Reason:\s*)+/i, "")
            .trim();
          events.push({
            type: "rejected",
            date: ts,
            text: (
              <>
                <div className="space-y-1">
                  <div>
                    <span className="font-semibold text-black">{t("gifts.historyAllocationRejectedTitle")}</span> {t("gifts.for")}
                    <span className="font-bold ml-1">{guestName}</span>
                    <span className="font ml-1">{t("gifts.historyBy")}</span>
                    <span className="font-bold ml-1">{userName}</span>
                  </div>
                  {item?.notes && (
                    <div className="text-xs text-black">
                      <span className="font-medium">{t("gifts.historyReason")}:</span>
                      <span className="font-semibold ml-1">{normalizedReason || item.notes}</span>
                    </div>
                  )}
                </div>
              </>
            ),
            link: item?.docname,
          });
        } else if (kind === "allocation_removed") {
          events.push({
            type: "rejected",
            date: ts,
            text: (
              <>
                <div className="space-y-1">
                  <div>
                    <span className="font-semibold text-black">{t("gifts.allocationRemoved")}</span> {t("gifts.for")}
                    <span className="font-bold ml-1">{guestName}</span>
                    <span className="font ml-1">{t("gifts.historyBy")}</span>
                    <span className="font-bold ml-1">{userName}</span>
                  </div>
                </div>
              </>
            ),
            link: item?.docname,
          });
        } else if (kind === "allocation_request_removed") {
          events.push({
            type: "modified",
            date: ts,
            text: (
              <>
                <div className="space-y-1">
                  <div>
                    <span className="font-semibold text-black">{t("gifts.allocationRequestRemoved")}</span> {t("gifts.for")}
                    <span className="font-bold ml-1">{guestName}</span>
                    <span className="font ml-1">{t("gifts.historyBy")}</span>
                    <span className="font-bold ml-1">{userName}</span>
                  </div>
                </div>
              </>
            ),
            link: item?.docname,
          });
        } else if (kind === "dispatch_details_updated") {
          const dispatchEditSummary = String(item?.notes || "")
            .replace(/^Dispatch details updated:\s*/i, "")
            .trim();
          const dispatchChanges = parseStructuredChanges(dispatchEditSummary);
          events.push({
            type: "modified",
            date: ts,
            text: (
              <>
                <div className="space-y-1">
                  <div>
                    <span className="font-semibold text-black">{t("gifts.historyDispatchDetailsEdited")}</span>
                    <span className="ml-1">{t("gifts.historyBy")}</span>
                    <span className="font-bold ml-1">{userName}</span>
                  </div>
                  {dispatchChanges.length > 0 ? (
                    <ul className="mt-2 space-y-3 text-xs text-black">
                      {dispatchChanges.map((change, index) => (
                        <li
                          key={`${change.field}-${change.from}-${change.to}-${index}`}
                          className="rounded-md border border-border bg-muted/30 px-3 py-2.5"
                        >
                          <div className="font-semibold text-sm mb-1">{change.field}</div>
                          {change.subField && (
                            <div className="text-xs text-muted-foreground mb-2">{change.subField}</div>
                          )}
                          <div className="space-y-1">
                            <div className="text-muted-foreground">
                              <span className="font-medium text-foreground">Previous:</span>{" "}
                              <span>{change.from}</span>
                            </div>
                            <div className="text-muted-foreground">
                              <span className="font-medium text-foreground">Updated:</span>{" "}
                              <span>{change.to}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : dispatchEditSummary ? (
                    <div className="text-xs text-black">{dispatchEditSummary}</div>
                  ) : null}
                </div>
              </>
            ),
            link: item?.docname,
          });
        }
        
        return;
      }

      const userName =
        item?.user_full_name || 
        (item?.user && item.user.includes('@') ? item.user.split('@')[0] : item.user) || 
        t("common.unknown");
      const guestName =
        item?.guest_full_name || item?.gift_recipient || t("common.unknown");

      if (kind === "gift_created") {
        events.push({
          type: "created",
          date: ts,
          text: (
            <>
              {t("gifts.historyCreatedBy", { user: "" })}
              <span className="font-semibold">{userName}</span>{" "}
            </>
          ),
        });
        return;
      }

      if (kind === "interest_removed") {
        events.push({
          type: "modified",
          date: ts,
          text: (
            <>
              <span className="font-semibold">{t("gifts.historyInterestRemoved")}</span> {t("gifts.for")}
              <span className="font-semibold ml-1">{guestName}</span>
              <span className="ml-1">{t("gifts.historyBy")}</span>
              <span className="font-semibold ml-1">{userName}</span>
            </>
          ),
          link: item?.doctype === "Gift Interest" ? item?.docname : undefined,
        });
        return;
      }

      if (kind === "gift_modified") {
        const changes = Array.isArray(item?.changes) ? item.changes : [];

        // Skip status change events since we handle them manually
        const statusChange = changes.find(
          (c: any) => String(c?.field) === "status",
        );
        if (statusChange) {
          return; // Skip status changes - we handle these manually
        }

        const eventChange = changes.find(
          (c: any) => String(c?.field) === "event",
        );
        const eventNameChange = changes.find(
          (c: any) => String(c?.field) === "event_name",
        );
        // Debug: Log the enhanced event change data
        if (eventChange) {
          console.log("Enhanced Event Change:", eventChange);
        }

        const structuredChanges = changes
          .map((c: any) => {
            // Merge event + event_name so we show the event *name* in history.
            if (String(c?.field) === "event_name") return null;

            const field = labelField(String(c?.field || ""));

            let fromV = stringifyVal(c?.from);
            let toV = stringifyVal(c?.to);
            if (
              String(c?.field) === "event" &&
              (eventChange || eventNameChange)
            ) {
              const fromName = eventNameChange
                ? stringifyVal(eventNameChange?.from)
                : null;
              const toName = eventNameChange
                ? stringifyVal(eventNameChange?.to)
                : null;
              
              // For unassignment: use event name if available, otherwise use enhanced data
              if (fromName && fromName !== "-" && fromName !== "") {
                fromV = fromName;
              } else if (eventChange?.from_name && eventChange.from_name !== "-" && eventChange.from_name !== "") {
                // Use the enhanced event name from backend
                fromV = eventChange.from_name;
              } else if (eventChange?.from && eventChange?.from !== "-" && eventChange?.from !== "") {
                // Try to find the event name from the event names map
                fromV = eventNamesMap.get(eventChange.from) || stringifyVal(eventChange.from);
              } else {
                // Properly handle null/empty values as "-"
                fromV = "-";
              }
              
              // For assignment/unassignment: use event name if available
              if (toName && toName !== "-" && toName !== "") {
                toV = toName;
              } else if (eventChange?.to_name && eventChange.to_name !== "-" && eventChange.to_name !== "") {
                // Use the enhanced event name from backend
                toV = eventChange.to_name;
              } else if (eventChange?.to && eventChange?.to !== "-" && eventChange?.to !== "") {
                // Try to find the event name from the event names map
                toV = eventNamesMap.get(eventChange.to) || stringifyVal(eventChange.to);
              } else {
                // Properly handle null/empty values as "-"
                toV = "-";
              }
            }
            return {
              field,
              from: fromV,
              to: toV,
            };
          })
          .filter(Boolean) as Array<{ field: string; from: string; to: string }>;

        events.push({
          type: "modified",
          date: ts,
          text: (
            <>
              <div className="space-y-1">
                <div>
                  <span>{t("gifts.historyModifiedBy", { user: "" })}</span>
                  <span className="font-semibold">{userName}</span>
                </div>
                {structuredChanges.length > 0 && (
                  <ul className="mt-2 space-y-2 text-xs text-black">
                    {structuredChanges.map((change, index) => (
                      <li
                        key={`${change.field}-${change.from}-${change.to}-${index}`}
                        className="rounded-md border border-border bg-muted/30 px-2.5 py-2"
                      >
                        <div className="font-semibold">{change.field}</div>
                        <div className="mt-1 text-muted-foreground">
                          <span className="font-medium text-foreground">Previous:</span>{" "}
                          <span>{change.from}</span>
                        </div>
                        <div className="text-muted-foreground">
                          <span className="font-medium text-foreground">Updated:</span>{" "}
                          <span>{change.to}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ),
        });
        return;
      }

      if (kind === "interest_created") {
        events.push({
          type: "interest",
          date: ts,
          text: (
            <>
              {t("gifts.historyInterestRecordedBy", { user: "", guest: "" })}{" "}
              <span className="font-semibold">{userName}</span> {t("gifts.for")}
              <span className="font-semibold ml-1">{guestName}</span>
            </>
          ),
          link: item?.doctype === "Gift Interest" ? item?.docname : undefined,
        });
        return;
      }
    });

    return events.sort(
      (a, b) =>
        parseFrappeDate(String(b.date || 0)).getTime() -
        parseFrappeDate(String(a.date || 0)).getTime(),
    );
  }, [bundle, gift, eventNamesMap, t]);

  // ── Loading / Error
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground text-sm">
            {t("gifts.loadingGiftDetails")}
          </p>
        </div>
      </div>
    );
  }

  if (error || !gift) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <p className="text-destructive font-medium">
          {t("gifts.failedToLoadGift")}
        </p>
        <Button variant="outline" onClick={() => navigate("/gifts")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {t("common.back")}{" "}
          {t("nav.gifts")}
        </Button>
      </div>
    );
  }

  const giftAttributes = gift.table_gvlf || [];
  const hasImages = gift.gift_images && gift.gift_images.length > 0;
  const hasBarcode = gift.barcode_value || gift.barcode;
  const isEventCoordinator = (roles || []).some(
    (r) => String(r).toLowerCase() === "event coordinator",
  );

  const handlePrintBarcode = () => {
    const value = String(gift?.barcode_value || "").trim();
    const imageUrl = gift?.barcode ? String(gift.barcode) : "";
    const giftId = String(gift?.gift_id || gift?.name || "");

    if (!value && !imageUrl) return;

    const resolvedImageUrl =
      imageUrl ||
      (value
        ? `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(value)}&code=Code128&multiplebarcodes=false&translate-esc=false&unit=Fit&dpi=96&imagetype=Gif&rotation=0&color=%23000000&bgcolor=%23ffffff&codepage=&qunit=Mm&quiet=0`
        : "");

    const printContent = `
      <!doctype html>
      <html>
        <head>
          <title>Barcode</title>
          <style>
            @media print {
              @page { margin: 0; size: auto; }
              body { margin: 0; padding: 20px; }
            }
            body { margin: 0; padding: 20px; text-align: center; font-family: Arial, sans-serif; }
            .barcode-container { display: inline-block; }
            .barcode-image { max-width: 300px; height: auto; }
            .barcode-value { font-family: monospace; font-size: 16px; margin-top: 8px; }
            .gift-id { font-size: 14px; margin-top: 4px; color: #666; }
          </style>
        </head>
        <body>
          <div class="barcode-container">
            ${resolvedImageUrl ? `<img src="${resolvedImageUrl}" class="barcode-image" />` : ""}
            ${value ? `<div class="barcode-value">${value}</div>` : ""}
            ${giftId ? `<div class="gift-id">ID: ${giftId}</div>` : ""}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    const w = window.open("", "_blank");
    if (!w) return;

    w.document.open();
    w.document.write(printContent);
    w.document.close();
  };

  const isDelivered = giftIssues?.some((i: any) => i.status === "Delivered");
  const hasActiveDispatch = giftIssues?.some(
    (i: any) => i.dispatch_status === "In Transit" || i.status === "In Transit",
  );
  const effectiveStatus = isDelivered
    ? "Delivered"
    : hasActiveDispatch
      ? "In Transit"
      : gift.status || "Available";
  const normalizedGiftStatus = String(gift.status || "")
    .trim()
    .toLowerCase();
  const canShowDispatchSection = normalizedGiftStatus == "delivered";
  const isIssued = normalizedGiftStatus === "issued";
  const isActionsLocked = isIssued || normalizedGiftStatus === "delivered";
  const canEditGift =
    ((normalizedGiftStatus !== "delivered" &&
      normalizedGiftStatus !== "issued" &&
      !isEventCoordinator) ||
      isAdmin ||
      isEventManager);
  const canDeleteGift = isAdmin || isEventManager;
  const canViewCertificate =
    normalizedGiftStatus === "delivered" && Boolean(primaryApprovedIssue?.name);
  const certificateUrl = canViewCertificate
    ? `${config.backendUrl}/api/method/frappe.utils.print_format.download_pdf?doctype=Gift%20Issue&name=${encodeURIComponent(primaryApprovedIssue?.name || "")}&format=Delivered%20Gift%20Certificate&no_letterhead=1&letterhead=No%20Letterhead&settings=%7B%7D&_lang=en&pdf_generator=wkhtmltopdf`
    : "";
  const allocationVisibleStatuses = new Set(["allocated", "issued", "delivered"]);
  const shouldShowAllocatedTo = allocationVisibleStatuses.has(normalizedGiftStatus);
  const activeAllocatedIssue = (giftIssues || []).find((i: any) => {
    const approvalStatus = String(i?.approval_status || "").toLowerCase();
    const issueStatus = String(i?.status || "").toLowerCase();
    if (approvalStatus !== "approved") return false;
    return issueStatus !== "cancelled" && issueStatus !== "returned";
  }) as GiftIssue | undefined;
  const allocatedToRecipientId = shouldShowAllocatedTo
    ? String(
        (activeAllocatedIssue as any)?.gift_recipient ||
          (primaryApprovedIssue as any)?.gift_recipient ||
          gift?.gift_recipient ||
          "",
      ).trim()
    : "";
  const allocatedToRecipientLabel = shouldShowAllocatedTo
    ? String(
        (activeAllocatedIssue as any)?.guest_name ||
          (activeAllocatedIssue as any)?.owner_full_name ||
          (primaryApprovedIssue as any)?.guest_name ||
          (primaryApprovedIssue as any)?.owner_full_name ||
          allocatedToRecipientId ||
          "",
      ).trim()
    : "";

  const displayInterests = giftInterests?.length ? giftInterests : [];
  const persistedTimeline = Array.isArray((bundle as any)?.timeline)
    ? (bundle as any).timeline
    : Array.isArray((gift as any)?.timeline)
      ? (gift as any).timeline
      : [];
  const timelineEntrySeen = new Set<string>();
  const timelineEntries = persistedTimeline.filter((row: any) => {
    const key = `${String(row?.kind || "")}|${String(row?.docname || "")}|${String(row?.timestamp || "")}|${String(row?.notes || "")}`;
    if (timelineEntrySeen.has(key)) return false;
    timelineEntrySeen.add(key);
    return true;
  });

  const latestIssue = [...(giftIssues || [])]
    .filter(Boolean)
    .sort(
      (a: any, b: any) =>
        parseFrappeDate(String(b.modified || b.creation || 0)).getTime() -
        parseFrappeDate(String(a.modified || a.creation || 0)).getTime(),
    )[0];

  const hasDispatchDetails = Boolean(
    primaryIssue?.dispatch_date ||
    primaryIssue?.received_by_name ||
    primaryIssue?.delivery_person_name ||
    primaryIssue?.delivery_remarks ||
    (primaryIssue?.documents || []).length,
  );

  const carouselImages = hasImages
    ? gift.gift_images!.map((img: any, i: number) => ({
        url: getImageUrl(img.image),
        alt: `${t("gifts.giftPhoto")} ${i + 1}`,
      }))
    : [];

  return (
    <>
      <div className="min-h-svh bg-background">
        <div className="">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-start gap-3" />
            <div className="flex items-center gap-2 shrink-0">
              {(canEditGift || canDeleteGift || canViewCertificate) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canViewCertificate && (
                      <DropdownMenuItem asChild>
                        <a href={certificateUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                          <FileText className="h-4 w-4 mr-2" />
                          {t("gifts.viewCertificate")}
                        </a>
                      </DropdownMenuItem>
                    )}

                    {canEditGift && (
                      <DropdownMenuItem
                        onClick={() => navigate(`/gifts/${encodeURIComponent(gift.name)}/edit`)}
                        className="cursor-pointer"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        {t("gifts.editGift")}
                      </DropdownMenuItem>
                    )}
                    

                    {canDeleteGift && (
                      <>
                        {(canEditGift || canViewCertificate) && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          onClick={() => setShowDeleteDialog(true)}
                          disabled={deleteMutation.isPending}
                          className="text-destructive focus:text-destructive cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("gifts.deleteGift")}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {/* <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(normalizedGiftStatus !== "delivered" && normalizedGiftStatus !== "issued" && !isEventCoordinator) || isAdmin || isEventManager ? (
                    <DropdownMenuItem
                      onClick={() => navigate(`/gifts/${encodeURIComponent(gift.name)}/edit`)}
                    >
                      <Edit className="h-4 w-4 mr-2" /> {t("gifts.editGift")}
                    </DropdownMenuItem>
                  ) : null}
                  {(isAdmin || isEventManager) && (
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> {t("gifts.deleteGift")}
                  </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div> */}
          </div>

          {/* ── Two-column Layout */}
          <div className="grid lg:grid-cols-[1fr_320px] gap-5">
            {/* ── LEFT COLUMN */}
            <div className="space-y-4">
              {/* Gift Details / Attributes */}
              <AccordionSection
                icon={<List />}
                title={t("gifts.giftDetails")}
                defaultOpen
                badge={
                  <Badge
                    className={` flex-shrink-0   tracking-wide font-semibold ${
                      getStatusColor(gift.status) || "bg-muted"
                    }`}
                  >
                    {gift.status === "Issued" ? "Allocated" : gift.status}
                  </Badge>
                }
              >
                <div className="px-5 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4 pb-3 border-b border-border">
                    <Field label={t("gifts.giftName")}>
                      <p className="font-semibold">{gift.gift_name}</p>
                    </Field>
                    <Field label={t("gifts.id")}>
                      <p className="font-mono text-sm">{gift.name}</p>
                    </Field>
                    <Field label={t("gifts.category")}>
                      <div>
                        <p>
                          {categoryData?.category_name || gift.category || "-"}
                        </p>
                      </div>
                    </Field>

                    <Field label={t("gifts.barcode")}>
                      <div className="flex gap-2">
                        {gift?.barcode ? (
                          <img
                            className="w-60"
                            src={gift?.barcode}
                            alt="Loading failed"
                          />
                        ) : (
                          <p className="font-mono text-sm">
                            {gift.barcode_value || "-"}
                          </p>
                        )}
                      </div>
                    </Field>
                    <Field label={t("gift.labels.uaeRing")}>
                      <p className="font-mono text-sm">
                        {(gift as any).uae_ring_number || "-"}
                      </p>
                    </Field>
                  </div>
                  {gift.description && (
                    <div className="pb-3 border-b border-border">
                      <Field label={t("gifts.description")}>
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {gift.description}
                        </p>
                      </Field>
                    </div>
                  )}
                  {giftAttributes.length > 0 ? (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-3">
                        {t("gifts.attributes")}
                      </p>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <Table
                          className="w-full"
                          style={{ tableLayout: "fixed" }}
                        >
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead className="w-[45%] font-semibold text-foreground border-b border-border">
                                {t("gift.labels.attributeName")}
                              </TableHead>
                              <TableHead className="w-[55%] font-semibold text-foreground border-b border-border">
                                {t("gift.labels.value")}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {giftAttributes.map((attr: any, index: number) => (
                              <TableRow
                                key={index}
                                className="border-b border-border hover:bg-muted/20"
                              >
                                <TableCell className="font-medium text-foreground py-3 align-top">
                                  <div className="break-words pr-2">
                                    {attr.attribute_name}
                                    {attr.is_mandatory === 1 ||
                                    attr.is_mandatory === true ? (
                                      <span className="text-destructive ml-1">
                                        *
                                      </span>
                                    ) : null}
                                  </div>
                                </TableCell>
                                <TableCell className="text-foreground py-3 align-top">
                                  <div className="break-words">
                                    {attr.default_value || "-"}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      {t("gifts.noAttributesAdded")}
                    </p>
                  )}
                  {hasImages && carouselImages.length > 0 && (
                    <PhotoCarousel
                      images={carouselImages}
                      giftName={gift.gift_name}
                      giftDescription={gift.description}
                    />
                  )}
                </div>
              </AccordionSection>

              {/* Gift Interests */}
              <GiftInterestsSidebar
                displayInterests={displayInterests}
                issues={giftIssues}
                timelineEntries={timelineEntries}
                isIssued={isActionsLocked}
                canApprove={canApprove}
                canCoordinatorManage={isEventCoordinator || isEventManager}
                formatDateTime={formatDateTime}
                onIssue={(interestName) => {
                  const interest = (giftInterests || []).find(
                    (i: any) => i.name === interestName,
                  );
                  const guestName =
                    (interest as any)?.guest_name ||
                    (interest as any)?.gift_recipient ||
                    interestName;
                  setShowConfirmIssue({ interestName, guestName });
                }}
                onAllocateInterestDirect={(interestName) =>
                  allocateInterestDirectMutation.mutate(interestName)
                }
                onViewIssue={(issueName) => openIssueDetails(issueName)}
                onApproveIssue={(issueName) =>
                  approveIssueMutation.mutate(issueName)
                }
                onRejectIssue={(issueName, label) => {
                  setRejectTarget({ type: "issue", name: issueName, label });
                  setShowRejectionModal(true);
                }}
                onSendIssueForApprovalAgain={(issueName) =>
                  sendIssueForApprovalAgainMutation.mutate(issueName)
                }
                onUnissueIssue={(issueName, issueLabel) => {
                  setUnissueTarget({ issueName, issueLabel });
                  setShowUnissueModal(true);
                }}
                onRemoveInterest={(interestName, label) => {
                  setRemoveInterestTarget({ interestName, label });
                  setShowRemoveInterestModal(true);
                }}
                onRemoveAllocationRequest={(issueName, label) => {
                  setRemoveRequestTarget({ issueName, label });
                  setShowRemoveRequestModal(true);
                }}
              />

              {/* Gift Dispatch Details */}
              {canShowDispatchSection && (
                <div id="gift-dispatch-details">
                  <AccordionSection
                    icon={<Truck />}
                    title={t("gifts.dispatchDetails")}
                  >
                    {latestIssue ? (
                      <div className="px-5 py-4 space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <Field label={t("dispatch.deliveryDateTime")}>
                            {formatDateTime(
                              latestIssue.dispatch_date || latestIssue.creation,
                            )}
                          </Field>
                          <div className="sm:col-span-2 rounded-lg border border-border bg-muted/20 px-3 py-3">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              {t("dispatch.receivedDelivered")}
                            </p>
                            <div className="grid sm:grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  {t("dispatch.receivedBy")}
                                </p>
                                <p className="text-sm font-medium text-foreground">
                                  {latestIssue.received_by_name || "-"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {latestIssue.receiver_contact || "-"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  {t("dispatch.deliveredBy")}
                                </p>
                                <p className="text-sm font-medium text-foreground">
                                  {latestIssue.delivery_person_name || "-"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {latestIssue.delivery_person_contact || "-"}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-4">
                          <Field label={t("dispatch.receiverIdentity")}>
                            {latestIssue.receiver_id || "-"}
                          </Field>
                          {latestIssue.delivery_person_id && (
                            <Field label={t("dispatch.handoverPersonEmiratesId") || "Handover Person Emirates ID"}>
                              {latestIssue.delivery_person_id}
                            </Field>
                          )}
                        </div>
                        </div>

                        {latestIssue.delivery_remarks && (
                          <Field label={t("dispatch.deliveryRemarks")}>
                            <p className="whitespace-pre-wrap text-sm">
                              {latestIssue.delivery_remarks}
                            </p>
                          </Field>
                        )}

                        <div className="space-y-2 border-t border-border pt-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {t("dispatch.dispatchAttachments")}
                          </p>
                          {(latestIssue.documents || []).filter(
                            (doc) =>
                              doc.document_attachment ||
                              doc.document_type ||
                              doc.description,
                          ).length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {(latestIssue.documents || [])
                                .filter(
                                  (doc) =>
                                    doc.document_attachment ||
                                    doc.document_type ||
                                    doc.description,
                                )
                                .map((doc, idx) => {
                                  const isImage =
                                    doc.document_attachment?.match(
                                      /\.(jpg|jpeg|png|gif|webp|svg)$/i,
                                    );
                                  const docUrl = getImageUrl(
                                    doc.document_attachment,
                                  );
                                  const docTypeLabel =
                                    doc.document_type ||
                                    `${t("common.document")} ${idx + 1}`;

                                  return (
                                    <div
                                      key={
                                        doc.name ||
                                        `${doc.document_attachment}-${idx}`
                                      }
                                      className="space-y-1.5"
                                    >
                                      <div className="group relative aspect-square rounded-lg border border-border overflow-hidden bg-muted/30">
                                        {isImage ? (
                                          <a
                                            href={docUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block w-full h-full"
                                          >
                                            <img
                                              src={docUrl}
                                              alt={docTypeLabel}
                                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                          </a>
                                        ) : (
                                          <div className="flex flex-col items-center justify-center h-full p-4">
                                            <FileText className="h-10 w-10 text-muted-foreground mb-2" />
                                            <p className="text-xs font-medium text-foreground text-center line-clamp-2 mb-2">
                                              {docTypeLabel}
                                            </p>
                                            {doc.document_attachment && (
                                              <a
                                                href={docUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md transition-colors"
                                              >
                                                {t("common.view")}
                                              </a>
                                            )}
                                          </div>
                                        )}

                                        {doc.description && (
                                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {doc.description}
                                          </div>
                                        )}
                                      </div>

                                      <p className="text-xs font-medium text-foreground line-clamp-2">
                                        {docTypeLabel}
                                      </p>

                                      {doc.description && (
                                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                                          {doc.description}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              {t("dispatch.noDocumentsAttached")}
                            </p>
                          )}
                        </div>

                        {isIssued && latestIssue.name && (
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDispatchIssue(latestIssue);
                                setDispatchDetailsOpen(true);
                              }}
                            >
                              {hasDispatchDetails
                                ? t("gifts.editDispatchDetails")
                                : t("gifts.addDispatchDetails")}
                            </Button>
                          </div>
                        )}

                        {/* Edit Dispatch Button for Delivered Gifts */}
                        {canShowDispatchSection &&
                          hasDispatchDetails &&
                          latestIssue?.name && (
                            <div className="flex justify-end mt-3">
                              {(isAdmin || isEventManager) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setDispatchIssue(latestIssue);
                                    setDispatchDetailsOpen(true);
                                  }}
                                  className="gap-2"
                                >
                                  <Edit className="h-4 w-4" />
                                  {t("gifts.editDispatchDetails")}
                                </Button>
                              )}
                            </div>
                          )}
                      </div>
                    ) : (
                      <div className="px-5 py-4">
                        <p className="text-sm text-muted-foreground">
                          {t("gifts.noDispatchDetailsFound")}
                        </p>
                      </div>
                    )}
                  </AccordionSection>
                </div>
              )}

              <div className="mt-5">
                <SystemInfo gift={gift} formatDate={formatDate} />
              </div>
            </div>

            {/* ── RIGHT SIDEBAR */}
            <div className="space-y-4">
              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-border p-4">
                <p className="text-sm font-semibold text-foreground mb-3">
                  {t("common.quickActions")}
                </p>
                <div className="space-y-2">
                  {hasBarcode && (
                    <button
                      type="button"
                      onClick={handlePrintBarcode}
                      className="w-full flex lg:justify-start justify-center items-center gap-2.5 px-4 py-3 rounded-lg border border-border text-sm font-semibold transition-colors border-amber-500 text-amber-600 hover:bg-amber-50"
                    >
                      <Printer className="h-4 w-4" /> {t("gifts.printBarcode")}
                    </button>
                  )}
                  {!isActionsLocked && (
                    <button
                      onClick={() => {
                        if (!gift.event) {
                          setShowAssignEventDialog(true);
                          return;
                        }
                        setShowInterestModal(true);
                      }}
                      className="w-full lg:justify-start justify-center  border-blue-600 text-blue-600 hover:bg-blue-50 flex items-center gap-2.5 px-4 py-3 rounded-lg border border-border text-sm font-medium transition-colors"
                    >
                      <Heart className="h-4 w-4 text-blue-600" />{" "}
                      {t("gifts.recordInterest")}
                    </button>
                  )}

                  {isIssued && !hasDispatchDetails && primaryIssue?.name && (
                    <button
                      type="button"
                      onClick={() => {
                        setDispatchIssue(primaryIssue);
                        setDispatchDetailsOpen(true);
                      }}
                      className="w-full flex lg:justify-start justify-center items-center gap-2.5 px-4 py-3 rounded-lg border border-border text-sm font-semibold transition-colors border-green-600 text-green-600 hover:bg-green-50"
                    >
                      <Truck className="h-4 w-4 text-green-600" />{" "}
                      {t("gifts.addDispatchDetails")}
                    </button>
                  )}
                </div>
              </div>

              {/* Assigned Event */}
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">
                    {t("common.assignedEvent")}
                  </p>
                </div>
                <div className="px-3 pb-4 pt-3">
                  <div className="text-center">
                    {gift.event ? (
                      <Link
                        to={`/events/${encodeURIComponent(gift.event)}`}
                        className="text-sm font-semibold text-primary hover:underline break-words flex gap-1 justify-center items-center"
                      >
                        <span className="text-left text-sm break-words">
                          {gift.event_name || gift.event}
                        </span>
                        <ExternalLink className="h-4 w-4 flex-shrink-0" />
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold text-foreground break-words">
                        -
                      </p>
                    )}

                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Allocated to</p>
                </div>
                <div className="px-3 pb-4 pt-3">
                  <div className="text-center">
                    {allocatedToRecipientId ? (
                      <button
                        type="button"
                        className="text-sm font-semibold text-primary hover:underline"
                        onClick={() => {
                          setAllocatedRecipientId(allocatedToRecipientId);
                          setAllocatedRecipientDialogOpen(true);
                        }}
                      >
                        {allocatedToRecipientLabel || allocatedToRecipientId}
                      </button>
                    ) : (
                      <p className="text-sm font-semibold text-foreground break-words">-</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Gift History */}
              <div className="bg-white rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">
                    {t("gifts.giftHistory")}
                  </p>
                </div>
                <div className="max-h-80 overflow-y-auto pr-1">
                  {giftHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("gifts.noGiftHistoryFound")}
                    </p>
                  ) : (
                    giftHistory.map((event, index) => {
                      const style = giftHistoryStyle[event.type];
                      const Icon = style.icon;
                      const isLast = index === giftHistory.length - 1;

                      return (
                        <div
                          key={`${event.type}-${event.date}-${index}`}
                          className="relative pl-8 pb-6"
                        >
                          {/* Vertical Line */}
                          {!isLast && (
                            <span className="absolute left-3 top-6 h-full w-px bg-border" />
                          )}

                          {/* Icon Circle */}
                          <div
                            className={`absolute left-0 top-1 w-6 h-6 rounded-full ${style.color} flex items-center justify-center shadow-sm`}
                          >
                            <Icon className="h-3 w-3 text-white" />
                          </div>

                          {/* Content */}
                          <div className="bg-muted/30 rounded-md px-3 py-2 border border-border/70">
                            <p className="text-xs text-foreground leading-relaxed break-words">
                              {event.text}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {formatDateTime(event.date)}
                            </p>

                            {/* {event.link && (
                              <button
                                type="button"
                                onClick={() =>
                                  openIssueDetails(String(event.link))
                                }
                                className="text-[11px] text-primary hover:underline flex items-center gap-1 mt-1"
                              >
                                {t("gifts.viewDetails")}
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            )} */}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals */}
      <RecordInterestModal
        open={showInterestModal}
        onClose={() => setShowInterestModal(false)}
        giftName={gift.name}
        eventName={bundle?.event}
        onRecordInterest={(recipientNames) =>
          recordInterestMutation.mutate(recipientNames)
        }
        isRecording={recordInterestMutation.isPending}
      />
      <Dialog open={showAssignEventDialog} onOpenChange={setShowAssignEventDialog}>
      <DialogContent className="[&>button]:hidden">
        <DialogHeader>
          <DialogTitle>{t("gifts.assignEventBeforeInterestTitle")}</DialogTitle>
          <DialogDescription>{t("gifts.assignEventBeforeInterest")}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
      <ConfirmIssueModal
        open={!!showConfirmIssue}
        onClose={() => setShowConfirmIssue(null)}
        guestName={showConfirmIssue?.guestName || ""}
        onConfirm={() => {
          if (!showConfirmIssue?.interestName) return;
          createIssueFromInterestMutation.mutate(showConfirmIssue.interestName);
        }}
      />
      <RejectionModal
        open={showRejectionModal}
        onClose={() => setShowRejectionModal(false)}
        requesterName={rejectTarget?.label || t("gifts.requester")}
        isRejecting={rejectPendingMutation.isPending}
        onConfirm={(reason) => {
          if (!rejectTarget) return;
          rejectPendingMutation.mutate({
            type: rejectTarget.type,
            name: rejectTarget.name,
            reason,
          });
        }}
      />

      {/* Unissue Modal */}
      <AlertDialog open={showUnissueModal} onOpenChange={setShowUnissueModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("gifts.removeAllocation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("gifts.removeAllocationConfirmation").replace(
                "{name}",
                unissueTarget?.issueLabel || ""
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowUnissueModal(false);
              setUnissueTarget(null);
            }}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!unissueTarget) return;
                unissueGiftMutation.mutate({
                  issueName: unissueTarget.issueName,
                  reason: t("gifts.allocationRemoved")
                });
                setShowUnissueModal(false);
                setUnissueTarget(null);
              }}
              disabled={unissueGiftMutation.isPending}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {unissueGiftMutation.isPending
                ? t("common.loading")
                : t("gifts.removeAllocation")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRemoveInterestModal} onOpenChange={setShowRemoveInterestModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("gifts.removeInterest")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("gifts.removeInterestConfirmation").replace(
                "{name}",
                removeInterestTarget?.label || "",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowRemoveInterestModal(false);
                setRemoveInterestTarget(null);
              }}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!removeInterestTarget) return;
                removeInterestMutation.mutate(removeInterestTarget.interestName);
                setShowRemoveInterestModal(false);
                setRemoveInterestTarget(null);
              }}
              disabled={removeInterestMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {removeInterestMutation.isPending
                ? t("common.loading")
                : t("gifts.removeInterest")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRemoveRequestModal} onOpenChange={setShowRemoveRequestModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("gifts.removeAllocationRequest")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("gifts.removeAllocationRequestConfirmation").replace(
                "{name}",
                removeRequestTarget?.label || "",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowRemoveRequestModal(false);
                setRemoveRequestTarget(null);
              }}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!removeRequestTarget) return;
                removeAllocationRequestMutation.mutate(removeRequestTarget.issueName);
                setShowRemoveRequestModal(false);
                setRemoveRequestTarget(null);
              }}
              disabled={removeAllocationRequestMutation.isPending}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {removeAllocationRequestMutation.isPending
                ? t("common.loading")
                : t("gifts.removeAllocationRequest")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedIssue?.approval_status == "Approved" && (
        <IssueDetailsDialog
          open={issueDetailsOpen}
          onClose={() => setIssueDetailsOpen(false)}
          issue={selectedIssue}
          formatDateTime={formatDateTime}
        />
      )}

      <IssueDispatchDetailsSheet
        open={dispatchDetailsOpen}
        onClose={() => setDispatchDetailsOpen(false)}
        issue={dispatchIssue}
        isSaving={updateIssueDispatchMutation.isPending}
        onSave={(data) => {
          if (!dispatchIssue?.name) return;
          const normalized: Partial<GiftIssue> = {
            ...data,
            ...(data.dispatch_date
              ? { dispatch_status: "Delivered", status: "Delivered" }
              : {}),
          };
          updateIssueDispatchMutation.mutate({
            issueName: dispatchIssue.name,
            data: normalized,
          });
        }}
      />
      <EditGiftPanel open={showEditPanel} onOpenChange={setShowEditPanel} />

      <GuestDetailDialog
        open={allocatedRecipientDialogOpen}
        onOpenChange={(open) => {
          setAllocatedRecipientDialogOpen(open);
          if (!open) setAllocatedRecipientId(null);
        }}
        recipient={allocatedRecipient}
        title={t("recipients.guestDetails")}
        onEdit={(recipientName) => navigate(`/recipients/edit/${recipientName}`)}
      />

      {/* ── Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("gifts.deleteGift")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("gifts.deleteGiftConfirmation").replace(
                "{name}",
                gift.gift_name,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMutation.mutate();
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-white"
            >
              {deleteMutation.isPending
                ? t("common.loading")
                : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
