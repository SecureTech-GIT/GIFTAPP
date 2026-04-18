import { useState } from "react";
import {
  Menu,
  User,
  LogOut,
  ScanBarcode,
  ArrowLeft,
  Bell,
  CheckCheck,
  Trash2,
  Globe,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { parseFrappeDate } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AuthAPI, GiftSearchAPI, NotificationAPI } from "@/services/api";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

// Enhanced function to extract gift name from notification subject
const getGiftNameFromSubject = (subject: string): string => {
  if (!subject) return "";

  // Extract gift name from patterns like "Approval requested for gift: Gift Name"
  const approvalRequestedMatch = subject.match(/:(.+)$/);
  if (approvalRequestedMatch) {
    return approvalRequestedMatch[1].trim();
  }

  // Extract gift name from patterns like "Gift delivered: Gift Name"
  const deliveredMatch = subject.match(/:(.+)$/);
  if (deliveredMatch) {
    return deliveredMatch[1].trim();
  }

  // Extract gift name from patterns like "Allocation accepted: Gift GiftName allocated to GuestName"
  const acceptedMatch = subject.match(/Gift (.+?) allocated to/);
  if (acceptedMatch) {
    return acceptedMatch[1].trim();
  }

  // Extract gift name from patterns like "Allocation rejected: Gift GiftName request for GuestName"
  const rejectedMatch = subject.match(/Gift (.+?) request for/);
  if (rejectedMatch) {
    return rejectedMatch[1].trim();
  }

  return "";
};

// Enhanced function to get better link for notifications
const getNotificationLink = async (
  notification: any,
): Promise<string | null> => {
  // For Gift notifications, use the document_name to navigate to the gift
  if (notification.document_type === "Gift" && notification.document_name) {
    return `/gifts/${notification.document_name}`;
  }

  // For Gift Issue notifications, fetch the gift issue to get the gift ID
  if (
    notification.document_type === "Gift Issue" &&
    notification.document_name
  ) {
    try {
      // Import API dynamically to avoid circular dependencies
      const { GiftIssueAPI } = await import("@/services/api");
      const result = await GiftIssueAPI.get(notification.document_name);
      if (result.success && result.data?.gift) {
        return `/gifts/${result.data.gift}`;
      }
    } catch (error) {
      console.error("Failed to fetch gift issue details:", error);
    }
    // Fallback to gifts list if we can't get the gift ID
    return "/gifts";
  }

  return null;
};

interface TopBarProps {
  title: string;
  onMenuClick: () => void;
}

