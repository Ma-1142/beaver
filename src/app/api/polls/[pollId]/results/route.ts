import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { polls, responses, responseChoices } from '@/db/schema';
import { eq, count } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;

    // Get poll with candidate dates
    const poll = await db.query.polls.findFirst({
      where: eq(polls.pollId, pollId),
      with: {
        candidateDates: {
          orderBy: (dates, { asc }) => [asc(dates.sortOrder)],
        },
        finalizedDate: true,
      },
    });

    if (!poll) {
      return NextResponse.json(
        { error: 'Poll not found' },
        { status: 404 }
      );
    }

    // Get total response count
    const responseCountResult = await db
      .select({ count: count() })
      .from(responses)
      .where(eq(responses.pollId, pollId));

    const totalResponses = responseCountResult[0]?.count || 0;

    // Get vote counts per candidate date
    const voteCounts = await db
      .select({
        candidateId: responseChoices.candidateId,
        voteCount: count(),
      })
      .from(responseChoices)
      .innerJoin(responses, eq(responseChoices.responseId, responses.responseId))
      .where(eq(responses.pollId, pollId))
      .groupBy(responseChoices.candidateId);

    // Build vote count map
    const voteCountMap = new Map(
      voteCounts.map((vc) => [vc.candidateId, vc.voteCount])
    );

    // Calculate results for each candidate date
    const results = poll.candidateDates.map((date) => ({
      candidateId: date.candidateId,
      label: date.label,
      dateValue: date.dateValue,
      voteCount: voteCountMap.get(date.candidateId) || 0,
    }));

    // Find best date(s)
    const maxVotes = Math.max(...results.map((r) => r.voteCount), 0);
    const bestDates = maxVotes > 0
      ? results.filter((r) => r.voteCount === maxVotes).map((r) => r.candidateId)
      : [];

    // Add caching headers based on poll status
    const headers = new Headers();
    if (poll.status === 'finalized') {
      // Finalized polls never change, cache for 1 hour
      headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    } else if (poll.status === 'closed') {
      // Closed polls rarely change, cache for 5 minutes
      headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    } else {
      // Open polls change frequently, cache for 30 seconds
      headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    }

    return NextResponse.json({
      poll: {
        pollId: poll.pollId,
        title: poll.title,
        description: poll.description,
        status: poll.status,
        finalizedDate: poll.finalizedDate,
      },
      totalResponses,
      results,
      bestDates,
      isTie: bestDates.length > 1,
    }, { headers });
  } catch (error) {
    console.error('Error fetching results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}
