// Sends the e-mails of the app, for now only the link that confirms a new e-mail address.
// The real sending service is the next task ("E-mail service"). Until it is set up, the message is written to the
// server's log instead, so the link can still be opened while we develop. Never send a link anywhere else.
export interface Mail {
  to: string
  subject: string
  text: string
}

export async function sendMail(mail: Mail): Promise<void> {
  console.log(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`);
}
