import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Eye,
  FileUp,
  GitBranch,
  LayoutTemplate,
  ListRestart,
  MousePointer2,
  Search,
  Send,
  Share2,
  ShieldCheck,
  TableProperties,
  Wrench,
} from "lucide-react";

export interface TrustItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface FeatureItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface FeatureGroup {
  label: "Build" | "Collect" | "Manage";
  features: FeatureItem[];
}

export interface WorkflowStep {
  number: string;
  icon: LucideIcon;
  title: string;
  description: string;
  mockup: "templates" | "builder" | "share" | "responses";
}

export interface IntegrationItem {
  name: string;
  monogram: string;
  description: string;
  accent: string;
}

export const TRUST_ITEMS: TrustItem[] = [
  {
    icon: LayoutTemplate,
    title: "5 built-in templates",
    description: "Start with a proven form structure",
  },
  {
    icon: ShieldCheck,
    title: "Payment lifecycle tracking",
    description: "Follow every transaction state",
  },
  {
    icon: CreditCard,
    title: "PayPal and Xendit",
    description: "Use your own gateway account",
  },
  {
    icon: Search,
    title: "Search, filter, and CSV",
    description: "Keep every response manageable",
  },
];

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    label: "Build",
    features: [
      {
        icon: MousePointer2,
        title: "Page-based form builder",
        description:
          "Arrange fields into clear pages, configure each question, and build without writing code.",
      },
      {
        icon: Eye,
        title: "Live preview",
        description:
          "Step through the same responsive experience your respondents will use before you publish.",
      },
      {
        icon: LayoutTemplate,
        title: "Ready-made templates",
        description:
          "Start from Contact Intake, Support Ticket, Deal Qualification, Account Intake, or Task Request.",
      },
    ],
  },
  {
    label: "Collect",
    features: [
      {
        icon: CreditCard,
        title: "Payment steps",
        description:
          "Collect a response and its PayPal or Xendit payment as one connected journey.",
      },
      {
        icon: FileUp,
        title: "File uploads",
        description:
          "Let respondents attach the documents and images you need alongside their answers.",
      },
      {
        icon: GitBranch,
        title: "Conditional fields",
        description:
          "Show the right follow-up questions based on answers already given in the form.",
      },
    ],
  },
  {
    label: "Manage",
    features: [
      {
        icon: TableProperties,
        title: "Response workspace",
        description:
          "Search, sort, filter, inspect, and export submissions to CSV from one structured table.",
      },
      {
        icon: Share2,
        title: "Share and embed",
        description:
          "Publish a direct form link or place the responsive form inside your own website.",
      },
      {
        icon: ListRestart,
        title: "Payment recovery",
        description:
          "Verify pending transactions, copy active checkout links, or replace expired payment links.",
      },
    ],
  },
];

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    number: "01",
    icon: LayoutTemplate,
    title: "Choose a starting point",
    description: "Pick one of five templates or begin with a blank form.",
    mockup: "templates",
  },
  {
    number: "02",
    icon: Wrench,
    title: "Shape the experience",
    description: "Add pages, fields, conditions, and an optional payment step.",
    mockup: "builder",
  },
  {
    number: "03",
    icon: Send,
    title: "Preview and publish",
    description: "Check the respondent journey, then share its link or embed it.",
    mockup: "share",
  },
  {
    number: "04",
    icon: BarChart3,
    title: "Manage what arrives",
    description: "Review responses and payment status from the form workspace.",
    mockup: "responses",
  },
];

export const INTEGRATIONS: IntegrationItem[] = [
  {
    name: "PayPal",
    monogram: "P",
    description: "Create checkout sessions and reconcile their payment status.",
    accent: "#003087",
  },
  {
    name: "Xendit",
    monogram: "X",
    description: "Accept payments with verified webhooks and status recovery.",
    accent: "#0e6baf",
  },
  {
    name: "Resend",
    monogram: "R",
    description: "Send recovery links for pending payments from your domain.",
    accent: "#141413",
  },
];

export const PAYMENT_ASSURANCES = [
  { icon: BadgeCheck, label: "Gateway status verification" },
  { icon: CheckCircle2, label: "Amount and currency matching" },
  { icon: ListRestart, label: "Expired-link replacement" },
];
