"use client";

import { signOut } from "next-auth/react";
import styles from "./shell.module.css";

export default function SignOutButton() {
  return (
    <button
      type="button"
      className={styles.signOut}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </button>
  );
}
