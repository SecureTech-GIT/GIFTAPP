import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

// Animation classes that are direction-independent
const slideAnimations = {
  top: "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
  bottom: "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
  // Use transform with direction-independent values
  left: "data-[state=closed]:translate-x-[-100%] data-[state=open]:translate-x-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
  right: "data-[state=closed]:translate-x-[100%] data-[state=open]:translate-x-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
};

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: cn("inset-x-0 top-0 border-b", slideAnimations.top),
        bottom: cn("inset-x-0 bottom-0 border-t", slideAnimations.bottom),
        left: cn("inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm", slideAnimations.left),
        right: cn("inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm", slideAnimations.right),
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Force animation direction regardless of RTL/LTR */
  animationDirection?: "left" | "right" | "top" | "bottom";
}

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ side = "right", className, children, animationDirection, ...props }, ref) => {
    // Get the document direction
    const dir = typeof document !== 'undefined' ? document.documentElement.dir : 'ltr';
    
    // Determine which side to use for positioning (affected by RTL)
    const positionSide = React.useMemo(() => {
      if (dir === 'rtl') {
        if (side === 'left') return 'right';
        if (side === 'right') return 'left';
      }
      return side;
    }, [side, dir]);

    // Determine which side to use for animation (NOT affected by RTL)
    const animationSide = animationDirection || side;

    // Create custom animation class based on animationSide
    const animationClass = React.useMemo(() => {
      switch (animationSide) {
        case 'top':
          return "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top";
        case 'bottom':
          return "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom";
        case 'left':
          return "data-[state=closed]:translate-x-[-100%] data-[state=open]:translate-x-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left";
        case 'right':
          return "data-[state=closed]:translate-x-[100%] data-[state=open]:translate-x-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right";
        default:
          return "";
      }
    }, [animationSide]);

    // Base positioning classes based on positionSide
    const positionClass = React.useMemo(() => {
      switch (positionSide) {
        case 'top':
          return "inset-x-0 top-0 border-b";
        case 'bottom':
          return "inset-x-0 bottom-0 border-t";
        case 'left':
          return "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm";
        case 'right':
          return "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm";
        default:
          return "";
      }
    }, [positionSide]);

    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content 
          ref={ref} 
          className={cn(
            "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
            positionClass,
            animationClass,
            className
          )} 
          {...props}
        >
          {children}
          <SheetPrimitive.Close 
            className={cn(
              "absolute top-2  rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-secondary hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none",
              dir === 'rtl' ? "left-4" : "right-4"
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};