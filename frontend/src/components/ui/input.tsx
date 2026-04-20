import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        `
        flex h-10 w-full
        rounded-md
        border border-gray-300
        bg-background
        px-4 py-2
        text-sm
        placeholder:text-muted-foreground
        focus:outline-none focus:border-primary focus:shadow-[0_0_0_1px_theme(colors.primary)] disabled:cursor-not-allowed disabled:opacity-50 
        `,
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";

export { Input };
