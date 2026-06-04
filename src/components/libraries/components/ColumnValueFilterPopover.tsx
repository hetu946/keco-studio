'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import type { AssetRow, PropertyConfig } from '@/lib/types/libraryAssets';
import {
  collectColumnUniqueValues,
  formatFilterValueLabel,
  getFilterValueInitial,
  type ColumnFilterOptions,
} from '@/lib/utils/columnValueFilter';
import { getUserAvatarColor } from '@/lib/utils/avatarColors';
import searchIcon from '@/assets/images/searchIcon.svg';
import styles from './ColumnValueFilterPopover.module.css';

type ColumnValueFilterPopoverProps = {
  open: boolean;
  anchorRect: DOMRect | null;
  property: PropertyConfig | undefined;
  rows: AssetRow[];
  allProperties: PropertyConfig[];
  checkedValues?: Set<string>;
  assetNamesCache?: Record<string, string>;
  onClose: () => void;
  onApply: (selectedValues: Set<string>, allValues: Set<string>) => void;
};

function CheckIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      className={`${styles.checkIcon} ${visible ? '' : styles.checkIconHidden}`}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 7.25L5.75 10.5L11.5 3.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ColumnValueFilterPopover({
  open,
  anchorRect,
  property,
  rows,
  allProperties,
  checkedValues,
  assetNamesCache = {},
  onClose,
  onApply,
}: ColumnValueFilterPopoverProps) {
  const filterOptions: ColumnFilterOptions = { assetNamesCache };
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [searchText, setSearchText] = useState('');
  const [draftSelected, setDraftSelected] = useState<Set<string>>(new Set());

  const allValues = useMemo(() => {
    if (!property) return [];
    return collectColumnUniqueValues(rows, property, allProperties, filterOptions);
  }, [rows, property, allProperties, assetNamesCache]);

  const allValuesSet = useMemo(() => new Set(allValues), [allValues]);

  useEffect(() => {
    if (!open) return;
    setSearchText('');
    setDraftSelected(new Set(checkedValues ?? allValues));
  }, [open, checkedValues, allValues]);

  useEffect(() => {
    if (!open) return;

    const isInsidePopover = (target: EventTarget | null) => {
      if (!popoverRef.current || !target || !(target instanceof Node)) return false;
      return popoverRef.current.contains(target);
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (isInsidePopover(event.target)) return;
      onClose();
    };

    const handleScrollOrWheel = (event: Event) => {
      if (isInsidePopover(event.target)) return;
      onClose();
    };

    window.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('wheel', handleScrollOrWheel, { passive: true });
    window.addEventListener('scroll', handleScrollOrWheel, true);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('wheel', handleScrollOrWheel);
      window.removeEventListener('scroll', handleScrollOrWheel, true);
    };
  }, [open, onClose]);

  const filteredValues = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return allValues;
    return allValues.filter((value) =>
      formatFilterValueLabel(value).toLowerCase().includes(query)
    );
  }, [allValues, searchText]);

  const toggleValue = (value: string) => {
    setDraftSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  if (!open || !property || !anchorRect || typeof document === 'undefined') {
    return null;
  }

  const popoverStyle: React.CSSProperties = {
    top: anchorRect.bottom + 8,
    left: anchorRect.left + anchorRect.width / 2,
    transform: 'translateX(-50%)',
  };

  return createPortal(
    <div ref={popoverRef} className={styles.popover} style={popoverStyle} role="dialog" aria-label="Filter by values">
      <div className={styles.header}>
        <div className={styles.title}>Filter by values</div>
      </div>

      <div className={styles.searchWrap}>
        <Image src={searchIcon} alt="" width={16} height={16} className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          autoFocus
        />
      </div>

      <div className={styles.valueList}>
        {filteredValues.length === 0 ? (
          <div className={styles.emptyState}>No matching values</div>
        ) : (
          filteredValues.map((value) => {
            const isSelected = draftSelected.has(value);
            const label = formatFilterValueLabel(value);
            return (
              <button
                key={value || '__blank__'}
                type="button"
                className={styles.valueRow}
                onClick={() => toggleValue(value)}
              >
                <span
                  className={styles.valueAvatar}
                  style={{ backgroundColor: getUserAvatarColor(value || '(blank)') }}
                >
                  {getFilterValueInitial(label)}
                </span>
                <span className={styles.valueLabel}>{label}</span>
                <CheckIcon visible={isSelected} />
              </button>
            );
          })
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.cancelButton} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.okButton}
          onClick={() => onApply(draftSelected, allValuesSet)}
        >
          OK
        </button>
      </div>
    </div>,
    document.body
  );
}
