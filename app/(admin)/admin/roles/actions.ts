"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/dal";
import {
  createRole,
  updateRole,
  getRole,
  type RoleInput,
  type ModulePermission,
} from "@/lib/db/roles";
import { describeOracleError } from "@/lib/db/errors";

const permissionSchema = z.object({
  moduleCode: z.string().min(1),
  canView: z.boolean(),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canPost: z.boolean(),
  canCancel: z.boolean(),
  canPrint: z.boolean(),
  canApprove: z.boolean(),
});

const roleSchema = z.object({
  roleName: z.string().trim().min(1, "Role name is required").max(100),
  companyId: z.number().int().positive().nullable(),
  activeYn: z.enum(["Y", "N"]),
  permissions: z.array(permissionSchema),
});

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  permissions?: ModulePermission[];
};

function submittedValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "permissionsJson") out[key] = value;
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

function readPermissions(formData: FormData): { rows: ModulePermission[]; malformed: boolean } {
  try {
    const raw = JSON.parse(String(formData.get("permissionsJson") || "[]"));
    if (!Array.isArray(raw)) return { rows: [], malformed: true };
    return {
      rows: raw.map((r) => ({
        moduleCode: String(r.moduleCode),
        canView: Boolean(r.canView),
        canCreate: Boolean(r.canCreate),
        canEdit: Boolean(r.canEdit),
        canPost: Boolean(r.canPost),
        canCancel: Boolean(r.canCancel),
        canPrint: Boolean(r.canPrint),
        canApprove: Boolean(r.canApprove),
      })),
      malformed: false,
    };
  } catch {
    return { rows: [], malformed: true };
  }
}

export async function saveRoleAction(
  roleId: number | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("ROLE_MAINT", roleId ? "EDIT" : "CREATE");

  const { rows: permissions, malformed } = readPermissions(formData);
  if (malformed) {
    return {
      error: "Permission grid could not be read. Reload and try again.",
      values: submittedValues(formData),
    };
  }

  const companyIdRaw = formData.get("companyId");
  const parsed = roleSchema.safeParse({
    roleName: formData.get("roleName"),
    companyId: companyIdRaw ? Number(companyIdRaw) : null,
    activeYn: formData.get("activeYn") === "on" ? "Y" : "N",
    permissions,
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
      permissions,
    };
  }

  const input: RoleInput = {
    roleName: parsed.data.roleName,
    companyId: parsed.data.companyId,
    activeYn: parsed.data.activeYn,
  };

  if (!roleId) {
    try {
      await createRole(input, parsed.data.permissions);
    } catch (e) {
      return {
        error: describeOracleError(e, "The role could not be created."),
        values: submittedValues(formData),
        permissions,
      };
    }

    revalidatePath("/admin/roles");
    redirect("/admin/roles");
  }

  const existing = await getRole(roleId);
  if (!existing) return { error: "That role no longer exists." };

  try {
    await updateRole(roleId, input, parsed.data.permissions);
  } catch (e) {
    return {
      error: describeOracleError(e, "The role could not be saved."),
      values: submittedValues(formData),
      permissions,
    };
  }

  revalidatePath("/admin/roles");
  revalidatePath(`/admin/roles/${roleId}`);
  redirect(`/admin/roles/${roleId}`);
}
