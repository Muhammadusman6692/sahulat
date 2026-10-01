"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./account-lov.module.css";
import { type AccountLovOption, accountMainLabel, accountSubLabel, matchesAccountQuery } from "./account-lov";

export default function AccountCombobox({
  accounts,
  value,
  onChange,
  placeholder = "— select account —",
}: {
  accounts: AccountLovOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => accounts.find((a) => String(a.id) === value) ?? null, [accounts, value]);
  const filtered = useMemo(() => accounts.filter((a) => matchesAccountQuery(a, query)), [accounts, query]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  return (
    <div ref={rootRef} className={styles.wrap}>
      {selected && !open ? (
        <button
          type="button"
          className={styles.trigger}
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
        >
          <span>{accountMainLabel(selected)}</span>
          {accountSubLabel(selected) && <span className={styles.triggerSub}>{accountSubLabel(selected)}</span>}
        </button>
      ) : (
        <input
          type="text"
          className={styles.input}
          placeholder={placeholder}
          value={query}
          autoFocus={open}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      )}

      {open && (
        <div className={styles.dropdown}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>No matching account</div>
          ) : (
            filtered.map((a) => (
              <div
                key={a.id}
                className={styles.option}
                onClick={() => {
                  onChange(String(a.id));
                  setQuery("");
                  setOpen(false);
                }}
              >
                <div className={styles.optionMain}>{accountMainLabel(a)}</div>
                {accountSubLabel(a) && <div className={styles.optionSub}>{accountSubLabel(a)}</div>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
