import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Toaster } from "sonner";
import { Orbit } from "lucide-react";
import { AppContext } from "./context";
import { api } from "../services/api";
import {
  ApiError,
  onSessionExpired,
  restoreSession,
  clearSession,
} from "../services/http";
import { useUI } from "../store/ui";
import { Shell } from "../components/layout/Shell";
import { ActivateAccount } from "../features/auth/ActivateAccount";
import { WelcomeTour } from "../features/onboarding/WelcomeTour";
import { Login } from "../features/auth/Login";
const Dashboard = lazy(() =>
  import("../features/dashboard/Dashboard").then((module) => ({
    default: module.Dashboard,
  })),
);
const Contacts = lazy(() =>
  import("../features/contacts/Contacts").then((module) => ({
    default: module.Contacts,
  })),
);
import { ContactForm } from "../features/contacts/ContactForm";
import { ContactDetail } from "../features/contacts/ContactDetail";
const Leads = lazy(() =>
  import("../features/leads/Leads").then((module) => ({
    default: module.Leads,
  })),
);
const Campaigns = lazy(() =>
  import("../features/campaigns/Campaigns").then((module) => ({
    default: module.Campaigns,
  })),
);
const Products = lazy(() =>
  import("../features/products/Products").then((module) => ({
    default: module.Products,
  })),
);
import {
  AdministrationPage,
  Profile,
  Settings,
} from "../features/settings/Settings";
import { BackendLogs } from "../features/settings/BackendLogs";
import { Button } from "../components/ui/primitives";
function Workspace() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const activating = pathname.replace(/\/$/, "") === "/activate";
  const userId = useUI((s) => s.userId);
  const client = useQueryClient();
  const [restoring, setRestoring] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const restore = useCallback(async () => {
    setRestoring(true);
    setSessionError("");
    try {
      useUI.getState().login((await restoreSession()).id);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401))
        setSessionError((error as Error).message);
    } finally {
      setRestoring(false);
    }
  }, []);
  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      client.clear();
      useUI.getState().logout();
    });
    if (activating) setRestoring(false);
    else void restore();
    return unsubscribe;
  }, [client, restore, activating]);
  const [addOpen, setAddOpen] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);
  const {
    data: db,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["database", userId],
    queryFn: () => api.getDatabase(userId!),
    enabled: !!userId && !restoring && !activating,
    retry: (attempt, error) =>
      !(error instanceof ApiError && error.status < 500) && attempt < 1,
    refetchInterval: 15000,
  });
  const refresh = useCallback(async () => {
    await client.invalidateQueries({ queryKey: ["database", userId] });
  }, [client, userId]);
  const openContact = useCallback((id: string) => setContactId(id), []);
  useEffect(() => {
    setAddOpen(false);
    setContactId(null);
  }, [userId]);
  if (activating) return <ActivateAccount />;
  if (restoring)
    return <div className="workspace-loader">Restoring your session…</div>;
  if (sessionError)
    return (
      <div className="full-state">
        <h2>Cannot restore your session</h2>
        <p>{sessionError}</p>
        <Button onClick={() => void restore()}>Try again</Button>
        <Button
          onClick={() => {
            clearSession();
            setSessionError("");
          }}
        >
          Return to sign in
        </Button>
      </div>
    );
  if (!userId) return <Login />;
  if (error)
    return (
      <div className="full-state">
        <h2>We couldn't load your workspace</h2>
        <p>{error.message}</p>
        <Button onClick={() => refetch()}>Try again</Button>
        <Button onClick={clearSession}>Return to sign in</Button>
      </div>
    );
  if (isPending || !db)
    return (
      <div className="workspace-loader">
        <Orbit className="spin" size={32} />
        <span>Connecting your workspace…</span>
        <div className="skeleton" />
      </div>
    );
  const user = db.users.find((u) => u.id === userId);
  if (!user) return <Login />;
  return (
    <AppContext.Provider
      value={{
        db,
        user,
        refresh,
        addContact: () => setAddOpen(true),
        openContact,
      }}
    >
      <Shell>
        <Suspense
          fallback={
            <div className="route-loading">
              <div className="skeleton" />
              <p>Loading your workspace…</p>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </Shell>
      {user.onboardingCompleted === false && <WelcomeTour key={user.id} />}
      {addOpen && <ContactForm open setOpen={setAddOpen} />}
      <ContactDetail
        key={contactId ?? "closed"}
        id={contactId}
        onClose={() => setContactId(null)}
      />
    </AppContext.Provider>
  );
}
const root = createRootRoute({
  component: Workspace,
  notFoundComponent: () => (
    <div className="empty">
      <h2>This page isn't in your orbit</h2>
      <a href="/">Return to dashboard</a>
    </div>
  ),
});
const routes = [
  createRoute({
    getParentRoute: () => root,
    path: "/backend-logs",
    component: BackendLogs,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/activate",
    component: () => null,
  }),
  createRoute({ getParentRoute: () => root, path: "/", component: Dashboard }),
  createRoute({
    getParentRoute: () => root,
    path: "/contacts",
    component: () => <Contacts />,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/clients",
    component: () => <Contacts mode="clients" />,
  }),
  createRoute({ getParentRoute: () => root, path: "/leads", component: Leads }),
  createRoute({
    getParentRoute: () => root,
    path: "/products",
    component: Products,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/settings",
    component: Settings,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/profile",
    component: Profile,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/campaigns",
    component: Campaigns,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/users",
    component: () => <AdministrationPage type="users" />,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/email-configurations",
    component: () => <AdministrationPage type="email" />,
  }),
];
const router = createRouter({ routeTree: root.addChildren(routes) });
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="full-state">
        <h2>Something interrupted your workspace</h2>
        <p>Reload to reconnect to your workspace.</p>
        <Button onClick={() => window.location.reload()}>
          Reload workspace
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function App() {
  return (
    <ErrorBoundary>
      <Tooltip.Provider delayDuration={350}>
        <RouterProvider router={router} />
        <Toaster
          position="top-right"
          closeButton
          theme="light"
          toastOptions={{
            unstyled: true,
            classNames: {
              toast: "crm-toast",
              title: "crm-toast-title",
              description: "crm-toast-description",
              content: "crm-toast-content",
              icon: "crm-toast-icon",
              closeButton: "crm-toast-close",
              success: "crm-toast-success",
              error: "crm-toast-error",
              warning: "crm-toast-warning",
              info: "crm-toast-info",
              actionButton: "crm-toast-action",
              cancelButton: "crm-toast-cancel",
            },
          }}
        />
      </Tooltip.Provider>
    </ErrorBoundary>
  );
}
