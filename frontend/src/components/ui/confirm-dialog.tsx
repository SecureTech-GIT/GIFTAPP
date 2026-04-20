import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmVariant = "default" | "destructive" | "success";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;

  title: string;
  subtitle?: string;

  confirmText?: string;
  cancelText?: string;

  variant?: ConfirmVariant;
  icon?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  subtitle,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  icon,
}: ConfirmDialogProps) {
  const confirmStyles = {
    default: "bg-primary text-white hover:bg-primary/90",
    destructive: "bg-destructive text-white hover:bg-destructive/90",
    success: "bg-green-600 text-white hover:bg-green-700",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-6 pb-5 space-y-3">
          {icon && (
            <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
              {icon}
            </div>
          )}

          <div>
            <h3 className="text-base font-semibold text-foreground">
              {title}
            </h3>

            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            {cancelText}
          </Button>

          <Button
            className={cn(confirmStyles[variant])}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}