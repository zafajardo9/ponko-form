# Payments Guide

> **Accept one-time payments through flow or page-builder forms, and Xendit subscriptions through page-builder forms.** Connect your own gateway and track transactions in PonkoForm.
> Verified against `main` at `7d2cbe3` on 2026-07-28.

---

## How Payments Work in PonkoForm

PonkoForm uses a **bring-your-own-gateway** model. You connect your own payment gateway credentials (PayPal or Xendit), and your form charges respondents directly through your account. No platform fees, no middleman — the money goes straight to you.

```
  Respondent fills form
        │
  Calculator computes total
        │
  Payment node charges via your gateway  ───→  Money goes to YOUR account
        │
  Receipt shown to respondent
        │
  Transaction recorded in Payments tab
```

---

## Step 1: Connect a Payment Gateway

Before any form can accept payments, you need to connect at least one payment gateway in **Settings**.

1. Go to **Settings → Integrations** (route: `/settings/integrations`)
2. Scroll to the **Payment Gateways** section
3. Choose a gateway:

### PayPal

| Field | What to Enter |
|---|---|
| **Client ID** | From your PayPal Developer Dashboard |
| **Client Secret** | From your PayPal Developer Dashboard |
| **Mode** | `sandbox` for testing, `live` for real payments |

> To get PayPal credentials, go to [developer.paypal.com](https://developer.paypal.com) → Apps & Credentials → Create App.

### Xendit

| Field | What to Enter |
|---|---|
| **Environment** | Test/sandbox while validating; live for real charges |
| **Secret Key** | From your Xendit Dashboard → Settings → API Keys |
| **Public Key** | Optional Xendit public key |
| **Webhook Token** | Required verification token from Xendit Webhook Settings |

> Xendit supports **PHP** only. If your form uses a different currency, the system will warn you.

For subscriptions, the Xendit account must have an active payment channel that supports merchant-initiated transactions (MIT/automatic recurring debits). Configure the integration's PonkoForm webhook URL in Xendit for payment-session, recurring-plan, and recurring-cycle events. Keep the webhook token configured in both systems so PonkoForm can verify every callback.

## Page-Builder Xendit Subscriptions

Subscription payments are available on page-builder forms in this release. Flow-builder subscriptions are planned separately.

1. Add required **Name** and **Email** fields on a page before the payment page.
2. Enable payment on a later page and select **Subscription**.
3. Select Xendit. Subscription currency is fixed to **PHP**.
4. Choose the earlier Name and Email fields used to create the Xendit customer.
5. Choose weekly, monthly, quarterly, semiannual, or annual billing.
6. Optionally configure a trial (0–365 days) and a maximum number of cycles.

PonkoForm considers the response complete once Xendit reports that the checkout session is completed and the recurring plan is active. It does not wait for every future billing cycle. Each later automatic debit is recorded as its own cycle through verified Xendit webhooks, and those cycle payments do not resend the form-completion email.

Cancellation remains managed in Xendit for phase 1. When Xendit reports that a recurring plan is inactive, PonkoForm displays the subscription as deactivated/cancelled and preserves its cycle history.

---

## Step 2: Add a Payment Node to Your Flow

Once a gateway is connected, add a **Payment** node to your flow:

1. Open your form in the **Editor**
2. From the palette's logic section, click **"Payment"**
3. Click the payment node to configure it (right panel):

### Payment Node Configuration

| Field | What to Set |
|---|---|
| **Amount Variable** | Pick the variable that holds the total (e.g., `amount_due`, `total_cost`) |
| **Currency** | The currency for this payment (e.g., `USD`, `PHP`) |

> The amount variable is typically set by a **Calculator** node just before the payment step. For example: a calculator adds VAT to a subtotal and stores the result in `amount_due`, then the payment node charges that amount.

### Payment Flow Pattern

A typical payment flow looks like this:

```
  Start → Form Fields → Calculator (compute total) → Payment → Summary
```

The **Calculator** runs before **Payment** to ensure the amount is ready. When the respondent reaches the payment step, they see:

1. The amount to be charged
2. A list of available payment methods (based on which gateways you've connected)
3. A **"Pay"** button that redirects them to the gateway's checkout page

### Page Builder Payments

For a page form, enable payment in the page settings rather than adding a flow node. Configure:

- one-time or Xendit subscription payment;
- currency and compatible connected gateway;
- amount mode: field, priced options, number-field sum, fixed amount, or formula;
- the fields/references used by the selected computation.

Use major-unit values in form calculations (for example, `1500` for ₱1,500). PonkoForm converts the final amount to integer minor units when creating the payment record and gateway checkout.

---

## Step 3: Respondent Experience

When a respondent reaches the payment step:

1. They see the amount and choose how to pay (PayPal / Xendit)
2. Clicking **"Pay Now"** redirects them to the gateway's hosted checkout page
3. After completing (or cancelling) payment, they're sent back to your form
4. If successful, they continue to the summary/receipt
5. If it failed, they see a "Try again" message

---

## Step 4: View Payment Transactions

All payment transactions are recorded and viewable from the **Payments** page.

### Accessing the Payments Page

From the form editor, click the **Payments** tab in the top navigation:

```
[ Build ] [ Responses ] [ Payments ]    Preview  Settings  Share  Publish
```

Or navigate directly to: `/forms/{formId}/payments`

### What You'll See

| Column | Description |
|---|---|
| **Invoice** | Auto-generated invoice number (e.g., `INV-000042`) |
| **Date** | When the payment was initiated |
| **Amount** | The charged amount in the form's currency |
| **Status** | ✅ Completed / ⏳ Pending / ❌ Failed / ↩ Refunded |
| **Gateway** | Which gateway processed it (PayPal / Xendit) |
| **Channel** | How the customer paid (GCash, Credit Card, Bank Transfer, etc.) |
| **Reference** | The gateway's transaction ID |

Subscription rows also show the subscriber, plan status, billing interval, next scheduled charge, and the latest cycle result. Open the detail view for the complete paid/pending/failed cycle timeline.

### Payment Detail View

Click any row to open a detail dialog with:

- **Status + Amount** banner at a glance
- **Full details list:** Payment ID, Invoice, Gateway, Reference, Channel, Currency, Execution ID, Submission ID
- **Raw Gateway Response** (expandable): The full JSON response from the gateway for debugging

---

## Payment Statuses

| Status | Meaning | Next Steps |
|---|---|---|
| **Completed** | Payment was successful | Money is in your gateway account |
| **Pending** | Awaiting confirmation (e.g., Xendit invoice awaiting bank transfer) | Check the gateway dashboard for updates |
| **Failed** | Payment was declined or expired | Ask the customer to try again |
| **Refunded** | Payment was refunded to the customer | Check your gateway dashboard |

---

## Viewing Payments Alongside Responses

The **Responses** page also shows payment status:

- Each submission row has a **Payment** column showing the status badge
- Clicking a response shows a **Payment** section with status + amount
- A **"View Payments →"** link takes you to the full payments page

---

## Frequently Asked Questions

### Q: Where does the money go?
Directly to **your** PayPal or Xendit account. PonkoForm never touches the funds.

### Q: Can I test payments without charging real money?
Yes! Use **PayPal Sandbox** mode or Xendit's test credentials. Payments made in sandbox mode won't actually charge anyone.

### Q: What if the respondent closes the payment page?
If they cancel or close the gateway's checkout, they're returned to the form and can try again. The payment status will show as **Failed**.

### Q: What currencies are supported?
| Gateway | Supported Currencies |
|---|---|
| **PayPal** | Most major currencies (USD, EUR, GBP, etc.) |
| **Xendit** | PHP only |

### Q: Can I refund a payment?
Not yet from within PonkoForm — process refunds directly through your gateway's dashboard. We'll add in-app refunds in a future update.

### Q: Does PonkoForm charge the subscriber every cycle?
No. Xendit performs the automatic recurring debit. PonkoForm verifies Xendit's signed webhook events and stores the resulting cycle history.

### Q: How does a subscriber cancel?
Cancellation is handled in Xendit in this release. PonkoForm reflects the inactive/cancelled state after receiving the plan webhook; it does not yet provide an in-app cancellation control.

## Subscription Operations

- Register the PonkoForm integration webhook URL for `payment_session.completed`, recurring plan activation/inactivation, and recurring cycle created/retrying/succeeded/failed events. PonkoForm accepts the documented dot and underscore event-name variants.
- Subscription session, plan, and cycle calls use Xendit's `2026-01-01` API version.
- Ensure the Xendit secret key can create payment sessions and read recurring plans and cycles.
- Use Xendit test credentials and a test MIT-capable payment channel before enabling live subscriptions.
- Set `SUBSCRIPTION_PAYMENTS_ENABLED=false` to stop new subscription configuration and checkout creation during an incident. Existing webhooks and stored subscription history continue to reconcile.
- Monitor rejected webhook signatures and stale active subscriptions. Active subscriptions are periodically reconciled against Xendit so missed callbacks can be recovered.

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| "No payment methods available" | No gateways connected, or connected gateway doesn't support the form's currency | Go to **Settings** and connect a gateway or change the currency |
| Payment fails during testing | Sandbox credentials are incorrect | Double-check your PayPal/Xendit sandbox keys |
| "Amount is zero or invalid" | The Calculator node before Payment didn't compute correctly | Check the expression and that the amount variable has a value |
| Transactions not showing | The form might not have a payment flow | Add a **Payment** node to your flow |
| Subscription option has no gateway | Xendit is not connected, PHP is not selected, or subscriptions are disabled | Connect Xendit, use PHP, and check `SUBSCRIPTION_PAYMENTS_ENABLED` |
| Subscription remains pending | Checkout or plan activation has not been confirmed | Check the Xendit session and recurring plan, then verify webhook delivery |
| A renewal is missing | A recurring-cycle webhook was delayed or rejected | Verify the webhook token and event configuration; scheduled reconciliation will also fetch missing cycles |
