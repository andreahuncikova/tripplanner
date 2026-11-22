import { useId } from 'react'
import { COMMON_CURRENCIES, useCurrencies } from '../lib/currencies'
import { cn } from '../lib/cn'

export interface CurrencySelectProps {
  label: string
  value: string
  onChange: (code: string) => void
  // The label above the field: text-md on New trip, text-sm in a dialog
  labelClassName?: string
}

// The group's currency, as on the New trip screen and in Trip settings. About 160 currencies are too many to scroll,
// so the common ones come first. ExchangeRate-API asks for a credit link wherever its rates are used.
export function CurrencySelect({ label, value, onChange, labelClassName = 'text-md font-bold' }: CurrencySelectProps) {
  const id = useId()
  const { options, source } = useCurrencies()
  const common = COMMON_CURRENCIES.map(code => options.find(o => o.code === code)).filter(o => o !== undefined)
  const others = options.filter(o => !COMMON_CURRENCIES.includes(o.code))

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelClassName}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full min-w-0 rounded-md border border-line-strong bg-white px-4 py-3.5 text-base text-roche focus:border-sommet focus:ring-1 focus:ring-sommet focus:outline-none"
      >
        <optgroup label="Common">
          {common.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
        </optgroup>
        <optgroup label={`All currencies (${options.length})`}>
          {others.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
        </optgroup>
      </select>
      <p className={cn('text-caption text-muted', source !== 'exchangerate-api' && 'sr-only')}>
        {source === 'exchangerate-api'
          ? <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="text-muted underline hover:text-roche">Rates By Exchange Rate API</a>
          : 'Exchange rates from the European Central Bank'}
      </p>
    </div>
  )
}
