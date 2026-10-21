/** Lijniconen, 24×24, kleur via currentColor. */
const P = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

type IconProps = { size?: number };

const svg = (path: JSX.Element, size = 22) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...P}>
    {path}
  </svg>
);

export const IconHome = ({ size }: IconProps) =>
  svg(<><path d="M4 11.5 12 5l8 6.5" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></>, size);
export const IconList = ({ size }: IconProps) =>
  svg(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9.5h16M9 3v4M15 3v4" /><path d="M8 13.5h2M8 16.5h2M13 13.5h3M13 16.5h3" /></>, size);
export const IconMap = ({ size }: IconProps) =>
  svg(<><path d="M12 21s-6-5.6-6-10.5A6 6 0 0 1 18 10.5C18 15.4 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.2" /></>, size);
export const IconBookmark = ({ size }: IconProps) => svg(<path d="M6.5 4h11v16.5L12 16.8 6.5 20.5Z" />, size);
export const IconUser = ({ size }: IconProps) =>
  svg(<><circle cx="9" cy="8.5" r="3" /><circle cx="17" cy="10" r="2.2" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><path d="M14.8 15.2c.7-.5 1.4-.7 2.2-.7 2 0 3.4 1.4 3.8 3.8" /></>, size);
export const IconFilter = ({ size }: IconProps) =>
  svg(<><path d="M4 6h16M7 12h10M10 18h4" /></>, size);
export const IconSearch = ({ size }: IconProps) =>
  svg(<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>, size);
export const IconClose = ({ size }: IconProps) => svg(<path d="M6 6l12 12M18 6 6 18" />, size);
export const IconExternal = ({ size }: IconProps) =>
  svg(<><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>, size);
export const IconRoute = ({ size }: IconProps) =>
  svg(<><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16" /></>, size);
export const IconCalendarPlus = ({ size }: IconProps) =>
  svg(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9.5h16M9 3v4M15 3v4M12 12.5v5M9.5 15h5" /></>, size);
export const IconRefresh = ({ size }: IconProps) =>
  svg(<><path d="M19 12a7 7 0 1 1-2.1-5" /><path d="M19 4v4h-4" /></>, size);
export const IconInfo = ({ size }: IconProps) =>
  svg(<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.2" /></>, size);
export const IconChevron = ({ size }: IconProps) => svg(<path d="m9 6 6 6-6 6" />, size);
export const IconRain = ({ size }: IconProps) =>
  svg(<><path d="M7 15a4 4 0 0 1 .4-8 5 5 0 0 1 9.6 1.5A3.3 3.3 0 0 1 16.5 15Z" /><path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2" /></>, size);
