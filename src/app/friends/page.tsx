"use client";

import { useState, useEffect, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Users,
  UserPlus,
  MessageCircle,
  Settings,
  Loader2,
  CheckCircle,
  AlertCircle,
  Search,
  Calendar,
  Mail,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import UserMenu from "@/components/auth/UserMenu";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  sendFriendRequest,
  getPendingFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  getFriends,
  unfriendUser,
  type FriendRequestWithUser,
  type Friend,
} from "@/lib/supabase/friends";

// Remove the local Friend type since we're importing it from the library

export default function FriendsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

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
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Unfriend confirmation state
  const [showUnfriendDialog, setShowUnfriendDialog] = useState(false);
  const [friendToUnfriend, setFriendToUnfriend] = useState<Friend | null>(null);
  const [isUnfriending, setIsUnfriending] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  // Load pending friend requests and friends list
  useEffect(() => {
    if (user) {
      loadPendingRequests();
      loadFriends();
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

  const handleUnfriendClick = (friend: Friend) => {
    setFriendToUnfriend(friend);
    setShowUnfriendDialog(true);
  };

  const handleConfirmUnfriend = async () => {
    if (!user || !friendToUnfriend) return;

    setIsUnfriending(true);

    try {
      const result = await unfriendUser(user.id, friendToUnfriend.friend_id);

      if (result.success) {
        // Optimistically remove from friends list
        setFriends((prev) =>
          prev.filter(
            (friend) => friend.friend_id !== friendToUnfriend.friend_id,
          ),
        );

        // Show success toast
        toast({
          title: "Friend removed",
          description: `You removed ${friendToUnfriend.friend_name || friendToUnfriend.friend_email} as a friend.`,
        });

        // Close dialogs
        setShowUnfriendDialog(false);
        setShowProfileModal(false);
        setFriendToUnfriend(null);
      } else {
        // Show error toast
        toast({
          title: "Error",
          description:
            result.error || "Failed to remove friend. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error unfriending user:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUnfriending(false);
    }
  };

  const handleCancelUnfriend = () => {
    setShowUnfriendDialog(false);
    setFriendToUnfriend(null);
  };

  const loadFriends = async () => {
    if (!user) return;

    try {
      setLoadingFriends(true);
      const friendsList = await getFriends(user.id);
      setFriends(friendsList);
    } catch (error) {
      console.error("Error loading friends:", error);
    } finally {
      setLoadingFriends(false);
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

  const handleAcceptRequest = async (requestId: string) => {
    if (!user) return;

    // Add to processing set for loading state
    setProcessingRequests((prev) => new Set(prev).add(requestId));

    try {
      const result = await acceptFriendRequest(requestId, user.id);

      if (result.success) {
        // Optimistically remove from pending requests
        setPendingRequests((prev) =>
          prev.filter((request) => request.id !== requestId),
        );

        // Refresh friends list to show new friend
        loadFriends();

        setMessage({
          type: "success",
          text: "Friend request accepted!",
        });
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to accept friend request",
        });
      }
    } catch (error) {
      console.error("Error accepting friend request:", error);
      setMessage({
        type: "error",
        text: "An unexpected error occurred. Please try again.",
      });
    } finally {
      // Remove from processing set
      setProcessingRequests((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    if (!user) return;

    // Add to processing set for loading state
    setProcessingRequests((prev) => new Set(prev).add(requestId));

    try {
      const result = await declineFriendRequest(requestId, user.id);

      if (result.success) {
        // Optimistically remove from pending requests
        setPendingRequests((prev) =>
          prev.filter((request) => request.id !== requestId),
        );

        setMessage({
          type: "success",
          text: "Friend request declined.",
        });
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to decline friend request",
        });
      }
    } catch (error) {
      console.error("Error declining friend request:", error);
      setMessage({
        type: "error",
        text: "An unexpected error occurred. Please try again.",
      });
    } finally {
      // Remove from processing set
      setProcessingRequests((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
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

  // Filter friends based on search query
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) {
      return friends;
    }

    const query = searchQuery.toLowerCase().trim();
    return friends.filter(
      (friend) =>
        friend.friend_name?.toLowerCase().includes(query) ||
        friend.friend_email.toLowerCase().includes(query),
    );
  }, [friends, searchQuery]);

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
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="flex gap-6">
          {/* Main Center Section: My Friends */}
          <div className="flex-1">
            <div className="dashboard-card">
              <div className="dashboard-card-header px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="dashboard-heading">My Friends</h2>
                    <p className="dashboard-body">
                      {friends.length > 0
                        ? `${friends.length} friend${friends.length === 1 ? "" : "s"}`
                        : "Your accepted friends."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddFriends(!showAddFriends)}
                      className="sleek-button hover-glow"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Friend
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFriendRequests(!showFriendRequests)}
                      className="sleek-button hover-glow relative"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Requests
                      {pendingRequests.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {pendingRequests.length}
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {/* Search Bar */}
                {friends.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search friends by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 modern-input"
                    />
                  </div>
                )}

                {/* Friends Grid */}
                {loadingFriends ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="dashboard-body">Loading friends...</p>
                  </div>
                ) : friends.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="stats-card-icon mx-auto mb-6 opacity-50">
                      <Users className="h-12 w-12" />
                    </div>
                    <h3 className="dashboard-heading mb-3">No friends yet</h3>
                    <p className="dashboard-body max-w-md mx-auto mb-6">
                      You don't have any friends yet. Send some requests to
                      start building your network!
                    </p>
                    <Button
                      variant="default"
                      onClick={() => setShowAddFriends(true)}
                      className="hover-glow"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Send Friend Request
                    </Button>
                  </div>
                ) : filteredFriends.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="stats-card-icon mx-auto mb-4 opacity-50">
                      <Search className="h-8 w-8" />
                    </div>
                    <h3 className="dashboard-subheading mb-2">
                      No friends found
                    </h3>
                    <p className="dashboard-body text-sm">
                      No friends match your search for &quot;{searchQuery}&quot;
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchQuery("")}
                      className="mt-2 sleek-button"
                    >
                      Clear search
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredFriends.map((friend) => (
                      <Card
                        key={friend.friend_id}
                        className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-border/50 hover:border-primary/30 group"
                        onClick={() => {
                          setSelectedFriend(friend);
                          setShowProfileModal(true);
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="text-center space-y-3">
                            <div className="stats-card-icon mx-auto">
                              <Users className="h-6 w-6" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm truncate">
                                {friend.friend_name || "Unknown User"}
                              </h3>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <p className="text-xs text-muted-foreground truncate">
                                  {friend.friend_email}
                                </p>
                              </div>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <p className="text-xs text-muted-foreground">
                                  {new Date(
                                    friend.friendship_created_at,
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="flex-1 sleek-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedFriend(friend);
                                  setShowProfileModal(true);
                                }}
                              >
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnfriendClick(friend);
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Toggleable Sections */}
          <div className="w-80 space-y-4">
            {/* Add Friend Section */}
            <div className="dashboard-card">
              <div
                className="dashboard-card-header px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setShowAddFriends(!showAddFriends)}
              >
                <div className="flex items-center justify-between">
                  <h3 className="dashboard-subheading text-sm">Add Friend</h3>
                  {showAddFriends ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>
              {showAddFriends && (
                <div className="p-4 space-y-3">
                  <form
                    onSubmit={handleSendFriendRequest}
                    className="space-y-3"
                  >
                    <Input
                      placeholder="friend@email.com"
                      value={emailToAdd}
                      onChange={(e) => setEmailToAdd(e.target.value)}
                      inputMode="email"
                      type="email"
                      className="modern-input text-sm"
                      disabled={isSubmitting}
                      required
                    />
                    <Button
                      type="submit"
                      disabled={isSubmitting || !emailToAdd.trim()}
                      className="w-full hover-glow"
                      size="sm"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send Request"
                      )}
                    </Button>
                  </form>

                  {message && (
                    <Alert
                      className={
                        message.type === "success"
                          ? "border-green-500"
                          : "border-red-500"
                      }
                    >
                      {message.type === "success" ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-red-500" />
                      )}
                      <AlertDescription
                        className={`text-xs ${
                          message.type === "success"
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {message.text}
                      </AlertDescription>
                    </Alert>
                  )}

                  <p className="text-xs text-muted-foreground">
                    We'll verify the email belongs to an existing account.
                  </p>
                </div>
              )}
            </div>

            {/* Friend Requests Section */}
            <div className="dashboard-card">
              <div
                className="dashboard-card-header px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setShowFriendRequests(!showFriendRequests)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="dashboard-subheading text-sm">
                      Friend Requests
                    </h3>
                    {pendingRequests.length > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                        {pendingRequests.length}
                      </span>
                    )}
                  </div>
                  {showFriendRequests ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>
              {showFriendRequests && (
                <div className="p-4">
                  {loadingRequests ? (
                    <div className="text-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">
                        Loading requests...
                      </p>
                    </div>
                  ) : pendingRequests.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="stats-card-icon mx-auto mb-2 opacity-50">
                        <UserPlus className="h-4 w-4" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        No pending requests
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingRequests.map((request) => (
                        <div
                          key={request.id}
                          className="rounded-lg border border-border/50 p-3 bg-card/50 space-y-2"
                        >
                          <div>
                            <span className="text-xs font-medium">
                              {request.sender?.full_name ||
                                request.sender?.email}
                            </span>
                            {request.sender?.full_name && (
                              <p className="text-xs text-muted-foreground truncate">
                                {request.sender.email}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleAcceptRequest(request.id)}
                              disabled={processingRequests.has(request.id)}
                              className="flex-1 h-7 text-xs hover-glow"
                            >
                              {processingRequests.has(request.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Accept"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeclineRequest(request.id)}
                              disabled={processingRequests.has(request.id)}
                              className="flex-1 h-7 text-xs sleek-button"
                            >
                              {processingRequests.has(request.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Decline"
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Friend Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="stats-card-icon">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl">
                    {selectedFriend?.friend_name || "Unknown User"}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {selectedFriend?.friend_email}
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowProfileModal(false)}
                className="sleek-button"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {selectedFriend && (
            <div className="space-y-6 mt-6">
              {/* Friend Info Section */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Friend Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Name
                      </label>
                      <p className="text-sm">
                        {selectedFriend.friend_name || "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Email
                      </label>
                      <p className="text-sm">{selectedFriend.friend_email}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Friends Since
                      </label>
                      <p className="text-sm">
                        {new Date(
                          selectedFriend.friendship_created_at,
                        ).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="default"
                      onClick={() =>
                        console.log("Message", selectedFriend.friend_id)
                      }
                      className="hover-glow"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        console.log(
                          "View shared notes",
                          selectedFriend.friend_id,
                        )
                      }
                      className="sleek-button hover-glow"
                    >
                      View Shared Notes
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleUnfriendClick(selectedFriend)}
                      className="hover-glow"
                    >
                      Remove Friend
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Shared Notes Section */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Shared Notes</CardTitle>
                  <CardDescription>
                    Notes that{" "}
                    {selectedFriend.friend_name || selectedFriend.friend_email}{" "}
                    has shared with you
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <div className="stats-card-icon mx-auto mb-4 opacity-50">
                      <MessageCircle className="h-8 w-8" />
                    </div>
                    <h4 className="dashboard-subheading mb-2">
                      No shared notes yet
                    </h4>
                    <p className="dashboard-body text-sm max-w-md mx-auto mb-4">
                      When{" "}
                      {selectedFriend.friend_name ||
                        selectedFriend.friend_email}{" "}
                      shares notes with you, they'll appear here for
                      collaborative learning.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() =>
                        console.log(
                          "Request shared notes",
                          selectedFriend.friend_id,
                        )
                      }
                      className="sleek-button hover-glow"
                    >
                      Request Notes
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Section */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                  <CardDescription>
                    Recent interactions and shared activities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="stats-card-icon mx-auto mb-4 opacity-50">
                      <Calendar className="h-6 w-6" />
                    </div>
                    <h4 className="dashboard-subheading mb-2">
                      No recent activity
                    </h4>
                    <p className="dashboard-body text-sm">
                      Start collaborating to see activity here!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Unfriend Confirmation Dialog */}
      <AlertDialog
        open={showUnfriendDialog}
        onOpenChange={setShowUnfriendDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Friend</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong>
                {friendToUnfriend?.friend_name ||
                  friendToUnfriend?.friend_email}
              </strong>{" "}
              as a friend? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancelUnfriend}
              disabled={isUnfriending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUnfriend}
              disabled={isUnfriending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnfriending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
