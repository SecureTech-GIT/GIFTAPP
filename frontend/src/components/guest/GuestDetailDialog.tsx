/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Edit } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { useRole } from "@/contexts/RoleContext";

type GuestDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: any | null;
  title?: string;
  onEdit?: (recipientName: string) => void;
};

export function GuestDetailDialog({
  open,
  onOpenChange,
  recipient,
  title,
  onEdit,
}: GuestDetailDialogProps) {
  const { t } = useTranslation();
  const { isAdmin, isEventManager, isEventCoordinator } = useRole();
  const recipientName = String(recipient?.name || "");
  
  const canEdit = !isEventCoordinator || isAdmin || isEventManager;

  // Use provided title or fall back to translation
  const dialogTitle = title || t('recipientDetails.title');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-3xl  max-w-[90vw] rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {recipient ? (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-semibold">
                  {recipient.owner_full_name ||
                    recipient.full_name ||
                    [recipient.guest_first_name, recipient.guest_last_name]
                      .filter(Boolean)
                      .join(" ") ||
                    recipient.name}
                </h3>
                {recipient.coordinator_full_name && (
                  <p className="text-muted-foreground mt-1">
                    {t('recipientDetails.coordinator')}: {recipient.coordinator_full_name}
                  </p>
                )}
              </div>
            </div>

            {(recipient.coordinator_full_name ||
              recipient.coordinator_email ||
              recipient.coordinator_mobile_no ||
              recipient.coordinator_emirates_id) && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-4 text-lg">
                    {t('recipientDetails.coordinatorInfo')}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recipient.coordinator_full_name && (
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-muted-foreground text-xs">
                          {t('recipientDetails.fields.fullName')}
                        </Label>
                        <p className="font-medium">{recipient.coordinator_full_name}</p>
                      </div>
                    )}
                    {recipient.coordinator_email && (
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">
                          {t('recipientDetails.fields.email')}
                        </Label>
                        <p className="text-sm">{recipient.coordinator_email}</p>
                      </div>
                    )}
                    {recipient.coordinator_mobile_no && (
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">
                          {t('recipientDetails.fields.mobileNumber')}
                        </Label>
                        <p className="text-sm font-mono">{recipient.coordinator_mobile_no}</p>
                      </div>
                    )}
                    {recipient.coordinator_emirates_id && (
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">
                          {t('recipientDetails.fields.emiratesId')}
                        </Label>
                        <p className="font-mono text-sm">{recipient.coordinator_emirates_id}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="py-8 text-sm text-muted-foreground">
            {t('recipientDetails.noDetailsFound')}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('recipientDetails.buttons.close')}
          </Button>
          {canEdit && onEdit && (
          <Button
            onClick={() => {
              if (!recipientName) return;
              onEdit?.(recipientName);
            }}
            disabled={!recipientName}
          >
            <Edit className="h-4 w-4 mr-2" />
            {t('recipientDetails.buttons.edit')}
          </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}