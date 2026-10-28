import { useState } from "react";
import { toast } from "sonner";
import { useCRM } from "../../app/context";
import { Button, Modal } from "../../components/ui/primitives";
import { json, request } from "../../services/http";
import {
  addDays,
  clock,
  dayKey,
  eventKinds,
  type DiaryEvent,
  type EventKind,
} from "./calendar";

export function EventForm({
  event,
  day,
  time,
  people,
  peopleError,
  onClose,
  onSaved,
}: {
  event?: DiaryEvent;
  day: string;
  time?: string;
  peopleError?: string;
  people: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { db } = useCRM();
  const [title, setTitle] = useState(event?.title ?? "");
  const [kind, setKind] = useState<EventKind>(
    event && event.kind !== "Follow-up" ? event.kind : "Meeting",
  );
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startDay, setStartDay] = useState(
    event ? dayKey(event.startsAt) : day,
  );
  const [endDay, setEndDay] = useState(
    event
      ? dayKey(
          new Date(new Date(event.endsAt).getTime() - (event.allDay ? 1 : 0)),
        )
      : time === "23:00"
        ? addDays(day, 1)
        : day,
  );
  const [startTime, setStartTime] = useState(
    event ? clock(event.startsAt) : (time ?? "09:00"),
  );
  const [endTime, setEndTime] = useState(
    event
      ? clock(event.endsAt)
      : time
        ? `${String((Number(time.slice(0, 2)) + 1) % 24).padStart(2, "0")}:00`
        : "10:00",
  );
  const [participants, setParticipants] = useState<string[]>(
    event?.participantIds ?? [],
  );
  const attendeeOptions = [
    ...people,
    ...participants
      .filter((id) => !people.some((person) => person.id === id))
      .map((id) => ({ id, name: "Unavailable attendee — uncheck to remove" })),
  ];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const [dirty, setDirty] = useState(false);
  const close = () => {
    if (!busy) {
      if (dirty) setDiscard(true);
      else onClose();
    }
  };
  return (
    <>
      <Modal
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={event ? "Edit event" : "Add to your diary"}
        description="Schedule in South African time (SAST). Events are shared with your CRM team."
      >
        <form
          onChange={() => setDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const form = new FormData(e.currentTarget);
            const startsAt = `${startDay}T${allDay ? "00:00" : startTime}:00+02:00`;
            const endsAt = `${allDay ? addDays(endDay, 1) : endDay}T${allDay ? "00:00" : endTime}:00+02:00`;
            if (new Date(endsAt) <= new Date(startsAt)) {
              setError("The end must be after the start.");
              return;
            }
            setBusy(true);
            try {
              await request(
                `/calendar/events${event ? `/${event.id}` : ""}`,
                json(event ? "PUT" : "POST", {
                  title,
                  kind,
                  allDay,
                  startsAt,
                  endsAt,
                  status: form.get("status"),
                  description: form.get("description"),
                  location: form.get("location"),
                  meetingUrl: form.get("meetingUrl"),
                  contactId: form.get("contactId") || null,
                  productId: form.get("productId") || null,
                  participantIds: participants,
                  reminderMinutes:
                    form.get("reminder") === ""
                      ? null
                      : Number(form.get("reminder")),
                  ...(event ? { version: event.version } : {}),
                }),
              );
              try {
                await onSaved();
                toast.success(
                  event ? "Event updated" : "Event added to your diary",
                );
              } catch {
                toast.info(
                  "Event saved. Refresh the calendar to see the latest bookings.",
                );
              }
              onClose();
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset className="form-body diary-form" disabled={busy}>
            <label>
              Event title *
              <input
                required
                autoFocus
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Product demonstration with a client"
              />
            </label>
            <div className="form-grid">
              <label>
                Type
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as EventKind)}
                >
                  {eventKinds.map((kind) => (
                    <option key={kind}>{kind}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  name="status"
                  defaultValue={event?.status ?? "Scheduled"}
                >
                  <option>Scheduled</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>
              </label>
            </div>
            <label className="diary-checkbox">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              All-day event
            </label>
            <div className="form-grid">
              <label>
                Start date *
                <input
                  type="date"
                  value={startDay}
                  required
                  onChange={(e) => {
                    setStartDay(e.target.value);
                    if (e.target.value > endDay) setEndDay(e.target.value);
                  }}
                />
              </label>
              <label>
                End date *
                <input
                  type="date"
                  value={endDay}
                  min={startDay}
                  required
                  onChange={(e) => setEndDay(e.target.value)}
                />
              </label>
              {!allDay && (
                <>
                  <label>
                    Start time *
                    <input
                      type="time"
                      required
                      step="300"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </label>
                  <label>
                    End time *
                    <input
                      type="time"
                      required
                      step="300"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </label>
                </>
              )}
            </div>
            <div className="form-grid">
              <label>
                Location
                <input
                  name="location"
                  maxLength={250}
                  defaultValue={event?.location ?? ""}
                  placeholder="Office, venue or online"
                />
              </label>
              <label>
                Meeting link
                <input
                  name="meetingUrl"
                  type="url"
                  pattern="https://.*"
                  maxLength={1000}
                  defaultValue={event?.meetingUrl ?? ""}
                  placeholder="https://…"
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Related contact
                <select name="contactId" defaultValue={event?.contactId ?? ""}>
                  <option value="">No linked contact</option>
                  {db.contacts.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.firstName} {c.lastName}
                      {c.company ? ` · ${c.company}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Related product
                <select name="productId" defaultValue={event?.productId ?? ""}>
                  <option value="">No linked product</option>
                  {db.products.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field-group">
              <span>Team attendees</span>
              <span className="form-hint">
                This adds attendees to the diary. It does not send email
                invitations.
              </span>
              <span className="diary-attendees">
                {attendeeOptions.length ? (
                  attendeeOptions.map((person) => (
                    <label key={person.id} className="diary-checkbox">
                      <input
                        type="checkbox"
                        checked={participants.includes(person.id)}
                        onChange={(e) => {
                          setParticipants((ids) =>
                            e.target.checked
                              ? [...ids, person.id]
                              : ids.filter((id) => id !== person.id),
                          );
                          setDirty(true);
                        }}
                      />
                      {person.name}
                    </label>
                  ))
                ) : (
                  <span className="form-hint">No available team members.</span>
                )}
              </span>
              {peopleError && (
                <small className="field-error">
                  Could not load team members: {peopleError}
                </small>
              )}
            </div>
            <label>
              Reminder
              <select
                name="reminder"
                defaultValue={
                  event?.reminderMinutes === null
                    ? ""
                    : (event?.reminderMinutes ?? 15)
                }
              >
                <option value="">No reminder</option>
                <option value="0">At start time</option>
                <option value="5">5 minutes before</option>
                <option value="15">15 minutes before</option>
                <option value="30">30 minutes before</option>
                <option value="60">1 hour before</option>
                <option value="1440">1 day before</option>
              </select>
              <small className="form-hint">
                Reminders appear while Calendar is open. Calendar-file exports
                include the reminder.
              </small>
            </label>
            <label>
              Notes
              <textarea
                name="description"
                rows={3}
                maxLength={4000}
                defaultValue={event?.description ?? ""}
                placeholder="Agenda, preparation or notes for your team…"
              />
            </label>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </fieldset>
          <div className="modal-footer">
            <Button type="button" disabled={busy} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              {event ? "Save changes" : "Add event"}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={discard}
        onOpenChange={setDiscard}
        title="Discard event changes?"
        description="Your unsaved diary changes will be lost."
      >
        <div className="modal-footer">
          <Button onClick={() => setDiscard(false)}>Keep editing</Button>
          <Button variant="danger" onClick={onClose}>
            Discard changes
          </Button>
        </div>
      </Modal>
    </>
  );
}
