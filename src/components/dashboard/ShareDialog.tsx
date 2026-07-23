import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, ExternalLink } from "lucide-react";
import {
  createEmailSurveyInvitation,
  getEmailSurveyFields,
} from "../../lib/server-fns/email-surveys";
import {
  buildEmailSurveyHtml,
  emailSurveyRatingUrl,
} from "../../lib/email-survey-html";
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
    mutationFn: () => createEmailSurveyInvitation({
      data: {
        publicId,
        fieldId: selectedSurveyFieldId!,
        recipientReference: recipientReference.trim() || null,
        expiresInDays,
      },
    }),
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

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdrop}
    >
      <div className="flex w-full max-w-lg flex-col rounded-xl bg-[#f5f0e8] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl bg-[#faf9f5] border-b border-[#e6dfd8] px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[#8e8b82]">
              Share —
            </span>
            <span className="text-sm font-medium text-[#141413]">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#8e8b82] hover:bg-[#e8e0d2] hover:text-[#141413] transition-colors"
            aria-label="Close share dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#e6dfd8] px-6 pt-4">
          <TabButton active={tab === "link"} onClick={() => setTab("link")}>
            Share link
          </TabButton>
          <TabButton active={tab === "embed"} onClick={() => setTab("embed")}>
            Embed
          </TabButton>
          <TabButton active={tab === "email"} onClick={() => setTab("email")}>
            Email survey
          </TabButton>
        </div>

        {/* Body */}
        <div className="p-6">
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
              <textarea
                readOnly
                value={embedCode}
                onFocus={(e) => e.currentTarget.select()}
                rows={10}
                className="w-full resize-none rounded-md border border-[#e6dfd8] bg-white px-3 py-2 font-mono text-xs leading-relaxed text-[#141413]"
              />
              <button
                onClick={() => copy(embedCode, "embed")}
                className="inline-flex h-9 w-fit items-center rounded-md bg-[#cc785c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#a9583e]"
              >
                {copied === "embed" ? "Copied!" : "Copy embed code"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-6 text-[#6c6a64]">
                Generate email-safe rating buttons for one recipient. Opening a link only preselects the rating; the response is recorded after they submit the hosted form.
              </p>

              {emailFieldsQuery.isLoading ? (
                <p className="text-sm text-[#8e8b82]">Loading satisfaction fields…</p>
              ) : emailFieldsQuery.isError ? (
                <p className="rounded-md border border-[#e3c5bd] bg-[#fff7f5] p-3 text-sm text-[#8a4034]">Unable to load satisfaction fields.</p>
              ) : emailFields.length === 0 ? (
                <p className="rounded-md border border-[#e6dfd8] bg-white p-3 text-sm text-[#6c6a64]">Add and save a Satisfaction field before generating email survey buttons.</p>
              ) : (
                <>
                  {!emailFieldsQuery.data?.published && (
                    <p className="rounded-md border border-[#d7a84c] bg-[#fff8e7] p-3 text-sm text-[#6b4f16]">Publish the form before generating links.</p>
                  )}
                  <label className="flex flex-col gap-1.5 text-sm text-[#141413]">
                    Satisfaction question
                    <select
                      value={selectedSurveyFieldId ?? ""}
                      onChange={(event) => {
                        setSelectedSurveyFieldId(Number(event.target.value));
                        setEmailInvitation(null);
                      }}
                      className="rounded-md border border-[#e6dfd8] bg-white px-3 py-2"
                    >
                      {emailFields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm text-[#141413]">
                    Recipient reference <span className="text-xs text-[#8e8b82]">Stored privately and never placed in the URL.</span>
                    <input
                      value={recipientReference}
                      onChange={(event) => { setRecipientReference(event.target.value); setEmailInvitation(null); }}
                      placeholder="customer@example.com or CRM-123"
                      className="rounded-md border border-[#e6dfd8] bg-white px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm text-[#141413]">
                    Link expiration
                    <select
                      value={expiresInDays}
                      onChange={(event) => { setExpiresInDays(Number(event.target.value)); setEmailInvitation(null); }}
                      className="rounded-md border border-[#e6dfd8] bg-white px-3 py-2"
                    >
                      <option value={7}>7 days</option>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => createEmailLinks.mutate()}
                    disabled={!selectedSurveyFieldId || !emailFieldsQuery.data?.published || createEmailLinks.isPending}
                    className="inline-flex h-9 w-fit items-center rounded-md bg-[#cc785c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#a9583e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {createEmailLinks.isPending ? "Generating…" : "Generate secure email buttons"}
                  </button>
                  {createEmailLinks.isError && (
                    <p className="text-sm text-[#c64545]">{(createEmailLinks.error as Error).message}</p>
                  )}
                </>
              )}

              {emailInvitation && (
                <div className="flex flex-col gap-3 border-t border-[#e6dfd8] pt-4">
                  <p className="text-xs leading-5 text-[#8e8b82]">This token is unique to this invitation. Generate a new one for each recipient.</p>
                  <div className="flex flex-wrap gap-2 rounded-md border border-[#e6dfd8] bg-white p-3">
                    {emailInvitation.field.options.map((option) => (
                      <a
                        key={option.value}
                        href={emailSurveyRatingUrl(origin, publicId, emailInvitation.token, option.value)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-16 min-w-16 flex-1 flex-col items-center justify-center rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-2 py-2 text-center text-xs text-[#141413]"
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
                  <textarea
                    readOnly
                    value={emailHtml}
                    onFocus={(event) => event.currentTarget.select()}
                    rows={8}
                    className="w-full resize-none rounded-md border border-[#e6dfd8] bg-white px-3 py-2 font-mono text-xs leading-relaxed text-[#141413]"
                  />
                  <button
                    type="button"
                    onClick={() => copy(emailHtml, "email")}
                    className="inline-flex h-9 w-fit items-center rounded-md bg-[#cc785c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#a9583e]"
                  >
                    {copied === "email" ? "Copied!" : "Copy email HTML"}
                  </button>
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
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
        active
          ? "border-[#cc785c] font-medium text-[#141413]"
          : "border-transparent text-[#6c6a64] hover:text-[#141413]"
      }`}
    >
      {children}
    </button>
  );
}
