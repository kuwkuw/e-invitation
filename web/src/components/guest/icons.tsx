import type { CSSProperties } from "react";

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

export const Twinkle = ({
  className,
  style,
  size,
}: {
  className: string;
  style?: CSSProperties;
  size: number;
}) => (
  <svg
    className={className}
    style={style}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" fill="currentColor" />
  </svg>
);

/** Trailing affordance on every action row. */
export const ChevronIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 6l6 6-6 6" stroke="#c3bbac" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const CalendarIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="#b3592e" strokeWidth="1.7" />
    <path
      d="M3.5 9.5h17M8 2.8v4M16 2.8v4"
      stroke="#b3592e"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

export const PinIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 21s-7-6.3-7-11a7 7 0 1114 0c0 4.7-7 11-7 11z"
      stroke="#b3592e"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="10" r="2.4" stroke="#b3592e" strokeWidth="1.7" />
  </svg>
);

export const LinkIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M9 15l6-6M11 6.5l1-1a3.5 3.5 0 015 5l-2 2M13 17.5l-1 1a3.5 3.5 0 01-5-5l2-2"
      stroke="#b3592e"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const HeartIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 20s-6.5-4.35-9-8.5C1.4 8.5 3 5.5 6 5.5c1.9 0 3.2 1.1 4 2.3.8-1.2 2.1-2.3 4-2.3 3 0 4.6 3 3 6-2.5 4.15-9 8.5-9 8.5z"
      stroke="#9a9384"
      strokeWidth="1.7"
      strokeLinejoin="round"
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
    <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="2.6" />
    <path d="M21 12a9 9 0 00-9-9" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
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
      stroke="#b7ae9e"
      strokeWidth="1.6"
      strokeDasharray="3 2.4"
    />
    <path
      d="M4 8l8 6 8-6"
      stroke="#b7ae9e"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
