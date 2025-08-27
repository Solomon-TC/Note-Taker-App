"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Heart,
  HeartOff,
  MessageSquare,
  Send,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  getFeedbackLeaderboard,
  submitFeedback,
  toggleFeedbackVote,
  useFeedbackRealtime,
  type FeedbackWithDetails,
} from "@/lib/supabase/feedback";
import { cn } from "@/lib/utils";

interface FeedbackBoardProps {
  className?: string;
}

export default function FeedbackBoard({ className }: FeedbackBoardProps) {
  const { user } = useAuth();
  const [feedbackList, setFeedbackList] = useState<FeedbackWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFeedbackContent, setNewFeedbackContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());

  // Set up realtime subscription for live updates
  useFeedbackRealtime(setFeedbackList, user?.id, {
    enableLogging: process.env.NODE_ENV === "development",
    maintainSortOrder: true,
  });

  // Load initial feedback data
  useEffect(() => {
    const loadInitialFeedback = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const result = await getFeedbackLeaderboard(user.id);
        if (result.success && result.data) {
          setFeedbackList(result.data);
        } else {
          setError(result.error || "Failed to load feedback");
        }
      } catch (err) {
        console.error("Error loading feedback:", err);
        setError("An unexpected error occurred while loading feedback");
      } finally {
        setLoading(false);
      }
    };

    loadInitialFeedback();
  }, [user]);

  // Clear error after showing it
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Handle new feedback submission with optimistic UI
  const handleSubmitFeedback = async () => {
    if (!user || !newFeedbackContent.trim() || submitting) return;

    const trimmedContent = newFeedbackContent.trim();
    if (trimmedContent.length > 1000) {
      setError("Feedback must be 1000 characters or less");
      return;
    }

    // Create optimistic feedback item
    const optimisticFeedback: FeedbackWithDetails = {
      id: `temp-${Date.now()}`,
      content: trimmedContent,
      user_id: user.id,
      vote_count: 0,
      created_at: new Date().toISOString(),
      author: {
        id: user.id,
        full_name: user.user_metadata?.full_name || null,
        email: user.email || "",
        avatar_url: user.user_metadata?.avatar_url || null,
      },
      user_has_voted: false,
      feedback_votes: [],
    };

    // Update UI optimistically
    setFeedbackList((prev) => [optimisticFeedback, ...prev]);
    setNewFeedbackContent("");
    setSubmitting(true);

    try {
      // Submit to backend
      const result = await submitFeedback({
        content: trimmedContent,
        user_id: user.id,
      });

      if (result.success && result.data) {
        // The realtime subscription will handle replacing the optimistic item
        // with real data when the INSERT event arrives
        console.log(
          "Feedback submitted successfully, waiting for realtime update",
        );
      } else {
        // Rollback optimistic update on error
        setFeedbackList((prev) =>
          prev.filter((item) => item.id !== optimisticFeedback.id),
        );
        setError(result.error || "Failed to submit feedback");
      }
    } catch (err) {
      console.error("Error submitting feedback:", err);
      // Rollback on unexpected error
      setFeedbackList((prev) =>
        prev.filter((item) => item.id !== optimisticFeedback.id),
      );
      setError("An unexpected error occurred while submitting feedback");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle vote toggle with optimistic UI
  const handleToggleVote = async (feedbackId: string) => {
    if (!user || votingIds.has(feedbackId)) return;

    const feedbackItem = feedbackList.find((f) => f.id === feedbackId);
    if (!feedbackItem) return;

    const wasVoted = feedbackItem.user_has_voted;
    const optimisticVoteCount = wasVoted
      ? feedbackItem.vote_count - 1
      : feedbackItem.vote_count + 1;

    // Track voting state
    setVotingIds((prev) => new Set([...Array.from(prev), feedbackId]));

    // Update UI optimistically
    setFeedbackList((prev) =>
      prev.map((item) =>
        item.id === feedbackId
          ? {
              ...item,
              user_has_voted: !wasVoted,
              vote_count: optimisticVoteCount,
            }
          : item,
      ),
    );

    try {
      // Submit to backend
      const result = await toggleFeedbackVote(feedbackId, user.id);

      if (!result.success) {
        // Rollback optimistic update on error
        setFeedbackList((prev) =>
          prev.map((item) =>
            item.id === feedbackId
              ? {
                  ...item,
                  user_has_voted: wasVoted,
                  vote_count: feedbackItem.vote_count,
                }
              : item,
          ),
        );
        setError(result.error || "Failed to toggle vote");
      } else {
        // The realtime subscription will handle updating the vote_count
        // when the feedback table UPDATE event arrives
        console.log("Vote toggled successfully, waiting for realtime update");
      }
    } catch (err) {
      console.error("Error toggling vote:", err);
      // Rollback on unexpected error
      setFeedbackList((prev) =>
        prev.map((item) =>
          item.id === feedbackId
            ? {
                ...item,
                user_has_voted: wasVoted,
                vote_count: feedbackItem.vote_count,
              }
            : item,
        ),
      );
      setError("An unexpected error occurred while voting");
    } finally {
      // Remove from voting state
      setVotingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(feedbackId);
        return newSet;
      });
    }
  };

  // Helper function to get user initials
  const getUserInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email
      .split("@")[0]
      .split(".")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Helper function to check if voting on a feedback item
  const isVoting = (feedbackId: string) => votingIds.has(feedbackId);

  if (!user) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
        <p className="text-muted-foreground">
          Please sign in to view and submit feedback.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Error Display */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit New Feedback Form */}
      <Card className="dashboard-card">
        <CardHeader className="dashboard-card-header">
          <div className="flex items-center gap-3">
            <div className="stats-card-icon">
              <Send className="h-5 w-5" />
            </div>
            <h3 className="dashboard-subheading">Submit Feedback</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Share your thoughts, suggestions, or report issues..."
            value={newFeedbackContent}
            onChange={(e) => setNewFeedbackContent(e.target.value)}
            className="min-h-[100px] resize-none"
            maxLength={1000}
            disabled={submitting}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {newFeedbackContent.length}/1000 characters
            </span>
            <Button
              onClick={handleSubmitFeedback}
              disabled={!newFeedbackContent.trim() || submitting}
              className="hover-glow"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Feedback
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Leaderboard */}
      <Card className="dashboard-card">
        <CardHeader className="dashboard-card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="stats-card-icon">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="dashboard-subheading">Feedback Leaderboard</h3>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{feedbackList.length} feedback items</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading feedback...</p>
            </div>
          ) : feedbackList.length === 0 ? (
            <div className="text-center py-8">
              <div className="stats-card-icon mx-auto mb-4 opacity-50">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h4 className="font-semibold mb-2">No feedback yet</h4>
              <p className="text-muted-foreground">
                Be the first to share your thoughts!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbackList.map((feedback, index) => (
                <Card
                  key={feedback.id}
                  className={cn(
                    "transition-all duration-200 hover:shadow-md",
                    feedback.user_has_voted &&
                      "ring-2 ring-primary/20 bg-primary/5",
                    feedback.id.startsWith("temp-") && "opacity-75",
                  )}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      {/* Ranking Badge */}
                      <div className="flex-shrink-0">
                        <Badge
                          variant={index < 3 ? "default" : "secondary"}
                          className={cn(
                            "text-xs font-bold",
                            index === 0 && "bg-yellow-500 hover:bg-yellow-600",
                            index === 1 && "bg-gray-400 hover:bg-gray-500",
                            index === 2 && "bg-amber-600 hover:bg-amber-700",
                          )}
                        >
                          #{index + 1}
                        </Badge>
                      </div>

                      {/* Author Avatar */}
                      <div className="flex-shrink-0">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={feedback.author?.avatar_url || undefined}
                            alt={feedback.author?.full_name || "User"}
                          />
                          <AvatarFallback className="text-xs">
                            {getUserInitials(
                              feedback.author?.full_name || null,
                              feedback.author?.email || "U",
                            )}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      {/* Feedback Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            {feedback.author?.full_name ||
                              feedback.author?.email?.split("@")[0] ||
                              "Anonymous"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            •
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(feedback.created_at).toLocaleDateString()}
                          </span>
                          {feedback.user_id === user.id && (
                            <Badge variant="outline" className="text-xs">
                              Your feedback
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm leading-relaxed break-words">
                          {feedback.content}
                        </p>
                      </div>

                      {/* Vote Controls */}
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <div className="text-center">
                          <div className="text-lg font-bold text-primary">
                            {feedback.vote_count}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {feedback.vote_count === 1 ? "vote" : "votes"}
                          </div>
                        </div>
                        <Button
                          variant={
                            feedback.user_has_voted ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handleToggleVote(feedback.id)}
                          disabled={
                            isVoting(feedback.id) ||
                            feedback.id.startsWith("temp-")
                          }
                          className={cn(
                            "transition-all duration-200",
                            feedback.user_has_voted
                              ? "bg-primary hover:bg-primary/90"
                              : "hover:bg-primary/10 hover:border-primary",
                          )}
                        >
                          {isVoting(feedback.id) ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                          ) : feedback.user_has_voted ? (
                            <>
                              <Heart className="h-4 w-4 mr-1 fill-current" />
                              <span className="hidden sm:inline">Voted</span>
                            </>
                          ) : (
                            <>
                              <HeartOff className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">Vote</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
