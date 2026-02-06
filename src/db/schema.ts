import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Polls table
export const polls = sqliteTable('polls', {
  pollId: text('poll_id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['open', 'closed', 'finalized'] }).notNull().default('open'),
  adminToken: text('admin_token').notNull(),
  creatorEmail: text('creator_email'), // Email of poll creator for login-based admin access
  creatorPinHash: text('creator_pin_hash'), // Hashed PIN for creator authentication
  creatorPinSalt: text('creator_pin_salt'), // Salt for creator PIN
  finalizedDateId: text('finalized_date_id'),
  deadline: integer('deadline', { mode: 'timestamp' }), // Optional deadline for responses
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  adminTokenIdx: index('admin_token_idx').on(table.adminToken),
}));

// Candidate dates table
export const candidateDates = sqliteTable('candidate_dates', {
  candidateId: text('candidate_id').primaryKey(),
  pollId: text('poll_id').notNull().references(() => polls.pollId, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  dateValue: text('date_value'), // ISO date string (YYYY-MM-DD) for calendar display
  sortOrder: integer('sort_order').notNull(),
});

// Responses table
export const responses = sqliteTable('responses', {
  responseId: text('response_id').primaryKey(),
  pollId: text('poll_id').notNull().references(() => polls.pollId, { onDelete: 'cascade' }),
  respondentToken: text('respondent_token').notNull(),
  name: text('name'),
  email: text('email'), // Email address for identity (nullable for legacy responses)
  pinHash: text('pin_hash'), // SHA-256 hash of 4-digit PIN for identity verification
  pinSalt: text('pin_salt'), // Random salt for salted PIN hashing (nullable for legacy responses)
  notes: text('notes'), // Optional notes/comments from respondent
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  pollRespondentIdx: index('response_poll_respondent_idx').on(table.pollId, table.respondentToken),
  pollEmailIdx: index('response_poll_email_idx').on(table.pollId, table.email),
}));

// Email verifications table
export const emailVerifications = sqliteTable('email_verifications', {
  id: text('id').primaryKey(),
  pollId: text('poll_id').notNull().references(() => polls.pollId, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  code: text('code').notNull(), // 6-digit verification code
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
  attempts: integer('attempts').notNull().default(0), // Number of verification attempts
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  pollEmailIdx: index('verification_poll_email_idx').on(table.pollId, table.email),
}));

// Response choices table (many-to-many between responses and candidate dates)
export const responseChoices = sqliteTable('response_choices', {
  responseId: text('response_id').notNull().references(() => responses.responseId, { onDelete: 'cascade' }),
  candidateId: text('candidate_id').notNull().references(() => candidateDates.candidateId, { onDelete: 'cascade' }),
}, (table) => ({
  pk: index('response_choice_pk').on(table.responseId, table.candidateId),
}));

// Poll questions table
export const pollQuestions = sqliteTable('poll_questions', {
  questionId: text('question_id').primaryKey(),
  pollId: text('poll_id').notNull().references(() => polls.pollId, { onDelete: 'cascade' }),
  type: text('type', { enum: ['text', 'multiple_choice'] }).notNull(),
  question: text('question').notNull(),
  required: integer('required', { mode: 'boolean' }).notNull().default(false),
  multiSelect: integer('multi_select', { mode: 'boolean' }).notNull().default(false), // For multiple choice: allow multiple selections
  sortOrder: integer('sort_order').notNull(),
}, (table) => ({
  pollIdx: index('question_poll_idx').on(table.pollId),
}));

// Question options table (for multiple choice questions)
export const questionOptions = sqliteTable('question_options', {
  optionId: text('option_id').primaryKey(),
  questionId: text('question_id').notNull().references(() => pollQuestions.questionId, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

// Question responses table
export const questionResponses = sqliteTable('question_responses', {
  id: text('id').primaryKey(),
  responseId: text('response_id').notNull().references(() => responses.responseId, { onDelete: 'cascade' }),
  questionId: text('question_id').notNull().references(() => pollQuestions.questionId, { onDelete: 'cascade' }),
  textAnswer: text('text_answer'), // For text questions
  selectedOptionId: text('selected_option_id').references(() => questionOptions.optionId, { onDelete: 'set null' }), // For single-select multiple choice
  selectedOptionIds: text('selected_option_ids'), // JSON array of option IDs for multi-select
}, (table) => ({
  responseQuestionIdx: index('question_response_idx').on(table.responseId, table.questionId),
}));

// Relations
export const pollsRelations = relations(polls, ({ many, one }) => ({
  candidateDates: many(candidateDates),
  responses: many(responses),
  questions: many(pollQuestions),
  finalizedDate: one(candidateDates, {
    fields: [polls.finalizedDateId],
    references: [candidateDates.candidateId],
  }),
}));

export const candidateDatesRelations = relations(candidateDates, ({ one, many }) => ({
  poll: one(polls, {
    fields: [candidateDates.pollId],
    references: [polls.pollId],
  }),
  responseChoices: many(responseChoices),
}));

export const responsesRelations = relations(responses, ({ one, many }) => ({
  poll: one(polls, {
    fields: [responses.pollId],
    references: [polls.pollId],
  }),
  choices: many(responseChoices),
  questionResponses: many(questionResponses),
}));

export const responseChoicesRelations = relations(responseChoices, ({ one }) => ({
  response: one(responses, {
    fields: [responseChoices.responseId],
    references: [responses.responseId],
  }),
  candidateDate: one(candidateDates, {
    fields: [responseChoices.candidateId],
    references: [candidateDates.candidateId],
  }),
}));

export const pollQuestionsRelations = relations(pollQuestions, ({ one, many }) => ({
  poll: one(polls, {
    fields: [pollQuestions.pollId],
    references: [polls.pollId],
  }),
  options: many(questionOptions),
  responses: many(questionResponses),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one }) => ({
  question: one(pollQuestions, {
    fields: [questionOptions.questionId],
    references: [pollQuestions.questionId],
  }),
}));

export const questionResponsesRelations = relations(questionResponses, ({ one }) => ({
  response: one(responses, {
    fields: [questionResponses.responseId],
    references: [responses.responseId],
  }),
  question: one(pollQuestions, {
    fields: [questionResponses.questionId],
    references: [pollQuestions.questionId],
  }),
  selectedOption: one(questionOptions, {
    fields: [questionResponses.selectedOptionId],
    references: [questionOptions.optionId],
  }),
}));

// Types
export type Poll = typeof polls.$inferSelect;
export type NewPoll = typeof polls.$inferInsert;
export type CandidateDate = typeof candidateDates.$inferSelect;
export type NewCandidateDate = typeof candidateDates.$inferInsert;
export type Response = typeof responses.$inferSelect;
export type NewResponse = typeof responses.$inferInsert;
export type ResponseChoice = typeof responseChoices.$inferSelect;
export type NewResponseChoice = typeof responseChoices.$inferInsert;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type NewEmailVerification = typeof emailVerifications.$inferInsert;
export type PollQuestion = typeof pollQuestions.$inferSelect;
export type NewPollQuestion = typeof pollQuestions.$inferInsert;
export type QuestionOption = typeof questionOptions.$inferSelect;
export type NewQuestionOption = typeof questionOptions.$inferInsert;
export type QuestionResponse = typeof questionResponses.$inferSelect;
export type NewQuestionResponse = typeof questionResponses.$inferInsert;
