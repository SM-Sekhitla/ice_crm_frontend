import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { Brand } from "../../components/shared/Brand";
import { Button } from "../../components/ui/primitives";
import { submitContactIntake, verifyContactIntake } from "../../services/http";
import { intakeToken, type IntakeDetails } from "./links";

export function PublicContactForm() {
  const [token, setToken] = useState(() => intakeToken(window.location.hash));
  const [status, setStatus] = useState<
    "checking" | "ready" | "unavailable" | "done"
  >("checking");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const change = () => setToken(intakeToken(window.location.hash));
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    let active = true;
    setError("");
    setStatus("checking");
    if (!token) {
      setStatus("unavailable");
      return;
    }
    void verifyContactIntake(token)
      .then(() => {
        if (active) setStatus("ready");
      })
      .catch((error: Error) => {
        if (active) {
          setStatus("unavailable");
          setError(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, [token]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const details = Object.fromEntries(
      ["firstName", "lastName", "email", "phone", "company", "jobTitle"].map(
        (key) => [key, String(form.get(key) ?? "").trim()],
      ),
    ) as unknown as IntakeDetails;
    setBusy(true);
    setError("");
    try {
      await submitContactIntake(token, details);
      setStatus("done");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="contact-intake-page">
      <section className="contact-intake-card" aria-labelledby="intake-title">
        <header className="contact-intake-brand">
          <Brand />
          <span>LET’S CONNECT</span>
        </header>
        {status === "checking" ? (
          <div className="contact-intake-state" role="status">
            <LoaderCircle className="spin" size={26} />
            <h1 id="intake-title">Opening your form…</h1>
          </div>
        ) : status === "done" ? (
          <div className="contact-intake-state" role="status">
            <span className="contact-intake-success">
              <Check size={28} />
            </span>
            <h1 id="intake-title">Lovely to meet you.</h1>
            <p>
              Your details have been received by our team. You can close this
              page.
            </p>
          </div>
        ) : status === "unavailable" ? (
          <div className="contact-intake-state">
            <h1 id="intake-title">We couldn’t open this form.</h1>
            <p>
              {error || "Please ask your contact to share their QR code again."}
            </p>
            <Button onClick={() => window.location.reload()}>Try again</Button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="contact-intake-heading">
              <span className="eyebrow">A NEW CONNECTION STARTS HERE</span>
              <h1 id="intake-title">Tell us about yourself.</h1>
              <p>Share your details so our team can get in touch.</p>
            </div>
            <fieldset disabled={busy} className="contact-intake-fields">
              <legend className="sr-only">Your contact details</legend>
              <div className="form-grid">
                <label>
                  First name *
                  <input
                    name="firstName"
                    autoComplete="given-name"
                    required
                    maxLength={100}
                  />
                </label>
                <label>
                  Last name *
                  <input
                    name="lastName"
                    autoComplete="family-name"
                    required
                    maxLength={100}
                  />
                </label>
              </div>
              <label>
                Email address *
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  inputMode="email"
                />
              </label>
              <label>
                Phone number{" "}
                <span className="contact-intake-optional">Optional</span>
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={50}
                />
              </label>
              <label>
                Company{" "}
                <span className="contact-intake-optional">Optional</span>
                <input
                  name="company"
                  autoComplete="organization"
                  maxLength={200}
                />
              </label>
              <label>
                Job title{" "}
                <span className="contact-intake-optional">Optional</span>
                <input
                  name="jobTitle"
                  autoComplete="organization-title"
                  maxLength={150}
                />
              </label>
            </fieldset>
            {error && (
              <p className="field-error contact-intake-error" role="alert">
                {error}
              </p>
            )}
            <div className="contact-intake-submit">
              <Button type="submit" variant="primary" loading={busy}>
                Share my details <ArrowRight size={17} />
              </Button>
              <small>
                * Required fields. Your details are shared with our team.
              </small>
            </div>
          </form>
        )}
        <footer className="contact-intake-footer">
          CUSTOMER RELATIONSHIP MANAGEMENT
        </footer>
      </section>
    </main>
  );
}
