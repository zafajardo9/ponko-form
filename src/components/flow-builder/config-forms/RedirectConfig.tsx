import { useEffect, useState } from 'react'
import { Field, textInputClass, type ConfigFormProps } from './controls'

/** Config form for a Redirect node: a URL template with a variable picker. */
export function RedirectConfig({ nodeId, config, variables, onChange }: ConfigFormProps) {
  const [url, setUrl] = useState((config.urlTemplate as string) ?? '')

  useEffect(() => setUrl((config.urlTemplate as string) ?? ''), [nodeId])

  function commit(next: string) {
    setUrl(next)
    onChange({ urlTemplate: next })
  }

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="URL template"
        hint="e.g. https://example.com/access?ref={{payment_ref}}&name={{customer_name}}"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => commit(url)}
          placeholder="https://example.com/?ref={{payment_ref}}"
          className={textInputClass}
        />
      </Field>

      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => (
          <button
            key={v.id}
            onClick={() => commit(`${url}{{${v.name}}}`)}
            className="rounded-md border border-[#e6dfd8] bg-white px-2 py-1 text-xs text-[#57544d] hover:border-[#cc785c]"
          >
            {v.name}
          </button>
        ))}
      </div>
    </div>
  )
}
