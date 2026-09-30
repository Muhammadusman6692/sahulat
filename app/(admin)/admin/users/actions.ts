"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/dal";
import {
  createUser,
  updateUser,
  getUser,
  setUserPassword,
  unlockUser,
  type UserInput,
  type AccessRow,
} from "@/lib/db/users";
import { describeOracleError } from "@/lib/db/errors";

const identityFields = {
  fullName: z.string().trim().min(1, "Full name is required").max(200),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email"),
  phone: z.string().trim().max(20).optional(),
  activeYn: z.enum(["Y", "N"]),
};

const usernameField = z
  .string()
  .trim()
  .min(3, "At least 3 characters")
  .max(50)
  .regex(/^[a-zA-Z0-9._-]+$/, "Letters, numbers, dots, underscores and hyphens only");

const passwordField = z.string().min(8, "At least 8 characters").max(100);

const accessRowSchema = z.object({
  companyId: z.number().int().positive(),
  branchId: z.number().int().positive().nullable(),
  warehouseId: z.number().int().positive().nullable(),
});

const accessRowsField = z
  .array(accessRowSchema)
  .min(1, "Grant access to at least one company");

const roleIdsField = z.array(z.coerce.number().int().positive());

const newSchema = z
  .object({
    username: usernameField,
    ...identityFields,
    password: passwordField,
    confirmPassword: z.string(),
    roleIds: roleIdsField,
    accessRows: accessRowsField,
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const editSchema = z.object({
  ...identityFields,
  roleIds: roleIdsField,
  accessRows: accessRowsField,
});

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  roleIds?: number[];
  accessRows?: AccessRow[];
};

function submittedValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "accessRowsJson") out[key] = value;
  }
  return out;
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function readAccessRows(formData: FormData): { rows: AccessRow[]; malformed: boolean } {
  try {
    const raw = JSON.parse(String(formData.get("accessRowsJson") || "[]"));
    if (!Array.isArray(raw)) return { rows: [], malformed: true };
    return {
      rows: raw.map((r) => ({
        companyId: Number(r.companyId),
        branchId: r.branchId === null || r.branchId === undefined ? null : Number(r.branchId),
        warehouseId:
          r.warehouseId === null || r.warehouseId === undefined ? null : Number(r.warehouseId),
      })),
      malformed: false,
    };
  } catch {
    return { rows: [], malformed: true };
  }
}

export async function saveUserAction(
  userId: number | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("USER_MAINT", userId ? "EDIT" : "CREATE");

  const { rows: accessRows, malformed } = readAccessRows(formData);
  const roleIds = formData.getAll("roleIds").map((v) => Number(v));

  if (malformed) {
    return {
      error: "Access rows could not be read. Reload and try again.",
      values: submittedValues(formData),
      roleIds,
    };
  }

  const base = {
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    activeYn: formData.get("activeYn") === "on" ? "Y" : "N",
    roleIds,
    accessRows,
  };

  if (!userId) {
    const parsed = newSchema.safeParse({
      ...base,
      username: formData.get("username"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });

    if (!parsed.success) {
      return {
        error: "Check the highlighted fields.",
        fieldErrors: fieldErrors(parsed.error),
        values: submittedValues(formData),
        roleIds,
        accessRows,
      };
    }

    const input: UserInput = {
      username: parsed.data.username,
      fullName: parsed.data.fullName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      activeYn: parsed.data.activeYn,
    };

    try {
      await createUser(input, parsed.data.password, parsed.data.roleIds, parsed.data.accessRows);
    } catch (e) {
      return {
        error: describeOracleError(e, "The user could not be created."),
        values: submittedValues(formData),
        roleIds,
        accessRows,
      };
    }

    revalidatePath("/admin/users");
    redirect("/admin/users");
  }

  const existing = await getUser(userId);
  if (!existing) return { error: "That user no longer exists." };

  const parsed = editSchema.safeParse(base);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
      roleIds,
      accessRows,
    };
  }

  try {
    await updateUser(
      userId,
      {
        fullName: parsed.data.fullName,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        activeYn: parsed.data.activeYn,
      },
      parsed.data.roleIds,
      parsed.data.accessRows,
    );
  } catch (e) {
    return {
      error: describeOracleError(e, "The user could not be saved."),
      values: submittedValues(formData),
      roleIds,
      accessRows,
    };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users/${userId}`);
}

const passwordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type PasswordFormState = { error?: string; ok?: boolean };

export async function setPasswordAction(
  userId: number,
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const existing = await getUser(userId);
  if (!existing) return { error: "That user no longer exists." };

  await requirePermission("USER_MAINT", "EDIT");

  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the password fields." };
  }

  try {
    await setUserPassword(userId, parsed.data.password);
  } catch (e) {
    return { error: describeOracleError(e, "The password could not be changed.") };
  }

  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function unlockUserAction(userId: number) {
  const existing = await getUser(userId);
  if (!existing) return;

  await requirePermission("USER_MAINT", "EDIT");
  await unlockUser(userId);

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}
