import { z } from 'zod';
import { PERMISSIONS } from '../domain/permission.js';

// Upper bounds only cap parsing cost; the domain applies the contract limits.
const email = z.string().max(320);
const password = z.string().max(1024);

export const registerSchema = z.strictObject({
  email,
  password,
  displayName: z.string().max(240).nullish(),
});

export const credentialsSchema = z.strictObject({ email, password });

export const tokenSchema = z.strictObject({ token: z.string().max(256) });

export const permissionChangeSchema = z.strictObject({
  email,
  permission: z.enum(PERMISSIONS),
});

export const accountIdSchema = z.uuid();

export type RegisterBody = z.output<typeof registerSchema>;
export type CredentialsBody = z.output<typeof credentialsSchema>;
export type TokenBody = z.output<typeof tokenSchema>;
export type PermissionChangeBody = z.output<typeof permissionChangeSchema>;
