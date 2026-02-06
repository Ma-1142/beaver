import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { polls, pollQuestions, questionOptions } from '@/db/schema';
import { eq, and, notInArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const optionSchema = z.object({
  id: z.string().optional(), // Existing option ID (for preserving answers)
  label: z.string().min(1).max(200),
});

const questionSchema = z.object({
  id: z.string().optional(), // Existing question ID (if updating)
  type: z.enum(['text', 'multiple_choice']),
  question: z.string().min(1).max(500),
  required: z.boolean().default(false),
  multiSelect: z.boolean().default(false),
  options: z.array(optionSchema).optional(), // For multiple choice
});

const questionsArraySchema = z.array(questionSchema);

// GET - Fetch all questions for a poll
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string; adminToken: string }> }
) {
  try {
    const { pollId, adminToken } = await params;

    // Verify admin token
    const poll = await db.query.polls.findFirst({
      where: and(eq(polls.pollId, pollId), eq(polls.adminToken, adminToken)),
    });

    if (!poll) {
      return NextResponse.json(
        { error: 'Unauthorized or poll not found' },
        { status: 404 }
      );
    }

    // Get questions with options
    const questions = await db.query.pollQuestions.findMany({
      where: eq(pollQuestions.pollId, pollId),
      with: {
        options: {
          orderBy: (opts, { asc }) => [asc(opts.sortOrder)],
        },
      },
      orderBy: (q, { asc }) => [asc(q.sortOrder)],
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}

// POST - Update questions for a poll (preserving existing question IDs)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string; adminToken: string }> }
) {
  try {
    const { pollId, adminToken } = await params;
    const body = await request.json();

    const validationResult = questionsArraySchema.safeParse(body.questions);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Verify admin token
    const poll = await db.query.polls.findFirst({
      where: and(eq(polls.pollId, pollId), eq(polls.adminToken, adminToken)),
    });

    if (!poll) {
      return NextResponse.json(
        { error: 'Unauthorized or poll not found' },
        { status: 404 }
      );
    }

    const questionsData = validationResult.data;

    // Get existing questions
    const existingQuestions = await db.query.pollQuestions.findMany({
      where: eq(pollQuestions.pollId, pollId),
      with: {
        options: true,
      },
    });

    const existingQuestionIds = existingQuestions.map((q) => q.questionId);
    const updatedQuestionIds: string[] = [];

    // Process each question
    for (let i = 0; i < questionsData.length; i++) {
      const q = questionsData[i];

      if (q.id && existingQuestionIds.includes(q.id)) {
        // Update existing question
        updatedQuestionIds.push(q.id);

        await db
          .update(pollQuestions)
          .set({
            type: q.type,
            question: q.question,
            required: q.required,
            multiSelect: q.multiSelect || false,
            sortOrder: i,
          })
          .where(eq(pollQuestions.questionId, q.id));

        // For multiple choice, update options in place to preserve answer links
        if (q.type === 'multiple_choice' && q.options) {
          const existingQuestion = existingQuestions.find((eq) => eq.questionId === q.id);
          const existingOptionIds = existingQuestion?.options?.map((o) => o.optionId) || [];
          const updatedOptionIds: string[] = [];

          for (let j = 0; j < q.options.length; j++) {
            const opt = q.options[j];
            if (opt.id && existingOptionIds.includes(opt.id)) {
              // Update existing option
              updatedOptionIds.push(opt.id);
              await db
                .update(questionOptions)
                .set({ label: opt.label, sortOrder: j })
                .where(eq(questionOptions.optionId, opt.id));
            } else {
              // Insert new option
              const optionId = nanoid(12);
              updatedOptionIds.push(optionId);
              await db.insert(questionOptions).values({
                optionId,
                questionId: q.id,
                label: opt.label,
                sortOrder: j,
              });
            }
          }

          // Delete removed options
          const optionsToDelete = existingOptionIds.filter((id) => !updatedOptionIds.includes(id));
          if (optionsToDelete.length > 0) {
            for (const optId of optionsToDelete) {
              await db.delete(questionOptions).where(eq(questionOptions.optionId, optId));
            }
          }
        } else {
          // If changed from multiple choice to text, delete options
          await db.delete(questionOptions).where(eq(questionOptions.questionId, q.id));
        }
      } else {
        // Insert new question
        const questionId = nanoid(12);
        updatedQuestionIds.push(questionId);

        await db.insert(pollQuestions).values({
          questionId,
          pollId,
          type: q.type,
          question: q.question,
          required: q.required,
          multiSelect: q.multiSelect || false,
          sortOrder: i,
        });

        // Insert options for multiple choice questions
        if (q.type === 'multiple_choice' && q.options) {
          for (let j = 0; j < q.options.length; j++) {
            await db.insert(questionOptions).values({
              optionId: nanoid(12),
              questionId,
              label: q.options[j].label,
              sortOrder: j,
            });
          }
        }
      }
    }

    // Delete questions that were removed (only if they have no responses)
    // Note: Questions with responses will be kept but hidden from new responses
    const questionsToDelete = existingQuestionIds.filter(
      (id) => !updatedQuestionIds.includes(id)
    );

    if (questionsToDelete.length > 0) {
      // For now, we delete removed questions (cascade deletes their responses)
      // If you want to preserve responses, you could add a "deleted" flag instead
      await db
        .delete(pollQuestions)
        .where(
          and(
            eq(pollQuestions.pollId, pollId),
            notInArray(pollQuestions.questionId, updatedQuestionIds)
          )
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving questions:', error);
    return NextResponse.json(
      { error: 'Failed to save questions' },
      { status: 500 }
    );
  }
}
