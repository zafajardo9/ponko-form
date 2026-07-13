import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: [resolve(import.meta.dirname, '../.env.local'), resolve(import.meta.dirname, '../.env')] })

const [{ db }, { formTemplates }, { BUILTIN_FORM_TEMPLATES }] = await Promise.all([
  import('../src/db/index'),
  import('../src/db/schema'),
  import('../src/lib/form-templates/catalog'),
])

for (const template of BUILTIN_FORM_TEMPLATES) {
  await db.insert(formTemplates).values({
    ...template,
    profileId: null,
    isBuiltin: true,
  }).onConflictDoUpdate({
    target: [formTemplates.isBuiltin, formTemplates.name],
    set: {
      description: template.description,
      category: template.category,
      pagesData: template.pagesData,
      updatedAt: new Date(),
    },
  })
}

console.log(`Seeded ${BUILTIN_FORM_TEMPLATES.length} built-in form templates.`)
