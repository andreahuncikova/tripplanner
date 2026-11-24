import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mailHtml, sendMail } from '../src/mailer';

const mail = {
  to: 'mia@example.com',
  subject: 'Confirm your new e-mail for TripPlanner',
  text: 'Hi Mia <3,\n\nopen the link.',
  button: { label: 'Confirm my new e-mail', url: 'https://tripplanner.app/confirm-email?token=abc' },
};

describe('sending e-mails with Resend', () => {
  beforeEach(() => { vi.stubEnv('RESEND_API_KEY', 're_test'); vi.stubEnv('MAIL_FROM', ''); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('sends the e-mail with the key, the test sender, a plain text with the link and an HTML version', async () => {
    const fetch = vi.fn(async () => new Response('{"id":"1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await sendMail(mail);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ from: 'TripPlanner <onboarding@resend.dev>', to: ['mia@example.com'], subject: mail.subject });
    expect(body.text).toContain('Confirm my new e-mail: https://tripplanner.app/confirm-email?token=abc');
    expect(body.html).toContain('href="https://tripplanner.app/confirm-email?token=abc"');
  });

  it('uses our own sender when MAIL_FROM is set', async () => {
    vi.stubEnv('MAIL_FROM', 'TripPlanner <hello@tripplanner.dk>');
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await sendMail(mail);
    expect(JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body)).from).toBe('TripPlanner <hello@tripplanner.dk>');
  });

  it('throws when Resend refuses the e-mail, so the user can be told', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"You can only send testing emails to your own email address"}', { status: 403 })));
    await expect(sendMail(mail)).rejects.toThrow(/Resend 403/);
  });

  it('only writes the e-mail to the log without a key', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await sendMail(mail);
    expect(fetch).not.toHaveBeenCalled();
    expect(log.mock.calls[0][0]).toContain('mia@example.com');
  });

  it('escapes names in the HTML, so they cannot add markup', () => {
    expect(mailHtml(mail)).toContain('Hi Mia &lt;3,');
    expect(mailHtml(mail)).not.toContain('<3');
  });
});
