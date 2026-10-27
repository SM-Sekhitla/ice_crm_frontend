import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/primitives";
import {
  activateAccount,
  ApiError,
  verifyInvitation,
} from "../../services/http";
import { useUI } from "../../store/ui";

export function ActivateAccount() {
  const navigate = useNavigate();
  const [token] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "",
  );
  const [state, setState] = useState<
    "checking" | "valid" | "invalid" | "unavailable"
  >("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    // Keep the token out of browser history after reading it. It is never sent in a URL or stored.
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
    let active = true;
    if (!token) {
      setState("invalid");
      return;
    }
    setState("checking");
    verifyInvitation(token)
      .then(() => {
        if (active) setState("valid");
      })
      .catch((error) => {
        if (active)
          setState(
            error instanceof ApiError && error.status === 400
              ? "invalid"
              : "unavailable",
          );
      });
    return () => {
      active = false;
    };
  }, [token, attempt]);
  return (
    <div className="activation-page">
      <main className="activation-card">
        <div className="activation-brand">
          ICE <span>RELATIONSHIP MANAGEMENT</span>
        </div>
        <div className="activation-icon">
          <ShieldCheck size={25} />
        </div>
        {state === "checking" ? (
          <>
            <h1>Checking your invitation…</h1>
            <p>Please wait a moment.</p>
          </>
        ) : state === "invalid" ? (
          <>
            <h1>Invitation unavailable</h1>
            <p>
              This link is invalid, expired, or already used. If you already set
              your password, sign in. Otherwise ask your administrator to send a
              new invitation.
            </p>
            <Link to="/">Return to sign in</Link>
          </>
        ) : state === "unavailable" ? (
          <>
            <h1>Cannot check your invitation</h1>
            <p>We couldn’t reach the server. Your link has not been used.</p>
            <Button onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <h1>Set your password</h1>
            <p>
              Choose a password with 12–128 characters to activate your account.
            </p>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                if (password !== confirmation) {
                  setError("The passwords do not match.");
                  return;
                }
                setBusy(true);
                try {
                  const user = await activateAccount(
                    token,
                    password,
                    confirmation,
                  );
                  setPassword("");
                  setConfirmation("");
                  useUI.getState().login(user.id);
                  await navigate({ to: "/", replace: true });
                } catch (error) {
                  if (error instanceof ApiError && error.status === 400)
                    setState("invalid");
                  else setError((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={12}
                  maxLength={128}
                  required
                  disabled={busy}
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  minLength={12}
                  maxLength={128}
                  required
                  disabled={busy}
                />
              </label>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" loading={busy}>
                Set password and log in <ArrowRight size={16} />
              </Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
