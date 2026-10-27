import { useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { signIn } from "../../services/http";
import { useUI } from "../../store/ui";
import { Button } from "../../components/ui/primitives";
export function Login() {
  const login = useUI((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="login">
      <div className="login-story">
        <div className="login-company">
          <img
            src="/brand/ice-logo.png"
            alt="Industrial Computing Engineering"
          />
          <span>RELATIONSHIP MANAGEMENT</span>
        </div>
        <div className="login-message">
          <span className="eyebrow">
            <span />
            THE FUTURE IS BUILT ON CONNECTIONS.
          </span>
          <h1>
            Great relationships.
            <br />
            Extraordinary
            <br />
            <em>possibilities.</em>
          </h1>
          <p>
            Your people, products, and opportunities.
            <br />
            One workspace to move them forward.
          </p>
          <div className="login-architecture" aria-hidden="true">
            <span>01 / CONNECT</span>
            <div />
            <span>02 / BUILD</span>
            <div />
            <span>03 / GROW</span>
          </div>
        </div>
        <div className="login-story-footer">
          <span>INDUSTRIAL COMPUTING ENGINEERING</span>
          <span>EST. 2012 / SOUTH AFRICA</span>
        </div>
      </div>
      <div className="login-panel">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setLoading(true);
            try {
              const user = await signIn(email.trim(), password);
              login(user.id);
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setLoading(false);
            }
          }}
        >
          <span className="login-welcome">ICE / BUSINESS DEVELOPMENT</span>
          <h2>Welcome back</h2>
          <p>Your next opportunity is waiting. Let’s get to work.</p>
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                type={visible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                aria-label={visible ? "Hide password" : "Show password"}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error && <p className="field-error">{error}</p>}
          <Button variant="primary" loading={loading} type="submit">
            Sign in to ICE <ArrowRight size={16} />
          </Button>
          <p className="login-access-note">
            Use the account provided by your workspace administrator.
          </p>
        </form>
        <small className="login-bottom">
          ICE CRM · Industrial Computing Engineering
        </small>
      </div>
    </div>
  );
}
