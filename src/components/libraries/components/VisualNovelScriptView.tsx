'use client';

import React, { useMemo } from 'react';
import type { AssetRow } from '@/lib/types/libraryAssets';
import styles from './VisualNovelScriptView.module.css';

export interface ScriptColumns {
  labelKey?: string;
  typeKey?: string;
  nameKey?: string;
  contentKey?: string;
}

interface VisualNovelScriptViewProps {
  rows: AssetRow[];
  scriptColumns: ScriptColumns;
}

function resolveSpeakerName(nameValue: string | undefined | null): string {
  if (!nameValue) return 'Narrator';
  const v = String(nameValue).trim();
  if (v === '1') return 'Assistant';
  if (v === '2') return 'Altana';
  // If the name is a non-empty string that's not a numeric code, use it directly (e.g. Chinese names)
  if (v && !/^\d+$/.test(v)) return v;
  return 'Narrator';
}

function resolveDialogType(typeValue: string | number | undefined | null): string | null {
  if (typeValue === undefined || typeValue === null) return null;
  const v = String(typeValue).trim();
  if (v === '1' || v === '2' || v === '3') return v;
  return null;
}

/**
 * Build a speaker-to-side map: each unique speaker is assigned 'left' or 'right'
 * based on order of first appearance (1st→left, 2nd→right, 3rd→left, ...).
 * The same speaker always stays on the same side.
 */
function buildSpeakerAlignmentMap(
  rows: AssetRow[],
  typeKey: string | undefined,
  nameKey: string | undefined,
): Map<string, 'left' | 'right'> {
  const map = new Map<string, 'left' | 'right'>();
  let side: 'left' | 'right' = 'left';

  for (const row of rows) {
    const typeVal = typeKey ? row.propertyValues[typeKey] : undefined;
    if (resolveDialogType(typeVal)) continue; // has explicit type, skip

    const nameVal = nameKey ? row.propertyValues[nameKey] : undefined;
    const speakerName = resolveSpeakerName(nameVal);
    if (!speakerName || speakerName === 'Narrator') continue;

    if (!map.has(speakerName)) {
      map.set(speakerName, side);
      side = side === 'left' ? 'right' : 'left';
    }
  }
  return map;
}

/**
 * Determine dialog alignment from Type field, or fallback to speaker map.
 */
function getDialogAlignment(
  typeValue: string | number | undefined | null,
  speakerName: string,
  speakerMap: Map<string, 'left' | 'right'>,
): 'left' | 'right' {
  const type = resolveDialogType(typeValue);
  if (type === '1') return 'left';
  if (type === '2') return 'right';
  if (type === '3') return 'left';

  // Fallback: use speaker map (same speaker always on same side)
  return speakerMap.get(speakerName) ?? 'left';
}

function getAvatarLetter(speakerName: string): string {
  if (speakerName === 'Altana') return 'A';
  if (speakerName === 'Assistant') return 'A';
  return 'N';
}

function getAvatarColor(speakerName: string, alignment: 'left' | 'right'): 'blue' | 'pink' {
  if (speakerName === 'Altana') return 'pink';
  return alignment === 'right' ? 'pink' : 'blue';
}

function getDialogColorClass(typeValue: string | number | undefined | null): 'blue' | 'pink' | 'gray' {
  const type = resolveDialogType(typeValue);
  if (type === '2') return 'pink';
  if (type === '3') return 'gray';
  return 'blue';
}

export function VisualNovelScriptView({ rows, scriptColumns }: VisualNovelScriptViewProps) {
  const { labelKey, typeKey, nameKey, contentKey } = scriptColumns;

  // Filter rows: start from the row where Label contains "Start" (case-insensitive)
  const filteredRows = useMemo(() => {
    if (!labelKey) return rows;
    const startIndex = rows.findIndex((row) => {
      const labelVal = row.propertyValues[labelKey];
      if (!labelVal) return false;
      return String(labelVal).trim().toLowerCase().includes('start');
    });
    if (startIndex === -1) return rows; // no "Start" found, show all
    return rows.slice(startIndex);
  }, [rows, labelKey]);

  // Build speaker-to-side alignment map for fallback (when Type is not 1/2/3)
  const speakerAlignmentMap = useMemo(
    () => buildSpeakerAlignmentMap(filteredRows, typeKey, nameKey),
    [filteredRows, typeKey, nameKey],
  );

  if (!filteredRows.length) {
    return <div className={styles.emptyState}>No script data</div>;
  }

  return (
    <div className={styles.container}>
      {filteredRows.map((row) => {
        const labelVal = labelKey ? row.propertyValues[labelKey] : undefined;
        const typeVal = typeKey ? row.propertyValues[typeKey] : undefined;
        const nameVal = nameKey ? row.propertyValues[nameKey] : undefined;
        const contentVal = contentKey ? row.propertyValues[contentKey] : undefined;

        const content = String(contentVal ?? '').trim();
        const label = String(labelVal ?? '').trim();

        // Render scene marker
        if (label && !content) {
          return (
            <div key={row.id} className={styles.sceneMarker}>
              <span className={styles.sceneMarkerText}>{label}</span>
            </div>
          );
        }

        // Skip rows with no content and no label
        if (!content && !label) return null;

        const speakerName = resolveSpeakerName(nameVal);
        const alignment = getDialogAlignment(typeVal, speakerName, speakerAlignmentMap);
        const avatarColor = getAvatarColor(speakerName, alignment);
        const avatarLetter = getAvatarLetter(speakerName);
        const dialogColor = getDialogColorClass(typeVal);

        // Determine dialog type tag label
        const typeTag = dialogColor === 'pink' ? 'PINK DIALOG' : dialogColor === 'gray' ? 'NARRATOR' : 'BLUE DIALOG';
        const tagColorClass = dialogColor === 'pink' ? 'pink' : dialogColor === 'gray' ? 'gray' : 'blue';

        return (
          <div key={row.id} className={`${styles.dialogRow} ${alignment === 'right' ? styles.right : styles.left}`}>
            <div>
              <div className={styles.speakerHeader}>
                <div className={`${styles.avatar} ${styles[avatarColor]}`}>
                  {avatarLetter}
                </div>
                <span className={styles.speakerName}>{speakerName}</span>
                <span className={`${styles.dialogTag} ${styles[tagColorClass]}`}>
                  {typeTag}
                </span>
              </div>
              <div className={`${styles.dialogBubble} ${styles[dialogColor]}`}>
                {content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
