import type { FieldCondition, PageField } from '../../lib/page-builder/types'

export type EditablePageField = PageField & { conditions: FieldCondition[] }