export function TopBar({ title, onMenuClick }: TopBarProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showScanner, setShowScanner] = useState(false);

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "ar" : "en";
    i18n.changeLanguage(newLang);
  };

  const safeRelativeTime = (v?: string) => {
    if (!v) return "";
    try {
      const dt = parseFrappeDate(v);
      if (Number.isNaN(dt.getTime())) return v;
      return formatDistanceToNow(dt, { addSuffix: true });
    } catch {
      return v;
    }
  };

  // ✅ Detect main module routes
  const isMainRoute =
    location.pathname === "/" || location.pathname.split("/").length <= 2;

  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const res = await AuthAPI.getLoggedUser();
      if (res.success) return res.data;
      return undefined;
    },
    retry: false,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await NotificationAPI.list();
      if (!res.success) return [];
      return res.data || [];
    },
    retry: false,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const recentNotifications = notifications.slice(0, 6);

  const markReadMutation = useMutation({
    mutationFn: (name: string) => NotificationAPI.markRead(name),
    onSuccess: () => {
      console.log("Notification marked as read successfully");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      console.error("Failed to mark notification as read:", error);
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => NotificationAPI.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const result = await NotificationAPI.clearAll();
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      const count = result.data?.deleted_count || 0;
      toast.success(`Cleared ${count} notifications`);
    },
    onError: (error) => {
      console.error("Clear all error:", error);
      toast.error("Failed to clear notifications");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => AuthAPI.logout(),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t("auth.logoutSuccess"));
        navigate("/login", { replace: true });
      } else {
        toast.error(res.error || t("auth.logoutFailed"));
      }
    },
    onError: () => toast.error(t("auth.logoutFailed")),
  });

  const fullName = localStorage.getItem("frappe_fullname") || user || "User";

  const initials = fullName
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const handleBarcodeScanned = async (barcode: string) => {
    setShowScanner(false);
    // toast.info(t('common.searchingForBarcode', { barcode }))

    const result = await GiftSearchAPI.findByBarcode(barcode);

    if (result.success && result.data) {
      // toast.success(t('giftFound', { name: result.data.gift_name }))
      navigate(`/gifts/${result.data.name}`);
    } else {
      toast.error(t("common.giftNotFound"));
    }
  };

  return (
    <>
      <header className="h-14 lg:h-16  bg-white flex items-center text-sidebar-foreground justify-between sticky top-0 px-4 lg:px-6 z-30">
        <div className="flex items-center gap-2 lg:gap-3 min-w-0">
          {/* Mobile Menu */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="shrink-0 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Back Button (Only on sub pages) */}
          {!isMainRoute && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}

          {/* Title */}
          <h1 className="text-lg lg:text-xl font-medium truncate">{title}</h1>
        </div>

        <div className="flex items-center  gap-1 lg:gap-3">
          {/* Barcode Scanner */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowScanner(true)}
            aria-label={t("common.scanBarcode")}
          >
            <ScanBarcode className="h-5 w-5" />
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("nav.notifications")}
                className="relative"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-[10px] leading-none"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>{t("nav.notifications")}</span>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <span className="text-xs text-muted-foreground mr-2">
                      {unreadCount} {t("notifications.unread")}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={
                      markAllReadMutation.isPending || unreadCount === 0
                    }
                    title={t("notifications.markAllRead")}
                  >
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => clearAllMutation.mutate()}
                    disabled={
                      clearAllMutation.isPending || notifications.length === 0
                    }
                    title={t("notifications.clearAll")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {recentNotifications.length === 0 ? (
                <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                  {t("notifications.noNotifications")}
                </div>
              ) : (
                <>
                  <div className="max-h-80 overflow-auto">
                    {recentNotifications.map((n) => (
                      <DropdownMenuItem
                        key={n.name}
                        className="items-start gap-2 p-3"
                        onClick={async () => {
                          // Debug logging
                          console.log("Popup notification clicked:", {
                            subject: n.subject,
                            document_type: n.document_type,
                            document_name: n.document_name,
                            read: n.read,
                            name: n.name,
                          });

                          // Mark as read if not already read
                          if (!n.read) {
                            console.log(
                              "Marking notification as read:",
                              n.name,
                            );
                            try {
                              const result = await NotificationAPI.markRead(
                                n.name,
                              );
                              if (result.success) {
                                console.log(
                                  "Notification marked as read successfully",
                                );
                                queryClient.invalidateQueries({
                                  queryKey: ["notifications"],
                                });
                              } else {
                                console.error(
                                  "Failed to mark notification as read:",
                                  result.error,
                                );
                              }
                            } catch (error) {
                              console.error(
                                "Failed to mark notification as read:",
                                error,
                              );
                            }
                          }

                          const link = await getNotificationLink(n);
                          if (link) {
                            console.log("Navigating to:", link);
                            navigate(link);
                          } else {
                            console.log("No link found for notification");
                          }
                        }}
                      >
                        <div
                          className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0"
                          style={{ opacity: n.read ? 0 : 1 }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium line-clamp-2">
                            {n.subject}
                          </div>

                          {n.document_type && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {n.document_type}
                            </div>
                          )}
                          {n.creation && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {safeRelativeTime(n.creation)}
                            </div>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}

              {/* Only show "View all" at the bottom */}
              <div className="p-2">
                <DropdownMenuItem
                  onClick={() => navigate("/notifications")}
                  className="cursor-pointer"
                >
                  {t("notifications.viewAll")}
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Language Switcher (tap/click friendly for iOS) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.switchLanguage")}
                title={
                  i18n.language === "en"
                    ? "التبديل إلى العربية"
                    : "Switch to English"
                }
                className="relative"
              >
                <Globe className="h-5 w-5" />
                {/* <span className="absolute -bottom-1 -right-1 text-[10px] font-bold bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                  {i18n.language === "en" ? "ع" : "En"}
                </span> */}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => i18n.changeLanguage("en")}
                className={i18n.language === "en" ? "bg-primary/10 font-medium" : undefined}
              >
                <span className="flex-1">{t("profile.english")}</span>
                {i18n.language === "en" && <span className="text-primary">✔</span>}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => i18n.changeLanguage("ar")}
                className={i18n.language === "ar" ? "bg-primary/10 font-medium" : undefined}
              >
                <span className="flex-1">{t("profile.arabic")}</span>
                {i18n.language === "ar" && <span className="text-primary">✔</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {initials || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden lg:inline text-sm font-medium">
                  {fullName || t("common.user")}
                </span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{t("common.myAccount")}</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link to="/profile" className="w-full cursor-pointer">
                  <User className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("nav.profile")}
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="text-destructive cursor-pointer"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {logoutMutation.isPending
                  ? t("auth.loggingOut")
                  : t("auth.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}
