/**
 * Helpers to read the user's current UI context for the agent.
 */

const ACTIVE_SECTION_ID_KEY_PREFIX = 'keco-active-section:';
const ACTIVE_SECTION_NAME_KEY_PREFIX = 'keco-active-section-name:';

/** Persist the active section tab for a library (id + human-readable name). */
export function persistActiveSection(
  libraryId: string,
  sectionId: string,
  sectionName: string
): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(`${ACTIVE_SECTION_ID_KEY_PREFIX}${libraryId}`, sectionId);
  window.sessionStorage.setItem(`${ACTIVE_SECTION_NAME_KEY_PREFIX}${libraryId}`, sectionName);
}

/** Active section tab name persisted by LibraryAssetsTable. */
export function getActiveSectionName(libraryId?: string): string | undefined {
  if (!libraryId || typeof window === 'undefined') return undefined;
  const name = window.sessionStorage.getItem(`${ACTIVE_SECTION_NAME_KEY_PREFIX}${libraryId}`);
  return name || undefined;
}
