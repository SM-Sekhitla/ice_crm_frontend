import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  calendarRange,
  dayKey,
  icalEvent,
  layoutDayEvents,
  onDay,
  type DiaryEvent,
} from "./calendar";

const event = (id: string, start: string, end: string): DiaryEvent => ({
  id,
  title: "Client meeting",
  description: "Agenda",
  kind: "Meeting",
  status: "Scheduled",
  startsAt: start,
  endsAt: end,
  allDay: false,
  location: "Office",
  meetingUrl: "",
  contactId: null,
  productId: null,
  participantIds: [],
  reminderMinutes: 15,
  createdBy: "owner",
  version: 1,
});

describe("South African calendar dates", () => {
  it("keeps local days correct across UTC midnight", () => {
    expect(dayKey("2026-10-27T22:30:00Z")).toBe("2026-10-28");
  });
  it("handles leap days and month-end navigation", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
  it("builds complete Monday-first month and week ranges", () => {
    const range = calendarRange("Month", "2026-10-28");
    expect(range.days).toHaveLength(42);
    expect(range.start).toBe("2026-09-28");
    expect(range.end).toBe("2026-11-09");
    expect(calendarRange("Week", "2026-10-28").days).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });
  it("treats all-day end dates as exclusive", () => {
    const e = {
      ...event("a", "2026-10-28T00:00:00+02:00", "2026-10-29T00:00:00+02:00"),
      allDay: true,
    };
    expect(onDay(e, "2026-10-28")).toBe(true);
    expect(onDay(e, "2026-10-29")).toBe(false);
  });
  it("places a cross-midnight booking on both days", () => {
    const e = event(
      "a",
      "2026-10-28T23:30:00+02:00",
      "2026-10-29T00:30:00+02:00",
    );
    expect(onDay(e, "2026-10-28")).toBe(true);
    expect(onDay(e, "2026-10-29")).toBe(true);
    expect(layoutDayEvents([e], "2026-10-29")[0].start).toBe(0);
  });
});
describe("overlapping meetings", () => {
  it("gives simultaneous events separate lanes and frees lanes at the end", () => {
    const items = layoutDayEvents(
      [
        event("a", "2026-10-28T09:00:00+02:00", "2026-10-28T10:00:00+02:00"),
        event("b", "2026-10-28T09:30:00+02:00", "2026-10-28T10:30:00+02:00"),
        event("c", "2026-10-28T11:00:00+02:00", "2026-10-28T12:00:00+02:00"),
      ],
      "2026-10-28",
    );
    expect(items[0].lane).not.toBe(items[1].lane);
    expect(items[0].lanes).toBe(2);
    expect(items[2].lanes).toBe(1);
    expect(items[0].start).toBe(540);
  });
});
describe("calendar-file export", () => {
  it("exports UTC timed events, safe text and reminders", () => {
    const text = icalEvent({
      ...event("one", "2026-10-28T09:00:00+02:00", "2026-10-28T10:00:00+02:00"),
      title: "Demo, next; step",
      description: "Line one\nLine two",
    });
    expect(text).toContain("DTSTART:20261028T070000Z\r\n");
    expect(text).toContain("SUMMARY:Demo\\, next\\; step");
    expect(text).toContain("DESCRIPTION:Line one\\nLine two");
    expect(text).toContain("TRIGGER:-PT15M");
  });
  it("exports all-day dates without a timezone shift", () => {
    const text = icalEvent({
      ...event("one", "2026-10-28T00:00:00+02:00", "2026-10-29T00:00:00+02:00"),
      allDay: true,
    });
    expect(text).toContain("DTSTART;VALUE=DATE:20261028");
    expect(text).toContain("DTEND;VALUE=DATE:20261029");
  });
  it("folds UTF-8 lines at no more than 75 bytes", () => {
    const title = "Réunion 客戶 ".repeat(20);
    const text = icalEvent({
      ...event("one", "2026-10-28T09:00:00Z", "2026-10-28T10:00:00Z"),
      title,
    });
    for (const line of text.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(text.replace(/\r\n /g, "")).toContain(`SUMMARY:${title}`);
  });
});
