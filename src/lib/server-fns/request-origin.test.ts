import { describe, expect, it } from 'vitest'
import { configuredDeploymentOrigin } from './request-origin'

describe('configured deployment origin', () => {
  it('supports explicit, Render, and scheme-less Vercel URLs', () => {
    expect(configuredDeploymentOrigin({ APP_URL: 'https://forms.example/path' })).toBe('https://forms.example')
    expect(configuredDeploymentOrigin({ RENDER_EXTERNAL_URL: 'https://ponkoform.onrender.com' }))
      .toBe('https://ponkoform.onrender.com')
    expect(configuredDeploymentOrigin({ VERCEL_URL: 'ponkoform-preview.vercel.app' }))
      .toBe('https://ponkoform-preview.vercel.app')
  })

  it('falls through invalid values and has a local default', () => {
    expect(configuredDeploymentOrigin({ APP_URL: '://invalid', VERCEL_URL: 'valid.vercel.app' }))
      .toBe('https://valid.vercel.app')
    expect(configuredDeploymentOrigin({})).toBe('http://localhost:3000')
  })
})
