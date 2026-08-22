import { z } from "zod";

// At least 8 chars, one uppercase, one lowercase, one number — matches the
// "password must follow security rules" line in the brief (3.1.1).
const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name"),
    employeeCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]*$/, "Letters, numbers and dashes only")
      .optional()
      .or(z.literal("")),
    email: z.string().trim().email("Enter a valid email address"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type SignInInput = z.infer<typeof signInSchema>;
