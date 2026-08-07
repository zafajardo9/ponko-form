import type { FormTemplateCategory, TemplatePageData } from './types'
import { satisfactionOptions } from '../page-builder/satisfaction'

export interface BuiltinFormTemplate {
  name: string
  description: string
  category: FormTemplateCategory
  pagesData: TemplatePageData[]
}

const finalPage = (message: string, position: number): TemplatePageData => ({
  title: 'Thank You', position, isFinal: true, finalTemplate: message, fields: [],
})

export const BUILTIN_FORM_TEMPLATES: BuiltinFormTemplate[] = [
  {
    name: 'Customer Satisfaction Survey',
    description: 'Measure customer satisfaction, recommendation intent, and collect actionable feedback.',
    category: 'survey',
    pagesData: [
      {
        title: 'Your Experience',
        description: 'Tell us how we did. Your feedback helps us improve.',
        position: 0,
        isFinal: false,
        fields: [
          {
            fieldType: 'satisfaction',
            label: 'How satisfied are you with your experience?',
            required: true,
            options: satisfactionOptions('five-point'),
            bindVariable: 'satisfaction_score',
            position: 0,
            width: 'full',
          },
          {
            fieldType: 'satisfaction',
            label: 'How likely are you to recommend us?',
            required: true,
            options: satisfactionOptions('nps'),
            bindVariable: 'recommendation_score',
            position: 1,
            width: 'full',
          },
          {
            fieldType: 'textarea',
            label: 'What could we do better?',
            placeholder: 'Share any details that would help us improve.',
            required: false,
            bindVariable: 'feedback',
            position: 2,
            width: 'full',
          },
          {
            fieldType: 'email',
            label: 'Email address',
            placeholder: 'Optional, if you would like a follow-up',
            required: false,
            bindVariable: 'email',
            position: 3,
            width: 'full',
          },
        ],
      },
      finalPage('Thank you for sharing your feedback. Your response helps us create a better experience.', 1),
    ],
  },
  {
    name: 'Contact Intake',
    description: 'Collect contact inquiries with name, email, phone, company, and message.',
    category: 'contact',
    pagesData: [
      {
        title: 'Contact Information', position: 0, isFinal: false, fields: [
          { fieldType: 'text', label: 'Full Name', required: true, bindVariable: 'full_name', position: 0, width: 'full' },
          { fieldType: 'email', label: 'Email', required: true, bindVariable: 'email', position: 1, width: 'full' },
          { fieldType: 'text', label: 'Phone', required: false, bindVariable: 'phone', position: 2, width: 'half' },
          { fieldType: 'text', label: 'Company', required: false, bindVariable: 'company', position: 3, width: 'half' },
          { fieldType: 'textarea', label: 'Message', required: false, bindVariable: 'message', position: 4, width: 'full' },
        ],
      },
      finalPage('Thank you for reaching out! We will get back to you shortly.', 1),
    ],
  },
  {
    name: 'Support Ticket',
    description: 'Capture support requests with issue details, priority, category, and attachments.',
    category: 'support',
    pagesData: [
      {
        title: 'Ticket Details', position: 0, isFinal: false, fields: [
          { fieldType: 'text', label: 'Issue Title', required: true, bindVariable: 'issue_title', position: 0, width: 'full' },
          { fieldType: 'textarea', label: 'Description', required: true, bindVariable: 'description', position: 1, width: 'full' },
          { fieldType: 'select', label: 'Priority', required: true, bindVariable: 'priority', position: 2, width: 'half', options: [
            { label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' },
            { label: 'High', value: 'high' }, { label: 'Urgent', value: 'urgent' },
          ] },
          { fieldType: 'select', label: 'Category', required: true, bindVariable: 'category', position: 3, width: 'half', options: [
            { label: 'Bug Report', value: 'bug' }, { label: 'Feature Request', value: 'feature' },
            { label: 'Account Issue', value: 'account' }, { label: 'Billing', value: 'billing' },
            { label: 'Other', value: 'other' },
          ] },
          { fieldType: 'file_upload', label: 'Attachments', required: false, bindVariable: 'attachments', position: 4, width: 'full' },
        ],
      },
      finalPage('Your support ticket has been submitted. Our team will review it shortly.', 1),
    ],
  },
  {
    name: 'Deal Qualification',
    description: 'Qualify sales opportunities with company, deal value, stage, and contact details.',
    category: 'sales',
    pagesData: [
      {
        title: 'Deal Information', position: 0, isFinal: false, fields: [
          { fieldType: 'text', label: 'Company Name', required: true, bindVariable: 'company_name', position: 0, width: 'full' },
          { fieldType: 'number', label: 'Deal Size', required: true, bindVariable: 'deal_size', position: 1, width: 'half' },
          { fieldType: 'select', label: 'Deal Stage', required: true, bindVariable: 'deal_stage', position: 2, width: 'half', options: [
            { label: 'Prospecting', value: 'prospecting' }, { label: 'Qualification', value: 'qualification' },
            { label: 'Proposal', value: 'proposal' }, { label: 'Negotiation', value: 'negotiation' },
            { label: 'Closed Won', value: 'closed_won' },
          ] },
        ],
      },
      {
        title: 'Contact Information', position: 1, isFinal: false, fields: [
          { fieldType: 'text', label: 'Contact Name', required: true, bindVariable: 'contact_name', position: 0, width: 'full' },
          { fieldType: 'email', label: 'Contact Email', required: true, bindVariable: 'contact_email', position: 1, width: 'full' },
          { fieldType: 'textarea', label: 'Additional Notes', required: false, bindVariable: 'notes', position: 2, width: 'full' },
        ],
      },
      finalPage('Deal submitted successfully. Your sales team will follow up.', 2),
    ],
  },
  {
    name: 'Account Intake',
    description: 'Onboard new accounts with company details, industry, and a primary contact.',
    category: 'general',
    pagesData: [
      {
        title: 'Company Information', position: 0, isFinal: false, fields: [
          { fieldType: 'text', label: 'Company Name', required: true, bindVariable: 'company_name', position: 0, width: 'full' },
          { fieldType: 'text', label: 'Industry', required: true, bindVariable: 'industry', position: 1, width: 'half' },
          { fieldType: 'number', label: 'Employee Count', required: false, bindVariable: 'employee_count', position: 2, width: 'half' },
          { fieldType: 'text', label: 'Website', required: false, bindVariable: 'website', position: 3, width: 'full' },
        ],
      },
      {
        title: 'Primary Contact', position: 1, isFinal: false, fields: [
          { fieldType: 'text', label: 'Contact Name', required: true, bindVariable: 'contact_name', position: 0, width: 'full' },
          { fieldType: 'email', label: 'Contact Email', required: true, bindVariable: 'contact_email', position: 1, width: 'full' },
        ],
      },
      finalPage('Account information received. Welcome aboard!', 2),
    ],
  },
  {
    name: 'Task Request',
    description: 'Collect task requests with an assignee, due date, and clear priority.',
    category: 'general',
    pagesData: [
      {
        title: 'Task Details', position: 0, isFinal: false, fields: [
          { fieldType: 'text', label: 'Task Title', required: true, bindVariable: 'task_title', position: 0, width: 'full' },
          { fieldType: 'textarea', label: 'Description', required: true, bindVariable: 'description', position: 1, width: 'full' },
          { fieldType: 'text', label: 'Assignee', required: false, bindVariable: 'assignee', position: 2, width: 'half' },
          { fieldType: 'date', label: 'Due Date', required: true, bindVariable: 'due_date', position: 3, width: 'half' },
          { fieldType: 'select', label: 'Priority', required: true, bindVariable: 'priority', position: 4, width: 'half', options: [
            { label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' },
            { label: 'High', value: 'high' }, { label: 'Critical', value: 'critical' },
          ] },
        ],
      },
      finalPage('Task request submitted successfully. It will be reviewed shortly.', 1),
    ],
  },
  {
    name: 'Product Purchase',
    description: 'Sell a single product or service at a fixed price — collect buyer details, then take payment.',
    category: 'sales',
    pagesData: [
      {
        title: 'Customer Details',
        description: 'Tell us who the order is for.',
        position: 0,
        isFinal: false,
        fields: [
          { fieldType: 'text', label: 'Full Name', required: true, bindVariable: 'full_name', position: 0, width: 'full' },
          { fieldType: 'email', label: 'Email Address', required: true, bindVariable: 'email', position: 1, width: 'full' },
          { fieldType: 'textarea', label: 'Order Notes', placeholder: 'Anything we should know about your order?', required: false, bindVariable: 'notes', position: 2, width: 'full' },
        ],
      },
      {
        title: 'Payment',
        description: 'Complete payment to confirm your order.',
        position: 1,
        isFinal: false,
        hasPayment: true,
        paymentCurrency: 'PHP',
        paymentComputation: { mode: 'fixed', fixedAmount: 500, showBreakdown: true },
        fields: [],
      },
      finalPage('Thank you for your purchase! We will process your order shortly.', 2),
    ],
  },
  {
    name: 'Products & Services Order',
    description: 'Let customers pick from products and services with prices, then pay the calculated total.',
    category: 'sales',
    pagesData: [
      {
        title: 'Customer Details',
        description: 'Tell us who the order is for.',
        position: 0,
        isFinal: false,
        fields: [
          { fieldType: 'text', label: 'Full Name', required: true, bindVariable: 'full_name', position: 0, width: 'full' },
          { fieldType: 'email', label: 'Email Address', required: true, bindVariable: 'email', position: 1, width: 'full' },
        ],
      },
      {
        title: 'Choose Items',
        description: 'Select every product or service you would like to order.',
        position: 1,
        isFinal: false,
        fields: [
          {
            fieldType: 'checkbox',
            label: 'Products & Services',
            required: true,
            bindVariable: 'items',
            position: 0,
            width: 'full',
            validationRules: { optionPricesEnabled: true },
            options: [
              { label: 'Starter Pack', value: 'starter', price: 500 },
              { label: 'Pro Pack', value: 'pro', price: 1200 },
              { label: 'Setup Service', value: 'setup', price: 800 },
              { label: 'Priority Support', value: 'priority', price: 400 },
            ],
          },
          { fieldType: 'textarea', label: 'Order Notes', placeholder: 'Anything we should know about your order?', required: false, bindVariable: 'notes', position: 1, width: 'full' },
        ],
      },
      {
        title: 'Payment',
        description: 'Complete payment to confirm your order.',
        position: 2,
        isFinal: false,
        hasPayment: true,
        paymentCurrency: 'PHP',
        paymentComputation: { mode: 'sum_priced_options', fieldBindings: ['items'], showBreakdown: true },
        fields: [],
      },
      finalPage('Thank you for your order! We will confirm it shortly.', 3),
    ],
  },
]
