import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { polls, responses, responseChoices } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;
    const { searchParams } = new URL(request.url);
    const respondentToken = searchParams.get('respondentToken');

    // Get poll
    const poll = await db.query.polls.findFirst({
      where: eq(polls.pollId, pollId),
      with: {
        candidateDates: {
          orderBy: (dates, { asc }) => [asc(dates.sortOrder)],
        },
        finalizedDate: true,
        questions: {
          orderBy: (questions, { asc }) => [asc(questions.sortOrder)],
          with: {
            options: {
              orderBy: (options, { asc }) => [asc(options.sortOrder)],
            },
          },
        },
      },
    });

    if (!poll) {
      return NextResponse.json(
        { error: 'Poll not found' },
        { status: 404 }
      );
    }

    // Get existing response if respondentToken is provided
    let existingResponse = null;
    if (respondentToken) {
      const response = await db.query.responses.findFirst({
        where: and(
          eq(responses.pollId, pollId),
          eq(responses.respondentToken, respondentToken)
        ),
        with: {
          choices: true,
          questionResponses: true,
        },
      });

      if (response) {
        existingResponse = {
          responseId: response.responseId,
          name: response.name,
          email: response.email,
          notes: response.notes,
          selectedDates: response.choices.map((c) => c.candidateId),
          questionAnswers: response.questionResponses?.map((a) => ({
            questionId: a.questionId,
            textAnswer: a.textAnswer,
            selectedOptionId: a.selectedOptionId,
            selectedOptionIds: a.selectedOptionIds ? JSON.parse(a.selectedOptionIds) : null,
          })) || [],
        };
      }
    }

    // Get total number of responses
    const totalResponsesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(responses)
      .where(eq(responses.pollId, pollId));
    const totalResponses = totalResponsesResult[0]?.count || 0;

    // Get availability counts per candidate date
    const availabilityResults = await db
      .select({
        candidateId: responseChoices.candidateId,
        count: sql<number>`count(*)`,
      })
      .from(responseChoices)
      .innerJoin(responses, eq(responseChoices.responseId, responses.responseId))
      .where(eq(responses.pollId, pollId))
      .groupBy(responseChoices.candidateId);

    const availabilityCounts: Record<string, number> = {};
    for (const row of availabilityResults) {
      availabilityCounts[row.candidateId] = row.count;
    }

    return NextResponse.json({
      poll: {
        pollId: poll.pollId,
        title: poll.title,
        description: poll.description,
        status: poll.status,
        candidateDates: poll.candidateDates,
        finalizedDate: poll.finalizedDate,
        deadline: poll.deadline,
        createdAt: poll.createdAt,
        questions: poll.questions,
      },
      existingResponse,
      totalResponses,
      availabilityCounts,
    });
  } catch (error) {
    console.error('Error fetching poll:', error);
    return NextResponse.json(
      { error: 'Failed to fetch poll' },
      { status: 500 }
    );
  }
}
