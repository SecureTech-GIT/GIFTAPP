import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Gift,
  FolderOpen,
  FileBarChart,
  Settings,
  CalendarDays,
  UserRound,
  CheckCircle2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRole } from "@/contexts/RoleContext";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
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

/* ✅ SAME STRUCTURE AS SIDEBAR */
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
    title: "approvals.approvals",
    items: [
      {
        title: "approvals.approvals",
        href: "/approval-requests",
        icon: CheckCircle2,
        permission: "canApproveInterest",
      },
    ],
  },
  {
    title: "nav.guestManagement",
    items: [{ title: "nav.recipients", href: "/recipients", icon: UserRound }],
  },
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

export function MobileNav({ open, onClose }: MobileNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { hasPermission, isLoading } = useRole();

  const filteredNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.permission) return true;
        return hasPermission(item.permission);
      }),
    }))
    .filter((group) => group.items.length > 0);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 left-0 z-50 w-52 bg-sidebar text-sidebar-foreground border-r shadow-lg flex flex-col lg:hidden animate-in slide-in-from-left duration-300">
        {/* Header */}
        <div className="h-16 flex items-center justify-center px-4 border-b">
          <img
            src={`${import.meta.env.BASE_URL || '/'}imagelogo1.png`}
            alt={t('common.logo')}
            className="h-10 w-10 object-contain"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          {isLoading ? (
            <nav className="space-y-3 px-2 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 animate-pulse"
                >
                  <div className="h-5 w-5 rounded bg-gray-400" />
                  <div className="h-4 flex-1 rounded bg-muted" />
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
                            onClick={onClose}
                            className={cn(
                              "sidebar-item flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all duration-200",
                              isActive
                                ? "bg-primary text-white shadow-md"
                                : "hover:bg-primary/10"
                            )}
                          >
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            <span>{t(item.title)}</span>
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

        {/* Footer */}
        <div className="p-2 flex-shrink-0 border-t">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={cn(
              "sidebar-item flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all duration-200",
              location.pathname === "/settings"
                ? "bg-primary text-white"
                : "hover:bg-primary/10"
            )}
          >
            <Settings className="h-5 w-5 flex-shrink-0" />
            <span>{t('nav.settings')}</span>
          </NavLink>
        </div>
      </aside>
    </>
  );
}