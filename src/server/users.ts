/**
 * Server functions for user management.
 *
 * Calls the LibreChat Admin API (/api/admin/users) for list, search, create,
 * update, and delete.
 */

import { z } from 'zod';
import { queryOptions } from '@tanstack/react-query';
import { SystemRoles } from 'librechat-data-provider';
import { createServerFn } from '@tanstack/react-start';
import type { AdminUserSearchResult } from '@librechat/data-schemas';
import type { TUser } from 'librechat-data-provider';
import { apiFetch, extractApiError } from './utils/api';

// ── Server functions ─────────────────────────────────────────────────

export const getUsersFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ users: TUser[] }> => {
    const response = await apiFetch('/api/admin/users');
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.status}`);
    }
    const json = (await response.json()) as { users: TUser[] };
    return { users: json.users ?? [] };
  },
);

export const usersQueryOptions = queryOptions({
  queryKey: ['users'],
  queryFn: () => getUsersFn().then((r) => r.users),
  staleTime: 30_000,
});

export const createUserFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.nativeEnum(SystemRoles),
        password: z.string().min(8),
        confirm_password: z.string().min(8),
      })
      .refine((data) => data.password === data.confirm_password, {
        message: 'Passwords must match',
        path: ['confirm_password'],
      }),
  )
  .handler(async ({ data }): Promise<{ user: TUser }> => {
    const response = await apiFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      await extractApiError(response, 'Failed to create user');
    }
    const json = (await response.json()) as { user: TUser };
    return json;
  });

export const updateUserFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      role: z.nativeEnum(SystemRoles).optional(),
    }),
  )
  .handler(async ({ data }): Promise<{ user: TUser }> => {
    const { id, ...updates } = data;
    const response = await apiFetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      await extractApiError(response, 'Failed to update user');
    }
    const json = (await response.json()) as { user: TUser };
    return json;
  });

export const deleteUserFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const response = await apiFetch(`/api/admin/users/${encodeURIComponent(data.id)}`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete user: ${response.status}`);
    }
  });

export const searchUsersFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ query: z.string() }))
  .handler(async ({ data }): Promise<{ users: AdminUserSearchResult[] }> => {
    const response = await apiFetch(`/api/admin/users/search?q=${encodeURIComponent(data.query)}`);
    if (!response.ok) {
      await extractApiError(response, 'Failed to search users');
    }
    const json = (await response.json()) as { users: AdminUserSearchResult[] };
    return { users: json.users ?? [] };
  });
