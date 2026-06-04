import { Field, Select, VariableSelect, type ConfigFormProps } from './controls'

const CURRENCIES = ['USD', 'PHP', 'EUR', 'GBP', 'SGD', 'AUD']

/** Config form for a Payment node: amount variable, currency, and gateway. */
export function PaymentConfig({ config, variables, onChange, gateways = [] }: ConfigFormProps) {
  const amountVar = config.amountVariable as string | undefined
  const currency = (config.currency as string) ?? 'USD'
  const gatewayId = config.gatewayId as number | undefined
  const gatewayName = gateways.find((g) => g.id === gatewayId)?.name

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
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Payment gateway">
        <Select
          value={gatewayId ? String(gatewayId) : ''}
          onChange={(v) => onChange({ gatewayId: v ? Number(v) : null })}
        >
          <option value="">Select a gateway…</option>
          {gateways.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        {gateways.length === 0 && (
          <p className="text-xs text-[#c64545]">
            No active payment gateways. Add one before publishing a payment flow.
          </p>
        )}
      </Field>

      {amountVar && gatewayName && (
        <p className="rounded-lg border border-[#e6dfd8] bg-white px-3 py-2 text-xs text-[#57544d]">
          Will charge <span className="font-medium">{`{{${amountVar}}}`}</span> {currency} via{' '}
          <span className="font-medium">{gatewayName}</span>.
        </p>
      )}
    </div>
  )
}
