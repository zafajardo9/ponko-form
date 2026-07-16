/**
 * seed-service-flow.ts — Development seed for a "Service Order" flow
 *
 * Creates a flow-powered form that:
 *   1. Collects personal info (name, email, phone, address)
 *   2. Shows a catalog of immigration/consultancy services with Fee + Security Deposit
 *   3. Lets the user select multiple services via checkboxes
 *   4. Computes: service fees total → +12% VAT → total with VAT
 *   5. Computes: security deposits total
 *   6. Computes: grand total = total_with_vat + security_deposit_total
 *   7. Displays a summary with all computed values
 *
 * Run with:  npx tsx scripts/seed-service-flow.ts
 *
 * Idempotent — re-running deletes the existing flow on the target form
 * and rebuilds from scratch.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";

const {
  profiles,
  forms,
  paymentGateways,
  flows,
  flowVariables,
  flowNodes,
  flowEdges,
} = schema;

const db = drizzle(process.env.DATABASE_URL!, { schema });

// ── Service Catalog ────────────────────────────────────────────────────────
// Each entry: key, display label, fee (in centavos/smallest currency unit),
//             and security deposit.
interface ServiceEntry {
  key: string;
  label: string;
  fee: number;
  deposit: number;
}

const SERVICE_CATALOG: ServiceEntry[] = [
  {
    key: "no_derogatory_check",
    label: "No Derogatory Check",
    fee: 15_000_00,
    deposit: 3_000_00,
  },
  {
    key: "tourist_visa_extension",
    label: "Tourist Visa Extension",
    fee: 2_500_00,
    deposit: 9_000_00,
  },
  {
    key: "tourist_visa_waiver",
    label: "Tourist Visa Waiver",
    fee: 2_500_00,
    deposit: 5_500_00,
  },
  {
    key: "acr_cancellation",
    label: "ACR Cancellation",
    fee: 10_000_00,
    deposit: 5_000_00,
  },
  {
    key: "acr_processing",
    label: "ACR Processing",
    fee: 10_000_00,
    deposit: 5_000_00,
  },
  {
    key: "aep_application",
    label: "AEP Application",
    fee: 20_000_00,
    deposit: 20_000_00,
  },
  {
    key: "aep_cancellation",
    label: "AEP Cancellation",
    fee: 10_000_00,
    deposit: 1_000_00,
  },
  {
    key: "aep_exemption",
    label: "AEP Exemption",
    fee: 25_000_00,
    deposit: 10_000_00,
  },
  {
    key: "visa_downgrade",
    label: "Visa Downgrade",
    fee: 25_000_00,
    deposit: 10_000_00,
  },
  {
    key: "grace_period",
    label: "Grace Period",
    fee: 10_000_00,
    deposit: 2_500_00,
  },
  {
    key: "re_stamping",
    label: "Re-Stamping",
    fee: 10_000_00,
    deposit: 5_500_00,
  },
  {
    key: "annual_report_assistance",
    label: "Annual Report Assistance",
    fee: 1_500_00,
    deposit: 1_000_00,
  },
  {
    key: "exit_clearance_certificate",
    label: "Exit Clearance Certificate",
    fee: 10_000_00,
    deposit: 5_500_00,
  },
  {
    key: "motion_of_reconsideration",
    label: "Motion of Reconsideration",
    fee: 10_000_00,
    deposit: 10_000_00,
  },
  {
    key: "srrv_id_renewal",
    label: "SRRV ID Renewal",
    fee: 10_000_00,
    deposit: 2_500_00,
  },
  {
    key: "re_validation",
    label: "Re-Validation",
    fee: 15_000_00,
    deposit: 10_000_00,
  },
  {
    key: "tin_application",
    label: "TIN Application",
    fee: 12_000_00,
    deposit: 2_500_00,
  },
];

async function main() {
  // 1. Find or create a form titled "Service Order".
  let [form] = await db
    .select()
    .from(forms)
    .where(eq(forms.title, "Service Order"))
    .limit(1);
  if (!form) {
    let [profile] = await db.select().from(profiles).limit(1);
    if (!profile) {
      [profile] = await db
        .insert(profiles)
        .values({ clerkId: "seed_demo_user", displayName: "Seed Demo" })
        .returning();
    }
    [form] = await db
      .insert(forms)
      .values({
        profileId: profile.id,
        publicId: "seed-service-order",
        title: "Service Order",
        description:
          "Immigration & consultancy services — select services, automatic fee + VAT + deposit calculation",
        status: "draft",
      })
      .returning();
    console.log(`Created form #${form.id} "Service Order"`);
  } else {
    console.log(`Using existing form #${form.id} ("Service Order")`);
  }

  // 2. Remove any existing flow for this form (cascade clears children).
  await db.delete(flows).where(eq(flows.formId, form.id));

  // 3. Create the flow.
  const [flow] = await db.insert(flows).values({ formId: form.id }).returning();
  console.log(`Created flow #${flow.id}`);

  // 4. Declare variables.
  await db.insert(flowVariables).values([
    // ── Personal info ──
    {
      flowId: flow.id,
      name: "full_name",
      type: "string",
      description: "Client full name",
    },
    {
      flowId: flow.id,
      name: "email",
      type: "string",
      description: "Client email address",
    },
    {
      flowId: flow.id,
      name: "phone",
      type: "string",
      description: "Client phone number",
    },
    {
      flowId: flow.id,
      name: "address",
      type: "string",
      description: "Client address",
    },

    // ── Service selection ──
    {
      flowId: flow.id,
      name: "selected_services",
      type: "string",
      description:
        'JSON array of selected service keys (e.g. ["no_derogatory_check","tourist_visa_extension"])',
    },

    // ── Computed totals ──
    {
      flowId: flow.id,
      name: "service_fees_total",
      type: "money",
      description: "Sum of fees for selected services",
    },
    {
      flowId: flow.id,
      name: "security_deposit_total",
      type: "money",
      description: "Sum of security deposits for selected services",
    },
    {
      flowId: flow.id,
      name: "vat_amount",
      type: "money",
      description: "12% VAT on service fees",
    },
    {
      flowId: flow.id,
      name: "total_with_vat",
      type: "money",
      description: "Service fees + VAT",
    },
    {
      flowId: flow.id,
      name: "grand_total",
      type: "money",
      description: "Total with VAT + security deposits",
    },
  ]);

  // 5. Pick a payment gateway if one exists.
  const [gateway] = await db.select().from(paymentGateways).limit(1);

  // 6. Build the service catalog config that the runtime can use to look up
  //    fee/deposit amounts when computing totals from selected_services.
  const serviceCatalogConfig: Record<string, { fee: number; deposit: number }> =
    {};
  for (const svc of SERVICE_CATALOG) {
    serviceCatalogConfig[svc.key] = { fee: svc.fee, deposit: svc.deposit };
  }

  // ── Create nodes ──────────────────────────────────────────────────────

  const Y_START = 40;
  const Y_STEP = 130;
  let y = Y_START;

  // Start
  const [startNode] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: "start",
      label: "Start",
      positionX: 250,
      positionY: y,
    })
    .returning();
  y += Y_STEP;

  // Personal info: full name
  const [nameField] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: "form_field",
      label: "Full Name",
      positionX: 250,
      positionY: y,
      config: {
        fieldType: "text",
        label: "Full Name",
        placeholder: "Juan Dela Cruz",
        required: true,
        bindToVariable: "full_name",
      },
    })
    .returning();
  y += Y_STEP;

  // Personal info: email
  const [emailField] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: "form_field",
      label: "Email Address",
      positionX: 250,
      positionY: y,
      config: {
        fieldType: "email",
        label: "Email Address",
        placeholder: "juan@example.com",
        required: true,
        bindToVariable: "email",
      },
    })
    .returning();
  y += Y_STEP;

  // Personal info: phone
  const [phoneField] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: "form_field",
      label: "Phone Number",
      positionX: 250,
      positionY: y,
      config: {
        fieldType: "text",
        label: "Phone Number",
        placeholder: "+63 912 345 6789",
        required: true,
        bindToVariable: "phone",
      },
    })
    .returning();
  y += Y_STEP;

  // Personal info: address
  const [addressField] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: "form_field",
      label: "Address",
      positionX: 250,
      positionY: y,
      config: {
        fieldType: "textarea",
        label: "Address",
        placeholder: "Street, City, Province",
        required: false,
        bindToVariable: "address",
      },
    })
    .returning();
  y += Y_STEP;

  // Service selection: checkbox group for all services
  const [serviceField] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: "form_field",
      label: "Select Services",
      positionX: 250,
      positionY: y,
      config: {
        fieldType: "checkbox",
        label: "Choose the services you want to avail",
        required: true,
        bindToVariable: "selected_services",
        options: SERVICE_CATALOG.map((svc) => ({
          label: `${svc.label} — Fee: ₱${(svc.fee / 100).toLocaleString()}.00  Deposit: ₱${(svc.deposit / 100).toLocaleString()}.00`,
          value: svc.key,
        })),
        serviceCatalog: serviceCatalogConfig,
      },
    })
    .returning();
  y += Y_STEP;

  // Calculator: sum service fees
  const [calcFees] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: "calculator",
      label: "Service Fees Total",
      positionX: 250,
      positionY: y,
      config: {
        targetVariable: "service_fees_total",
        expression: "SUM_FEES({{selected_services}})", // Runtime resolves this against the service catalog
        label: "Total service fees from selected items",
      },
    })
    .returning();
  y += Y_STEP;

  // Calculator: sum security deposits
  const [calcDeposits] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: "calculator",
      label: "Security Deposit Total",
      positionX: 250,
      positionY: y,
      config: {
        targetVariable: "security_deposit_total",
        expression: "SUM_DEPOSITS({{selected_services}})", // Runtime resolves this against the service catalog
        label: "Total security deposits from selected items",
      },
    })
    .returning();
  y += Y_STEP;

  // Calculator: VAT (12% of service fees)
  const [calcVat] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: "calculator",
      label: "VAT (12%)",
      positionX: 250,
      positionY: y,
      config: {
        targetVariable: "vat_amount",
        expression: "{{service_fees_total}} * 0.12",
        label: "12% VAT on total service fees",
      },
    })
    .returning();
  y += Y_STEP;

  // Calculator: total with VAT
  const [calcTotalWithVat] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: "calculator",
      label: "Total with VAT",
      positionX: 250,
      positionY: y,
      config: {
        targetVariable: "total_with_vat",
        expression: "{{service_fees_total}} + {{vat_amount}}",
        label: "Service fees plus 12% VAT",
      },
    })
    .returning();
  y += Y_STEP;

  // Calculator: grand total
  const [calcGrandTotal] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: "calculator",
      label: "Grand Total",
      positionX: 250,
      positionY: y,
      config: {
        targetVariable: "grand_total",
        expression: "{{total_with_vat}} + {{security_deposit_total}}",
        label: "Total with VAT plus security deposits",
      },
    })
    .returning();
  y += Y_STEP;

  // Summary / confirmation
  const [summaryNode] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: "summary",
      label: "Summary & Confirmation",
      positionX: 250,
      positionY: y,
      config: {
        title: "Order Summary",
        template: [
          "--- Personal Information ---",
          "Name: {{full_name}}",
          "Email: {{email}}",
          "Phone: {{phone}}",
          "Address: {{address}}",
          "",
          "--- Services Selected ---",
          "{{selected_services}}",
          "",
          "--- Payment Breakdown ---",
          "Service Fees:        ₱{{service_fees_total}}",
          "VAT (12%):           ₱{{vat_amount}}",
          "Total (fees + VAT):  ₱{{total_with_vat}}",
          "Security Deposits:   ₱{{security_deposit_total}}",
          "────────────────────────────",
          "GRAND TOTAL:         ₱{{grand_total}}",
        ].join("\n"),
      },
    })
    .returning();

  // 7. Record the start node on the flow.
  await db
    .update(flows)
    .set({ startNodeId: startNode.id })
    .where(eq(flows.id, flow.id));

  // 8. Connect the nodes with edges.
  await db.insert(flowEdges).values([
    { flowId: flow.id, sourceNodeId: startNode.id, targetNodeId: nameField.id },
    {
      flowId: flow.id,
      sourceNodeId: nameField.id,
      targetNodeId: emailField.id,
    },
    {
      flowId: flow.id,
      sourceNodeId: emailField.id,
      targetNodeId: phoneField.id,
    },
    {
      flowId: flow.id,
      sourceNodeId: phoneField.id,
      targetNodeId: addressField.id,
    },
    {
      flowId: flow.id,
      sourceNodeId: addressField.id,
      targetNodeId: serviceField.id,
    },
    {
      flowId: flow.id,
      sourceNodeId: serviceField.id,
      targetNodeId: calcFees.id,
    },
    {
      flowId: flow.id,
      sourceNodeId: calcFees.id,
      targetNodeId: calcDeposits.id,
    },
    {
      flowId: flow.id,
      sourceNodeId: calcDeposits.id,
      targetNodeId: calcVat.id,
    },
    {
      flowId: flow.id,
      sourceNodeId: calcVat.id,
      targetNodeId: calcTotalWithVat.id,
    },
    {
      flowId: flow.id,
      sourceNodeId: calcTotalWithVat.id,
      targetNodeId: calcGrandTotal.id,
    },
    {
      flowId: flow.id,
      sourceNodeId: calcGrandTotal.id,
      targetNodeId: summaryNode.id,
    },
  ]);

  // ── Summary ──────────────────────────────────────────────────────────
  const totalServices = SERVICE_CATALOG.length;
  console.log(`Seeded "Service Order" flow:`);
  console.log(`  15 variables, 12 nodes, 11 edges`);
  console.log(`  ${totalServices} services in catalog`);
  console.log(`  Personal info: name, email, phone, address`);
  console.log(
    `  Computations: fees → VAT (12%) → total w/ VAT + deposits = grand total`,
  );
  if (!gateway) {
    console.log(
      "  Note: no payment gateway found — flow is configured without a payment node.",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
