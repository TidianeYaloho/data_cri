const iconPaths = {
  agriculture: (
    <>
      <path d="M12 21c0-7.5 2.4-12.4 8-16-1 7.4-3.8 12.1-8 16Z" />
      <path d="M12 21c0-6.2-2.4-10.3-8-14 1 6.4 3.7 10.4 8 14Z" />
      <path d="M12 21V9" />
    </>
  ),
  energie: (
    <path d="m13 2-8 12h6l-1 8 9-13h-6l0-7Z" />
  ),
  industrie: (
    <>
      <path d="M3 21V10l6 3V9l6 3V6l6 3v12H3Z" />
      <path d="M7 21v-4h3v4M15 21v-4h3v4" />
    </>
  ),
  environnement: (
    <>
      <path d="M7.5 7.5A6.5 6.5 0 0 1 18 9" />
      <path d="m18 5 .5 4-4-.5" />
      <path d="M16.5 16.5A6.5 6.5 0 0 1 6 15" />
      <path d="m6 19-.5-4 4 .5" />
    </>
  ),
  tourisme: (
    <>
      <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  service: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2.5 21c.5-5 2.5-7 5.5-7s5 2 5.5 7" />
      <path d="M13.5 15c1-.8 2.1-1.2 3.5-1.2 2.7 0 4.2 1.8 4.5 5.2" />
    </>
  ),
};

export default function SectorIcon({ sector, size = 34 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[sector] || iconPaths.service}
    </svg>
  );
}
