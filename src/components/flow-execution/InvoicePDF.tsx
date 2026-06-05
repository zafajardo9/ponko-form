import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  PDFDownloadLink,
} from '@react-pdf/renderer'
import type { InvoiceModel } from './invoice'

/**
 * Real PDF invoice (not a print dialog) via @react-pdf/renderer. This module is
 * loaded lazily and rendered only on the client, so the PDF engine never enters
 * the SSR path. `InvoicePDF` is the default export — a styled download link.
 */

const C = {
  ink: '#141413',
  muted: '#8e8b82',
  soft: '#6c6a64',
  border: '#e6dfd8',
  panel: '#faf9f5',
  accent: '#cc785c',
  green: '#2f7d52',
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: C.ink, fontFamily: 'Helvetica' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  issuer: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  invoiceLabel: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.accent },
  meta: { marginTop: 4, fontSize: 10, color: C.muted, textAlign: 'right' },
  paidBadge: {
    marginTop: 8,
    alignSelf: 'flex-end',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#d8f0e0',
    color: C.green,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  rule: { marginVertical: 18, height: 1, backgroundColor: C.border },
  sectionLabel: {
    fontSize: 9,
    letterSpacing: 1,
    color: C.muted,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowLabel: { color: C.soft, flex: 1, paddingRight: 12 },
  rowValue: { fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  totalBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 6,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 11, color: C.soft },
  totalValue: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  footer: { marginTop: 28, fontSize: 9, color: C.muted },
})

function InvoiceDocument({ invoice }: { invoice: InvoiceModel }) {
  return (
    <Document title={invoice.invoiceNo}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.issuer}>{invoice.issuer}</Text>
            <Text style={{ marginTop: 4, color: C.muted, fontSize: 10 }}>Receipt / Invoice</Text>
          </View>
          <View>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={styles.meta}>{invoice.invoiceNo}</Text>
            <Text style={styles.meta}>{invoice.dateText}</Text>
            {invoice.paid && <Text style={styles.paidBadge}>PAID</Text>}
          </View>
        </View>

        <View style={styles.rule} />

        {invoice.lines.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>DETAILS</Text>
            {invoice.lines.map((line, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.rowLabel}>{line.label}</Text>
                <Text style={styles.rowValue}>{line.value}</Text>
              </View>
            ))}
          </View>
        )}

        {invoice.totalText && (
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Amount paid</Text>
            <Text style={styles.totalValue}>{invoice.totalText}</Text>
          </View>
        )}

        <View style={styles.footer}>
          {invoice.gatewayName && <Text>Paid via {invoice.gatewayName}</Text>}
          {invoice.reference && <Text>Reference: {invoice.reference}</Text>}
          <Text style={{ marginTop: 8 }}>Thank you for your payment.</Text>
        </View>
      </Page>
    </Document>
  )
}

export default function InvoicePDF({
  invoice,
  fileName,
}: {
  invoice: InvoiceModel
  fileName: string
}) {
  return (
    <PDFDownloadLink document={<InvoiceDocument invoice={invoice} />} fileName={fileName}>
      {({ loading }) => (
        <span className="inline-flex h-10 items-center justify-center rounded-md bg-[#cc785c] px-5 text-sm font-medium text-white transition-colors hover:bg-[#a9583e]">
          {loading ? 'Preparing PDF…' : '↓ Download PDF'}
        </span>
      )}
    </PDFDownloadLink>
  )
}
