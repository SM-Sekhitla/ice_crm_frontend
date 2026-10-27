import { Brand } from "../shared/Brand";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Bell,
  Boxes,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ContactRound,
  LayoutDashboard,
  FileText,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useCRM } from "../../app/context";
import { signOut } from "../../services/http";
import { toast } from "sonner";
import { useUI } from "../../store/ui";
import { Avatar, Button, Modal, Tip } from "../ui/primitives";
import { can } from "../../lib/permissions";
const groups = [
  {
    label: "OVERVIEW",
    items: [{ title: "Dashboard", path: "/", icon: LayoutDashboard }],
  },
  {
    label: "WORKSPACE",
    items: [
      { title: "Contacts", path: "/contacts", icon: ContactRound },
      { title: "Leads", path: "/leads", icon: Target },
      { title: "Clients", path: "/clients", icon: BriefcaseBusiness },
      { title: "Products", path: "/products", icon: Boxes },
    ],
  },
  {
    label: "MARKETING",
    items: [{ title: "Campaigns", path: "/campaigns", icon: Mail }],
  },
  {
    label: "ADMINISTRATION",
    items: [
      { title: "User management", path: "/users", icon: Users },
      { title: "Backend logs", path: "/backend-logs", icon: FileText },
      {
        title: "Email configurations",
        path: "/email-configurations",
        icon: ShieldCheck,
      },
    ],
  },
];
const names: Record<string, string> = {
  "/": "Dashboard",
  "/contacts": "Contacts",
  "/leads": "Leads",
  "/clients": "Clients",
  "/products": "Products",
  "/campaigns": "Campaigns",
  "/users": "User management",
  "/backend-logs": "Backend logs",
  "/email-configurations": "Email configurations",
  "/profile": "My profile",
  "/settings": "Settings",
};
export function Shell({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const { user, db, addContact, openContact } = useCRM();
  const collapsed = useUI((s) => s.collapsed);
  const toggle = useUI((s) => s.toggleSidebar);
  const logout = async () => {
    try {
      await signOut();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
  const path = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`ice-recent-searches-${user.id}`) || "[]",
      );
    } catch {
      return [];
    }
  });
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  useEffect(() => {
    setMobile(false);
  }, [path]);
  const results = [
    ...db.contacts
      .filter((c) =>
        `${c.firstName} ${c.lastName} ${c.company} ${c.email}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
      .slice(0, 6)
      .map((c) => ({
        id: c.id,
        title: `${c.firstName} ${c.lastName}`,
        subtitle: c.company,
        group: "Contacts",
        action: () => openContact(c.id),
      })),
    ...db.products
      .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3)
      .map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: p.type,
        group: "Products",
        action: () => navigate({ to: "/products" }),
      })),
    ...db.campaigns
      .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 2)
      .map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: c.status,
        group: "Campaigns",
        action: () => navigate({ to: "/campaigns" }),
      })),
  ];
  const choose = (i: number) => {
    const result = results[i];
    if (!result) return;
    result.action();
    setSearchOpen(false);
    if (query.trim()) {
      const next = [query, ...recent.filter((q) => q !== query)].slice(0, 5);
      setRecent(next);
      localStorage.setItem(
        `ice-recent-searches-${user.id}`,
        JSON.stringify(next),
      );
    }
  };
  return (
    <div
      className={`app ${collapsed ? "sidebar-collapsed" : ""} ${mobile ? "mobile-nav-open" : ""}`}
    >
      <button
        className="mobile-nav-backdrop"
        aria-label="Close navigation"
        onClick={() => setMobile(false)}
      />
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link to="/" aria-label="CRM home">
            <Brand />
          </Link>
          <button
            className="icon-button collapse-button"
            aria-label="Collapse sidebar"
            onClick={toggle}
          >
            <PanelLeftClose size={17} />
          </button>
        </div>
        <div className="sidebar-nav">
          {groups
            .filter(
              (g) => g.label !== "ADMINISTRATION" || can(user, "users.manage"),
            )
            .map((g) => (
              <div className="nav-group" key={g.label}>
                <span className="nav-label">{g.label}</span>
                {g.items.map((item) => (
                  <Tip label={item.title} key={item.path}>
                    <Link
                      to={item.path}
                      data-tour={item.path}
                      className={`nav-item ${path === item.path ? "active" : ""}`}
                    >
                      <item.icon size={18} />
                      <span>{item.title}</span>
                      {item.path === "/contacts" && (
                        <small>{db.contacts.length}</small>
                      )}
                      {item.path === "/leads" && (
                        <span className="nav-live-dot" />
                      )}
                    </Link>
                  </Tip>
                ))}
              </div>
            ))}
        </div>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span>
              <Sparkles size={15} />
              Built for what’s next
            </span>
            <p>
              One team. Every connection.
              <br />
              Real opportunities.
            </p>
            <button onClick={() => setHelp(true)}>
              Your workspace guide <ArrowIcon />
            </button>
          </div>
          <Link
            to="/settings"
            className={`nav-item ${path === "/settings" ? "active" : ""}`}
          >
            <Settings2 size={18} />
            <span>Settings</span>
          </Link>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            <span>Help & getting started</span>
            <span className="shortcut">?</span>
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="user-switch">
              <Avatar name={`${user.firstName} ${user.lastName}`} />
              <span>
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                <small>{user.role}</small>
              </span>
              <ChevronDown size={14} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="dropdown"
                side="top"
                align="start"
                sideOffset={8}
              >
                <DropdownMenu.Label>{user.email}</DropdownMenu.Label>
                <DropdownMenu.Item
                  onSelect={() => navigate({ to: "/profile" })}
                >
                  <UserRound size={15} />
                  My profile
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => navigate({ to: "/settings" })}
                >
                  <Settings2 size={15} />
                  Account settings
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  onSelect={() => {
                    void logout();
                  }}
                >
                  <LogOut size={15} />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            {collapsed && (
              <button
                className="icon-button expand-button"
                aria-label="Expand sidebar"
                onClick={toggle}
              >
                <Menu size={18} />
              </button>
            )}
            <Link to="/">Workspace</Link>
            <ChevronRight size={12} />
            <span>{names[path] || "Workspace"}</span>
          </div>
          <div className="topbar-actions">
            <button
              className="global-search"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={15} />
              <span>Search anything…</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="topbar-divider" />
            <Tip label="Quick create contact">
              <button
                className="icon-button"
                aria-label="Quick create contact"
                onClick={addContact}
              >
                <Plus size={19} />
              </button>
            </Tip>
            <div className="relative">
              <Tip label="Notifications">
                <button
                  className="icon-button notification-button"
                  aria-label="Notifications"
                  onClick={() => setNotifications(!notifications)}
                >
                  <Bell size={18} />
                  <i />
                </button>
              </Tip>
              {notifications && (
                <div className="notifications-popover">
                  <div className="section-heading">
                    <strong>Your workspace is up to date</strong>
                    <button
                      className="icon-button"
                      aria-label="Close notifications"
                      onClick={() => setNotifications(false)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p>Follow-ups and recent activity are on your dashboard.</p>
                  <Link to="/leads" onClick={() => setNotifications(false)}>
                    View your pipeline <ChevronRight size={13} />
                  </Link>
                </div>
              )}
            </div>
            <button
              className="avatar-button"
              aria-label="My profile"
              data-tour="/profile"
              onClick={() => navigate({ to: "/profile" })}
            >
              <Avatar name={`${user.firstName} ${user.lastName}`} small />
            </button>
          </div>
        </header>
        <motion.main
          className="main-content"
          key={path}
          initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {children}
        </motion.main>
        <footer className="app-footer">
          <span>
            <span className="footer-mark" />
            ICE / CRM
          </span>
          <span>Industrial Computing Engineering</span>
          <span>
            <span className="live-dot" />
            Connected workspace
          </span>
        </footer>
      </div>
      <Modal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Search your workspace"
        description="Find people, products, and campaigns."
      >
        <div className="command-search">
          <Search size={19} />
          <input
            autoFocus
            placeholder="Where would you like to go?"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                choose(active);
              }
            }}
            aria-label="Search workspace"
          />
        </div>
        <div className="command-results">
          {!query && recent.length > 0 && (
            <div className="recent-searches">
              <span>Recent searches</span>
              {recent.map((q) => (
                <button key={q} onClick={() => setQuery(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
          {results.map((r, i) => (
            <div key={r.id}>
              {(i === 0 || results[i - 1].group !== r.group) && (
                <p className="command-group">{r.group}</p>
              )}
              <button
                className={`command-result ${active === i ? "active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span>
                  <strong>{r.title}</strong>
                  <small>{r.subtitle}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            </div>
          ))}
          {!results.length && (
            <p className="command-group">
              No matching records. Try a different name.
            </p>
          )}
        </div>
        <div className="command-footer">
          <span>↑ ↓ to navigate</span>
          <span>↵ to open</span>
          <span>esc to close</span>
        </div>
      </Modal>
      <Modal
        open={help}
        onOpenChange={setHelp}
        title="Welcome to your ICE South Africa"
        description="A considered space for better business relationships."
      >
        <div className="form-body">
          <div className="help-step">
            <span>1</span>
            <div>
              <strong>Start with your products</strong>
              <p>Organise your services, projects, and products.</p>
            </div>
          </div>
          <div className="help-step">
            <span>2</span>
            <div>
              <strong>Make a connection</strong>
              <p>Add a contact and associate them with an existing product.</p>
            </div>
          </div>
          <div className="help-step">
            <span>3</span>
            <div>
              <strong>Move the relationship forward</strong>
              <p>
                Convert contacts to leads, manage the pipeline, and welcome new
                clients.
              </p>
            </div>
          </div>
          <div className="callout">
            Your workspace is connected to the CRM server. Start by creating a
            product, assign your team, and add contacts. Campaign sending
            requires an authorised sender configured by your administrator.
          </div>
        </div>
        <div className="modal-footer">
          <Button variant="primary" onClick={() => setHelp(false)}>
            Let's get started
          </Button>
        </div>
      </Modal>
    </div>
  );
}
function ArrowIcon() {
  return <ChevronRight size={13} />;
}
