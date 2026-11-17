import { useEffect, useMemo, useState } from 'react'
import type { FxRates, FxSource } from '@shared/types'
import { api } from './api'

// Used when the server's currency list cannot be loaded
const FALLBACK_CURRENCIES = ['EUR', 'DKK', 'USD', 'GBP', 'SEK', 'NOK', 'CHF', 'CZK', 'PLN', 'HUF', 'JPY', 'CAD', 'AUD']
// Shown first in the lists: the currencies groups in our survey travel with most (Danish and European trips)
export const COMMON_CURRENCIES = ['EUR', 'DKK', 'SEK', 'NOK', 'GBP', 'USD', 'CHF', 'PLN', 'CZK', 'HUF']

export interface CurrencyOption {
  code: string
  // "DKK — Danish Krone", or only the code when the browser has no name for it
  label: string
}

// The exchange rates from the server (the server keeps them for six hours); null while they load or when they failed
export function useFxRates(): FxRates | null {
  const [fx, setFx] = useState<FxRates | null>(null)
  useEffect(() => {
    api<FxRates>('/api/fx-rates').then(setFx).catch(() => setFx(null))
  }, [])
  return fx
}

// The currencies the server has exchange rates for, so the budget can convert every one of them
// (New trip, Trip settings and Add expense). The browser adds the names in English.
export function useCurrencies(): { options: CurrencyOption[]; source: FxSource | null } {
  const fx = useFxRates()
  const options = useMemo(() => {
    const codes = fx ? Object.keys(fx.rates).sort() : FALLBACK_CURRENCIES
    const names = new Intl.DisplayNames(['en'], { type: 'currency' })
    return codes.map(code => {
      const name = names.of(code)
      return { code, label: name && name !== code ? `${code} — ${name}` : code }
    })
  }, [fx])
  return { options, source: fx?.source ?? null }
}
