import { useEffect, useMemo, useState } from 'react'
import { api } from './api'

// Used when the server's currency list cannot be loaded
const FALLBACK_CURRENCIES = ['EUR', 'DKK', 'USD', 'GBP', 'SEK', 'NOK', 'CHF', 'CZK', 'PLN', 'HUF', 'JPY', 'CAD', 'AUD']

// The currencies the server has exchange rates for, so the budget can convert every one of them,
// as options like { code: "DKK", label: "DKK — Danish Krone" } (New trip and Trip settings)
export function useCurrencies() {
  const [codes, setCodes] = useState<string[]>(FALLBACK_CURRENCIES)
  useEffect(() => {
    api<Record<string, number>>('/api/fx-rates')
      .then(rates => setCodes(Object.keys(rates).sort()))
      .catch(() => setCodes(FALLBACK_CURRENCIES))
  }, [])
  return useMemo(() => {
    const names = new Intl.DisplayNames(['en'], { type: 'currency' })
    return codes.map(code => ({ code, label: `${code} — ${names.of(code) ?? code}` }))
  }, [codes])
}
