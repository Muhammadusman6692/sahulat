"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./account-lov.module.css";
import { type PartyLovOption, partyMainLabel, partySubLabel, matchesPartyQuery } from "./party-lov";

export default function PartyCombobox({
  parties,
  value,
  onChange,
  placeholder = "— select party —",
}: {
  parties: PartyLovOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => parties.find((p) => String(p.id) === value) ?? null, [parties, value]);
  const filtered = useMemo(() => parties.filter((p) => matchesPartyQuery(p, query)), [parties, query]);

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
          <span>{partyMainLabel(selected)}</span>
          {partySubLabel(selected) && <span className={styles.triggerSub}>{partySubLabel(selected)}</span>}
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
            <div className={styles.empty}>No matching party</div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                className={styles.option}
                onClick={() => {
                  onChange(String(p.id));
                  setQuery("");
                  setOpen(false);
                }}
              >
                <div className={styles.optionMain}>{partyMainLabel(p)}</div>
                {partySubLabel(p) && <div className={styles.optionSub}>{partySubLabel(p)}</div>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
