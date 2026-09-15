interface Props {
  blocked: boolean;
  message: string;
}

/**
 * Why Publish is disabled (FR-1.8), pinned where it cannot scroll away.
 *
 * The chat log says the same thing on every turn the date is still past, and
 * that stays — the two do different jobs. The log entry is the assistant
 * answering a refused publish in conversation; this is the standing
 * explanation of a disabled control, and it has to survive a collapsed log on
 * a phone. `useInvitationEditor` is unchanged: this renders from `dateBlocked`,
 * which App already reads for `canPublish`.
 */
export function PastDateBanner({ blocked, message }: Props) {
  if (!blocked) return null;
  return (
    <div className="cc-banner glass-solid" role="status">
      {message}
    </div>
  );
}
