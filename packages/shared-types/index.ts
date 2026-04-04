// ============================================================
// LNAYCRM — Types TypeScript partagés
// Utilisés par frontend et backend
// ============================================================

// ── Enums ───────────────────────────────────────────────────

export type Role = 'ADMIN' | 'MANAGER' | 'AGENT';

export type ClientStatus = 'PROSPECT' | 'ACTIVE' | 'INACTIVE' | 'DNC';

export type TenantPlan = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

// ── Tenant ──────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── User ────────────────────────────────────────────────────

export interface User {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser extends Omit<User, 'createdAt' | 'updatedAt'> {}

// ── Client ──────────────────────────────────────────────────

export interface Client {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  company?: string;
  status: ClientStatus;
  notes?: string;
  assignedAgentId?: string;
  assignedAgent?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  customData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ── API responses ────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ── Auth ─────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: Role;
  email: string;
  iat: number;
  exp: number;
}
