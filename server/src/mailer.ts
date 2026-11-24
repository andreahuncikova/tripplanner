// Sends the e-mails of the app, for now the link that confirms a new e-mail address (routes/auth.ts).
// The e-mails go through Resend (resend.com), whose free plan allows 100 e-mails a day and 3,000 a month.
// RESEND_API_KEY is set in server/.env locally and in Render's Environment, never in the code.
// MAIL_FROM is the sender, e.g. "TripPlanner <hello@our-domain.dk>"; without a domain of our own,
// Resend's test sender onboarding@resend.dev is used, which only delivers to the e-mail of the Resend account.
// Without a key (while developing) the e-mail is written to the server's log instead, so the link can still be opened.

const API = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;
const TEST_SENDER = 'TripPlanner <onboarding@resend.dev>';

export interface Mail {
  to: string
  subject: string
  text: string
  // A button in the HTML version of the e-mail; the text version has the plain link instead
  button?: { label: string; url: string }
}

export const mailEnabled = () => !!process.env.RESEND_API_KEY;

// Names and addresses go into HTML, so <, > and & must not be read as markup
const escape = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// The same text as the plain version, as paragraphs, and the button in the app's colours
export function mailHtml(mail: Mail): string {
  const paragraphs = mail.text.split('\n\n').map(p => `<p style="margin:0 0 16px">${escape(p).replace(/\n/g, '<br>')}</p>`).join('');
  const button = mail.button
    ? `<p style="margin:24px 0"><a href="${escape(mail.button.url)}" style="display:inline-block;background:#485978;color:#ffffff;`
      + `text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">${escape(mail.button.label)}</a></p>`
    : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#232830;max-width:520px">`
    + `<p style="margin:0 0 24px;font-size:20px;font-weight:bold">TripPlanner</p>${paragraphs}${button}</div>`;
}

// Throws when the e-mail could not be sent, so the caller can tell the user instead of waiting for nothing
export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[mail] no RESEND_API_KEY, so not sent. To ${mail.to}: ${mail.subject}\n${mail.text}`);
    return;
  }
  const text = mail.button ? `${mail.text}\n\n${mail.button.label}: ${mail.button.url}` : mail.text;
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || TEST_SENDER, to: [mail.to], subject: mail.subject, text, html: mailHtml(mail) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    // Resend explains the problem in the answer, e.g. that the test sender may only write to the account's own e-mail
    const why = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status} ${why.slice(0, 200)}`);
  }
}
