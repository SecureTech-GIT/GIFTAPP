import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      expand={true}
      visibleToasts={5}
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // Success toast
          success: "group-[.toaster]:!bg-green-50 group-[.toaster]:!border-green-200 group-[.toaster]:!text-green-900 dark:group-[.toaster]:!bg-green-950 dark:group-[.toaster]:!border-green-800 dark:group-[.toaster]:!text-green-100",
          // Error toast
          error: "group-[.toaster]:!bg-red-50 group-[.toaster]:!border-red-200 group-[.toaster]:!text-red-900 dark:group-[.toaster]:!bg-red-950 dark:group-[.toaster]:!border-red-800 dark:group-[.toaster]:!text-red-100",
          // Warning toast
          warning: "group-[.toaster]:!bg-yellow-50 group-[.toaster]:!border-yellow-200 group-[.toaster]:!text-yellow-900 dark:group-[.toaster]:!bg-yellow-950 dark:group-[.toaster]:!border-yellow-800 dark:group-[.toaster]:!text-yellow-100",
          // Info toast
          info: "group-[.toaster]:!bg-blue-50 group-[.toaster]:!border-blue-200 group-[.toaster]:!text-blue-900 dark:group-[.toaster]:!bg-blue-950 dark:group-[.toaster]:!border-blue-800 dark:group-[.toaster]:!text-blue-100",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };