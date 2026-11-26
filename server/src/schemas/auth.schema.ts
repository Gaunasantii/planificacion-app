import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().email('Email inválido').toLowerCase(),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
  firstName: z.string().trim().min(1, 'El nombre es obligatorio'),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Email inválido').toLowerCase(),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
