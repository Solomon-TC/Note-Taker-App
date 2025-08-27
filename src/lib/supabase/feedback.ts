"use client";

import { useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-client";
import { Database } from "@/types/supabase";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

type Feedback = Database["public"]["Tables"]["feedback"]["Row"];
type FeedbackVote = Database["public"]["Tables"]["feedback_votes"]["Row"];
type User = Database["public"]["Tables"]["users"]["Row"];

// ============================================================================
// TypeScript Interfaces for Feedback System
// ============================================================================

/**
 * Realtime payload types for feedback table changes
 */
export type FeedbackRealtimePayload = RealtimePostgresChangesPayload<{
  [key: string]: any;
}>;

/**
 * Realtime payload types for feedback_votes table changes
 */
export type FeedbackVoteRealtimePayload = RealtimePostgresChangesPayload<{
  [key: string]: any;
}>;

/**
 * Configuration for realtime feedback subscriptions
 */
export interface FeedbackRealtimeConfig {
  /** Whether to log realtime events to console */
  enableLogging?: boolean;
  /** Custom channel name (defaults to 'feedback-changes') */
  channelName?: string;
  /** Whether to maintain sort order after updates */
  maintainSortOrder?: boolean;
}

/**
 * Vote event details for granular notifications
 */
export interface VoteEventDetails {
  feedback_id: string;
  user_id: string;
  vote_added: boolean; // true if vote was added, false if removed
  timestamp: string;
}

/**
 * Callback function type for vote events
 */
export type VoteEventCallback = (details: VoteEventDetails) => void;

/**
 * Enhanced feedback item with author information and user vote status
 */
export interface FeedbackWithDetails extends Feedback {
  author?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  user_has_voted: boolean;
  feedback_votes?: FeedbackVote[];
}

/**
 * Result interface for feedback operations
 */
export interface FeedbackOperationResult {
  success: boolean;
  error?: string;
  data?: Feedback;
}

/**
 * Result interface for vote operations
 */
export interface VoteOperationResult {
  success: boolean;
  error?: string;
  vote_added?: boolean; // true if vote was added, false if removed
  new_vote_count?: number;
}

/**
 * Result interface for leaderboard fetch
 */
export interface FeedbackLeaderboardResult {
  success: boolean;
  error?: string;
  data?: FeedbackWithDetails[];
}

/**
 * Input interface for submitting new feedback
 */
export interface SubmitFeedbackInput {
  content: string;
  user_id: string;
}

// ============================================================================
// Core Feedback Functions
// ============================================================================

/**
 * Fetch the feedback leaderboard with author info and user vote status
 *
 * This function demonstrates the optimistic UI pattern:
 * 1. Call this function to get current state
 * 2. Update UI immediately with optimistic changes
 * 3. Call mutation functions (submitFeedback, toggleFeedbackVote)
 * 4. Rollback UI if mutation fails
 *
 * @param currentUserId - ID of the current user to check vote status
 * @returns Promise<FeedbackLeaderboardResult>
 */
export async function getFeedbackLeaderboard(
  currentUserId?: string,
): Promise<FeedbackLeaderboardResult> {
  const supabase = createClient();

  try {
    console.log("📊 Fetching feedback leaderboard:", {
      currentUserId,
      timestamp: new Date().toISOString(),
    });

    // Fetch all feedback with author info and vote data
    // Using explicit join syntax to avoid foreign key constraint name dependency
    const { data: feedbackData, error: feedbackError } = await supabase
      .from("feedback")
      .select(
        `
        id,
        content,
        user_id,
        created_at,
        vote_count,
        users!inner(
          id,
          full_name,
          email,
          avatar_url
        ),
        feedback_votes(
          id,
          user_id,
          created_at
        )
      `,
      )
      .order("vote_count", { ascending: false })
      .order("created_at", { ascending: false });

    if (feedbackError) {
      console.error("📊 Error fetching feedback leaderboard:", {
        error: feedbackError,
        code: feedbackError.code,
        message: feedbackError.message,
        details: feedbackError.details,
        hint: feedbackError.hint,
        timestamp: new Date().toISOString(),
      });

      // Handle specific RLS errors
      if (
        feedbackError.code === "42501" ||
        feedbackError.message?.includes("policy")
      ) {
        return {
          success: false,
          error: "Access denied. Please ensure you are signed in.",
        };
      }

      // Handle foreign key relationship errors with more specific debugging
      if (
        feedbackError.code === "PGRST200" ||
        feedbackError.code === "PGRST301" ||
        feedbackError.message?.includes("foreign key") ||
        feedbackError.message?.includes("relation") ||
        feedbackError.message?.includes("schema cache") ||
        feedbackError.message?.includes("could not find foreign table")
      ) {
        console.error("📊 Schema relationship error details:", {
          code: feedbackError.code,
          message: feedbackError.message,
          details: feedbackError.details,
          hint: feedbackError.hint,
          fullError: feedbackError,
        });

        // Try a fallback query without the join
        console.log("📊 Attempting fallback query without user join...");
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("feedback")
          .select(
            `
            id,
            content,
            user_id,
            created_at,
            vote_count
          `,
          )
          .order("vote_count", { ascending: false })
          .order("created_at", { ascending: false });

        if (fallbackError) {
          console.error("📊 Fallback query also failed:", fallbackError);
          return {
            success: false,
            error: `Database schema error: ${feedbackError.message}. Fallback query also failed: ${fallbackError.message}`,
          };
        }

        if (fallbackData) {
          console.log(
            "📊 Fallback query succeeded, fetching user data separately...",
          );

          // Fetch user data separately for each feedback item
          const transformedFeedback: FeedbackWithDetails[] = [];

          for (const item of fallbackData) {
            let author = undefined;

            if (item.user_id) {
              const { data: userData, error: userError } = await supabase
                .from("users")
                .select("id, full_name, email, avatar_url")
                .eq("id", item.user_id)
                .single();

              if (!userError && userData) {
                author = userData;
              }
            }

            // Check if current user has voted on this feedback
            let userHasVoted = false;
            if (currentUserId) {
              const { data: voteData, error: voteError } = await supabase
                .from("feedback_votes")
                .select("id")
                .eq("feedback_id", item.id)
                .eq("user_id", currentUserId)
                .maybeSingle();

              if (!voteError && voteData) {
                userHasVoted = true;
              }
            }

            transformedFeedback.push({
              ...item,
              author,
              user_has_voted: userHasVoted,
              feedback_votes: [],
            });
          }

          console.log(
            "📊 Fallback feedback leaderboard fetched successfully:",
            {
              totalItems: transformedFeedback.length,
              topVoteCount: transformedFeedback[0]?.vote_count || 0,
              userVotedItems: transformedFeedback.filter(
                (f) => f.user_has_voted,
              ).length,
            },
          );

          return {
            success: true,
            data: transformedFeedback,
          };
        }

        return {
          success: false,
          error:
            "Database schema error. The feedback system may need to be reinitialized. Please try refreshing the page or contact support.",
        };
      }

      return {
        success: false,
        error: `Failed to fetch feedback: ${feedbackError.message} (Code: ${feedbackError.code})`,
      };
    }

    // Transform the data to include user vote status
    const transformedFeedback: FeedbackWithDetails[] = (feedbackData || []).map(
      (item: any) => {
        // Check if current user has voted on this feedback
        const userHasVoted = currentUserId
          ? (item.feedback_votes || []).some(
              (vote: any) => vote.user_id === currentUserId,
            )
          : false;

        return {
          id: item.id,
          content: item.content,
          user_id: item.user_id,
          created_at: item.created_at,
          vote_count: item.vote_count,
          author: item.users
            ? {
                id: item.users.id,
                full_name: item.users.full_name,
                email: item.users.email,
                avatar_url: item.users.avatar_url,
              }
            : undefined,
          user_has_voted: userHasVoted,
          feedback_votes: item.feedback_votes || [],
        };
      },
    );

    console.log("📊 Feedback leaderboard fetched successfully:", {
      totalItems: transformedFeedback.length,
      topVoteCount: transformedFeedback[0]?.vote_count || 0,
      userVotedItems: transformedFeedback.filter((f) => f.user_has_voted)
        .length,
    });

    return {
      success: true,
      data: transformedFeedback,
    };
  } catch (error) {
    console.error("📊 Unexpected error in getFeedbackLeaderboard:", error);
    return {
      success: false,
      error: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Submit new feedback to the system
 *
 * Optimistic UI Pattern Usage:
 * ```typescript
 * // 1. Update UI optimistically
 * const optimisticFeedback = {
 *   id: 'temp-' + Date.now(),
 *   content: newContent,
 *   user_id: currentUser.id,
 *   vote_count: 0,
 *   created_at: new Date().toISOString(),
 *   author: currentUser,
 *   user_has_voted: false
 * };
 * setFeedbackList([optimisticFeedback, ...feedbackList]);
 *
 * // 2. Submit to backend
 * const result = await submitFeedback({ content: newContent, user_id: currentUser.id });
 *
 * // 3. Handle result
 * if (result.success) {
 *   // Replace optimistic item with real data
 *   setFeedbackList(prev => prev.map(item =>
 *     item.id === optimisticFeedback.id ? result.data : item
 *   ));
 * } else {
 *   // Rollback optimistic update
 *   setFeedbackList(prev => prev.filter(item => item.id !== optimisticFeedback.id));
 *   showError(result.error);
 * }
 * ```
 *
 * @param input - Feedback content and user ID
 * @returns Promise<FeedbackOperationResult>
 */
export async function submitFeedback(
  input: SubmitFeedbackInput,
): Promise<FeedbackOperationResult> {
  const supabase = createClient();

  try {
    // Validate input
    if (!input.content?.trim()) {
      return {
        success: false,
        error: "Feedback content is required",
      };
    }

    if (!input.user_id) {
      return {
        success: false,
        error: "User ID is required",
      };
    }

    // Trim and validate content length
    const trimmedContent = input.content.trim();
    if (trimmedContent.length > 1000) {
      return {
        success: false,
        error: "Feedback content must be 1000 characters or less",
      };
    }

    console.log("💬 Submitting new feedback:", {
      userId: input.user_id,
      contentLength: trimmedContent.length,
      timestamp: new Date().toISOString(),
    });

    // Insert new feedback
    // RLS policies will automatically ensure user can only insert with their own user_id
    const { data, error } = await supabase
      .from("feedback")
      .insert({
        user_id: input.user_id,
        content: trimmedContent,
        vote_count: 0, // Start with 0 votes
      })
      .select()
      .single();

    if (error) {
      console.error("💬 Error submitting feedback:", error);

      // Handle specific database errors
      if (error.code === "23505") {
        return {
          success: false,
          error: "Duplicate feedback detected. Please try again.",
        };
      }

      if (error.code === "42501" || error.message?.includes("policy")) {
        return {
          success: false,
          error: "You are not authorized to submit feedback. Please sign in.",
        };
      }

      if (error.code === "23514") {
        return {
          success: false,
          error: "Invalid feedback data. Please check your input.",
        };
      }

      return {
        success: false,
        error: "Failed to submit feedback. Please try again.",
      };
    }

    if (!data) {
      return {
        success: false,
        error: "No data returned from feedback submission",
      };
    }

    console.log("💬 Feedback submitted successfully:", {
      feedbackId: data.id,
      userId: data.user_id,
      voteCount: data.vote_count,
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("💬 Unexpected error in submitFeedback:", error);
    return {
      success: false,
      error: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Toggle a user's vote on a feedback item (add vote if not voted, remove if voted)
 *
 * Optimistic UI Pattern Usage:
 * ```typescript
 * // 1. Update UI optimistically
 * const wasVoted = feedbackItem.user_has_voted;
 * const optimisticVoteCount = wasVoted
 *   ? feedbackItem.vote_count - 1
 *   : feedbackItem.vote_count + 1;
 *
 * setFeedbackList(prev => prev.map(item =>
 *   item.id === feedbackId
 *     ? { ...item, user_has_voted: !wasVoted, vote_count: optimisticVoteCount }
 *     : item
 * ));
 *
 * // 2. Submit to backend
 * const result = await toggleFeedbackVote(feedbackId, currentUser.id);
 *
 * // 3. Handle result
 * if (!result.success) {
 *   // Rollback optimistic update
 *   setFeedbackList(prev => prev.map(item =>
 *     item.id === feedbackId
 *       ? { ...item, user_has_voted: wasVoted, vote_count: feedbackItem.vote_count }
 *       : item
 *   ));
 *   showError(result.error);
 * } else {
 *   // Optionally update with server response for accuracy
 *   if (result.new_vote_count !== undefined) {
 *     setFeedbackList(prev => prev.map(item =>
 *       item.id === feedbackId
 *         ? { ...item, vote_count: result.new_vote_count }
 *         : item
 *     ));
 *   }
 * }
 * ```
 *
 * @param feedbackId - ID of the feedback item to vote on
 * @param userId - ID of the user voting
 * @returns Promise<VoteOperationResult>
 */
export async function toggleFeedbackVote(
  feedbackId: string,
  userId: string,
): Promise<VoteOperationResult> {
  const supabase = createClient();

  try {
    // Validate input
    if (!feedbackId || !userId) {
      return {
        success: false,
        error: "Feedback ID and user ID are required",
      };
    }

    console.log("🗳️ Toggling feedback vote:", {
      feedbackId,
      userId,
      timestamp: new Date().toISOString(),
    });

    // Check if user has already voted on this feedback
    const { data: existingVote, error: voteCheckError } = await supabase
      .from("feedback_votes")
      .select("id")
      .eq("feedback_id", feedbackId)
      .eq("user_id", userId)
      .maybeSingle();

    if (voteCheckError && voteCheckError.code !== "PGRST116") {
      console.error("🗳️ Error checking existing vote:", voteCheckError);
      return {
        success: false,
        error: "Failed to check existing vote status",
      };
    }

    let voteAdded: boolean;
    let operationError: any = null;

    if (existingVote) {
      // User has voted - remove the vote
      console.log("🗳️ Removing existing vote:", existingVote.id);

      const { error: deleteError } = await supabase
        .from("feedback_votes")
        .delete()
        .eq("id", existingVote.id)
        .eq("user_id", userId); // Extra security check

      operationError = deleteError;
      voteAdded = false;
    } else {
      // User hasn't voted - add a vote
      console.log("🗳️ Adding new vote");

      const { error: insertError } = await supabase
        .from("feedback_votes")
        .insert({
          feedback_id: feedbackId,
          user_id: userId,
        });

      operationError = insertError;
      voteAdded = true;
    }

    if (operationError) {
      console.error("🗳️ Error toggling vote:", operationError);

      // Handle specific database errors
      if (operationError.code === "23505") {
        return {
          success: false,
          error: "Vote already exists. Please refresh and try again.",
        };
      }

      if (operationError.code === "23503") {
        return {
          success: false,
          error: "Feedback item not found.",
        };
      }

      if (
        operationError.code === "42501" ||
        operationError.message?.includes("policy")
      ) {
        return {
          success: false,
          error: "You are not authorized to vote. Please sign in.",
        };
      }

      return {
        success: false,
        error: "Failed to toggle vote. Please try again.",
      };
    }

    // Fetch updated vote count for accuracy
    // The database trigger should have updated this automatically
    const { data: updatedFeedback, error: fetchError } = await supabase
      .from("feedback")
      .select("vote_count")
      .eq("id", feedbackId)
      .single();

    if (fetchError) {
      console.warn("🗳️ Could not fetch updated vote count:", fetchError);
      // Don't fail the operation since the vote toggle succeeded
    }

    const newVoteCount = updatedFeedback?.vote_count;

    console.log("🗳️ Vote toggled successfully:", {
      feedbackId,
      voteAdded,
      newVoteCount,
    });

    return {
      success: true,
      vote_added: voteAdded,
      new_vote_count: newVoteCount,
    };
  } catch (error) {
    console.error("🗳️ Unexpected error in toggleFeedbackVote:", error);
    return {
      success: false,
      error: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Check if a specific user has voted on a specific feedback item
 *
 * This is a utility function for cases where you need to check vote status
 * without fetching the entire leaderboard.
 *
 * @param feedbackId - ID of the feedback item
 * @param userId - ID of the user
 * @returns Promise<{ success: boolean; has_voted?: boolean; error?: string }>
 */
export async function checkUserVote(
  feedbackId: string,
  userId: string,
): Promise<{ success: boolean; has_voted?: boolean; error?: string }> {
  const supabase = createClient();

  try {
    // Validate input
    if (!feedbackId || !userId) {
      return {
        success: false,
        error: "Feedback ID and user ID are required",
      };
    }

    console.log("🔍 Checking user vote status:", {
      feedbackId,
      userId,
      timestamp: new Date().toISOString(),
    });

    const { data: vote, error } = await supabase
      .from("feedback_votes")
      .select("id")
      .eq("feedback_id", feedbackId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("🔍 Error checking user vote:", error);
      return {
        success: false,
        error: "Failed to check vote status",
      };
    }

    const hasVoted = !!vote;

    console.log("🔍 User vote status checked:", {
      feedbackId,
      userId,
      hasVoted,
    });

    return {
      success: true,
      has_voted: hasVoted,
    };
  } catch (error) {
    console.error("🔍 Unexpected error in checkUserVote:", error);
    return {
      success: false,
      error: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get feedback statistics for analytics
 *
 * @returns Promise<{ success: boolean; stats?: any; error?: string }>
 */
export async function getFeedbackStats(): Promise<{
  success: boolean;
  stats?: {
    total_feedback: number;
    total_votes: number;
    top_voted_feedback?: FeedbackWithDetails;
    recent_feedback_count: number; // Last 7 days
  };
  error?: string;
}> {
  const supabase = createClient();

  try {
    console.log("📈 Fetching feedback statistics");

    // Get total feedback count
    const { count: totalFeedback, error: feedbackCountError } = await supabase
      .from("feedback")
      .select("*", { count: "exact", head: true });

    if (feedbackCountError) {
      console.error("📈 Error fetching feedback count:", feedbackCountError);
      return {
        success: false,
        error: "Failed to fetch feedback statistics",
      };
    }

    // Get total votes count
    const { count: totalVotes, error: votesCountError } = await supabase
      .from("feedback_votes")
      .select("*", { count: "exact", head: true });

    if (votesCountError) {
      console.error("📈 Error fetching votes count:", votesCountError);
      return {
        success: false,
        error: "Failed to fetch vote statistics",
      };
    }

    // Get recent feedback count (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentFeedbackCount, error: recentCountError } =
      await supabase
        .from("feedback")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString());

    if (recentCountError) {
      console.error(
        "📈 Error fetching recent feedback count:",
        recentCountError,
      );
    }

    // Construct the stats object with the fetched data
    const stats = {
      total_feedback: totalFeedback || 0,
      total_votes: totalVotes || 0,
      recent_feedback_count: recentFeedbackCount || 0,
    };

    console.log("📈 Feedback statistics fetched:", stats);

    return {
      success: true,
      stats,
    };
  } catch (error) {
    console.error("📈 Unexpected error in getFeedbackStats:", error);
    return {
      success: false,
      error: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// ============================================================================
// Realtime Subscription Hooks
// ============================================================================

/**
 * Custom React hook for subscribing to feedback table changes in real-time
 *
 * This hook integrates seamlessly with the existing optimistic UI patterns.
 * It handles INSERT, UPDATE, and DELETE events on the feedback table to keep
 * the UI synchronized without manual refresh.
 *
 * INTEGRATION WITH OPTIMISTIC UI:
 * The hook is designed to work alongside optimistic updates. When you perform
 * optimistic updates (like in submitFeedback or toggleFeedbackVote), the realtime
 * events will eventually arrive and can either:
 * 1. Replace optimistic items with real data (for new feedback)
 * 2. Update existing items with accurate server state (for vote counts)
 *
 * USAGE EXAMPLE:
 * ```typescript
 * const [feedbackList, setFeedbackList] = useState<FeedbackWithDetails[]>([]);
 * const [currentUser, setCurrentUser] = useState<User | null>(null);
 *
 * // Set up realtime subscription
 * useFeedbackRealtime(setFeedbackList, currentUser?.id, {
 *   enableLogging: true,
 *   maintainSortOrder: true
 * });
 *
 * // Your existing optimistic UI functions work unchanged
 * const handleSubmitFeedback = async (content: string) => {
 *   // ... existing optimistic logic ...
 *   const result = await submitFeedback({ content, user_id: currentUser.id });
 *   // ... existing error handling ...
 * };
 * ```
 *
 * @param setFeedbackList - State setter function for the feedback list
 * @param currentUserId - Current user ID for vote status calculation
 * @param config - Optional configuration for the subscription
 */
export function useFeedbackRealtime(
  setFeedbackList: React.Dispatch<React.SetStateAction<FeedbackWithDetails[]>>,
  currentUserId?: string,
  config: FeedbackRealtimeConfig = {},
): void {
  const {
    enableLogging = false,
    channelName = "feedback-changes",
    maintainSortOrder = true,
  } = config;

  const supabase = createClient();

  // Memoize the sort function to avoid recreating it on every render
  const sortFeedbackList = useCallback(
    (list: FeedbackWithDetails[]) => {
      if (!maintainSortOrder) return list;

      return [...list].sort((a, b) => {
        // Sort by vote_count descending, then by created_at descending
        if (a.vote_count !== b.vote_count) {
          return b.vote_count - a.vote_count;
        }
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    },
    [maintainSortOrder],
  );

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const setupRealtimeSubscription = async () => {
      try {
        if (enableLogging) {
          console.log("📡 Setting up feedback realtime subscription:", {
            channelName,
            currentUserId,
            maintainSortOrder,
            timestamp: new Date().toISOString(),
          });
        }

        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "feedback",
            },
            async (payload: FeedbackRealtimePayload) => {
              if (enableLogging) {
                console.log("📡 Feedback realtime event:", {
                  eventType: payload.eventType,
                  table: payload.table,
                  schema: payload.schema,
                  new: payload.new,
                  old: payload.old,
                  timestamp: new Date().toISOString(),
                });
              }

              try {
                if (payload.eventType === "INSERT" && payload.new) {
                  // Handle new feedback insertion
                  const newFeedback = payload.new as any;

                  // Check if this feedback already exists (from optimistic update)
                  setFeedbackList((prevList) => {
                    const existingIndex = prevList.findIndex(
                      (f) =>
                        f.id === newFeedback.id ||
                        (f.id.startsWith("temp-") &&
                          f.content === newFeedback.content &&
                          f.user_id === newFeedback.user_id),
                    );

                    let updatedList: FeedbackWithDetails[];

                    if (existingIndex >= 0) {
                      // Replace optimistic item with real data
                      const existingItem = prevList[existingIndex];
                      const updatedItem: FeedbackWithDetails = {
                        ...newFeedback,
                        author: existingItem.author, // Preserve author info from optimistic update
                        user_has_voted: currentUserId ? false : false, // New feedback, user hasn't voted yet
                        feedback_votes: [],
                      };

                      updatedList = prevList.map((item, index) =>
                        index === existingIndex ? updatedItem : item,
                      );

                      if (enableLogging) {
                        console.log(
                          "📡 Replaced optimistic feedback with real data:",
                          {
                            optimisticId: existingItem.id,
                            realId: newFeedback.id,
                          },
                        );
                      }
                    } else {
                      // Add new feedback (not from optimistic update)
                      const newItem: FeedbackWithDetails = {
                        ...newFeedback,
                        author: undefined, // Will be populated by next leaderboard fetch
                        user_has_voted: false,
                        feedback_votes: [],
                      };

                      updatedList = [newItem, ...prevList];

                      if (enableLogging) {
                        console.log(
                          "📡 Added new feedback from realtime:",
                          newFeedback.id,
                        );
                      }
                    }

                    return sortFeedbackList(updatedList);
                  });
                }

                if (payload.eventType === "UPDATE" && payload.new) {
                  // Handle feedback updates (mainly vote_count changes)
                  const updatedFeedback = payload.new as any;

                  setFeedbackList((prevList) => {
                    const updatedList = prevList.map((item) => {
                      if (item.id === updatedFeedback.id) {
                        // Preserve existing author and vote status, update other fields
                        return {
                          ...item,
                          ...updatedFeedback,
                          author: item.author, // Preserve author info
                          user_has_voted: item.user_has_voted, // Preserve user vote status
                        };
                      }
                      return item;
                    });

                    if (enableLogging) {
                      const updatedItem = updatedList.find(
                        (f) => f.id === updatedFeedback.id,
                      );
                      console.log("📡 Updated feedback from realtime:", {
                        id: updatedFeedback.id,
                        newVoteCount: updatedFeedback.vote_count,
                        found: !!updatedItem,
                      });
                    }

                    return sortFeedbackList(updatedList);
                  });
                }

                if (payload.eventType === "DELETE" && payload.old) {
                  // Handle feedback deletion
                  const deletedFeedback = payload.old as any;

                  setFeedbackList((prevList) => {
                    const filteredList = prevList.filter(
                      (item) => item.id !== deletedFeedback.id,
                    );

                    if (enableLogging) {
                      console.log("📡 Removed feedback from realtime:", {
                        id: deletedFeedback.id,
                        remainingCount: filteredList.length,
                      });
                    }

                    return filteredList;
                  });
                }
              } catch (error) {
                console.error("📡 Error processing feedback realtime event:", {
                  error,
                  payload,
                  timestamp: new Date().toISOString(),
                });
              }
            },
          )
          .subscribe((status) => {
            if (enableLogging) {
              console.log("📡 Feedback subscription status:", {
                status,
                channelName,
                timestamp: new Date().toISOString(),
              });
            }

            if (status === "SUBSCRIPTION_ERROR") {
              console.error("📡 Failed to subscribe to feedback changes");
            }
          });
      } catch (error) {
        console.error(
          "📡 Error setting up feedback realtime subscription:",
          error,
        );
      }
    };

    setupRealtimeSubscription();

    // Cleanup function
    return () => {
      if (channel) {
        if (enableLogging) {
          console.log("📡 Cleaning up feedback realtime subscription:", {
            channelName,
            timestamp: new Date().toISOString(),
          });
        }

        supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [
    supabase,
    setFeedbackList,
    currentUserId,
    channelName,
    enableLogging,
    sortFeedbackList,
  ]);
}

/**
 * Custom React hook for subscribing to feedback_votes table changes for granular notifications
 *
 * This hook is optional and provides detailed vote events that can be used for:
 * - Toast notifications ("Someone upvoted your feedback!")
 * - Real-time vote animations
 * - Activity feeds
 * - Analytics tracking
 *
 * Note: This hook does NOT update the feedback list directly. Use useFeedbackRealtime
 * for that purpose. This hook is purely for notification/UX enhancement purposes.
 *
 * USAGE EXAMPLE:
 * ```typescript
 * const [toastMessage, setToastMessage] = useState<string | null>(null);
 *
 * useFeedbackVotesRealtime((voteEvent) => {
 *   if (voteEvent.vote_added) {
 *     setToastMessage(`Someone upvoted feedback #${voteEvent.feedback_id.slice(-6)}!`);
 *   } else {
 *     setToastMessage(`Someone removed their vote from feedback #${voteEvent.feedback_id.slice(-6)}`);
 *   }
 *
 *   // Clear toast after 3 seconds
 *   setTimeout(() => setToastMessage(null), 3000);
 * }, {
 *   enableLogging: true,
 *   channelName: 'vote-notifications'
 * });
 * ```
 *
 * @param onVoteEvent - Callback function called when a vote event occurs
 * @param config - Optional configuration for the subscription
 */
export function useFeedbackVotesRealtime(
  onVoteEvent: VoteEventCallback,
  config: FeedbackRealtimeConfig = {},
): void {
  const { enableLogging = false, channelName = "feedback-votes-changes" } =
    config;

  const supabase = createClient();

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const setupVotesSubscription = async () => {
      try {
        if (enableLogging) {
          console.log("📡 Setting up feedback votes realtime subscription:", {
            channelName,
            timestamp: new Date().toISOString(),
          });
        }

        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "feedback_votes",
            },
            (payload: FeedbackVoteRealtimePayload) => {
              if (enableLogging) {
                console.log("📡 Feedback vote realtime event:", {
                  eventType: payload.eventType,
                  table: payload.table,
                  schema: payload.schema,
                  new: payload.new,
                  old: payload.old,
                  timestamp: new Date().toISOString(),
                });
              }

              try {
                if (payload.eventType === "INSERT" && payload.new) {
                  // Vote was added
                  const newVote = payload.new as any;
                  const voteEvent: VoteEventDetails = {
                    feedback_id: newVote.feedback_id,
                    user_id: newVote.user_id,
                    vote_added: true,
                    timestamp: newVote.created_at || new Date().toISOString(),
                  };

                  onVoteEvent(voteEvent);

                  if (enableLogging) {
                    console.log("📡 Vote added event:", voteEvent);
                  }
                }

                if (payload.eventType === "DELETE" && payload.old) {
                  // Vote was removed
                  const deletedVote = payload.old as any;
                  const voteEvent: VoteEventDetails = {
                    feedback_id: deletedVote.feedback_id,
                    user_id: deletedVote.user_id,
                    vote_added: false,
                    timestamp: new Date().toISOString(),
                  };

                  onVoteEvent(voteEvent);

                  if (enableLogging) {
                    console.log("📡 Vote removed event:", voteEvent);
                  }
                }
              } catch (error) {
                console.error("📡 Error processing vote realtime event:", {
                  error,
                  payload,
                  timestamp: new Date().toISOString(),
                });
              }
            },
          )
          .subscribe((status) => {
            if (enableLogging) {
              console.log("📡 Feedback votes subscription status:", {
                status,
                channelName,
                timestamp: new Date().toISOString(),
              });
            }

            if (status === "SUBSCRIPTION_ERROR") {
              console.error("📡 Failed to subscribe to feedback votes changes");
            }
          });
      } catch (error) {
        console.error(
          "📡 Error setting up feedback votes realtime subscription:",
          error,
        );
      }
    };

    setupVotesSubscription();

    // Cleanup function
    return () => {
      if (channel) {
        if (enableLogging) {
          console.log("📡 Cleaning up feedback votes realtime subscription:", {
            channelName,
            timestamp: new Date().toISOString(),
          });
        }

        supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [supabase, onVoteEvent, channelName, enableLogging]);
}

// ============================================================================
// Usage Examples and Documentation
// ============================================================================

/**
 * OPTIMISTIC UI PATTERN EXAMPLES WITH REALTIME SUBSCRIPTIONS
 *
 * The functions in this file are designed to work with optimistic UI updates
 * and realtime subscriptions. Here are complete examples of how to use them
 * in your React components:
 *
 * 1. COMPLETE FEEDBACK COMPONENT WITH REALTIME:
 * ```typescript
 * const [feedbackList, setFeedbackList] = useState<FeedbackWithDetails[]>([]);
 * const [loading, setLoading] = useState(true);
 * const [error, setError] = useState<string | null>(null);
 * const [toastMessage, setToastMessage] = useState<string | null>(null);
 * const { user } = useAuth(); // Your auth hook
 *
 * // Initial data load
 * useEffect(() => {
 *   const loadFeedback = async () => {
 *     const result = await getFeedbackLeaderboard(user?.id);
 *     if (result.success) {
 *       setFeedbackList(result.data || []);
 *     } else {
 *       setError(result.error || 'Failed to load feedback');
 *     }
 *     setLoading(false);
 *   };
 *   loadFeedback();
 * }, [user?.id]);
 *
 * // Set up realtime subscription for live updates
 * useFeedbackRealtime(setFeedbackList, user?.id, {
 *   enableLogging: process.env.NODE_ENV === 'development',
 *   maintainSortOrder: true
 * });
 *
 * // Optional: Set up vote notifications
 * useFeedbackVotesRealtime((voteEvent) => {
 *   if (voteEvent.user_id !== user?.id) { // Don't show notifications for own votes
 *     const action = voteEvent.vote_added ? 'upvoted' : 'removed vote from';
 *     setToastMessage(`Someone ${action} feedback #${voteEvent.feedback_id.slice(-6)}!`);
 *     setTimeout(() => setToastMessage(null), 3000);
 *   }
 * }, {
 *   enableLogging: process.env.NODE_ENV === 'development'
 * });
 * ```
 *
 * 2. SUBMITTING FEEDBACK WITH OPTIMISTIC UI + REALTIME:
 * ```typescript
 * const [submitting, setSubmitting] = useState(false);
 *
 * const handleSubmitFeedback = async (content: string) => {
 *   if (!user || submitting) return;
 *
 *   // Create optimistic feedback item
 *   const optimisticFeedback: FeedbackWithDetails = {
 *     id: `temp-${Date.now()}`,
 *     content,
 *     user_id: user.id,
 *     vote_count: 0,
 *     created_at: new Date().toISOString(),
 *     author: {
 *       id: user.id,
 *       full_name: user.full_name,
 *       email: user.email,
 *       avatar_url: user.avatar_url,
 *     },
 *     user_has_voted: false,
 *     feedback_votes: [],
 *   };
 *
 *   // Update UI optimistically
 *   setFeedbackList(prev => [optimisticFeedback, ...prev]);
 *   setSubmitting(true);
 *
 *   try {
 *     // Submit to backend
 *     const result = await submitFeedback({ content, user_id: user.id });
 *
 *     if (result.success && result.data) {
 *       // The realtime subscription will handle replacing the optimistic item
 *       // with real data when the INSERT event arrives. No manual replacement needed!
 *       console.log('Feedback submitted successfully, waiting for realtime update');
 *     } else {
 *       // Rollback optimistic update on error
 *       setFeedbackList(prev => prev.filter(item => item.id !== optimisticFeedback.id));
 *       setError(result.error || 'Failed to submit feedback');
 *     }
 *   } catch (error) {
 *     // Rollback on unexpected error
 *     setFeedbackList(prev => prev.filter(item => item.id !== optimisticFeedback.id));
 *     setError('An unexpected error occurred');
 *   } finally {
 *     setSubmitting(false);
 *   }
 * };
 * ```
 *
 * 3. TOGGLING VOTES WITH OPTIMISTIC UI + REALTIME:
 * ```typescript
 * const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
 *
 * const handleToggleVote = async (feedbackId: string) => {
 *   if (!user || votingIds.has(feedbackId)) return;
 *
 *   const feedbackItem = feedbackList.find(f => f.id === feedbackId);
 *   if (!feedbackItem) return;
 *
 *   const wasVoted = feedbackItem.user_has_voted;
 *   const optimisticVoteCount = wasVoted
 *     ? feedbackItem.vote_count - 1
 *     : feedbackItem.vote_count + 1;
 *
 *   // Track voting state
 *   setVotingIds(prev => new Set([...prev, feedbackId]));
 *
 *   // Update UI optimistically
 *   setFeedbackList(prev => prev.map(item =>
 *     item.id === feedbackId
 *       ? { ...item, user_has_voted: !wasVoted, vote_count: optimisticVoteCount }
 *       : item
 *   ));
 *
 *   try {
 *     // Submit to backend
 *     const result = await toggleFeedbackVote(feedbackId, user.id);
 *
 *     if (!result.success) {
 *       // Rollback optimistic update on error
 *       setFeedbackList(prev => prev.map(item =>
 *         item.id === feedbackId
 *           ? { ...item, user_has_voted: wasVoted, vote_count: feedbackItem.vote_count }
 *           : item
 *       ));
 *       setError(result.error || 'Failed to toggle vote');
 *     } else {
 *       // The realtime subscription will handle updating the vote_count
 *       // when the feedback table UPDATE event arrives. The user_has_voted
 *       // status is already correct from our optimistic update.
 *       console.log('Vote toggled successfully, waiting for realtime update');
 *     }
 *   } catch (error) {
 *     // Rollback on unexpected error
 *     setFeedbackList(prev => prev.map(item =>
 *       item.id === feedbackId
 *         ? { ...item, user_has_voted: wasVoted, vote_count: feedbackItem.vote_count }
 *         : item
 *     ));
 *     setError('An unexpected error occurred');
 *   } finally {
 *     // Remove from voting state
 *     setVotingIds(prev => {
 *       const newSet = new Set(prev);
 *       newSet.delete(feedbackId);
 *       return newSet;
 *     });
 *   }
 * };
 * ```
 *
 * 4. TOAST NOTIFICATIONS FOR VOTE EVENTS:
 * ```typescript
 * const [toastMessage, setToastMessage] = useState<string | null>(null);
 *
 * // Set up vote event notifications
 * useFeedbackVotesRealtime((voteEvent) => {
 *   // Only show notifications for other users' votes
 *   if (voteEvent.user_id !== user?.id) {
 *     const action = voteEvent.vote_added ? 'upvoted' : 'removed their vote from';
 *     const feedbackPreview = feedbackList
 *       .find(f => f.id === voteEvent.feedback_id)
 *       ?.content.slice(0, 30) || `#${voteEvent.feedback_id.slice(-6)}`;
 *
 *     setToastMessage(`Someone ${action} "${feedbackPreview}..."`);
 *
 *     // Auto-clear toast
 *     setTimeout(() => setToastMessage(null), 4000);
 *   }
 * });
 *
 * // Toast component
 * {toastMessage && (
 *   <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
 *     {toastMessage}
 *   </div>
 * )}
 * ```
 *
 * 5. ERROR HANDLING AND LOADING STATES:
 * ```typescript
 * const [error, setError] = useState<string | null>(null);
 * const [submitting, setSubmitting] = useState(false);
 * const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
 *
 * // Clear error after showing it
 * useEffect(() => {
 *   if (error) {
 *     const timer = setTimeout(() => setError(null), 5000);
 *     return () => clearTimeout(timer);
 *   }
 * }, [error]);
 *
 * // Loading states for individual actions
 * const isVoting = (feedbackId: string) => votingIds.has(feedbackId);
 * ```
 *
 * 6. REALTIME CONNECTION STATUS:
 * ```typescript
 * const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
 *
 * // You can extend the hooks to expose connection status if needed
 * // For now, check the browser console for connection logs when enableLogging is true
 * ```
 */
