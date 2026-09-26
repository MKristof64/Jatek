export default function PlayerGroupIcon({ count }) {
  const people = Math.max(2, count);
  const width = 18 + (people - 1) * 6;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height="24"
      viewBox={`0 0 ${width} 24`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="home-player-icons"
      aria-hidden="true"
      focusable="false"
    >
      <g data-player-silhouette="front">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </g>
      {Array.from({ length: people - 1 }, (_, index) => (
        <g key={index} transform={`translate(${index * 6} 0)`} data-player-silhouette="behind">
          <path d="M16 3.128a4 4 0 0 1 0 7.744" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        </g>
      ))}
    </svg>
  );
}
