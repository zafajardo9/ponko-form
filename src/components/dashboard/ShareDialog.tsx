import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Check,
  Clock3,
  Code2,
  Copy,
  ExternalLink,
  Link2,
  Mail,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  createEmailSurveyInvitation,
  getEmailSurveyFields,
} from "../../lib/server-fns/email-surveys";
import { appConfig } from "../../utils/app-config";
import {
  buildEmailSurveyHtml,
  emailSurveyRatingUrl,
} from "../../lib/email/email-survey-html";
import { SVG_STAR_MARKER } from "../../lib/page-builder/satisfaction";
import { StarIcon } from "../ui/StarIcon";

interface ShareDialogProps {
  publicId: string;
  title: string;
  onClose: () => void;
}

type Tab = "link" | "embed" | "email";

/**
 * ShareDialog
 *
 * Surfaces the two ways a creator can make a published form accessible:
 *   1. Link  — a clean, navigation-free shareable page (/forms/submit/:id)
 *   2. Embed — a responsive <iframe> snippet that fills its host container and
 *              auto-resizes to fit the form's content (/forms/embed/:id)
 */
export function ShareDialog({ publicId, title, onClose }: ShareDialogProps) {
  const [tab, setTab] = useState<Tab>("link");
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedSurveyFieldId, setSelectedSurveyFieldId] = useState<number | null>(null);
  const [recipientReference, setRecipientReference] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [emailInvitation, setEmailInvitation] = useState<Awaited<ReturnType<typeof createEmailSurveyInvitation>> | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareId = publicId;
  const shareUrl = `${origin}/forms/submit/${shareId}`;
  const embedUrl = `${origin}/forms/embed/${shareId}`;

  // Responsive iframe + a tiny listener that resizes it to the form's content
  // height (the embed page posts its height via postMessage).
  const embedCode = `<iframe
  src="${embedUrl}"
  title="${title.replace(/"/g, "&quot;")}"
  style="width:100%;border:none;overflow:hidden;"
  width="100%"
  height="600"
  loading="lazy"
></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "ponkoform:resize" && String(e.data.formId) === "${shareId}") {
      var f = document.querySelector('iframe[src="${embedUrl}"]');
      if (f) f.style.height = e.data.height + "px";
    }
  });
</script>`;

  const emailFieldsQuery = useQuery({
    queryKey: ["email-survey-fields", publicId],
    queryFn: () => getEmailSurveyFields({ data: { publicId } }),
    enabled: tab === "email",
  });
  const emailFields = emailFieldsQuery.data?.fields ?? [];

  useEffect(() => {
    if (selectedSurveyFieldId == null && emailFields[0]) {
      setSelectedSurveyFieldId(emailFields[0].id);
    }
  }, [emailFields, selectedSurveyFieldId]);

  const createEmailLinks = useMutation({
    mutationFn: () => {
      if (selectedSurveyFieldId == null) throw new Error('Select a survey field')
      return createEmailSurveyInvitation({
        data: {
          publicId,
          fieldId: selectedSurveyFieldId,
          recipientReference: recipientReference.trim() || null,
          expiresInDays,
        },
      })
    },
    onSuccess: setEmailInvitation,
  });

  const emailHtml = emailInvitation
    ? buildEmailSurveyHtml({
        origin,
        publicId,
        token: emailInvitation.token,
        title: emailInvitation.field.label,
        options: emailInvitation.field.options,
      })
    : "";

  function copy(value: string, key: string) {
    navigator.clipboard?.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
  }

  async function copyEmailBlock() {
    if (!emailInvitation) return;

    const plainText = [
      emailInvitation.field.label,
      ...emailInvitation.field.options.map(
        (option) =>
          `${option.label}: ${emailSurveyRatingUrl(origin, publicId, emailInvitation.token, option.value)}`,
      ),
    ].join("\n");

    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([emailHtml], { type: "text/html" }),
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard?.writeText(emailHtml);
      }
      setCopied("email");
      setTimeout(() => setCopied((current) => (current === "email" ? null : current)), 2500);
    } catch {
      await navigator.clipboard?.writeText(emailHtml);
      setCopied("email");
      setTimeout(() => setCopied((current) => (current === "email" ? null : current)), 2500);
    }
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdrop}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${title}`}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-white/70 bg-[#f5f0e8] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e6dfd8] bg-[#faf9f5] px-5 py-3.5 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8e8b82]">
              Share form
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[#141413]">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#8e8b82] transition-colors hover:bg-[#e8e0d2] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
            aria-label="Close share dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1 border-b border-[#e6dfd8] bg-[#faf9f5] px-4 py-2.5 sm:px-6">
          <TabButton active={tab === "link"} onClick={() => setTab("link")}>
            <Link2 size={14} aria-hidden="true" />
            Link
          </TabButton>
          <TabButton active={tab === "embed"} onClick={() => setTab("embed")}>
            <Code2 size={14} aria-hidden="true" />
            Embed
          </TabButton>
          <TabButton active={tab === "email"} onClick={() => setTab("email")}>
            <Mail size={14} aria-hidden="true" />
            Email rating
          </TabButton>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 sm:p-6">
          {tab === "link" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[#6c6a64]">
                A clean, full-page form with no app navigation. Anyone with the
                link can view and submit it.
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded-md border border-[#e6dfd8] bg-white px-3 py-2 text-sm text-[#141413]"
                />
                <button
                  onClick={() => copy(shareUrl, "link")}
                  className="inline-flex h-9 items-center rounded-md bg-[#cc785c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#a9583e]"
                >
                  {copied === "link" ? "Copied!" : "Copy"}
                </button>
              </div>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[#cc785c] hover:text-[#a9583e]"
              >
                Open in new tab <ExternalLink size={12} />
              </a>
            </div>
          ) : tab === "embed" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[#6c6a64]">
                Paste this snippet into any site. The form is responsive — it
                fills the container it's placed in and auto-resizes to fit its
                content.
              </p>
              <div className="relative">
                <textarea
                  readOnly
                  value={embedCode}
                  onFocus={(e) => e.currentTarget.select()}
                  rows={10}
                  className="w-full resize-none rounded-md border border-[#e6dfd8] bg-white px-3 py-2 pr-20 font-mono text-xs leading-relaxed text-[#141413]"
                />
                <button
                  onClick={() => copy(embedCode, "embed")}
                  className="absolute right-2 top-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-[#e6dfd8] bg-white/95 px-2.5 text-xs font-medium text-[#5f5b55] shadow-sm transition-colors hover:border-[#cc785c]/50 hover:text-[#a9583e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30"
                >
                  {copied === "embed" ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                  {copied === "embed" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="rounded-lg border border-[#e6dfd8] bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5e4dc] text-[#a9583e]">
                    <Mail size={17} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#141413]">
                      Add a rating question to an email
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-[#6c6a64]">
                      Create a private rating block, then paste it into Gmail,
                      Outlook, Mailchimp, or another email tool.
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#8a5c48]">
                      <ShieldCheck size={13} aria-hidden="true" />
                      {appConfig.name} creates the links—it does not send the email.
                    </p>
                  </div>
                </div>
              </div>

              {emailFieldsQuery.isLoading ? (
                <div className="rounded-lg border border-[#e6dfd8] bg-white p-4 text-sm text-[#8e8b82]">
                  Loading rating questions…
                </div>
              ) : emailFieldsQuery.isError ? (
                <p className="rounded-lg border border-[#e3c5bd] bg-[#fff7f5] p-4 text-sm text-[#8a4034]">
                  We couldn’t load the rating questions. Close this window and try again.
                </p>
              ) : emailFields.length === 0 ? (
                <div className="rounded-lg border border-[#e6dfd8] bg-white p-4">
                  <p className="text-sm font-medium text-[#141413]">No rating question found</p>
                  <p className="mt-1 text-sm leading-5 text-[#6c6a64]">
                    Add and save a Satisfaction field in the form builder before creating an email rating block.
                  </p>
                </div>
              ) : (
                <>
                  {!emailFieldsQuery.data?.published && (
                    <p className="rounded-lg border border-[#d7a84c] bg-[#fff8e7] p-4 text-sm text-[#6b4f16]">
                      Publish this form before creating recipient links.
                    </p>
                  )}
                  <div className="rounded-lg border border-[#e6dfd8] bg-white p-4 sm:p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#141413] text-xs font-semibold text-white">1</span>
                      <h2 className="text-sm font-semibold text-[#141413]">Set up the rating block</h2>
                    </div>

                    <div className="flex flex-col gap-4">
                      <label className="flex flex-col gap-1.5 text-sm font-medium text-[#141413]">
                        Rating question
                        <select
                          value={selectedSurveyFieldId ?? ""}
                          onChange={(event) => {
                            setSelectedSurveyFieldId(Number(event.target.value));
                            setEmailInvitation(null);
                          }}
                          className="h-10 rounded-md border border-[#dedbd5] bg-white px-3 text-sm font-normal outline-none transition focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
                        >
                          {emailFields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1.5 text-sm font-medium text-[#141413]">
                        <span className="flex items-center gap-1.5">
                          <UserRound size={14} className="text-[#8e8b82]" aria-hidden="true" />
                          Who is this for?
                          <span className="font-normal text-[#8e8b82]">(optional)</span>
                        </span>
                        <input
                          value={recipientReference}
                          onChange={(event) => { setRecipientReference(event.target.value); setEmailInvitation(null); }}
                          placeholder="Email address or customer ID"
                          className="h-10 rounded-md border border-[#dedbd5] bg-white px-3 text-sm font-normal outline-none transition placeholder:text-[#aaa69e] focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
                        />
                        <span className="text-xs font-normal leading-4 text-[#8e8b82]">
                          Used only to identify this response. {appConfig.name} will not email them.
                        </span>
                      </label>

                      <label className="flex flex-col gap-1.5 text-sm font-medium text-[#141413]">
                        <span className="flex items-center gap-1.5">
                          <Clock3 size={14} className="text-[#8e8b82]" aria-hidden="true" />
                          Keep the rating links active for
                        </span>
                        <select
                          value={expiresInDays}
                          onChange={(event) => { setExpiresInDays(Number(event.target.value)); setEmailInvitation(null); }}
                          className="h-10 rounded-md border border-[#dedbd5] bg-white px-3 text-sm font-normal outline-none transition focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
                        >
                          <option value={7}>7 days</option>
                          <option value={30}>30 days</option>
                          <option value={60}>60 days</option>
                          <option value={90}>90 days</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => createEmailLinks.mutate()}
                    disabled={!selectedSurveyFieldId || !emailFieldsQuery.data?.published || createEmailLinks.isPending}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#cc785c] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#a9583e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Mail size={15} aria-hidden="true" />
                    {createEmailLinks.isPending ? "Creating rating block…" : "Create email rating block"}
                  </button>
                  {createEmailLinks.isError && (
                    <p className="rounded-md border border-[#e3c5bd] bg-[#fff7f5] p-3 text-sm text-[#c64545]">
                      {(createEmailLinks.error as Error).message}
                    </p>
                  )}
                </>
              )}

              {emailInvitation && (
                <div className="rounded-lg border border-[#dccfc5] bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#141413] text-xs font-semibold text-white">2</span>
                      <h2 className="text-sm font-semibold text-[#141413]">Copy it into your email</h2>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf4ec] px-2 py-1 text-[11px] font-semibold text-[#3f7048]">
                      <Check size={11} aria-hidden="true" />
                      Ready
                    </span>
                  </div>

                  <div className="rounded-md border border-[#e6dfd8] bg-[#faf9f5] p-3">
                    <p className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-[#8e8b82]">Email preview</p>
                    <p className="mb-3 text-sm font-semibold text-[#141413]">{emailInvitation.field.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {emailInvitation.field.options.map((option) => (
                        <a
                          key={option.value}
                          href={emailSurveyRatingUrl(origin, publicId, emailInvitation.token, option.value)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-h-16 min-w-16 flex-1 flex-col items-center justify-center rounded-md border border-[#dedbd5] bg-white px-2 py-2 text-center text-xs text-[#141413] transition-colors hover:border-[#cc785c] hover:bg-[#fffaf7]"
                        >
                          {option.emoji === SVG_STAR_MARKER ? (
                            <StarIcon size={24} filled className="text-[#cc785c]" />
                          ) : (
                            <span className="text-xl">{option.emoji || option.value}</span>
                          )}
                          <span className="mt-1">{option.label}</span>
                        </a>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={copyEmailBlock}
                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#141413] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#343330] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
                  >
                    {copied === "email" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                    {copied === "email" ? "Rating block copied" : "Copy rating block"}
                  </button>
                  <p className="mt-2 text-center text-xs leading-4 text-[#8e8b82]">
                    Paste it into your email message, then send from your usual email tool.
                    Create a new block for each recipient.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
        active
          ? "bg-white text-[#141413] shadow-sm ring-1 ring-[#e6dfd8]"
          : "text-[#6c6a64] hover:bg-white/60 hover:text-[#141413]"
      }`}
    >
      {children}
    </button>
  );
}
