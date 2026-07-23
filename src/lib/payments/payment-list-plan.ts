export type PaymentListLoaders<TRows, TCount, TFlow, TPage> = {
  rows: () => PromiseLike<TRows>
  count: () => PromiseLike<TCount>
  flowCapability: () => PromiseLike<TFlow>
  pageCapability: () => PromiseLike<TPage>
}

/**
 * Start every independent payment-list read in the same database wave.
 * Keeping this orchestration explicit prevents capability checks from drifting
 * back behind the paginated row/count fetch.
 */
export function loadPaymentListParts<TRows, TCount, TFlow, TPage>(
  loaders: PaymentListLoaders<TRows, TCount, TFlow, TPage>,
) {
  return Promise.all([
    loaders.rows(),
    loaders.count(),
    loaders.flowCapability(),
    loaders.pageCapability(),
  ] as const)
}
