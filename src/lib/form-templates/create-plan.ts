import type { TemplatePageData } from "./types";

export function orderedTemplatePages(
  pages: TemplatePageData[],
): TemplatePageData[] {
  return [...pages].sort((a, b) => a.position - b.position);
}

export function templatePageInsertValues(
  formId: number,
  pages: TemplatePageData[],
) {
  return orderedTemplatePages(pages).map((page, position) => ({
    formId,
    title: page.title.slice(0, 255),
    description: page.description ?? null,
    position,
    isFinal: page.isFinal,
    finalTemplate: page.isFinal
      ? page.finalTemplate ?? "Your response has been recorded."
      : null,
  }));
}

export function templateFieldInsertValues(
  createdPages: { id: number; position: number }[],
  pages: TemplatePageData[],
) {
  const pageIdByPosition = new Map(
    createdPages.map((page) => [page.position, page.id]),
  );

  return orderedTemplatePages(pages).flatMap((page, pagePosition) => {
    if (page.isFinal) return [];
    const pageId = pageIdByPosition.get(pagePosition);
    if (pageId === undefined) {
      throw new Error(`Template page ${pagePosition + 1} was not created`);
    }
    return [...page.fields]
      .sort((a, b) => a.position - b.position)
      .map((field, position) => ({
        pageId,
        fieldType: field.fieldType,
        label: field.label.slice(0, 255),
        placeholder: field.placeholder?.slice(0, 255) ?? null,
        required: Boolean(field.required),
        options: field.options ?? null,
        bindVariable: field.bindVariable,
        position,
        width: field.width ?? ("full" as const),
        validationRules: null,
      }));
  });
}
