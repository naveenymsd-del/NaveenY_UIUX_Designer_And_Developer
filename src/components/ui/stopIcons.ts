import type { StopIcon } from '@/data/world'

/** 24×24 stroke icons for the journey stops (guide, minimap, chip) */
export const STOP_ICONS: Record<StopIcon, string> = {
  start: 'M6 21V4 M6 4h11l-2.5 4 2.5 4H6',
  home: 'M4 11 12 4l8 7 M6 10v10h12V10 M10 20v-5h4v5',
  education: 'M2 9l10-5 10 5-10 5z M6 11v5c3 2 9 2 12 0v-5',
  office: 'M5 21V5h9v16 M14 9h5v12 M8 8h3 M8 12h3 M8 16h3 M3 21h18',
  projects: 'M3 5h18v11H3z M8 20h8 M12 16v4',
  gallery: 'M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6 M15.5 9.5a1.5 1.5 0 1 0 0.01 0',
  cafe: 'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17 M8.5 3.5c-.8 1 .8 2 0 3 M12.5 3.5c-.8 1 .8 2 0 3',
}
