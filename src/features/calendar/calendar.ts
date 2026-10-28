export const eventKinds = [
  "Meeting",
  "Call",
  "Appointment",
  "Task",
  "Reminder",
] as const;
export type EventKind = (typeof eventKinds)[number];
export type CalendarView = "Month" | "Week" | "Agenda";
export interface DiaryEvent {
  id: string;
  title: string;
  description: string;
  kind: EventKind | "Follow-up";
  status: "Scheduled" | "Completed" | "Cancelled";
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string;
  meetingUrl: string;
  contactId: string | null;
  productId: string | null;
  participantIds: string[];
  reminderMinutes: number | null;
  createdBy: string;
  version: number;
  source?: "follow-up";
  followUpId?: string;
}
export type EventInput = Omit<
  DiaryEvent,
  "id" | "createdBy" | "version" | "source" | "followUpId"
>;
const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Johannesburg",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const clock = (iso: string) =>
  new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
export function dayKey(iso: string | Date): string {
  const parts = Object.fromEntries(
    dateParts
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function addDays(day: string, delta: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}
export function addMonths(day: string, delta: number) {
  const date = new Date(`${day.slice(0, 7)}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  const last = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(Number(day.slice(8)), last));
  return date.toISOString().slice(0, 10);
}
export const midnight = (day: string) => `${day}T00:00:00+02:00`;
export function calendarRange(view: CalendarView, day: string) {
  const first = view === "Month" ? `${day.slice(0, 7)}-01` : day;
  const weekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const start = view === "Agenda" ? first : addDays(first, -weekday);
  const count = view === "Month" ? 42 : view === "Week" ? 7 : 30;
  return {
    start,
    end: addDays(start, count),
    days: Array.from({ length: count }, (_, i) => addDays(start, i)),
  };
}
export function onDay(event: DiaryEvent, day: string) {
  return (
    new Date(event.startsAt).getTime() <
      new Date(midnight(addDays(day, 1))).getTime() &&
    new Date(event.endsAt).getTime() > new Date(midnight(day)).getTime()
  );
}
export function prettyDay(
  day: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  },
) {
  return new Intl.DateTimeFormat("en-ZA", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
export function layoutDayEvents(events: DiaryEvent[], day: string) {
  const start = new Date(midnight(day)).getTime();
  const items = events
    .filter((e) => !e.allDay && onDay(e, day))
    .map((event) => ({
      event,
      start: Math.max(0, (new Date(event.startsAt).getTime() - start) / 60000),
      end: Math.min(1440, (new Date(event.endsAt).getTime() - start) / 60000),
      lane: 0,
      lanes: 1,
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let group: typeof items = [];
  let groupEnd = -1;
  const finish = () => {
    const lanes = Math.max(1, ...group.map((i) => i.lane + 1));
    group.forEach((i) => {
      i.lanes = lanes;
    });
  };
  for (const item of items) {
    if (item.start >= groupEnd) {
      finish();
      group = [];
      groupEnd = -1;
    }
    const occupied = new Set(
      group.filter((i) => i.end > item.start).map((i) => i.lane),
    );
    while (occupied.has(item.lane)) item.lane++;
    group.push(item);
    groupEnd = Math.max(groupEnd, item.end);
  }
  finish();
  return items;
}
export function icalEvent(event: DiaryEvent) {
  const escape = (value: string) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  const utc = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CRM//Team Diary//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}@crm.local`,
    `DTSTAMP:${utc(new Date().toISOString())}`,
    `SUMMARY:${escape(event.title)}`,
  ];
  if (event.allDay)
    lines.push(
      `DTSTART;VALUE=DATE:${dayKey(event.startsAt).replaceAll("-", "")}`,
      `DTEND;VALUE=DATE:${dayKey(event.endsAt).replaceAll("-", "")}`,
    );
  else
    lines.push(`DTSTART:${utc(event.startsAt)}`, `DTEND:${utc(event.endsAt)}`);
  lines.push(
    `DESCRIPTION:${escape(event.description)}`,
    `LOCATION:${escape(event.location)}`,
    `STATUS:${event.status === "Cancelled" ? "CANCELLED" : "CONFIRMED"}`,
  );
  if (event.meetingUrl) lines.push(`URL:${event.meetingUrl}`);
  if (event.reminderMinutes !== null && event.status === "Scheduled")
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escape(event.title)}`,
      `TRIGGER:-PT${event.reminderMinutes}M`,
      "END:VALARM",
    );
  lines.push("END:VEVENT", "END:VCALENDAR");
  return (
    lines
      .map((line) => {
        const chunks: string[] = [];
        let chunk = "";
        let bytes = 0;
        for (const char of line) {
          const size = new TextEncoder().encode(char).length;
          if (bytes + size > 75) {
            chunks.push(chunk);
            chunk = " ";
            bytes = 1;
          }
          chunk += char;
          bytes += size;
        }
        chunks.push(chunk);
        return chunks.join("\r\n");
      })
      .join("\r\n") + "\r\n"
  );
}
export function downloadFile(
  name: string,
  text: string,
  type = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
