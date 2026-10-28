import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderOpen,
  RefreshCw,
  Search,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import { useCRM } from "../../app/context";
import { Button, Empty, PageHeader } from "../../components/ui/primitives";
import { can } from "../../lib/permissions";
import { request } from "../../services/http";
import { downloadFile } from "../calendar/calendar";
interface LogFile {
  key: string;
  name: string;
  entries: number;
  modifiedAt: string;
}
interface LogEntry {
  id: number;
  level: string;
  text: string;
  createdAt: string;
}
interface LogPage {
  items: LogEntry[];
  hasMore: boolean;
  nextCursor: number | null;
  retentionDays: number;
  coverage: string;
}
const modified = (iso: string) =>
  new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(iso));
export function BackendLogs() {
  const { user } = useCRM();
  const allowed = can(user, "logs.view");
  const [folder, setFolder] = useState<"modules" | "services">("modules");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [fileSearch, setFileSearch] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [kind, setKind] = useState("");
  const [before, setBefore] = useState<number>();
  const [live, setLive] = useState(true);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setBefore(undefined);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const files = useQuery({
    queryKey: ["backend-log-files", user.id],
    queryFn: ({ signal }) =>
      request<{
        folders: { modules: LogFile[]; services: LogFile[] };
        retentionDays: number;
      }>("/admin/backend-logs/files", { signal }),
    enabled: allowed,
    refetchInterval: live ? 15000 : false,
    retry: false,
  });
  const allFiles = files.data?.folders[folder] ?? [];
  const active =
    allFiles.find((file) => file.key === selectedKey) ?? allFiles[0];
  useEffect(() => {
    if (!allFiles.some((file) => file.key === selectedKey) && allFiles[0])
      setSelectedKey(allFiles[0].key);
  }, [selectedKey, allFiles]);
  const visibleFiles = allFiles.filter((file) =>
    file.name.toLowerCase().includes(fileSearch.toLowerCase()),
  );
  const filters = () => {
    const params = new URLSearchParams();
    if (active)
      params.set(folder === "modules" ? "module_exact" : "service", active.key);
    if (level) params.set("level", level);
    if (kind) params.set("kind", kind);
    if (query) params.set("q", query);
    return params;
  };
  const logs = useQuery({
    queryKey: [
      "backend-log-file",
      user.id,
      folder,
      active?.key,
      level,
      kind,
      query,
      before,
    ],
    queryFn: ({ signal }) => {
      const params = filters();
      params.set("limit", "100");
      if (before) params.set("before", String(before));
      return request<LogPage>(`/admin/backend-logs?${params}`, { signal });
    },
    enabled: allowed && !!active,
    refetchInterval: live && !before ? 15000 : false,
    retry: false,
  });
  const refresh = () => {
    void files.refetch();
    if (active) void logs.refetch();
  };
  if (!allowed)
    return (
      <Empty
        title="Administrator access required"
        description="System logs are available to Super Admins."
      />
    );
  return (
    <>
      <PageHeader
        title="System Logs"
        description="Browse retained runtime logs by module and service."
        actions={
          <Button
            disabled={files.isFetching || logs.isFetching}
            onClick={refresh}
          >
            <RefreshCw
              size={15}
              className={files.isFetching || logs.isFetching ? "spin" : ""}
            />
            Refresh
          </Button>
        }
      />
      <div className="log-explorer-breadcrumb">
        <Server size={16} />
        <span>logs</span>
        <ChevronRight size={14} />
        <button
          className={folder === "modules" ? "active" : ""}
          onClick={() => {
            setFolder("modules");
            setSelectedKey(null);
            setBefore(undefined);
          }}
        >
          modules
        </button>
        <span className="log-folder-divider">/</span>
        <button
          className={folder === "services" ? "active" : ""}
          onClick={() => {
            setFolder("services");
            setSelectedKey(null);
            setBefore(undefined);
          }}
        >
          services
        </button>
        <span className="log-retention">
          {files.data?.retentionDays ?? 7}-day retention
        </span>
      </div>
      <div className="log-explorer">
        <section className="panel log-explorer-files" aria-label="Log files">
          <div className="log-file-filter">
            <Search size={15} />
            <input
              aria-label="Filter log files"
              placeholder="Filter this folder…"
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
            />
          </div>
          <div className="log-file-list" aria-label={`${folder} log files`}>
            {files.error ? (
              <div className="log-explorer-state" role="alert">
                <strong>Unable to load log files</strong>
                <p>{files.error.message}</p>
                <Button onClick={() => void files.refetch()}>Try again</Button>
              </div>
            ) : files.isPending ? (
              <div className="log-explorer-state" role="status">
                Loading log files…
              </div>
            ) : visibleFiles.length ? (
              visibleFiles.map((file) => (
                <button
                  key={file.key}
                  className={`log-file-row ${active?.key === file.key ? "active" : ""}`}
                  aria-pressed={active?.key === file.key}
                  title={file.name}
                  onClick={() => {
                    setSelectedKey(file.key);
                    setBefore(undefined);
                  }}
                >
                  <FileText size={16} />
                  <span>{file.name}</span>
                  <small>{file.entries.toLocaleString()} entries</small>
                </button>
              ))
            ) : (
              <div className="log-explorer-state">
                {allFiles.length
                  ? "No files match this filter."
                  : "No logs captured yet. New runtime events will appear here."}
              </div>
            )}
          </div>
          <div className="log-explorer-files-footer">
            <Folder size={13} />
            {allFiles.length} log streams
          </div>
        </section>
        <section
          className="panel log-explorer-preview"
          aria-label="Log preview"
        >
          <div className="log-preview-heading">
            <div>
              <strong>
                <FolderOpen size={16} />
                {active ? `${folder}/${active.name}` : "Select a log file"}
              </strong>
              {active && (
                <small>
                  {active.entries.toLocaleString()} retained entries · updated{" "}
                  {modified(active.modifiedAt)} SAST
                </small>
              )}
            </div>
            <Button
              disabled={!active || downloading}
              loading={downloading}
              title="Download up to the latest 2,000 matching entries"
              onClick={async () => {
                setDownloading(true);
                try {
                  const result = await request<{
                    filename: string;
                    content: string;
                    truncated: boolean;
                    count: number;
                  }>(`/admin/backend-logs/export?${filters()}`);
                  downloadFile(result.filename, result.content);
                  toast.success(
                    result.truncated
                      ? "Downloaded latest 2,000 entries. Narrow the filters for a smaller log."
                      : `Downloaded ${result.count} log entries`,
                  );
                } catch (error) {
                  toast.error((error as Error).message);
                } finally {
                  setDownloading(false);
                }
              }}
            >
              <Download size={15} />
              Download
            </Button>
          </div>
          <div className="log-preview-filters">
            <label>
              <Search size={14} />
              <input
                aria-label="Search log contents"
                value={search}
                maxLength={120}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search log contents…"
              />
            </label>
            <select
              aria-label="Log severity"
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setBefore(undefined);
              }}
            >
              <option value="">All levels</option>
              {["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"].map(
                (level) => (
                  <option key={level}>{level}</option>
                ),
              )}
            </select>
            <select
              aria-label="Log category"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setBefore(undefined);
              }}
            >
              <option value="">All events</option>
              <option value="system">System</option>
              <option value="requests">Requests</option>
              <option value="delivery">Delivery</option>
            </select>
            <label className="log-live-toggle">
              <input
                type="checkbox"
                checked={live}
                onChange={(e) => setLive(e.target.checked)}
              />
              Live
            </label>
          </div>
          <div
            className="log-preview-code"
            tabIndex={0}
            role="region"
            aria-label="Log file contents"
            aria-busy={logs.isFetching}
          >
            {!active ? (
              <div className="log-explorer-state">
                <FileText size={26} />
                <p>Select a module or service to preview its logs.</p>
              </div>
            ) : logs.error ? (
              <div className="log-explorer-state" role="alert">
                <strong>Unable to load this log</strong>
                <p>{logs.error.message}</p>
                <Button onClick={() => void logs.refetch()}>Try again</Button>
              </div>
            ) : logs.isPending ? (
              <div className="log-explorer-state" role="status">
                Loading log contents…
              </div>
            ) : !logs.data?.items.length ? (
              <div className="log-explorer-state">
                No entries match these filters.
              </div>
            ) : (
              <pre>
                {[...logs.data.items].reverse().map((entry) => (
                  <span
                    key={entry.id}
                    className={`log-code-entry log-${entry.level.toLowerCase()}`}
                  >
                    {entry.text}
                  </span>
                ))}
              </pre>
            )}
          </div>
          <div className="log-preview-footer">
            <span>
              {logs.data?.items.length ?? 0} entries shown
              {before ? " · older page" : " · newest page"} · timestamps in UTC
            </span>
            <div>
              <Button
                disabled={!before || logs.isFetching}
                onClick={() => setBefore(undefined)}
              >
                Newest
              </Button>
              <Button
                disabled={!logs.data?.hasMore || logs.isFetching}
                onClick={() => {
                  if (logs.data?.nextCursor) setBefore(logs.data.nextCursor);
                }}
              >
                Older
              </Button>
            </div>
          </div>
        </section>
      </div>
      <p className="backend-logs-note">
        These are virtual log files from stored API and worker events. Sensitive
        values are redacted. Hosting build logs and operating-system logs remain
        in the hosting console.
      </p>
    </>
  );
}
