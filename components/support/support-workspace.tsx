"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  Conversation,
  ConversationMessage,
  Customer,
  SupportTicket,
  SupportWorkspaceData,
  TicketMessage
} from "@/lib/supabase/types";
import { SUPPORT_ATTACHMENT_FOLDERS } from "@/lib/constants";
import { uploadFiles } from "@/lib/uploads-client";
import { safeJson } from "@/lib/utils";

export function SupportWorkspace({ initialData }: { initialData: SupportWorkspaceData | null }) {
  const supabase = getSupabaseBrowserClient();
  const [workspace, setWorkspace] = useState(initialData);
  const [chatMessage, setChatMessage] = useState("");
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const [ticketReply, setTicketReply] = useState("");
  const [status, setStatus] = useState("Chat with us live or open a support request whenever you need help.");

  const customer = workspace?.customer as Customer | undefined;
  const activeConversation = workspace?.conversations?.[0] as Conversation | undefined;
  const activeTicket = workspace?.tickets?.[0] as SupportTicket | undefined;

  useEffect(() => {
    if (!customer) {
      return;
    }

    const channel = supabase
      .channel(`support-${customer.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `customer_id=eq.${customer.id}` }, (payload) => {
        setWorkspace((current) => {
          if (!current) return current;
          const incoming = payload.new as Conversation;
          if (!incoming?.id) return current;
          const next = [...current.conversations.filter((entry) => entry.id !== incoming.id), incoming];
          return { ...current, conversations: next };
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `customer_id=eq.${customer.id}` }, (payload) => {
        setWorkspace((current) => {
          if (!current) return current;
          const incoming = payload.new as SupportTicket;
          if (!incoming?.id) return current;
          const next = [...current.tickets.filter((entry) => entry.id !== incoming.id), incoming];
          return { ...current, tickets: next };
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [customer, supabase]);

  useEffect(() => {
    if (!activeConversation) {
      return;
    }

    const channel = supabase
      .channel(`conversation-${activeConversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${activeConversation.id}` },
        (payload) => {
          setWorkspace((current) => {
            if (!current) return current;
            const message = payload.new as ConversationMessage;
            if (current.conversationMessages.some((entry) => entry.id === message.id)) {
              return current;
            }
            return { ...current, conversationMessages: [...current.conversationMessages, message] };
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeConversation, supabase]);

  useEffect(() => {
    if (!activeTicket) {
      return;
    }

    const channel = supabase
      .channel(`ticket-${activeTicket.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${activeTicket.id}` },
        (payload) => {
          setWorkspace((current) => {
            if (!current) return current;
            const message = payload.new as TicketMessage;
            if (current.ticketMessages.some((entry) => entry.id === message.id)) {
              return current;
            }
            return { ...current, ticketMessages: [...current.ticketMessages, message] };
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeTicket, supabase]);

  const canRender = useMemo(() => Boolean(workspace && customer), [workspace, customer]);

  if (!canRender) {
    return (
      <section className="empty-panel">
        <p className="eyebrow">Customer account required</p>
        <h2>Sign in to start live chat, track ticket replies, and manage order-specific support.</h2>
        <p className="muted">
          The help articles and guides on this page are open to everyone. Sign in when you need personal support.
        </p>
        <a className="button" href="/auth">
          Sign in
        </a>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="support-card">
        <p className="eyebrow">Support workspace</p>
        <h2>Manage conversations, tickets, and file attachments in one place.</h2>
        <p className="muted">{status}</p>
      </section>

      <div className="support-layout">
        <section className="support-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Live chat</p>
              <h2>Chat with our team</h2>
            </div>
            <button
              className="button button--ghost"
              onClick={async () => {
                const conversation = await safeJson<Conversation>(
                  await fetch("/api/support/conversations", { method: "POST" })
                );
                setWorkspace((current) =>
                  current
                    ? {
                        ...current,
                        conversations: [conversation, ...current.conversations.filter((item) => item.id !== conversation.id)]
                      }
                    : current
                );
              }}
              type="button"
            >
              Start chat
            </button>
          </div>

          <div className="message-stream">
            {workspace?.conversationMessages.length ? (
              workspace.conversationMessages.map((message) => (
                <article className="message-card" key={message.id}>
                  <strong>{message.sender_type}</strong>
                  <p>{message.content}</p>
                  {message.attachments?.length ? (
                    <div className="attachment-list">
                      {message.attachments.map((attachment) => (
                        <a href={attachment} key={attachment} rel="noreferrer" target="_blank">
                          Attachment
                        </a>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="muted">Start a conversation and we will reply here.</p>
            )}
          </div>

          <div className="form-stack">
            <label className="field">
              <span>Message</span>
              <textarea onChange={(event) => setChatMessage(event.target.value)} rows={4} value={chatMessage} />
            </label>
            <input multiple onChange={(event) => setChatFiles(Array.from(event.target.files || []))} type="file" />
            <button
              className="button"
              onClick={async () => {
                try {
                  const conversation = activeConversation
                    ? activeConversation
                    : await safeJson<Conversation>(await fetch("/api/support/conversations", { method: "POST" }));
                  const attachments = await uploadFiles(chatFiles, SUPPORT_ATTACHMENT_FOLDERS.conversation);
                  const message = await safeJson<ConversationMessage>(
                    await fetch(`/api/support/conversations/${conversation.id}/messages`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json"
                      },
                      body: JSON.stringify({
                        content: chatMessage,
                        attachments
                      })
                    })
                  );
                  setWorkspace((current) =>
                    current
                      ? {
                          ...current,
                          conversations: [conversation, ...current.conversations.filter((entry) => entry.id !== conversation.id)],
                          conversationMessages: [...current.conversationMessages, message]
                        }
                      : current
                  );
                  setChatMessage("");
                  setChatFiles([]);
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : "We could not send your message right now.");
                }
              }}
              type="button"
            >
              Send message
            </button>
          </div>
        </section>

        <section className="support-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Tickets</p>
              <h2>Support requests</h2>
            </div>
          </div>

          <div className="message-stream">
            {workspace?.tickets.length ? (
              workspace.tickets.map((ticket) => (
                <article className="message-card" key={ticket.id}>
                  <strong>{ticket.ticket_number}</strong>
                  <p>{ticket.subject}</p>
                  <p className="muted">{ticket.status}</p>
                </article>
              ))
            ) : (
              <p className="muted">You have not opened any support requests yet.</p>
            )}
          </div>

          <div className="form-stack">
            <label className="field">
              <span>Subject</span>
              <input onChange={(event) => setTicketSubject(event.target.value)} value={ticketSubject} />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea onChange={(event) => setTicketDescription(event.target.value)} rows={4} value={ticketDescription} />
            </label>
            <input multiple onChange={(event) => setTicketFiles(Array.from(event.target.files || []))} type="file" />
            <button
              className="button button--ghost"
              onClick={async () => {
                try {
                  const attachments = await uploadFiles(ticketFiles, SUPPORT_ATTACHMENT_FOLDERS.ticket);
                  const ticket = await safeJson<SupportTicket>(
                    await fetch("/api/support/tickets", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json"
                      },
                      body: JSON.stringify({
                        subject: ticketSubject,
                        description: ticketDescription,
                        attachments
                      })
                    })
                  );
                  setWorkspace((current) =>
                    current ? { ...current, tickets: [ticket, ...current.tickets] } : current
                  );
                  setTicketSubject("");
                  setTicketDescription("");
                  setTicketFiles([]);
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : "We could not create your support request right now.");
                }
              }}
              type="button"
            >
              Create ticket
            </button>
          </div>

          {activeTicket ? (
            <>
              <div className="message-stream">
                {workspace?.ticketMessages.map((message) => (
                  <article className="message-card" key={message.id}>
                    <strong>{message.sender_type}</strong>
                    <p>{message.message_body}</p>
                    {message.attachments?.length ? (
                      <div className="attachment-list">
                        {message.attachments.map((attachment) => (
                          <a href={attachment} key={attachment} rel="noreferrer" target="_blank">
                            Attachment
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className="form-stack">
                <label className="field">
                  <span>Reply to ticket</span>
                  <textarea onChange={(event) => setTicketReply(event.target.value)} rows={3} value={ticketReply} />
                </label>
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      const message = await safeJson<TicketMessage>(
                        await fetch(`/api/support/tickets/${activeTicket.id}/messages`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json"
                          },
                          body: JSON.stringify({
                            message: ticketReply,
                            attachments: []
                          })
                        })
                      );
                      setWorkspace((current) =>
                        current ? { ...current, ticketMessages: [...current.ticketMessages, message] } : current
                      );
                      setTicketReply("");
                    } catch (error) {
                      setStatus(error instanceof Error ? error.message : "We could not send your reply right now.");
                    }
                  }}
                  type="button"
                >
                  Send ticket reply
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
