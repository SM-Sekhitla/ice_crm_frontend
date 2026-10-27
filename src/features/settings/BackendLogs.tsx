import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, FileText, RefreshCw, Search } from "lucide-react";
import { useCRM } from "../../app/context";
import {
  Badge,
  Button,
  Empty,
  Modal,
  PageHeader,
} from "../../components/ui/primitives";
import { can } from "../../lib/permissions";
import { request } from "../../services/http";

interface BackendLog {
  id: number;
  createdAt: string;
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  module: string | null;
  service: string | null;
  details: string | null;
  source: "api" | "worker";
  message: string;
  requestId: string | null;
  method: string | null;
  route: string | null;
  statusCode: number | null;
  durationMs: number | null;
  errorType: string | null;
  outcome: string | null;
}
interface LogPage {
  items: BackendLog[];
  hasMore: boolean;
  nextCursor: number | null;
  retentionDays: number;
  coverage: string;
}
const timestamp = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Africa/Johannesburg",
});

export function BackendLogs() {
  const { user } = useCRM();
  const allowed = can(user, "logs.view");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [service, setService] = useState("");
  const [kind, setKind] = useState("");
  const [moduleInput, setModuleInput] = useState("");
  const [module, setModule] = useState("");
  const [selected, setSelected] = useState<BackendLog | null>(null);
  const [before, setBefore] = useState<number>();
  const [live, setLive] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setModule(moduleInput);
      setBefore(undefined);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, moduleInput]);
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: [
      "backend-logs",
      user.id,
      query,
      level,
      service,
      module,
      kind,
      before,
    ],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ limit: "50" });
      if (query) params.set("q", query);
      if (level) params.set("level", level);
      if (service) params.set("service", service);
      if (module) params.set("module", module);
      if (kind) params.set("kind", kind);
      if (before) params.set("before", String(before));
      return request<LogPage>(`/admin/backend-logs?${params}`, { signal });
    },
    enabled: allowed,
    refetchInterval: live && !before ? 15000 : false,
    retry: false,
  });
  if (!allowed)
    return (
      <Empty
        title="Administrator access required"
        description="Backend logs are available to Super Admins."
      />
    );
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE ADMINISTRATION"
        title="Backend logs"
        description="Explore system events, API requests and email delivery across modules and services. Times are shown in South African local time."
        actions={
          <Button onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw size={15} className={isFetching ? "spin" : undefined} />
            Refresh
          </Button>
        }
      />
      <section
        className="panel backend-logs-panel"
        aria-label="Backend log viewer"
      >
        <div className="backend-logs-toolbar">
          <label className="backend-logs-search">
            <Search size={16} />
            <input
              aria-label="Search backend logs"
              placeholder="Search events, routes, request IDs…"
              value={search}
              maxLength={120}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Log severity"
            value={level}
            onChange={(event) => {
              setLevel(event.target.value);
              setBefore(undefined);
            }}
          >
            <option value="">All severities</option>
            <option value="DEBUG">Debug</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <select
            aria-label="Log service"
            value={service}
            onChange={(event) => {
              setService(event.target.value);
              setBefore(undefined);
            }}
          >
            <option value="">All services</option>
            <option value="api">API</option>
            <option value="email-worker">Email worker</option>
          </select>
          <select
            aria-label="Log category"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setBefore(undefined);
            }}
          >
            <option value="">All logs</option>
            <option value="system">System events</option>
            <option value="requests">API requests</option>
            <option value="delivery">Email delivery</option>
          </select>
          <input
            className="backend-logs-module-filter"
            aria-label="Filter by module or logger"
            placeholder="Module / logger, e.g. auth"
            value={moduleInput}
            maxLength={120}
            list="backend-log-modules"
            onChange={(event) =>
              setModuleInput(event.target.value.replace(/[^A-Za-z0-9_.-]/g, ""))
            }
          />
          <datalist id="backend-log-modules">
            {[
              "app.api.auth",
              "app.api.admin",
              "app.api.crm",
              "app.api.campaigns",
              "app.api.imports",
              "app.api.workspace",
              "app.services.worker",
              "app.services.invitations",
              "crm.bootstrap",
              "crm.errors",
              "uvicorn",
              "sqlalchemy",
              "httpx",
            ].map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <label className="backend-logs-live">
            <input
              type="checkbox"
              checked={live}
              onChange={(event) => setLive(event.target.checked)}
            />
            Auto-refresh
          </label>
        </div>
        <div className="backend-logs-caption">
          <FileText size={14} />
          <span>
            Runtime and operational events · {data?.retentionDays ?? 7}-day
            retention ·{" "}
            {before
              ? "Viewing older entries"
              : live
                ? "Refreshes every 15 seconds"
                : "Auto-refresh paused"}
          </span>
        </div>
        {error ? (
          <div className="backend-logs-state" role="alert">
            <h3>Unable to load backend logs</h3>
            <p>{error.message}</p>
            <Button onClick={() => void refetch()}>Try again</Button>
          </div>
        ) : isPending ? (
          <div className="backend-logs-state" role="status">
            Loading backend logs…
          </div>
        ) : !data?.items.length ? (
          <Empty
            title="No log entries found"
            description="New events appear after requests or email processing. Try clearing the filters."
          />
        ) : (
          <div className="table-scroll">
            <table className="backend-logs-table">
              <thead>
                <tr>
                  <th>Time (SAST)</th>
                  <th>Severity</th>
                  <th>Event</th>
                  <th>Service / module</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th className="record-actions-heading">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <time dateTime={entry.createdAt}>
                        {timestamp.format(new Date(entry.createdAt))}
                      </time>
                    </td>
                    <td>
                      <Badge
                        tone={
                          ["ERROR", "CRITICAL"].includes(entry.level)
                            ? "red"
                            : entry.level === "WARNING"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {entry.level}
                      </Badge>
                    </td>
                    <td className="backend-log-event">
                      <strong>{entry.message}</strong>
                      {entry.route && (
                        <code>
                          {entry.method} {entry.route}
                        </code>
                      )}
                      {entry.errorType && (
                        <span className="field-error">{entry.errorType}</span>
                      )}
                      {entry.requestId && (
                        <small>Request: {entry.requestId}</small>
                      )}
                      {entry.outcome && <small>Outcome: {entry.outcome}</small>}
                    </td>
                    <td className="backend-log-module">
                      <strong>
                        {entry.service ||
                          (entry.source === "api" ? "api" : "email-worker")}
                      </strong>
                      <code>{entry.module || "—"}</code>
                    </td>
                    <td>{entry.statusCode ?? "—"}</td>
                    <td>
                      {entry.durationMs === null
                        ? "—"
                        : `${entry.durationMs.toFixed(1)} ms`}
                    </td>
                    <td className="user-actions-cell">
                      <Button
                        className="row-action"
                        aria-label={`View log ${entry.id}`}
                        title="View log details"
                        onClick={() => setSelected(entry)}
                      >
                        <Eye size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="backend-logs-footer">
          <span>{data?.items.length ?? 0} entries shown</span>
          <div>
            <Button
              disabled={!before || isFetching}
              onClick={() => setBefore(undefined)}
            >
              Newest
            </Button>
            <Button
              disabled={!data?.hasMore || isFetching}
              onClick={() => {
                if (data?.nextCursor) setBefore(data.nextCursor);
              }}
            >
              Older entries
            </Button>
          </div>
        </div>
      </section>
      <p className="backend-logs-note">
        Sensitive values are redacted. Database statements, exception messages
        and stack frame source lines are omitted.{" "}
        {data?.coverage ||
          "Covers API and email worker runtimes; hosting build, OS and container platform logs are not streamed."}
      </p>
      <Modal
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Log details"
        description="Runtime diagnostics with sensitive values removed."
      >
        {selected && (
          <div className="form-body backend-log-details">
            <div className="backend-log-details-heading">
              <Badge
                tone={
                  ["ERROR", "CRITICAL"].includes(selected.level)
                    ? "red"
                    : selected.level === "WARNING"
                      ? "amber"
                      : "neutral"
                }
              >
                {selected.level}
              </Badge>
              <time>{timestamp.format(new Date(selected.createdAt))} SAST</time>
            </div>
            <dl>
              <dt>Service</dt>
              <dd>{selected.service || selected.source}</dd>
              <dt>Module / logger</dt>
              <dd>{selected.module || "—"}</dd>
              <dt>Request ID</dt>
              <dd>{selected.requestId || "—"}</dd>
              <dt>Status / duration</dt>
              <dd>
                {selected.statusCode ?? "—"} ·{" "}
                {selected.durationMs === null
                  ? "—"
                  : `${selected.durationMs.toFixed(1)} ms`}
              </dd>
            </dl>
            <div>
              <h3>Message</h3>
              <pre>{selected.message}</pre>
            </div>
            {selected.route && (
              <div>
                <h3>Route</h3>
                <pre>
                  {selected.method} {selected.route}
                </pre>
              </div>
            )}
            {selected.errorType && (
              <div>
                <h3>Error type</h3>
                <code>{selected.errorType}</code>
              </div>
            )}
            {selected.details && (
              <div>
                <h3>Stack frames</h3>
                <pre>{selected.details}</pre>
              </div>
            )}
            {selected.outcome && (
              <div>
                <h3>Outcome</h3>
                <p>{selected.outcome}</p>
              </div>
            )}
          </div>
        )}
        <div className="modal-footer">
          <Button onClick={() => setSelected(null)}>Close</Button>
        </div>
      </Modal>
    </>
  );
}
