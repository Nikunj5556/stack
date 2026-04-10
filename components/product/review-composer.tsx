"use client";

import { useState } from "react";

import { SUPPORT_ATTACHMENT_FOLDERS } from "@/lib/constants";
import { uploadFiles } from "@/lib/uploads-client";
import { safeJson } from "@/lib/utils";

export function ReviewComposer({ productId }: { productId: string }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState(
    "Signed-in customers can share a rating, written review, and optional screenshots or short videos."
  );

  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Write a review</p>
          <h2>Share your experience with other customers</h2>
        </div>
      </div>

      <div className="form-stack">
        <label className="field">
          <span>Rating</span>
          <select onChange={(event) => setRating(Number(event.target.value))} value={rating}>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} star{value > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Title</span>
          <input onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>
        <label className="field">
          <span>Review</span>
          <textarea onChange={(event) => setBody(event.target.value)} rows={4} value={body} />
        </label>
        <input
          accept="image/*,video/*"
          multiple
          onChange={(event) => setFiles(Array.from(event.target.files || []))}
          type="file"
        />
        <button
          className="button"
          onClick={async () => {
            try {
              const attachments = await uploadFiles(files, SUPPORT_ATTACHMENT_FOLDERS.review);
              await safeJson(
                await fetch("/api/reviews", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    productId,
                    rating,
                    reviewTitle: title,
                    reviewBody: body,
                    attachments
                  })
                })
              );
              setTitle("");
              setBody("");
              setFiles([]);
              setStatus("Review submitted successfully. If you bought this product on this account, your review will show a verified purchase badge.");
            } catch (error) {
              setStatus(error instanceof Error ? error.message : "Unable to submit review.");
            }
          }}
          type="button"
        >
          Submit review
        </button>
        <p className="muted">{status}</p>
      </div>
    </section>
  );
}
