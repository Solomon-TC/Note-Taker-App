"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Users,
  UserPlus,
  MessageCircle,
  Settings,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import UserMenu from "@/components/auth/UserMenu";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  sendFriendRequest,
  getPendingFriendRequests,
  type FriendRequestWithUser,
} from "@/lib/supabase/friends";

type Friend = { id: string; email: string; name?: string };

export default function FriendsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Form state
  const [emailToAdd, setEmailToAdd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Data state
  const [pendingRequests, setPendingRequests] = useState<
    FriendRequestWithUser[]
  >([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  // Temporary mock friends list (will be implemented in next step)
  const friends: Friend[] = [];

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  // Load pending friend requests
  useEffect(() => {
    if (user) {
      loadPendingRequests();
    }
  }, [user]);

  const loadPendingRequests = async () => {
    if (!user) return;

    try {
      setLoadingRequests(true);
      const requests = await getPendingFriendRequests(user.id);
      setPendingRequests(requests);
    } catch (error) {
      console.error("Error loading pending requests:", error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !emailToAdd.trim()) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const result = await sendFriendRequest(user.id, emailToAdd.trim());

      if (result.success) {
        setMessage({
          type: "success",
          text: "Friend request sent successfully!",
        });
        setEmailToAdd("");
        // Refresh pending requests in case there were any changes
        loadPendingRequests();
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to send friend request",
        });
      }
    } catch (error) {
      console.error("Error sending friend request:", error);
      setMessage({
        type: "error",
        text: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if user is not authenticated (redirect will happen)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="dashboard-card m-4 mb-6">
        <div className="dashboard-card-header px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left side - Back button and title */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="sleek-button hover-glow"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div className="flex items-center gap-3">
                <div className="stats-card-icon">
                  <Users className="h-5 w-5" />
                </div>
                <h1 className="dashboard-heading">Friends</h1>
              </div>
            </div>

            {/* Right side - User menu */}
            <div className="flex items-center gap-3">
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: controls + lists */}
          <div className="space-y-6">
            {/* Add Friend */}
            <div className="dashboard-card">
              <div className="dashboard-card-header px-6 py-4">
                <h2 className="dashboard-subheading">Add Friend</h2>
                <p className="dashboard-body">
                  Send a friend request by email.
                </p>
              </div>
              <div className="p-6 space-y-3">
                <form onSubmit={handleSendFriendRequest} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="friend@email.com"
                      value={emailToAdd}
                      onChange={(e) => setEmailToAdd(e.target.value)}
                      inputMode="email"
                      type="email"
                      className="modern-input"
                      disabled={isSubmitting}
                      required
                    />
                    <Button
                      type="submit"
                      disabled={isSubmitting || !emailToAdd.trim()}
                      className="hover-glow"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send"
                      )}
                    </Button>
                  </div>

                  {message && (
                    <Alert
                      className={
                        message.type === "success"
                          ? "border-green-500"
                          : "border-red-500"
                      }
                    >
                      {message.type === "success" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <AlertDescription
                        className={
                          message.type === "success"
                            ? "text-green-700"
                            : "text-red-700"
                        }
                      >
                        {message.text}
                      </AlertDescription>
                    </Alert>
                  )}
                </form>

                <p className="text-xs text-muted-foreground">
                  We'll verify the email belongs to an existing account.
                </p>
              </div>
            </div>

            {/* Pending Requests */}
            <div className="dashboard-card">
              <div className="dashboard-card-header px-6 py-4">
                <h2 className="dashboard-subheading">Friend Requests</h2>
                <p className="dashboard-body">Incoming friend requests.</p>
              </div>
              <div className="p-6">
                {loadingRequests ? (
                  <div className="text-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3" />
                    <p className="dashboard-body text-sm">
                      Loading requests...
                    </p>
                  </div>
                ) : pendingRequests.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="stats-card-icon mx-auto mb-3 opacity-50">
                      <UserPlus className="h-5 w-5" />
                    </div>
                    <p className="dashboard-body text-sm">
                      No pending requests
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 bg-card/50"
                      >
                        <div>
                          <span className="text-sm font-medium">
                            {request.sender?.full_name || request.sender?.email}
                          </span>
                          {request.sender?.full_name && (
                            <p className="text-xs text-muted-foreground">
                              {request.sender.email}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.created_at!).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => console.log("Accept", request.id)}
                            className="hover-glow"
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => console.log("Decline", request.id)}
                            className="sleek-button"
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* My Friends */}
            <div className="dashboard-card">
              <div className="dashboard-card-header px-6 py-4">
                <h2 className="dashboard-subheading">My Friends</h2>
                <p className="dashboard-body">Your accepted friends.</p>
              </div>
              <div className="p-6">
                {friends.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="stats-card-icon mx-auto mb-3 opacity-50">
                      <Users className="h-5 w-5" />
                    </div>
                    <p className="dashboard-body text-sm">
                      You have no friends yet
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friends.map((f) => (
                      <div
                        key={f.id}
                        className={`nav-item cursor-pointer rounded-xl ${
                          selectedFriend?.id === f.id ? "active" : ""
                        }`}
                        onClick={() => setSelectedFriend(f)}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Users className="h-4 w-4 flex-shrink-0" />
                          <div>
                            <span className="text-sm font-medium">
                              {f.name || f.email}
                            </span>
                            {f.name && (
                              <p className="text-xs text-muted-foreground">
                                {f.email}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="sleek-button"
                        >
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column: friend profile / shared notes */}
          <div className="lg:col-span-2">
            <div className="dashboard-card h-full">
              <div className="dashboard-card-header px-6 py-4">
                <h2 className="dashboard-subheading">Friend Profile</h2>
                <p className="dashboard-body">
                  {selectedFriend
                    ? `Viewing ${selectedFriend.name || selectedFriend.email}`
                    : "Select a friend to view their shared notes."}
                </p>
              </div>
              <Separator />
              <div className="p-6">
                {!selectedFriend ? (
                  <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <div className="stats-card-icon mx-auto mb-4 opacity-50">
                        <Users className="h-8 w-8" />
                      </div>
                      <h3 className="dashboard-heading mb-2">
                        No friend selected
                      </h3>
                      <p className="dashboard-body max-w-md mx-auto">
                        Choose a friend from the list to view their shared notes
                        and collaborate on your learning journey.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Friend Info */}
                    <div className="dashboard-card">
                      <div className="p-4">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="stats-card-icon">
                            <Users className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="dashboard-subheading">
                              {selectedFriend.name || selectedFriend.email}
                            </h3>
                            {selectedFriend.name && (
                              <p className="dashboard-body">
                                {selectedFriend.email}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              console.log("Message", selectedFriend.id)
                            }
                            className="sleek-button hover-glow"
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Message
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              console.log("Remove friend", selectedFriend.id)
                            }
                            className="sleek-button"
                          >
                            Remove Friend
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Shared Notes */}
                    <div className="dashboard-card">
                      <div className="dashboard-card-header px-4 py-3">
                        <h3 className="dashboard-subheading">Shared Notes</h3>
                      </div>
                      <div className="p-4">
                        <div className="text-center py-8">
                          <div className="stats-card-icon mx-auto mb-3 opacity-50">
                            <MessageCircle className="h-5 w-5" />
                          </div>
                          <p className="dashboard-body text-sm">
                            Notes marked "friends" by{" "}
                            {selectedFriend.name || selectedFriend.email} will
                            appear here.
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            No shared notes yet.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Sidebar - Mobile friendly */}
        <div className="mt-6 lg:hidden">
          <div className="dashboard-card">
            <div className="dashboard-card-header px-6 py-4">
              <h2 className="dashboard-subheading">Quick Actions</h2>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                variant="ghost"
                className="justify-start sleek-button hover-glow"
                onClick={() => console.log("Send Friend Request")}
              >
                <UserPlus className="h-4 w-4 mr-3" />
                Send Request
              </Button>
              <Button
                variant="ghost"
                className="justify-start sleek-button hover-glow"
                onClick={() => console.log("Start Group Chat")}
              >
                <MessageCircle className="h-4 w-4 mr-3" />
                Group Chat
              </Button>
              <Button
                variant="ghost"
                className="justify-start sleek-button hover-glow"
                onClick={() => console.log("Privacy Settings")}
              >
                <Settings className="h-4 w-4 mr-3" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
