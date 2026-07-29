# Getting Started with PonkoForm

> **Build and publish a simple multi-page contact form in about 10 minutes.**

## What You'll Build

A contact form that:

1. collects a name and email;
2. asks what the respondent needs;
3. shows a final confirmation;
4. can be shared as a link or embedded on a site.

This tutorial uses the Page Builder, which is the default for new forms.

## Step 1: Create a Form

1. Sign in and open **Forms**.
2. Select **New Form**.
3. Choose **Start from scratch**, or select **Contact Intake** to begin from a template.
4. Enter `Quick Contact Form`.
5. Select **Create & open editor**.

A blank form is initialized with page-form data when the editor opens. Templates are copied into an independent form, so later edits do not change the original template.

## Step 2: Know the Editor

The unified editor changes its workspace based on the form's stored mode:

- New and template forms show the **Page Builder**.
- Existing flow forms show **List** and **Canvas** flow views.
- The header provides Preview, settings/theme, Share, and publish controls.
- Form navigation links to Build, Responses, Payments, and Invoicing.

For this tutorial, stay in the Page Builder.

## Step 3: Build the Contact Page

Create or select the first non-final page and name it `Contact Details`.

Add these fields:

| Field | Label | Binding | Required |
|---|---|---|---:|
| Text | Full Name | `full_name` | Yes |
| Email | Email Address | `email` | Yes |
| Select | What can we help with? | `interest` | Yes |
| Long Text | Tell us more | `message` | No |

For the Select field, add options such as:

- General question → `general`
- Project inquiry → `project`
- Support → `support`

Bindings are stable keys used in stored response data, conditions, computations, and templates. Use short snake_case names and keep them unique within the form.

## Step 4: Configure the Final Page

Add or select a final page, then:

1. Set the title to `Thank You`.
2. Enter a confirmation such as `Thanks! Your response has been recorded.`
3. Leave the redirect empty for now.

A final page completes the response. You can use a final redirect instead when respondents should continue to another site.

## Step 5: Preview and Validate

1. Select **Preview**.
2. Fill out the required fields.
3. Move through each page and confirm the final message appears.
4. Test narrow/mobile sizing if the form will be embedded.

Preview does not charge real payment methods. When a form contains payment, use sandbox/test credentials before publishing.

## Step 6: Publish and Share

1. Select **Publish**.
2. Open **Share**.
3. Copy the public URL or the iframe embed code.

The shared URL uses the form's public ID, not its internal creator-facing numeric ID. Draft forms are not available as normal public submissions.

## Step 7: Review Responses

After a test submission:

1. Open **Responses** to inspect submitted field values.
2. Use filters, archive/bulk actions, or CSV export as needed.
3. If the form accepts payment, use **Payments** for transaction state and recovery actions.
4. Use **Invoicing** to configure respondent confirmation/invoice email after connecting Resend or SMTP.

## Where to Go Next

| Goal | Guide |
|---|---|
| Add page conditions, references, or computed fields | [AI Knowledge Bank — Page Builder](AI-KNOWLEDGE-BANK.md#9-page-builder-mechanics) |
| Understand branching flow forms | [Flow Form Guide](flow-form-guide.md) |
| Configure PayPal or Xendit | [Payments Guide](payments-guide.md) |
| See exactly what is implemented | [Current System Overview](current-system.md) |
| Work on the codebase | [System Memory](../memory-ponko/README.md) |
