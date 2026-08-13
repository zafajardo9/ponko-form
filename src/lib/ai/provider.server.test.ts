import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runAIAssistant } from './provider.server'
import type { AIAssistantRequest } from './contracts'

const request: AIAssistantRequest = {
  formId: 10,
  mode: 'guide',
  messages: [{ role: 'user', content: 'How should I collect an email?' }],
  draft: {
    formTitle: null,
    pages: [{ title: 'Page 1', description: null, isFinal: false, fields: [] }],
    references: [],
  },
}

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'gemini-secret'
  process.env.DEEPSEEK_API_KEY = 'deepseek-secret'
  process.env.GEMINI_MODEL = 'gemini-3.6-flash'
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash'
})

afterEach(() => {
  vi.unstubAllGlobals()
  process.env = { ...originalEnv }
})

describe('runAIAssistant', () => {
  it('uses Gemini for Guide answers without exposing routing data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Use the Email field for built-in validation.' }] } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await runAIAssistant(request)
    expect(result).toEqual({
      kind: 'answer',
      message: 'Use the Email field for built-in validation.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('generativelanguage.googleapis.com')
    expect(JSON.stringify(result)).not.toContain('gemini')
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body.generationConfig).toEqual({ maxOutputTokens: 1_200 })
  })

  it('uses DeepSeek JSON mode for Generate Form requests', async () => {
    const generationRequest: AIAssistantRequest = {
      ...request,
      mode: 'generate',
      messages: [{ role: 'user', content: 'Create a contact form.' }],
    }
    const generated = {
      message: 'A contact form is ready.',
      candidate: {
        pages: [
          {
            title: 'Contact',
            description: null,
            isFinal: false,
            finalTemplate: null,
            fields: [{
              fieldType: 'email',
              label: 'Email',
              placeholder: 'name@example.com',
              required: true,
              options: null,
              bindVariable: 'email',
              width: 'full',
              validationRules: null,
            }],
          },
          {
            title: 'Thank you',
            description: null,
            isFinal: true,
            finalTemplate: '<p>We will be in touch.</p>',
            fields: [],
          },
        ],
      },
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(generated) } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await runAIAssistant(generationRequest)
    expect(result).toMatchObject({ kind: 'generation', message: 'A contact form is ready.' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.deepseek.com/chat/completions')
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body).toMatchObject({
      model: 'deepseek-v4-flash',
      response_format: { type: 'json_object' },
    })
  })

  it('does not send Guide questions to DeepSeek when Gemini is unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(runAIAssistant(request)).rejects.toMatchObject({
      category: 'unavailable',
      retryable: true,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('requires the provider key assigned to each mode', async () => {
    delete process.env.GEMINI_API_KEY
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(runAIAssistant(request)).rejects.toMatchObject({
      category: 'authentication',
      retryable: false,
    })

    process.env.GEMINI_API_KEY = 'gemini-secret'
    delete process.env.DEEPSEEK_API_KEY
    await expect(runAIAssistant({ ...request, mode: 'generate' })).rejects.toMatchObject({
      category: 'authentication',
      retryable: false,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
