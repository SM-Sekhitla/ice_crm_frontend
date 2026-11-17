export interface ContactIntakeLink {
  enabled: boolean;
  url: string | null;
}
export interface IntakeDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
}
export function intakeToken(hash: string) {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("token") ?? "";
  return /^[A-Za-z0-9_-]{64}$/.test(token) ? token : "";
}
