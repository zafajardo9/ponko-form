import { config } from 'dotenv'
config()
config({ path: '.env.local', override: true })

import { runAIAssistant, AIProviderError } from './src/lib/ai/provider.server'
import type { AIAssistantRequest } from './src/lib/ai/contracts'

const base: AIAssistantRequest = {
  formId: 1,
  mode: 'guide',
  messages: [{ role: 'user', content: 'What fields does my form have?' }],
  draft: {
    formTitle: 'Workshop Registration',
    pages: [
      {
        title: 'Registration',
        description: null,
        isFinal: false,
        fields: [
          { fieldType: 'text', label: 'Full name', required: true, bindVariable: 'full_name', placeholder: null, options: null, width: 'full' },
        ],
      },
      { title: 'Done', description: null, isFinal: true, fields: [] },
    ],
    references: [{ key: 'vat_rate', type: 'percentage', value: '12', label: 'VAT rate', description: 'Tax applied to orders' }],
  },
}

async function probe(name: string, request: AIAssistantRequest) {
  console.log(`\n=== ${name} ===`)
  const started = Date.now()
  try {
    const result = await runAIAssistant(request)
    console.log(`OK (${Date.now() - started}ms):`, JSON.stringify(result).slice(0, 400))
  } catch (error) {
    console.log(`FAILED (${Date.now() - started}ms):`)
    if (error instanceof AIProviderError) {
      console.log('  category:', error.category, '| retryable:', error.retryable, '|', error.message)
    } else {
      console.log('  unexpected:', String(error).slice(0, 600))
    }
  }
}

await probe('GUIDE (Gemini)', base)
await probe('GENERATE (DeepSeek)', {
  ...base,
  mode: 'generate',
  messages: [{ role: 'user', content: 'Create a simple registration form with one name field and one email field.' }],
})
