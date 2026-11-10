import dns from 'node:dns';

// Some Windows machines give Node a DNS server (127.0.0.1) that does not answer, so the
// mongodb+srv:// lookup fails with "querySrv ECONNREFUSED". DNS_SERVERS (comma-separated,
// e.g. 8.8.8.8,1.1.1.1) makes Node ask those servers instead. Only set it locally, not on Render.
// Imported by db.ts and by the scripts in scripts/, after server/.env is loaded.
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map(s => s.trim()));
}
