import './study.css';

export interface StudyMascotProps {
  message: string;
  size?: number;
}

/**
 * StudyMascot — the original "Loopbug": a rounded-square study card with a
 * single orbit ring and two dot eyes. Simple inline-SVG geometry drawn here,
 * no external images, no copied mascot. Art is aria-hidden; the encouraging
 * message is real text.
 */
export function StudyMascot({ message, size = 56 }: StudyMascotProps) {
  return (
    <div className="study-mascot">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        aria-hidden="true"
        className="study-mascot-art"
      >
        {/* orbit ring */}
        <ellipse
          cx="32"
          cy="33"
          rx="26"
          ry="13"
          fill="none"
          stroke="var(--study-sun)"
          strokeWidth="3"
          strokeLinecap="round"
          transform="rotate(-18 32 33)"
        />
        {/* rounded-square card body */}
        <rect
          x="15"
          y="17"
          width="34"
          height="30"
          rx="8"
          fill="var(--study-primary)"
        />
        {/* card text lines */}
        <rect x="21" y="24" width="22" height="3.5" rx="1.75" fill="var(--study-primary-ink)" opacity="0.85" />
        <rect x="21" y="30" width="15" height="3.5" rx="1.75" fill="var(--study-primary-ink)" opacity="0.55" />
        {/* two dot eyes */}
        <circle cx="26" cy="39" r="2.6" fill="var(--study-primary-ink)" />
        <circle cx="38" cy="39" r="2.6" fill="var(--study-primary-ink)" />
        {/* orbit satellite dot */}
        <circle cx="55" cy="24" r="3" fill="var(--study-mint)" />
      </svg>
      <p className="study-mascot-message">{message}</p>
    </div>
  );
}

export default StudyMascot;
