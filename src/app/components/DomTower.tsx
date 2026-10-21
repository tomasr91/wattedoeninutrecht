/**
 * Eigen, vereenvoudigde tekening van de Domtoren: twee vierkante geledingen,
 * de achthoekige lantaarn met pinakels, de bekroning en de doorgang onderin.
 * De toren neemt currentColor aan; vensters en doorgang zijn uitsparingen.
 */
export function DomTower({ height = 44, title, line = false }: { height?: number; title?: string; line?: boolean }) {
  return (
    <svg
      viewBox="0 0 32 96"
      height={height}
      width={(height * 32) / 96}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        fill={line ? 'none' : 'currentColor'}
        stroke={line ? 'currentColor' : undefined}
        strokeWidth={line ? 1.2 : undefined}
        vectorEffect={line ? 'non-scaling-stroke' : undefined}
        strokeLinejoin="round"
        fillRule="evenodd"
        d={[
          // Spits en bekroning
          'M15.4 0h1.2v4.4h-1.2z',
          'M16 4.5c3 1.6 4.6 4.6 4.8 10.5H11.2C11.4 9.1 13 6.1 16 4.5z',
          // Lantaarn met pinakels
          'M10.6 15h10.8v23H10.6z',
          'M8.6 22 9.6 12.5 10.6 22z',
          'M21.4 22 22.4 12.5 23.4 22z',
          // Tweede geleding met pinakels
          'M7 38h18v25H7z',
          'M5.2 43 6.1 33 7 43z',
          'M25 43 25.9 33 26.8 43z',
          // Onderste geleding
          'M6 63h20v33H6z',
          // Uitsparingen: lantaarnvensters
          'M13 20.5a1 1 0 0 1 2 0V33h-2z',
          'M17 20.5a1 1 0 0 1 2 0V33h-2z',
          // Hoge spitsboogvensters tweede geleding
          'M10.2 44.5a1.4 1.4 0 0 1 2.8 0V59h-2.8z',
          'M19 44.5a1.4 1.4 0 0 1 2.8 0V59h-2.8z',
          // Vensters onderste geleding
          'M9.6 67.5a1.2 1.2 0 0 1 2.4 0V77H9.6z',
          'M20 67.5a1.2 1.2 0 0 1 2.4 0V77H20z',
          // Doorgang onder de toren
          'M12.6 96V86a3.4 3.4 0 0 1 6.8 0v10z',
        ].join(' ')}
      />
    </svg>
  );
}
