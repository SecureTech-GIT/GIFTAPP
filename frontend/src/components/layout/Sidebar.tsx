// src/components/layout/Sidebar.tsx

import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Gift,
  FolderOpen,
  Truck,
  FileBarChart,
  ChevronLeft,
  ChevronRight,
  Settings,
  CalendarDays,
  UserRound,
  Copy,
  PanelLeft,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRole } from "@/contexts/RoleContext";


interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?:
    | "canAccessCategories"
    | "canAccessReports"
    | "canAccessMaintenance"
    | "canApproveInterest";
}

interface NavGroup {
  title: string;
  items: NavItem[];
}



export function Sidebar({ open, onToggle }: SidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { hasPermission, isLoading } = useRole();
  const assetBase = import.meta.env.BASE_URL
const navGroups: NavGroup[] = [
  {
    title: "nav.overview",
    items: [{ title: "nav.dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    title: "nav.eventManagement",
    items: [{ title: "nav.events", href: "/events", icon: CalendarDays }],
  },
  {
    title: "nav.giftManagement",
    items: [
      { title: "nav.gifts", href: "/gifts", icon: Gift },
      {
        title: "nav.categories",
        href: "/categories",
        icon: FolderOpen,
        permission: "canAccessCategories",
      },
    ],
  },
   {
    title: t('approvals.approvals'),
    items: [{ title: t('approvals.approvals'), href: "/approval-requests", icon: CheckCircle2, permission: "canApproveInterest" }],
  },
  {
    title: "nav.guestManagement",
    items: [{ title: "nav.recipients", href: "/recipients", icon: UserRound }],
  },
  // {
  //   title: "nav.outboundGifts",
  //   items: [{ title: "nav.dispatch", href: "/dispatch", icon: Truck }],
  // },
  {
    title: "nav.analytics",
    items: [
      {
        title: "nav.reports",
        href: "/reports",
        icon: FileBarChart,
        permission: "canAccessReports",
      },
    ],
  },
];
  // Filter nav groups based on permissions
  const filteredNavGroups = navGroups
    ?.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.permission) return true;
        return hasPermission(item.permission);
      }),
    }))
    ?.filter((group) => group.items.length > 0);

  return (
    <aside
      className={cn(
        "fixed top-0 h-screen flex flex-col",
        "bg-sidebar text-sidebar-foreground",
        "border-r ",
        "shadow-lg transition-all duration-300 z-40",
        "ltr:left-0 rtl:right-0",
        open ? "w-44" : "w-16",
      )}
    >
      {/* Header */}
      <div className="flex flex-col items-center relative ">
        {/* Collapse Button */}

        {/* Logo */}
        <div className={cn("transition-all  duration-300 mt-3 ")}>
          <img
            onClick={onToggle}
            src={`${assetBase}imagelogo1.png`}
            alt="PSN Logo"
            className={cn(
              "object-contain transition-all cursor-pointer duration-300",
              open ? "h-16 w-16" : "h-11 w-11",
            )}
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        {isLoading ? (
          <nav className="space-y-3 px-2 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center  gap-3 px-3 py-2 animate-pulse",
                )}
              >
                {/* Icon skeleton */}
                <div className="h-5 w-5 rounded bg-gray-400" />

                {/* Text skeleton (only when open) */}
                {open && <div className="h-4 flex-1 rounded bg-muted" />}
              </div>
            ))}
          </nav>
        ) : (
          <nav className="space-y-2 px-2">
            {filteredNavGroups.map((group) => (
              <div key={group.title}>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const isActive =
                      location.pathname === item.href ||
                      (item.href !== "/" &&
                        location.pathname.startsWith(item.href));

                    return (
                      <li key={item.href}>
                        <NavLink
                          to={item.href}
                          className={cn(
                            "sidebar-item flex items-center gap-3 px-3 py-2 text-sm  font-medium transition-all duration-200",
                            isActive
                              ? "bg-primary text-white shadow-md"
                              : "text-sidebar-foreground hover:bg-primary/10 ",
                          )}
                          title={!open ? t(item.title) : undefined}
                        >
                          <item.icon
                            className={cn(
                              "h-5 w-5 flex-shrink-0",
                              !open && "mx-auto",
                            )}
                          />
                          {open && <span>{t(item.title)}</span>}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        )}
      </ScrollArea>

      {/* Footer - Fixed at bottom */}
      <div className="p-2 flex-shrink-0">
        <NavLink
          to="/settings"
          className={cn(
            "sidebar-item flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all duration-200",
            location.pathname === "/settings"
              ? "bg-primary text-white"
              : "text-sidebar-foreground hover:bg-primary/10 ",
          )}
          title={!open ? t("nav.settings") : undefined}
        >
          <Settings
            className={cn("h-5 w-5 flex-shrink-0", !open && "mx-auto")}
          />
          {open && <span>{t("nav.settings")}</span>}
        </NavLink>
      </div>
    </aside>
  );
}
