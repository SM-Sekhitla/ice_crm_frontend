import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useCRM } from "../../app/context";
import {
  Badge,
  Button,
  Empty,
  Modal,
  PageHeader,
} from "../../components/ui/primitives";
import { can, canManageAssociation } from "../../lib/permissions";
import { json, request } from "../../services/http";
import { api } from "../../services/api";
import {
  addDays,
  addMonths,
  calendarRange,
  clock,
  dayKey,
  downloadFile,
  eventKinds,
  icalEvent,
  layoutDayEvents,
  midnight,
  onDay,
  prettyDay,
  type CalendarView,
  type DiaryEvent,
} from "./calendar";
import { EventForm } from "./EventForm";

const colours: Record<string, string> = {
  Meeting: "#c1121f",
  Call: "#476f91",
  Appointment: "#805da6",
  Task: "#94702d",
  Reminder: "#4e7b62",
  "Follow-up": "#5c7480",
};
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Calendar() {
  const { db, user, openContact, refresh } = useCRM();
  const client = useQueryClient();
  const [focus, setFocus] = useState(() => dayKey(new Date()));
  const [view, setView] = useState<CalendarView>("Month");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [mine, setMine] = useState(false);
  const [showFollowUps, setShowFollowUps] = useState(true);
  const [editor, setEditor] = useState<{
    day: string;
    time?: string;
    event?: DiaryEvent;
  } | null>(null);
  const [selected, setSelected] = useState<DiaryEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const weekScroll = useRef<HTMLDivElement>(null);
  const range = useMemo(() => calendarRange(view, focus), [view, focus]);
  const allowed = can(user, "calendar.view");
  const eventsQuery = useQuery({
    queryKey: ["calendar-events", user.id, range.start, range.end],
    queryFn: ({ signal }) =>
      request<{ items: DiaryEvent[]; truncated: boolean }>(
        `/calendar/events?${new URLSearchParams({ start: midnight(range.start), end: midnight(range.end) })}`,
        { signal },
      ),
    enabled: allowed,
    refetchInterval: 60000,
  });
  const peopleQuery = useQuery({
    queryKey: ["calendar-people", user.id],
    queryFn: () => request<{ id: string; name: string }[]>("/calendar/people"),
    enabled: allowed,
    staleTime: 60000,
  });
  const people = peopleQuery.data ?? [];
  const savedEvents = eventsQuery.data?.items ?? [];
  const followUps = useMemo<DiaryEvent[]>(
    () =>
      db.followUps.flatMap((task) => {
        const association = db.associations.find(
          (a) => a.id === task.associationId,
        );
        if (!association || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate))
          return [];
        return [
          {
            id: `follow-up-${task.id}`,
            followUpId: task.id,
            source: "follow-up" as const,
            title: task.title,
            description: task.notes,
            kind: "Follow-up" as const,
            status:
              task.status === "Completed"
                ? ("Completed" as const)
                : ("Scheduled" as const),
            startsAt: midnight(task.dueDate),
            endsAt: midnight(addDays(task.dueDate, 1)),
            allDay: true,
            location: "",
            meetingUrl: "",
            contactId: association.contactId,
            productId: association.productId,
            participantIds: [],
            reminderMinutes: null,
            createdBy: task.ownerId,
            version: 0,
          },
        ];
      }),
    [db.followUps, db.associations],
  );
  const events = useMemo(
    () =>
      [...savedEvents, ...(showFollowUps ? followUps : [])]
        .filter(
          (e) =>
            new Date(e.startsAt) < new Date(midnight(range.end)) &&
            new Date(e.endsAt) > new Date(midnight(range.start)) &&
            (!kind || e.kind === kind) &&
            (!mine ||
              e.createdBy === user.id ||
              e.participantIds.includes(user.id)) &&
            `${e.title} ${e.description} ${e.location}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
            a.id.localeCompare(b.id),
        ),
    [savedEvents, followUps, showFollowUps, range, kind, mine, user.id, search],
  );
  const today = dayKey(new Date());
  const remindersQuery = useQuery({
    queryKey: ["calendar-reminders", user.id, today],
    queryFn: ({ signal }) =>
      request<{ items: DiaryEvent[]; truncated: boolean }>(
        `/calendar/events?${new URLSearchParams({ start: midnight(addDays(today, -1)), end: midnight(addDays(today, 8)) })}`,
        { signal },
      ),
    enabled: allowed,
    refetchInterval: 60000,
  });
  const daysEvents = (day: string) => events.filter((e) => onDay(e, day));
  const isEditable = (event: DiaryEvent) =>
    !event.source &&
    can(user, "calendar.manage") &&
    (event.createdBy === user.id || user.role === "Super Admin");
  const reload = async () => {
    await client.invalidateQueries({ queryKey: ["calendar-events"] });
    await client.invalidateQueries({ queryKey: ["calendar-reminders"] });
    await refresh();
  };
  const select = (event: DiaryEvent) => {
    setSelected(event);
    setActionError("");
    setDeleting(false);
  };
  useEffect(() => {
    if (view === "Week" && weekScroll.current)
      weekScroll.current.scrollTop = 7 * 56;
  }, [view, focus]);
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      for (const event of remindersQuery.data?.items ?? []) {
        if (
          event.status !== "Scheduled" ||
          event.reminderMinutes === null ||
          !(
            event.createdBy === user.id ||
            event.participantIds.includes(user.id)
          )
        )
          continue;
        const delta = new Date(event.startsAt).getTime() - now;
        if (delta < -60000 || delta > event.reminderMinutes * 60000) continue;
        const key = `crm-diary-reminder:${user.id}:${event.id}:${event.startsAt}:${event.reminderMinutes}`;
        try {
          if (sessionStorage.getItem(key)) continue;
          sessionStorage.setItem(key, "shown");
        } catch {
          continue;
        }
        toast.info(
          `${event.title} ${delta <= 0 ? "is starting now" : `starts in ${Math.max(1, Math.ceil(delta / 60000))} minutes`}`,
          { duration: 10000 },
        );
      }
    };
    check();
    const timer = window.setInterval(check, 30000);
    return () => window.clearInterval(timer);
  }, [remindersQuery.data, user.id]);
  if (!allowed)
    return (
      <Empty
        title="Calendar access unavailable"
        description="Ask your administrator to review your account access."
      />
    );
  const period =
    view === "Month"
      ? prettyDay(focus, { month: "long", year: "numeric" })
      : `${prettyDay(range.start, { day: "numeric", month: "short" })} – ${prettyDay(addDays(range.end, -1), { day: "numeric", month: "short", year: "numeric" })}`;
  const move = (direction: number) =>
    setFocus(
      view === "Month"
        ? addMonths(focus, direction)
        : addDays(focus, direction * (view === "Week" ? 7 : 30)),
    );
  const chip = (event: DiaryEvent, compact = false) => (
    <button
      key={event.id}
      className={`diary-event-chip ${event.status.toLowerCase()} ${compact ? "compact" : ""}`}
      style={{ "--event-colour": colours[event.kind] } as React.CSSProperties}
      onClick={() => select(event)}
      title={`${event.title} · ${event.allDay ? "All day" : clock(event.startsAt)} · ${event.status}`}
    >
      <i />
      {!event.allDay && <time>{clock(event.startsAt)}</time>}
      <span>{event.title}</span>
      {event.status === "Completed" && <Check size={11} />}
    </button>
  );
  return (
    <>
      <PageHeader
        eyebrow="MAKE TIME FOR WHAT MATTERS"
        title="Calendar & diary"
        description="Meetings, follow-ups and the next steps that move relationships forward."
        actions={
          <Button variant="primary" onClick={() => setEditor({ day: focus })}>
            <Plus size={16} />
            Add event
          </Button>
        }
      />
      <div className="diary-layout">
        <aside className="diary-sidebar">
          <section className="panel diary-today">
            <span className="eyebrow">TODAY</span>
            <strong>{Number(today.slice(8))}</strong>
            <p>
              {prettyDay(today, {
                weekday: "long",
                month: "long",
                year: "numeric",
              })}
            </p>
            <span>
              <Clock3 size={13} />
              South African time · UTC+02
            </span>
          </section>
          <section className="panel diary-filters">
            <h3>Your calendar</h3>
            <label className="diary-checkbox">
              <input
                type="checkbox"
                checked={mine}
                onChange={(e) => setMine(e.target.checked)}
              />
              My events & attendance
            </label>
            <label className="diary-checkbox">
              <input
                type="checkbox"
                checked={showFollowUps}
                onChange={(e) => setShowFollowUps(e.target.checked)}
              />
              CRM follow-ups
            </label>
            <div className="diary-legend">
              <button
                className={!kind ? "active" : ""}
                onClick={() => setKind("")}
              >
                All event types
              </button>
              {[...eventKinds, "Follow-up"].map((type) => (
                <button
                  key={type}
                  className={kind === type ? "active" : ""}
                  onClick={() => setKind(kind === type ? "" : type)}
                >
                  <i style={{ background: colours[type] }} />
                  {type}
                </button>
              ))}
            </div>
            <p>
              Events are shared with your team. Organisers and Super Admins can
              update bookings.
            </p>
          </section>
          <section className="panel diary-up-next">
            <h3>Coming up</h3>
            {events
              .filter(
                (e) =>
                  e.status === "Scheduled" && new Date(e.endsAt) > new Date(),
              )
              .slice(0, 3)
              .map((e) => (
                <button key={e.id} onClick={() => select(e)}>
                  <i style={{ background: colours[e.kind] }} />
                  <span>
                    <strong>{e.title}</strong>
                    <small>
                      {prettyDay(dayKey(e.startsAt), {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      · {e.allDay ? "All day" : clock(e.startsAt)}
                    </small>
                  </span>
                </button>
              ))}
            {!events.some(
              (e) =>
                e.status === "Scheduled" && new Date(e.endsAt) > new Date(),
            ) && <p>No upcoming events in this view.</p>}
          </section>
        </aside>
        <section className="panel diary-main">
          <div className="diary-toolbar">
            <div className="diary-navigation">
              <Button onClick={() => setFocus(today)}>Today</Button>
              <button
                className="icon-button"
                aria-label="Previous period"
                onClick={() => move(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Next period"
                onClick={() => move(1)}
              >
                <ChevronRight size={18} />
              </button>
              <h2>{period}</h2>
            </div>
            <div className="segmented">
              {(["Month", "Week", "Agenda"] as CalendarView[]).map((v) => (
                <button
                  key={v}
                  className={v === view ? "active" : ""}
                  onClick={() => setView(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="diary-search-bar">
            <label className="search-input">
              <Search size={15} />
              <input
                aria-label="Search calendar"
                placeholder="Search your diary…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <span>{events.length} events in view</span>
            <button
              className="icon-button"
              aria-label="Refresh calendar"
              disabled={eventsQuery.isFetching}
              onClick={() => void eventsQuery.refetch()}
            >
              <RefreshCw
                size={15}
                className={eventsQuery.isFetching ? "spin" : ""}
              />
            </button>
          </div>
          {eventsQuery.error ? (
            <div className="diary-error" role="alert">
              <h3>Unable to load calendar</h3>
              <p>{eventsQuery.error.message}</p>
              <Button onClick={() => void eventsQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : eventsQuery.isPending ? (
            <div className="diary-error" role="status">
              Loading your diary…
            </div>
          ) : (
            <>
              {eventsQuery.data?.truncated && (
                <p className="callout">
                  This view contains more than 1,000 bookings. Switch to Week to
                  see a smaller range.
                </p>
              )}
              {view === "Month" && (
                <div className="diary-month-scroll">
                  <div className="diary-month">
                    <div className="diary-weekdays">
                      {weekdays.map((day) => (
                        <span key={day}>{day}</span>
                      ))}
                    </div>
                    <div className="diary-month-grid">
                      {range.days.map((day) => {
                        const entries = daysEvents(day);
                        return (
                          <div
                            className={`diary-day ${day.slice(0, 7) !== focus.slice(0, 7) ? "outside" : ""} ${day === today ? "today" : ""}`}
                            key={day}
                          >
                            <div className="diary-day-heading">
                              <button
                                aria-label={`Add event on ${prettyDay(day)}`}
                                onClick={() => setEditor({ day })}
                              >
                                {Number(day.slice(8))}
                              </button>
                              <button
                                className="diary-day-add"
                                aria-label={`Schedule on ${day}`}
                                onClick={() => setEditor({ day })}
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                            {entries
                              .slice(0, 3)
                              .map((entry) => chip(entry, true))}
                            {entries.length > 3 && (
                              <button
                                className="diary-more"
                                onClick={() => {
                                  setFocus(day);
                                  setView("Agenda");
                                }}
                              >
                                +{entries.length - 3} more
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {view === "Week" && (
                <div className="diary-week-scroll" ref={weekScroll}>
                  <div className="diary-week">
                    <div className="diary-week-heading">
                      <span>SAST</span>
                      {range.days.map((day, i) => (
                        <button
                          className={day === today ? "today" : ""}
                          key={day}
                          onClick={() => setEditor({ day })}
                        >
                          <small>{weekdays[i]}</small>
                          <strong>{Number(day.slice(8))}</strong>
                        </button>
                      ))}
                    </div>
                    <div className="diary-week-allday">
                      <span>All day</span>
                      {range.days.map((day) => (
                        <div key={day}>
                          {daysEvents(day)
                            .filter((e) => e.allDay)
                            .map((e) => chip(e, true))}
                        </div>
                      ))}
                    </div>
                    <div className="diary-week-timeline">
                      <div className="diary-hours">
                        {Array.from({ length: 24 }, (_, h) => (
                          <span key={h}>{String(h).padStart(2, "0")}:00</span>
                        ))}
                      </div>
                      {range.days.map((day) => (
                        <div className="diary-week-day" key={day}>
                          {Array.from({ length: 24 }, (_, h) => (
                            <button
                              key={h}
                              className="diary-hour-slot"
                              aria-label={`Add event on ${day} at ${h}:00`}
                              onClick={() =>
                                setEditor({
                                  day,
                                  time: `${String(h).padStart(2, "0")}:00`,
                                })
                              }
                            />
                          ))}
                          {layoutDayEvents(events, day).map((item) => (
                            <button
                              className={`diary-timed-event ${item.event.status.toLowerCase()}`}
                              key={item.event.id}
                              style={
                                {
                                  top: (item.start / 60) * 56,
                                  height: Math.max(
                                    24,
                                    ((item.end - item.start) / 60) * 56 - 2,
                                  ),
                                  left: `calc(${(item.lane / item.lanes) * 100}% + 2px)`,
                                  width: `calc(${100 / item.lanes}% - 4px)`,
                                  "--event-colour": colours[item.event.kind],
                                } as React.CSSProperties
                              }
                              onClick={() => select(item.event)}
                              title={item.event.title}
                            >
                              <strong>{item.event.title}</strong>
                              <small>
                                {clock(item.event.startsAt)}–
                                {clock(item.event.endsAt)}
                              </small>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {view === "Agenda" && (
                <div className="diary-agenda">
                  {range.days
                    .filter((day) => daysEvents(day).length)
                    .map((day) => (
                      <section key={day}>
                        <div
                          className={`diary-agenda-date ${day === today ? "today" : ""}`}
                        >
                          <strong>{Number(day.slice(8))}</strong>
                          <span>
                            {prettyDay(day, {
                              weekday: "short",
                              month: "short",
                            })}
                          </span>
                        </div>
                        <div>
                          {daysEvents(day).map((event) => (
                            <button
                              className={`diary-agenda-event ${event.status.toLowerCase()}`}
                              key={event.id}
                              onClick={() => select(event)}
                            >
                              <time>
                                {event.allDay
                                  ? "All day"
                                  : clock(event.startsAt)}
                              </time>
                              <i style={{ background: colours[event.kind] }} />
                              <span>
                                <strong>{event.title}</strong>
                                <small>
                                  {event.kind}
                                  {event.location ? ` · ${event.location}` : ""}
                                </small>
                              </span>
                              <Badge
                                tone={
                                  event.status === "Completed"
                                    ? "green"
                                    : event.status === "Cancelled"
                                      ? "neutral"
                                      : "blue"
                                }
                              >
                                {event.status}
                              </Badge>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  {!events.length && (
                    <Empty
                      title="Your diary is clear"
                      description="Add a meeting, call, appointment or reminder to plan your next step."
                      action={
                        <Button onClick={() => setEditor({ day: focus })}>
                          <Plus size={14} />
                          Add event
                        </Button>
                      }
                    />
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
      {editor && (
        <EventForm
          key={editor.event?.id ?? editor.day}
          event={editor.event}
          day={editor.day}
          time={editor.time}
          peopleError={peopleQuery.error?.message}
          people={people}
          onSaved={reload}
          onClose={() => setEditor(null)}
        />
      )}
      <Modal
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setSelected(null);
            setDeleting(false);
          }
        }}
        title={selected?.title ?? "Event details"}
        description={
          selected ? `${selected.kind} · ${selected.status}` : "Calendar event"
        }
      >
        {selected && (
          <>
            <div className="form-body diary-details">
              <div className="diary-detail-time">
                <CalendarDays size={20} />
                <div>
                  <strong>{prettyDay(dayKey(selected.startsAt))}</strong>
                  <span>
                    {selected.allDay
                      ? "All day"
                      : `${clock(selected.startsAt)} – ${clock(selected.endsAt)}`}
                    {dayKey(selected.startsAt) !==
                      dayKey(
                        new Date(
                          new Date(selected.endsAt).getTime() -
                            (selected.allDay ? 1 : 0),
                        ),
                      ) &&
                      ` · until ${prettyDay(dayKey(new Date(new Date(selected.endsAt).getTime() - (selected.allDay ? 1 : 0))))}`}{" "}
                    · SAST
                  </span>
                </div>
              </div>
              {selected.location && (
                <p>
                  <MapPin size={16} />
                  {selected.location}
                </p>
              )}
              {selected.meetingUrl && (
                <a
                  className="button"
                  href={selected.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={14} />
                  Join meeting
                </a>
              )}
              <p>
                <Users size={16} />
                Organiser:{" "}
                {people.find((p) => p.id === selected.createdBy)?.name ??
                  db.users.find((u) => u.id === selected.createdBy)
                    ?.firstName ??
                  "Unavailable team member"}
              </p>
              {!!selected.participantIds.length && (
                <div>
                  <strong>Attendees</strong>
                  <div className="diary-attendee-tags">
                    {selected.participantIds.map((id) => (
                      <span key={id}>
                        {people.find((p) => p.id === id)?.name ??
                          "Unavailable team member"}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selected.contactId && (
                <Button
                  onClick={() => {
                    openContact(selected.contactId!);
                    setSelected(null);
                  }}
                >
                  View related contact
                  <ChevronRight size={14} />
                </Button>
              )}
              {selected.description && (
                <div className="diary-detail-notes">
                  <strong>Notes</strong>
                  <p>{selected.description}</p>
                </div>
              )}
              {selected.reminderMinutes !== null && (
                <p className="form-hint">
                  Reminder:{" "}
                  {selected.reminderMinutes === 0
                    ? "at start time"
                    : `${selected.reminderMinutes} minutes before`}
                  . Shown while Calendar is open.
                </p>
              )}
              {deleting && (
                <div className="callout">
                  Delete this event from the shared diary? This cannot be
                  undone.
                </div>
              )}
              {actionError && (
                <p className="field-error" role="alert">
                  {actionError}
                </p>
              )}
            </div>
            <div className="modal-footer diary-detail-actions">
              <Button
                disabled={busy}
                onClick={() =>
                  downloadFile(
                    "crm-event.ics",
                    icalEvent(selected),
                    "text/calendar;charset=utf-8",
                  )
                }
              >
                <Download size={14} />
                Export .ics
              </Button>
              {selected.source === "follow-up"
                ? (() => {
                    const association = db.associations.find((a) =>
                      db.followUps.some(
                        (f) =>
                          f.id === selected.followUpId &&
                          f.associationId === a.id,
                      ),
                    );
                    return association &&
                      canManageAssociation(user, association) ? (
                      <Button
                        loading={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await api.setFollowUpStatus(
                              selected.followUpId!,
                              selected.status === "Completed"
                                ? "Open"
                                : "Completed",
                              user.id,
                            );
                            await reload();
                            setSelected(null);
                            toast.success("Follow-up updated");
                          } catch (e) {
                            setActionError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {selected.status === "Completed"
                          ? "Reopen"
                          : "Complete"}{" "}
                        follow-up
                      </Button>
                    ) : null;
                  })()
                : isEditable(selected) && (
                    <>
                      <Button
                        disabled={busy}
                        onClick={() => {
                          setEditor({
                            day: dayKey(selected.startsAt),
                            event: selected,
                          });
                          setSelected(null);
                        }}
                      >
                        <Pencil size={14} />
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        loading={busy}
                        onClick={async () => {
                          if (!deleting) {
                            setDeleting(true);
                            return;
                          }
                          setBusy(true);
                          try {
                            await request(
                              `/calendar/events/${selected.id}?version=${selected.version}`,
                              json("DELETE"),
                            );
                            await reload();
                            setSelected(null);
                            setDeleting(false);
                            toast.success("Event deleted");
                          } catch (e) {
                            setActionError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                        {deleting ? "Confirm delete" : "Delete"}
                      </Button>
                    </>
                  )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
