// Decorative inline icons for the guest page. All are aria-hidden: every one
// sits inside a control or heading that already carries the accessible name.

export const CheckIcon = ({ size = 18, color = "currentColor", width = 2.2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 13l4 4L19 7"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CrossIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 7l10 10M17 7L7 17" stroke={color} strokeWidth="2.1" strokeLinecap="round" />
  </svg>
);

/** «Ще не знаю» (adr-019 §9.1): a question, not an answer yet. */
export const QuestionIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M9 9.2a3 3 0 115.2 2.1c-.9.9-2.2 1.5-2.2 3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="18.2" r="1.1" fill="currentColor" />
  </svg>
);

export const CalendarIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M3.5 9.5h17M8 2.8v4M16 2.8v4"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

export const PinIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 21s-7-6.3-7-11a7 7 0 1114 0c0 4.7-7 11-7 11z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

export const LinkIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M9 15l6-6M11 6.5l1-1a3.5 3.5 0 015 5l-2 2M13 17.5l-1 1a3.5 3.5 0 01-5-5l2-2"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const SpinnerIcon = () => (
  <svg
    className="gr-spin"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2.6" />
    <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export const MinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const EmptyEnvelopeIcon = () => (
  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect
      x="3"
      y="6"
      width="18"
      height="13"
      rx="2.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeDasharray="3 2.4"
    />
    <path
      d="M4 8l8 6 8-6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
