import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground ",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-lg",
        outline: "border-2 border-primary text-primary hover:shadow-md bg-transparent",
        secondary: "bg-secondary text-secondary-foreground ",
        ghost: "hover:bg-muted hover:shadow-sm",
        link: "text-primary underline-offset-4 hover:underline",
        underlined: "text-primary underline hover:text-primary/80 decoration-2 hover:decoration-primary",
        success: "border-2 border-green-500 text-green-600 bg-transparent hover:bg-green-50 hover:text-green-700 hover:border-green-600",
        warning: "border-2 border-yellow-500 text-yellow-600 bg-transparent hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-600",
        error: "border-2 border-red-500 text-red-600 bg-transparent hover:bg-red-50 hover:text-red-700 hover:border-red-600",
        info: "border-2 border-blue-500 text-blue-600 bg-transparent hover:bg-blue-50 hover:text-blue-700 hover:border-blue-600",
        "success-outline": "border-2 border-green-500 text-green-600 bg-transparent hover:bg-green-50 hover:text-green-700 hover:border-green-600",
        "warning-outline": "border-2 border-yellow-500 text-yellow-600 bg-transparent hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-600",
        "error-outline": "border-2 border-red-500 text-red-600 bg-transparent hover:bg-red-50 hover:text-red-700 hover:border-red-600",
        "info-outline": "border-2 border-blue-500 text-blue-600 bg-transparent hover:bg-blue-50 hover:text-blue-700 hover:border-blue-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
