import { createServerFn } from '@tanstack/react-start'
import { getDocsList, getDoc } from '../../lib/docs-parser'

export const listDocs = createServerFn({ method: 'GET' }).handler(async () => {
  return getDocsList()
})

export const loadDoc = createServerFn({ method: 'GET' })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    return getDoc(data.slug)
  })
