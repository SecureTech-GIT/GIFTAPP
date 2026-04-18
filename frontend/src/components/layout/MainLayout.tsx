import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function MainLayout() {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const isMobile = useIsMobile();

  // Get page title from route
  const getPageTitle = () => {
    const path = location.pathname;

    // Overview
    if (path === "/") return t("common.dashboard");

    // Event Management
    if (path.startsWith("/events")) {
      if (path === "/events") return t("nav.events");
      if (path === "/events/new") return t("events.newEvent");
      if (path.endsWith("/edit")) return t("events.editEvent");
      return t("events.eventDetails");
    }

    // Gift Management
    if (path.startsWith("/gifts")) {
      if (path === "/gifts") return t("nav.gifts");
      if (path === "/gifts/new") return t("gift.newGift");
      if (path.endsWith("/edit")) return t("gifts.editGift");

      return t("gift.giftDetails");
    }
    if (path.startsWith("/categories")) {
      if (path === "/categories") return t("nav.categories");
      if (path === "/categories/new") return t("categories.newCategory");
      return t("categories.categoryDetails");
    }

    // Guest Management
    if (path.startsWith("/recipients")) {
      if (path === "/recipients") return t("nav.recipients");
      if (path === "/recipients/new") return t("recipients.newRecipient");
      return t("recipients.recipientDetails");
    }

    // Inbound Gifts
    if (path.startsWith("/received-gifts")) {
      if (path === "/received-gifts") return t("nav.receivedGifts");
      if (path === "/received-gifts/new")
        return t("receivedGifts.newInboundGift");
      return t("receivedGifts.receivedGiftDetails");
    }

    // Outbound Gifts
    if (path.startsWith("/dispatch")) {
      if (path === "/dispatch") return t("nav.dispatch");
      if (path === "/dispatch/new") return t("dispatch.newDispatch");
      return t("dispatch.dispatchDetails");
    }

    // Maintenance
    if (path.startsWith("/maintenance")) {
      if (path === "/maintenance") return t("nav.maintenance");
      if (path === "/maintenance/new") return t("maintenance.newMaintenance");
      return t("maintenance.maintenanceDetails");
    }

    // Analytics
    if (path.startsWith("/reports")) return t("nav.reports");

    // Other
    if (path.startsWith("/profile")) return t("nav.profile");
    if (path.startsWith("/notifications")) return t("nav.notifications");
    if (path.startsWith("/settings")) return t("nav.settings");
    // approval
    if (path.startsWith("/approval-requests")) return t("approvals.workspace");

    return t("auth.giftManagementSystem");
  };

  return (
    <SidebarProvider>
      <div className="min-h-svh flex w-full bg-background safe-area-px safe-area-pb">
        {/* Desktop Sidebar - Fixed position, hidden on mobile */}
        <div className="hidden lg:block">
          <Sidebar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />
        </div>

        {/* Mobile Navigation Drawer */}
        <MobileNav
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />

        {/* Main Content Area - with margin to account for fixed sidebar */}
        <div
          className={cn(
            "flex-1 flex flex-col min-w-0 transition-all duration-300",
            "ltr:lg:ml-44 rtl:lg:mr-44", // Default margin for open sidebar
            !sidebarOpen && "ltr:lg:ml-16 rtl:lg:mr-16", // Smaller margin when sidebar closed
          )}
        >
          <TopBar
            title={getPageTitle()}
            onMenuClick={() =>
              isMobile ? setMobileNavOpen(true) : setSidebarOpen(!sidebarOpen)
            }
          />

          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
