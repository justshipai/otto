import { StubSender, type OutboundSender } from '@/lib/outbound/sender';

/** The one place a concrete sender is chosen — mirror of lib/store and lib/llm. */
export function getSender(): OutboundSender {
  return new StubSender();
}
