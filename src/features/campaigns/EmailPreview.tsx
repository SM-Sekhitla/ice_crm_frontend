import { sanitizeEmailHtml } from "../../lib/email-html";
export { sanitizeEmailHtml } from "../../lib/email-html";
import type {
  CampaignInput,
  PersonalisationToken,
} from "../../types/campaigns";
import { personalise } from "../../lib/campaigns";

export function EmailPreview({
  draft,
  tokens,
  signatureHtml = "",
  mobile = false,
  sender,
  recipient,
}: {
  draft: Pick<CampaignInput, "subject" | "bodyHtml">;
  tokens: Record<PersonalisationToken, string>;
  signatureHtml?: string;
  mobile?: boolean;
  sender: string;
  recipient: string;
}) {
  const html = sanitizeEmailHtml(personalise(draft.bodyHtml, tokens, true));
  const signature = sanitizeEmailHtml(personalise(signatureHtml, tokens, true));
  return (
    <div className={`campaign-email-preview ${mobile ? "mobile" : ""}`}>
      <div className="campaign-email-header">
        <span className="campaign-preview-logo">ICE</span>
        <span>INDUSTRIAL COMPUTING ENGINEERING</span>
      </div>
      <div className="campaign-email-envelope">
        <strong>
          {personalise(draft.subject, tokens) || "Your subject line"}
        </strong>
        <span>
          <b>From</b>
          {sender}
        </span>
        <span>
          <b>To</b>
          {recipient}
        </span>
      </div>
      <div
        className="campaign-email-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {signature && (
        <div
          className="campaign-signature-content"
          dangerouslySetInnerHTML={{ __html: signature }}
        />
      )}
      <div className="campaign-email-footer">
        Personalised preview · Previewing does not send email
      </div>
    </div>
  );
}
