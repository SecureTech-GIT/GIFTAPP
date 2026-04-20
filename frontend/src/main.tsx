import '@/lib/i18n'
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import "./index.css";

import { MainLayout } from "./components/layout";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireRole } from "./components/auth/RequireRole";
import { RoleProvider } from "./contexts/RoleContext";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { GiftList, GiftForm } from "./pages/gifts";
import CategoryList from "./pages/categories/CategoryList";
import RecipientList from "./pages/recipients/RecipientList";
import { ReceiptList, ReceiptForm } from "./pages/receipts";
import { EventList, EventForm } from "./pages/events";
import EventDetail from "./pages/events/EventDetail";
import { MaintenanceList, MaintenanceForm } from "./pages/maintenance";
import { DispatchList, DispatchForm } from "./pages/dispatch";
import { ReportList, ReportViewer } from "./pages/reports";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import ConnectionDebug from "./pages/debug/ConnectionDebug";
import ReceivedGiftsList from '@/pages/gifts/ReceivedGiftsList'
import ReceivedGiftForm from '@/pages/gifts/ReceivedGiftForm'
import ReceivedGiftDetail from '@/pages/gifts/ReceivedGiftDetail'
import RecipientForm from '@/pages/recipients/RecipientForm'
import GiftDetail from './pages/gifts/GiftDetail';
import ApprovalRequests from './pages/approval/ApprovalRequests';


const queryClient = new QueryClient();

const basename = import.meta.env.DEV ? '/' : '/gift'

const router = createBrowserRouter(
  [
    {
      path: "/login",
      element: <Login />,
    },
    {
      path: "/",
      element: <RequireAuth />,
      children: [
        {
          path: "/",
          element: <RoleProvider><MainLayout /></RoleProvider>,
          children: [
            {
              index: true,
              element: <Dashboard />,
            },
            {
              path: "debug/connection",
              element: <ConnectionDebug />,
            },
            // Gifts
            {
              path: "gifts",
              children: [
                { index: true, element: <GiftList /> },
                { path: "new", element: <GiftForm mode="create" /> },
                { path: ":id", element: <GiftDetail /> },
                { path: ":id/edit", element: <GiftForm mode="edit" /> },
              ],
            },
            // Received Gifts
            {
              path: "received-gifts",
              children: [
                { index: true, element: <ReceivedGiftsList /> },
                { path: "new", element: <ReceivedGiftForm /> },
                { path: ":id", element: <ReceivedGiftDetail /> },
                { path: ":id/edit", element: <ReceivedGiftForm /> },
              ],
            },
            // Categories - Admin only
            {
              path: "categories",
              element: (
                <RequireRole permission="canAccessCategories">
                  <CategoryList />
                </RequireRole>
              ),
            },
            // Recipients
            {
              path: "recipients",
              element: <RecipientList />,
            },
            {
              path: "recipients/new",
              element: <RecipientForm />,
            },
            {
              path: "recipients/edit/:id",
              element: <RecipientForm />,
            },
            // Events
            {
              path: "events",
              children: [
                { index: true, element: <EventList /> },
                { path: "new", element: <EventForm /> },
                { path: ":id", element: <EventDetail /> },
                { path: ":id/edit", element: <EventForm /> },
              ],
            },
            
            // Maintenance - Admin only
            {
              path: "maintenance",
              children: [
                {
                  index: true,
                  element: (
                    <RequireRole permission="canAccessMaintenance">
                      <MaintenanceList />
                    </RequireRole>
                  ),
                },
                {
                  path: "new",
                  element: (
                    <RequireRole permission="canAccessMaintenance">
                      <MaintenanceForm />
                    </RequireRole>
                  ),
                },
                {
                  path: ":id",
                  element: (
                    <RequireRole permission="canAccessMaintenance">
                      <MaintenanceForm />
                    </RequireRole>
                  ),
                },
              ],
            },
            // Dispatch
            {
              path: "dispatch",
              children: [
                { index: true, element: <DispatchList /> },
                { path: "new", element: <DispatchForm /> },
                { path: ":id", element: <DispatchForm /> },
              ],
            },
            // Reports - Admin only
            {
              path: "reports",
              children: [
                {
                  index: true,
                  element: (
                    <RequireRole permission="canAccessReports">
                      <ReportList />
                    </RequireRole>
                  ),
                },
                {
                  path: ":reportId",
                  element: (
                    <RequireRole permission="canAccessReports">
                      <ReportViewer />
                    </RequireRole>
                  ),
                },
              ],
            },
            // Profile, Settings & Notifications
            { path: "profile", element: <Profile /> },
            { path: "settings", element: <Settings /> },
            { path: "notifications", element: <Notifications /> },

            // approval
            {
              path: "approval-requests",
              element: (
                <RequireRole permission="canApproveInterest">
                  <ApprovalRequests />
                </RequireRole>
              ),
            },
          ],
        },
      ],
    },
    {
      path: "*",
      element: <NotFound />,
    },
  ],
  {
    basename,
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  }
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
);
