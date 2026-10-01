import styles from "./form.module.css";

/**
 * Read-only display for a field the user cannot change — an inherited
 * company/branch scope, or a value fixed once the record is created.
 * Dashed border + lock icon so it doesn't read as an ordinary editable
 * input that just happens to be greyed out.
 */
export function LockedField({
  value,
  mono,
}: {
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className={styles.lockedField}>
      <svg
        className={styles.lockedIcon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <span className={mono ? styles.mono : undefined}>{value}</span>
    </div>
  );
}
