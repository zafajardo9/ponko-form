# Payments Guide

> **Accept payments through your flow forms.** Connect a payment gateway, add a Payment node, and track every transaction.

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

1. Go to **Dashboard → Settings** (top-right avatar menu)
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
| **Secret Key** | From your Xendit Dashboard → Settings → API Keys |
| **Webhook Token** | Optional — for real-time payment notifications |

> Xendit supports **PHP** only. If your form uses a different currency, the system will warn you.

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

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| "No payment methods available" | No gateways connected, or connected gateway doesn't support the form's currency | Go to **Settings** and connect a gateway or change the currency |
| Payment fails during testing | Sandbox credentials are incorrect | Double-check your PayPal/Xendit sandbox keys |
| "Amount is zero or invalid" | The Calculator node before Payment didn't compute correctly | Check the expression and that the amount variable has a value |
| Transactions not showing | The form might not have a payment flow | Add a **Payment** node to your flow |
