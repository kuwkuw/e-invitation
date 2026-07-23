// Decorative inline icons for the editor. All aria-hidden: each sits inside a
// control that already carries its accessible name via aria-label or text.

export const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M15 5l-7 7 7 7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ShareIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 15V4M8 8l4-4 4 4"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Doubles as the "generating" marker and the empty-preview placeholder. */
export const SparkleIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3l1.7 5L19 9.6l-4.4 3.1L16 18l-4-3-4 3 1.4-5.3L5 9.6 10.3 8 12 3z"
      fill="currentColor"
    />
  </svg>
);

export const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 19V6M6 12l6-6 6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CloseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const RegenerateIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 12a8 8 0 0114-5.3M20 4v4h-4"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M20 12a8 8 0 01-14 5.3M4 20v-4h4"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const PencilIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 20h4L18 10l-4-4L4 16v4z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const VariantsIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3l9 5-9 5-9-5 9-5z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 13l9 5 9-5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Three-dot "working" indicator; CSS animates the dots. */
export const BusyDots = () => (
  <span className="cc-dots">
    <span className="cc-dot" />
    <span className="cc-dot" />
    <span className="cc-dot" />
  </span>
);
