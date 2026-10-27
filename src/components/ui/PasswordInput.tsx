import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordInput({
  visibilityLabel = "password",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  visibilityLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-input-control">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-visibility"
        aria-label={`${visible ? "Hide" : "Show"} ${visibilityLabel}`}
        aria-pressed={visible}
        disabled={props.disabled}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </span>
  );
}
