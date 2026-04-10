"use client";

import { useState } from "react";

export function HelpFeedback({ articleId }: { articleId: string }) {
  const [status, setStatus] = useState("Was this article helpful?");
  const [pending, setPending] = useState(false);

  async function sendFeedback(isHelpful: boolean) {
    setPending(true);
    try {
      const sessionId = window.localStorage.getItem("creatorstack-help-session") || crypto.randomUUID();
      window.localStorage.setItem("creatorstack-help-session", sessionId);

      const response = await fetch(`/api/help/${articleId}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          isHelpful,
          sessionId
        })
      });

      if (!response.ok) {
        throw new Error("We could not save your feedback right now.");
      }

      setStatus(isHelpful ? "Thanks for letting us know this article helped." : "Thanks. We'll use this to improve the article.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "We could not save your feedback right now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="section-block section-block--tight">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Article feedback</p>
          <h2>{status}</h2>
        </div>
      </div>
      <div className="button-row">
        <button className="button" disabled={pending} onClick={() => void sendFeedback(true)} type="button">
          Helpful
        </button>
        <button className="button button--ghost" disabled={pending} onClick={() => void sendFeedback(false)} type="button">
          Not helpful
        </button>
      </div>
    </section>
  );
}
