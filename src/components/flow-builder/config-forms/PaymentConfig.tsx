import { Field, Select, VariableSelect, type ConfigFormProps } from './controls'

const CURRENCIES = ['USD', 'PHP', 'EUR', 'GBP', 'SGD', 'AUD']

/**
 * Config form for a Payment node: amount variable + currency.
 *
 * The gateway is NOT chosen here. At checkout the visitor picks from whichever
 * payment methods YOU (the form owner) have connected in Settings (PayPal,
 * Xendit) — using your own credentials. So a Payment node just needs to know
 * what to charge.
 */
export function PaymentConfig({ config, variables, onChange }: ConfigFormProps) {
  const amountVar = config.amountVariable as string | undefined
  const currency = (config.currency as string) ?? 'USD'

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
