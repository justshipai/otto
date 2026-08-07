/**
 * Outbound messages (email, SMS, …) leave the machine, so Otto ships with
 * NO real delivery: the default sender below just reports "sent" so the
 * product flow — draft → approve → sent state — can be exercised honestly
 * end to end.
 *
 * This is a small extension point: a contributor adds real delivery by
 * implementing OutboundSender in one file (an SMTP adapter, a Resend
 * adapter, …) and wiring it in lib/outbound/index.ts. Any real adapter
 * must remain approval-gated — senders are only ever invoked from an
 * approved draftAction.
 */

export interface OutboundMessage {
  to: string;
  subject?: string;
  body: string;
}

export interface OutboundSender {
  readonly name: string;
  send(message: OutboundMessage): Promise<{ status: 'sent' }>;
}

export class StubSender implements OutboundSender {
  readonly name = 'stub';

  async send(_message: OutboundMessage): Promise<{ status: 'sent' }> {
    // deliberately delivers nowhere
    return { status: 'sent' };
  }
}
