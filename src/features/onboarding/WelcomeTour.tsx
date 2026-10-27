import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useCRM } from "../../app/context";
import { Button } from "../../components/ui/primitives";
import { getTourSteps } from "./steps";
import { json, request } from "../../services/http";

export function WelcomeTour() {
  const { user, refresh } = useCRM();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const steps = useMemo(() => getTourSteps(user), [user]);
  const current = step ? steps[step - 1] : null;
  useEffect(() => {
    if (!current) {
      setAnchor(null);
      return;
    }
    void navigate({ to: current.path });
    let frame = 0;
    const position = () => {
      const element = document.querySelector<HTMLElement>(
        `[data-tour="${current.path}"]`,
      );
      const rectangle = element?.getBoundingClientRect();
      setAnchor(
        rectangle &&
          rectangle.width > 0 &&
          rectangle.left >= 0 &&
          rectangle.right < window.innerWidth
          ? rectangle
          : null,
      );
    };
    const target = document.querySelector<HTMLElement>(
      `[data-tour="${current.path}"]`,
    );
    if (
      window.innerWidth > 900 &&
      target &&
      target.getBoundingClientRect().left >= 0
    )
      target.scrollIntoView({ block: "nearest" });
    frame = requestAnimationFrame(() => {
      position();
    });
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [current?.path, navigate]);
  async function finish() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request("/auth/onboarding/complete", json("POST"));
      setVisible(false);
      await refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const placed = anchor && window.innerWidth > 900;
  return (
    <Dialog.Root
      open={visible}
      onOpenChange={(open) => {
        if (!open) void finish();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="onboarding-overlay" />
        {placed && (
          <div
            className="onboarding-highlight"
            aria-hidden="true"
            style={{
              left: anchor.left - 4,
              top: anchor.top - 3,
              width: anchor.width + 8,
              height: anchor.height + 6,
            }}
          />
        )}
        <Dialog.Content
          className={`onboarding-card ${placed ? "onboarding-anchored" : ""}`}
          style={
            placed
              ? {
                  left: Math.min(anchor.right + 22, window.innerWidth - 396),
                  top: Math.max(
                    20,
                    Math.min(anchor.top - 20, window.innerHeight - 330),
                  ),
                }
              : undefined
          }
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <span className="onboarding-eyebrow">
            <Sparkles size={15} />
            {step
              ? `QUICK TOUR · ${step} OF ${steps.length}`
              : "YOUR WORKSPACE IS READY"}
          </span>
          <Dialog.Title>
            {current?.title ?? `Welcome, ${user.firstName}!`}
          </Dialog.Title>
          <Dialog.Description>
            {current?.text ??
              "Your password is set and you’re signed in. Take a quick look around the modules you’ll use to grow your relationships."}
          </Dialog.Description>
          {error && (
            <>
              <p className="field-error" role="alert">
                {error}
              </p>
              <button className="text-link" onClick={() => setVisible(false)}>
                Close for now
              </button>
            </>
          )}
          <div className="onboarding-progress" aria-hidden="true">
            {steps.map((item, index) => (
              <span key={item.path} className={index < step ? "visited" : ""} />
            ))}
          </div>
          <div className="onboarding-actions">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void finish()}
            >
              Skip tour
            </Button>
            {step > 0 && (
              <Button
                disabled={busy}
                onClick={() => setStep((value) => value - 1)}
              >
                Back
              </Button>
            )}
            <Button
              variant="primary"
              loading={busy}
              onClick={() =>
                step === steps.length
                  ? void finish()
                  : setStep((value) => value + 1)
              }
            >
              {step === steps.length ? (
                <>
                  Finish <Check size={15} />
                </>
              ) : (
                <>
                  {step ? "Next" : "Show me around"}
                  <ArrowRight size={15} />
                </>
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
