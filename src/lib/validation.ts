import { z } from 'zod';

// Poll creation schema
export const createPollSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  candidateDates: z
    .array(
      z.object({
        label: z.string().min(1, 'Date is required').max(100, 'Date must be 100 characters or less'),
        dateValue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
      })
    )
    .min(2, 'At least 2 dates are required'),
  deadline: z.string().datetime().optional().nullable(), // ISO datetime string
  creatorEmail: z.string().email('Invalid email address'),
  creatorPin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

export type CreatePollInput = z.infer<typeof createPollSchema>;

// Question answer schema
const questionAnswerSchema = z.object({
  questionId: z.string().min(1),
  textAnswer: z.string().max(1000).optional().nullable(),
  selectedOptionId: z.string().optional().nullable(), // For single-select
  selectedOptionIds: z.array(z.string()).optional().nullable(), // For multi-select
});

// Response submission schema
export const submitResponseSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(50, 'Name must be 50 characters or less'),
  selectedDates: z.array(z.string()).min(1, 'Please select at least one date'),
  respondentToken: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
  notes: z.string().max(500, 'Notes must be 500 characters or less').optional(),
  questionAnswers: z.array(questionAnswerSchema).optional(),
});

export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;

// Verify credentials schema
export const verifyCredentialsSchema = z.object({
  email: z.string().email('Invalid email address'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

export type VerifyCredentialsInput = z.infer<typeof verifyCredentialsSchema>;

// Send verification email schema
export const sendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
  locale: z.string().optional(),
});

export type SendVerificationInput = z.infer<typeof sendVerificationSchema>;

// Verify email code schema
export const verifyEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// Admin action schemas
export const adminActionSchema = z.object({
  action: z.enum(['close', 'reopen', 'finalize', 'setDeadline', 'updateDescription']),
  finalizedDateId: z.string().optional(),
  deadline: z.string().datetime().optional().nullable(), // For setDeadline action
  description: z.string().max(500).optional().nullable(), // For updateDescription action
});

export type AdminActionInput = z.infer<typeof adminActionSchema>;
