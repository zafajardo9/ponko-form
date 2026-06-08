import { useQuery } from '@tanstack/react-query'
import { Field, Select, VariableSelect, type ConfigFormProps } from './controls'
import { SUPPORTED_CURRENCIES } from '../../../integrations/payments/currencies'
import { getGatewayCurrencySupport } from '../../../lib/server-fns/gateways'
import { getIntegrationSettings } from '../../../lib/server-fns/integrations'

/**
 * Config form for a Payment node: amount variable + currency.
 *
 * The gateway is NOT chosen here. At checkout the visitor picks from whichever
 * payment methods YOU (the form owner) have connected in Settings (PayPal,
 * Xendit) — using your own credentials. So a Payment node just needs to know
 * what to charge.
 *
 * Different gateways accept different currencies (e.g. Xendit only processes
 * PHP), so once a currency is picked we show which connected gateways can
 * actually take it — and warn when one can't.
 */
export function PaymentConfig({ config, variables, onChange }: ConfigFormProps) {
  const amountVar = config.amountVariable as string | undefined
  const currency = (config.currency as string) ?? 'USD'

  const { data: support } = useQuery({
    queryKey: ['gateway-currency-support'],
    queryFn: () => getGatewayCurrencySupport(),
  })
  const { data: settings } = useQuery({
    queryKey: ['integration-settings'],
    queryFn: () => getIntegrationSettings(),
  })

  const connectedSlugs = new Set<string>([
    ...(settings?.paypal.configured ? ['paypal'] : []),
    ...(settings?.xendit.configured ? ['xendit'] : []),
  ])

  return (
    <div className="flex flex-col gap-4">
      <Field label="Amount variable" hint="The value charged at runtime.">
        <VariableSelect
          value={amountVar}
          variables={variables}
          filterTypes={['number', 'money']}
          onChange={(name) => onChange({ amountVariable: name })}
        />
      </Field>

      <Field label="Currency">
        <Select value={currency} onChange={(v) => onChange({ currency: v })}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>

      {support && (
        <CurrencyCompatibility
          currency={currency}
          support={support}
          connectedSlugs={connectedSlugs}
        />
      )}

      <p className="rounded-lg border border-[#e6dfd8] bg-white px-3 py-2 text-xs text-[#57544d]">
        Customers choose how to pay (PayPal, Xendit) from the payment methods you connect in{' '}
        <span className="font-medium">Settings</span>. Connect at least one to accept payments.
      </p>

      {amountVar && (
        <p className="rounded-lg border border-[#e6dfd8] bg-white px-3 py-2 text-xs text-[#57544d]">
          Will charge <span className="font-medium">{`{{${amountVar}}}`}</span> in {currency}.
        </p>
      )}
    </div>
  )
}

/**
 * Shows, for the chosen currency, which gateways can process it. Flags any
 * gateway the creator has connected that won't be offered because it can't take
 * this currency.
 */
function CurrencyCompatibility({
  currency,
  support,
  connectedSlugs,
}: {
  currency: string
  support: { slug: string; name: string; currencies: string[] }[]
  connectedSlugs: Set<string>
}) {
  const rows = support.map((g) => ({
    ...g,
    accepts: g.currencies.includes(currency),
    connected: connectedSlugs.has(g.slug),
  }))

  // Connected gateways that can't take this currency → they won't be offered.
  const unusableConnected = rows.filter((r) => r.connected && !r.accepts)
  // Is there at least one connected gateway that CAN take it?
  const hasUsableConnected = rows.some((r) => r.connected && r.accepts)

  return (
    <div className="rounded-lg border border-[#e6dfd8] bg-white px-3 py-2.5 text-xs text-[#57544d]">
      <p className="font-medium text-[#141413]">Gateways that accept {currency}</p>
      <ul className="mt-1.5 space-y-1">
        {rows.map((r) => (
          <li key={r.slug} className="flex items-center gap-1.5">
            <span aria-hidden className={r.accepts ? 'text-[#2f6f3f]' : 'text-[#c64545]'}>
              {r.accepts ? '✓' : '✗'}
            </span>
            <span>{r.name}</span>
            {r.connected && (
              <span className="rounded-full bg-[#dcefdc] px-1.5 py-px text-[10px] font-medium text-[#2f6f3f]">
                connected
              </span>
            )}
          </li>
        ))}
      </ul>

      {connectedSlugs.size > 0 && !hasUsableConnected && (
        <p className="mt-2 rounded-md bg-[#fbeaea] px-2 py-1.5 text-[#c64545]">
          None of your connected gateways accept {currency}, so customers won’t be able to pay.
          Switch the currency or connect a gateway that supports it.
        </p>
      )}

      {hasUsableConnected && unusableConnected.length > 0 && (
        <p className="mt-2 text-[#8e8b82]">
          {unusableConnected.map((r) => r.name).join(', ')} won’t be offered for {currency}.
        </p>
      )}

      <p className="mt-2 text-[#8e8b82]">
        Automatic conversion for unsupported currencies is coming soon.
      </p>
    </div>
  )
}
