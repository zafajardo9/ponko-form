import { createServerFn } from '@tanstack/react-start'
import {
  assistantRequestSchema,
  type AIAssistantResponse,
} from '../ai/contracts'

export const chatWithBuilderAI = createServerFn({ method: 'POST' })
  .validator((data: unknown) => assistantRequestSchema.parse(data))
  .handler(async ({ data }): Promise<AIAssistantResponse> => {
    const [{ currentAuth: auth }, { assertFormEditor }, provider] = await Promise.all([
      import('../auth.server'),
      import('./flow-helpers'),
      import('../ai/provider.server'),
    ])
    const { userId } = await auth()
    if (!userId) {
      return { kind: 'error', code: 'unauthorized', message: 'Sign in again to use the assistant.' }
    }
    try {
      await assertFormEditor(data.formId, userId)
    } catch {
      return { kind: 'error', code: 'unauthorized', message: 'You do not have permission to use AI on this form.' }
    }

    try {
      return await provider.runAIAssistant(data)
    } catch (error) {
      if (error instanceof provider.AIProviderError) {
        if (error.category === 'authentication') {
          return {
            kind: 'error',
            code: 'not_configured',
            message: 'The assistant is not available yet. Ask the workspace administrator to activate it.',
          }
        }
        if (error.category === 'rate_limited') {
          return { kind: 'error', code: 'rate_limited', message: 'The assistant is busy right now. Try again shortly.' }
        }
        if (error.category === 'invalid_output') {
          return {
            kind: 'error',
            code: 'invalid_output',
            message: 'The assistant could not prepare a usable response. Rephrase your request and try again.',
          }
        }
      }
      return {
        kind: 'error',
        code: 'temporarily_unavailable',
        message: 'The assistant could not respond right now. Your form has not been changed.',
      }
    }
  })
