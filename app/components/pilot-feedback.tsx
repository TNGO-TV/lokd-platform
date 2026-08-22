"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

const categories = ["Bug", "Confusing", "Missing", "Idea"] as const;

function roleFor(pathname: string) {
  if (pathname.startsWith("/officer")) return "Officer";
  if (pathname.startsWith("/client")) return "Client";
  if (pathname.startsWith("/ops")) return "Operations";
  if (pathname.startsWith("/verify")) return "Passport verification";
  if (pathname.startsWith("/join")) return "Applicant";
  return "Public site";
}

export default function PilotFeedback() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<(typeof categories)[number]>("Idea");
  const [score, setScore] = useState(5);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ route: pathname, role: roleFor(pathname), category, score, note }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Feedback could not be saved.");
      setMessage("Thank you—your feedback is in the team review queue.");
      setNote("");
      window.setTimeout(() => { setOpen(false); setMessage(""); }, 1800);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Feedback could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button className="pilot-feedback-trigger" onClick={() => setOpen(true)} aria-label="Send pilot feedback">Feedback</button>
    {open && <div className="feedback-backdrop" onMouseDown={() => setOpen(false)}>
      <aside className="feedback-drawer" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="feedback-close" onClick={() => setOpen(false)} aria-label="Close feedback">×</button>
        <p className="eyebrow">Team pilot</p><h2 id="feedback-title">What should we improve?</h2>
        <p>Your note is saved with this screen and reviewer role.</p>
        <fieldset><legend>Feedback type</legend><div className="feedback-categories">{categories.map((item) => <button type="button" className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div></fieldset>
        <fieldset><legend>How clear was this screen?</legend><div className="feedback-score">{[1,2,3,4,5].map((item) => <button type="button" className={score === item ? "active" : ""} key={item} onClick={() => setScore(item)}>{item}</button>)}</div></fieldset>
        <label>Note<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="Tell us what worked, what was unclear, or what is missing." /></label>
        {message && <p className="feedback-message" role="status">{message}</p>}
        <button className="feedback-submit" disabled={busy || !note.trim()} onClick={() => void submit()}>{busy ? "Saving…" : "Send feedback"}</button>
      </aside>
    </div>}
  </>;
}
