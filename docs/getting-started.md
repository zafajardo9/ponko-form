# Getting Started with PonkoForm

> **Build your first flow form in ~10 minutes.**

---

## What You'll Build

A simple **contact + redirect form** that:
1. Asks for a name and email
2. Asks what they're interested in
3. Shows a confirmation message

No payments, no calculations — just the basics to learn the workflow.

---

## Step 1: Create a New Form

1. Go to your **Dashboard**
2. Click **"New Form"**
3. Enter a title: `Quick Contact Form`
4. Click **Create**

You'll land in the **Form Editor** — this is where everything happens.

---

## Step 2: Understand the Layout

The form editor has three main areas:

```
 ┌─────────────────────────────────────────────────┐
 │  ← Dashboard  │  My Form  │ [draft]              │
 │  [ Build ] [ Responses ] [ Payments ]             │
 ├─────────────────────────────────────────────────┤
 │                                                   │
 │   Palette      │   Flow Builder (List/Canvas)    │
 │   ┌───────┐    │                                  │
 │   │ Text  │    │   Start                         │
 │   │ Email │    │     │                            │
 │   │ Select│    │   Form Field                     │
 │   │ ...   │    │     │                            │
 │   └───────┘    │   Summary                       │
 │                │                                  │
 │                │                                  │
 └─────────────────────────────────────────────────┘
```

- **Left Palette:** Drag nodes onto your flow
- **Center:** Your flow — the visual graph of steps
- **Right Panel:** Configuration for the selected node

---

## Step 3: Build Your First Flow

Every flow starts with a **Start** node and ends with a **Summary** or **Redirect** node. Let's connect three nodes.

### Add a Form Field

1. From the palette, click **"Text"** — a `form_field` node appears in your flow
2. Click the new node to open its configuration (right panel)
3. Set the **Label** to `Your Name`
4. Leave **Required** checked
5. In **Bind to Variable**, type `full_name` (this is where the answer will be stored)

Now add an **Email** field:
1. Click **"Email"** from the palette
2. Click the node, set Label to `Email Address`
3. Bind to variable: `email`

### Add a Select Field

1. Click **"Select"** from the palette
2. Set Label to `How did you hear about us?`
3. Bind to variable: `referral_source`
4. Add options:
   - `Social Media` → `social`
   - `Friend` → `friend`
   - `Search Engine` → `search`
   - `Other` → `other`

### Add a Summary

1. From the palette's logic section, click **"Summary"**
2. Click the summary node, set Title to `Thanks!`
3. In the Template field, write:
   ```
   Thanks {{full_name}}! We'll reach out to you at {{email}}.
   Referral source: {{referral_source}}
   ```
4. Variables wrapped in `{{double braces}}` are replaced with the respondent's answers

### Connect Everything

Your flow should look like this:

```
  Start
    │
  Your Name (text)
    │
  Email Address (email)
    │
  How did you hear? (select)
    │
  Thanks! (summary)
```

Edges (connecting lines) are created automatically when you click palette items. You can also drag from the dot on the right side of a node to the dot on the left side of another node.

---

## Step 4: Test with Preview

Before publishing, test your form:

1. Click **"Preview"** in the top toolbar
2. The preview modal opens — fill in the fields
3. On the last step, you should see your summary template with the values you entered
4. Close the preview

> **Tip:** Check the **"Skip required fields"** checkbox at the bottom of each field step to quickly skim through without filling everything.

---

## Step 5: Publish & Share

1. Click **"Publish"** (top-right of the editor)
2. Once published, click **"Share"** to get the shareable link
3. You can also copy the embed code to add the form to your website

---

## What's Next?

| Topic | Guide |
|---|---|
| **Add calculations** (totals, VAT) | [Computation Patterns](flow-form-guide.md#5-computation-patterns) |
| **Branch based on answers** (decisions) | [Decision & Branching Patterns](flow-form-guide.md#6-decision--branching-patterns) |
| **Collect payments** | [Payments Guide](payments-guide.md) |
| **Build a multi-service order form** | [Tutorial 2: Service Order Flow](flow-form-guide.md#4-tutorial-2-multi-service-order-flow) |
| **All node types explained** | [Node Types Reference](flow-builder-guide.md#3-node-types-reference) |
| **Fix issues** | [Troubleshooting](flow-form-guide.md#9-troubleshooting) |
