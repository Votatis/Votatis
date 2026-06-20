import { z } from "@hono/zod-openapi";
import { ADMIN_ROLES, ADMIN_USER_STATUSES, MIN_PASSWORD_LENGTH } from "../constants";

// 관리자 인증/회원관리 스키마 (spec 0015).

export const AdminUserPublicSchema = z
  .object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
    role: z.enum(ADMIN_ROLES),
    status: z.enum(ADMIN_USER_STATUSES),
    last_login_at: z.string().nullable(),
    created_at: z.string(),
  })
  .openapi("AdminUserPublic");

export const LoginInputSchema = z
  .object({ username: z.string().min(1), password: z.string().min(1) })
  .openapi("AdminLoginInput");

export const SessionResultSchema = z
  .object({
    access_token: z.string(),
    refresh_token: z.string(),
    user: AdminUserPublicSchema,
  })
  .openapi("AdminSessionResultV2");

export const RefreshInputSchema = z
  .object({ refresh_token: z.string().min(1) })
  .openapi("AdminRefreshInput");

export const LogoutInputSchema = z
  .object({ refresh_token: z.string().min(1) })
  .openapi("AdminLogoutInput");

export const PasswordResetInputSchema = z
  .object({ token: z.string().min(1), password: z.string().min(MIN_PASSWORD_LENGTH) })
  .openapi("AdminPasswordResetInput");

export const OkResultSchema = z.object({ ok: z.literal(true) }).openapi("OkResult");

export const MemberCreateInputSchema = z
  .object({
    username: z.string().min(3).max(32),
    name: z.string().min(1),
    role: z.enum(ADMIN_ROLES).optional(),
  })
  .openapi("AdminMemberCreateInput");

export const MemberCreateResultSchema = z
  .object({ user: AdminUserPublicSchema, reset_token: z.string() })
  .openapi("AdminMemberCreateResult");

export const MemberListSchema = z
  .object({ members: z.array(AdminUserPublicSchema) })
  .openapi("AdminMemberList");

export const ResetTokenResultSchema = z
  .object({ reset_token: z.string() })
  .openapi("AdminResetTokenResult");

export const MemberPatchInputSchema = z
  .object({
    name: z.string().min(1).optional(),
    status: z.enum(ADMIN_USER_STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "수정할 필드가 없습니다." })
  .openapi("AdminMemberPatchInput");

export const AdminUserIdParamSchema = z.object({
  id: z.string().min(1).openapi({ param: { name: "id", in: "path" } }),
});
