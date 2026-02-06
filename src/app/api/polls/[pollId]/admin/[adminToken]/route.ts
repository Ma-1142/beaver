import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { polls, candidateDates, responses } from '@/db/schema';
import { adminActionSchema } from '@/lib/validation';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string; adminToken: string }> }
) {
  try {
    const { pollId, adminToken } = await params;

    // Verify admin token
    const poll = await db.query.polls.findFirst({
      where: and(eq(polls.pollId, pollId), eq(polls.adminToken, adminToken)),
      with: {
        candidateDates: {
          orderBy: (dates, { asc }) => [asc(dates.sortOrder)],
        },
        questions: {
          orderBy: (q, { asc }) => [asc(q.sortOrder)],
          with: {
            options: {
              orderBy: (o, { asc }) => [asc(o.sortOrder)],
            },
          },
        },
        finalizedDate: true,
      },
    });

    if (!poll) {
      return NextResponse.json(
        { error: 'Unauthorized or poll not found' },
        { status: 404 }
      );
    }

    // Get all responses with their choices and question answers
    const allResponses = await db.query.responses.findMany({
      where: eq(responses.pollId, pollId),
      with: {
        choices: {
          with: {
            candidateDate: true,
          },
        },
        questionResponses: {
          with: {
            question: {
              with: {
                options: true,
              },
            },
            selectedOption: true,
          },
        },
      },
      orderBy: (resp, { desc }) => [desc(resp.createdAt)],
    });

    // Format responses for admin view
    const formattedResponses = allResponses.map((response) => ({
      responseId: response.responseId,
      name: response.name,
      email: response.email,
      notes: response.notes,
      selectedDates: response.choices.map((c) => ({
        candidateId: c.candidateId,
        label: c.candidateDate?.label || '',
      })),
      questionAnswers: response.questionResponses?.map((a) => {
        // Parse selectedOptionIds from JSON if present
        let selectedOptionIds: string[] | null = null;
        let selectedOptionLabels: string[] | null = null;
        if (a.selectedOptionIds) {
          try {
            selectedOptionIds = JSON.parse(a.selectedOptionIds);
            // Look up labels for multi-select options
            if (selectedOptionIds && a.question?.options) {
              selectedOptionLabels = selectedOptionIds
                .map(id => a.question?.options?.find(o => o.optionId === id)?.label)
                .filter((l): l is string => !!l);
            }
          } catch {
            selectedOptionIds = null;
          }
        }
        return {
          questionId: a.questionId,
          question: a.question?.question || '',
          type: a.question?.type || 'text',
          multiSelect: a.question?.multiSelect || false,
          textAnswer: a.textAnswer,
          selectedOptionId: a.selectedOptionId,
          selectedOptionLabel: a.selectedOption?.label || null,
          selectedOptionIds,
          selectedOptionLabels,
        };
      }) || [],
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    }));

    // Calculate vote counts
    const voteCounts = poll.candidateDates.map((date) => {
      const count = allResponses.filter((r) =>
        r.choices.some((c) => c.candidateId === date.candidateId)
      ).length;
      return {
        candidateId: date.candidateId,
        label: date.label,
        dateValue: date.dateValue,
        voteCount: count,
      };
    });

    const maxVotes = Math.max(...voteCounts.map((v) => v.voteCount), 0);
    const bestDates = maxVotes > 0
      ? voteCounts.filter((v) => v.voteCount === maxVotes)
      : [];

    // Calculate question response summary with respondent names
    const questionSummary = poll.questions?.map((q) => {
      // Get answers with respondent info
      const answersWithRespondents = allResponses
        .map((r) => {
          const qr = r.questionResponses?.find((qr) => qr.questionId === q.questionId);
          if (!qr) return null;
          return {
            respondentName: r.name || 'Anonymous',
            responseId: r.responseId,
            textAnswer: qr.textAnswer,
            selectedOptionId: qr.selectedOptionId,
            selectedOptionIds: qr.selectedOptionIds,
          };
        })
        .filter((a): a is NonNullable<typeof a> => a !== null);

      if (q.type === 'text') {
        // For text questions, return answers with respondent names
        const textAnswersWithNames = answersWithRespondents
          .filter((a) => a.textAnswer)
          .map((a) => ({
            respondentName: a.respondentName,
            answer: a.textAnswer!,
          }));
        return {
          questionId: q.questionId,
          question: q.question,
          type: q.type,
          totalAnswers: textAnswersWithNames.length,
          textAnswers: textAnswersWithNames,
        };
      } else {
        // For multiple choice, track who selected each option
        const optionData: Record<string, { count: number; respondents: string[] }> = {};
        q.options?.forEach((opt) => {
          optionData[opt.optionId] = { count: 0, respondents: [] };
        });

        answersWithRespondents.forEach((a) => {
          if (a.selectedOptionId && optionData[a.selectedOptionId]) {
            optionData[a.selectedOptionId].count++;
            optionData[a.selectedOptionId].respondents.push(a.respondentName);
          }
          if (a.selectedOptionIds) {
            try {
              const ids = JSON.parse(a.selectedOptionIds) as string[];
              ids.forEach((id) => {
                if (optionData[id]) {
                  optionData[id].count++;
                  optionData[id].respondents.push(a.respondentName);
                }
              });
            } catch {
              // ignore parse errors
            }
          }
        });

        return {
          questionId: q.questionId,
          question: q.question,
          type: q.type,
          multiSelect: q.multiSelect,
          totalAnswers: answersWithRespondents.length,
          options: q.options?.map((opt) => ({
            optionId: opt.optionId,
            label: opt.label,
            count: optionData[opt.optionId]?.count || 0,
            respondents: optionData[opt.optionId]?.respondents || [],
          })),
        };
      }
    }) || [];

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
      },
      responses: formattedResponses,
      totalResponses: allResponses.length,
      voteCounts,
      bestDates,
      isTie: bestDates.length > 1,
      questionSummary,
    });
  } catch (error) {
    console.error('Error fetching admin data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin data' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string; adminToken: string }> }
) {
  try {
    const { pollId, adminToken } = await params;
    const body = await request.json();
    const validationResult = adminActionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { action, finalizedDateId, deadline, description } = validationResult.data;

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

    let newStatus: 'open' | 'closed' | 'finalized' = poll.status;
    const updateData: Partial<typeof polls.$inferInsert> = {
      updatedAt: new Date(),
    };

    switch (action) {
      case 'close':
        if (poll.status === 'finalized') {
          return NextResponse.json(
            { error: 'Cannot close a finalized poll' },
            { status: 400 }
          );
        }
        newStatus = 'closed';
        updateData.status = 'closed';
        break;

      case 'reopen':
        if (poll.status === 'finalized') {
          return NextResponse.json(
            { error: 'Cannot reopen a finalized poll' },
            { status: 400 }
          );
        }
        newStatus = 'open';
        updateData.status = 'open';
        break;

      case 'finalize':
        if (!finalizedDateId) {
          return NextResponse.json(
            { error: 'finalizedDateId is required for finalize action' },
            { status: 400 }
          );
        }

        // Verify the date belongs to this poll
        const candidateDate = await db.query.candidateDates.findFirst({
          where: and(
            eq(candidateDates.candidateId, finalizedDateId),
            eq(candidateDates.pollId, pollId)
          ),
        });

        if (!candidateDate) {
          return NextResponse.json(
            { error: 'Invalid candidate date' },
            { status: 400 }
          );
        }

        newStatus = 'finalized';
        updateData.status = 'finalized';
        updateData.finalizedDateId = finalizedDateId;
        break;

      case 'setDeadline':
        // deadline can be null to remove the deadline
        if (deadline) {
          const deadlineDate = new Date(deadline);
          if (isNaN(deadlineDate.getTime())) {
            return NextResponse.json(
              { error: 'Invalid deadline date format' },
              { status: 400 }
            );
          }
          updateData.deadline = deadlineDate;
        } else {
          updateData.deadline = null;
        }
        break;

      case 'updateDescription':
        // description can be null to remove the description
        updateData.description = description || null;
        break;
    }

    await db.update(polls).set(updateData).where(eq(polls.pollId, pollId));

    return NextResponse.json({
      success: true,
      newStatus,
    });
  } catch (error) {
    console.error('Error performing admin action:', error);
    return NextResponse.json(
      { error: 'Failed to perform admin action' },
      { status: 500 }
    );
  }
}
