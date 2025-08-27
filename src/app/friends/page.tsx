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
  FileText,
  Eye,
  BookOpen,
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
  getFriendSharedPages,
  debugSharedPagesAccess,
  type FriendRequestWithUser,
  type Friend,
  type SharedPage,
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

  // Shared notes state
  const [sharedPages, setSharedPages] = useState<SharedPage[]>([]);
  const [loadingSharedPages, setLoadingSharedPages] = useState(false);
  const [selectedSharedPage, setSelectedSharedPage] =
    useState<SharedPage | null>(null);
  const [showSharedPageModal, setShowSharedPageModal] = useState(false);

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

  // Load shared pages for a specific friend
  const loadSharedPages = async (friendId: string) => {
    if (!user) {
      console.error("📖 Cannot load shared pages: no user");
      return;
    }

    console.log("📖 Friends page: Starting to load shared pages", {
      currentUserId: user.id,
      friendId,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
    });

    try {
      setLoadingSharedPages(true);
      const result = await getFriendSharedPages(user.id, friendId);

      console.log("📖 Friends page: Shared pages result", {
        success: result.success,
        error: result.error,
        pagesCount: result.data?.length || 0,
        pages: result.data?.map((p) => ({
          id: p.id,
          title: p.title,
          visibility: p.visibility,
        })),
      });

      if (result.success) {
        setSharedPages(result.data || []);
        if ((result.data?.length || 0) === 0) {
          console.log(
            "📖 No shared pages found - this might be expected if friend hasn't shared any notes",
          );
        }
      } else {
        console.error("📖 Error loading shared pages:", result.error);
        setSharedPages([]);

        // Only show error toast for actual errors, not when no friendship exists
        if (!result.error?.includes("not friends")) {
          toast({
            title: "Error Loading Shared Notes",
            description: result.error || "Failed to load shared notes",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("📖 Unexpected error loading shared pages:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        friendId,
        userId: user.id,
      });
      setSharedPages([]);
      toast({
        title: "Unexpected Error",
        description: "An unexpected error occurred while loading shared notes",
        variant: "destructive",
      });
    } finally {
      setLoadingSharedPages(false);
    }
  };

  // Handle viewing a shared page
  const handleViewSharedPage = (page: SharedPage) => {
    setSelectedSharedPage(page);
    setShowSharedPageModal(true);
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
                          // Load shared pages when opening friend profile
                          loadSharedPages(friend.friend_id);
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
                                  // Load shared pages when opening friend profile
                                  loadSharedPages(friend.friend_id);
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
                      onClick={async () => {
                        if (!user) return;
                        console.log(
                          "🔍 Running debug test for shared pages access...",
                        );
                        const debugResult = await debugSharedPagesAccess(
                          user.id,
                          selectedFriend.friend_id,
                        );
                        console.log("🔍 Debug test complete:", debugResult);
                        toast({
                          title: "Debug Test Complete",
                          description:
                            "Check browser console for detailed results",
                        });
                      }}
                      className="sleek-button hover-glow"
                    >
                      Debug Shared Access
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
                  {loadingSharedPages ? (
                    <div className="text-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                      <h4 className="dashboard-subheading mb-2">
                        Loading shared notes...
                      </h4>
                      <p className="dashboard-body text-sm">
                        Please wait while we fetch the shared notes.
                      </p>
                    </div>
                  ) : sharedPages.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="stats-card-icon mx-auto mb-4 opacity-50">
                        <FileText className="h-8 w-8" />
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

                      {/* Debug Information */}
                      <div className="mt-6 p-4 bg-muted/20 rounded-lg text-left max-w-md mx-auto">
                        <h5 className="text-xs font-medium text-muted-foreground mb-2">
                          Debug Info (for troubleshooting):
                        </h5>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>• Friend ID: {selectedFriend.friend_id}</p>
                          <p>• Your ID: {user?.id}</p>
                          <p>• Check browser console for detailed logs</p>
                          <p>
                            • Ensure friend has set notes to 'Friends'
                            visibility
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            loadSharedPages(selectedFriend.friend_id)
                          }
                          className="mt-2 text-xs sleek-button"
                        >
                          Retry Loading
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sharedPages.map((page) => (
                        <div
                          key={page.id}
                          className="rounded-lg border border-border/50 p-4 bg-card/50 hover:bg-card/80 transition-colors cursor-pointer group"
                          onClick={() => handleViewSharedPage(page)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                                <h5 className="font-medium text-sm truncate">
                                  {page.title || "Untitled Note"}
                                </h5>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                                {page.notebook_name && (
                                  <div className="flex items-center gap-1">
                                    <BookOpen className="h-3 w-3" />
                                    <span>{page.notebook_name}</span>
                                  </div>
                                )}
                                {page.section_name && (
                                  <div className="flex items-center gap-1">
                                    <span>•</span>
                                    <span>{page.section_name}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    {new Date(
                                      page.updated_at || page.created_at || "",
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="opacity-0 group-hover:opacity-100 transition-opacity sleek-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewSharedPage(page);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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

      {/* Shared Page Viewer Modal */}
      <Dialog open={showSharedPageModal} onOpenChange={setShowSharedPageModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="stats-card-icon">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl">
                    {selectedSharedPage?.title || "Untitled Note"}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      <span>
                        {selectedSharedPage?.author_name ||
                          selectedSharedPage?.author_email}
                      </span>
                    </div>
                    {selectedSharedPage?.notebook_name && (
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        <span>{selectedSharedPage.notebook_name}</span>
                        {selectedSharedPage.section_name && (
                          <span> • {selectedSharedPage.section_name}</span>
                        )}
                      </div>
                    )}
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSharedPageModal(false)}
                className="sleek-button"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {selectedSharedPage && (
            <div className="space-y-6 mt-6">
              {/* Note Metadata */}
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="space-y-1">
                      <label className="font-medium text-muted-foreground">
                        Created
                      </label>
                      <p>
                        {new Date(
                          selectedSharedPage.created_at || "",
                        ).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="font-medium text-muted-foreground">
                        Last Updated
                      </label>
                      <p>
                        {new Date(
                          selectedSharedPage.updated_at ||
                            selectedSharedPage.created_at ||
                            "",
                        ).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="font-medium text-muted-foreground">
                        Visibility
                      </label>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-primary" />
                        <span className="capitalize">
                          {selectedSharedPage.visibility}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Note Content */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Note Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {selectedSharedPage.content_json ? (
                      <div
                        className="ProseMirror prose-lists"
                        dangerouslySetInnerHTML={{
                          __html: (() => {
                            try {
                              // Simple JSON to HTML conversion for display
                              const content =
                                typeof selectedSharedPage.content_json ===
                                "string"
                                  ? JSON.parse(selectedSharedPage.content_json)
                                  : selectedSharedPage.content_json;

                              if (content && content.content) {
                                return content.content
                                  .map((node: any) => {
                                    if (node.type === "paragraph") {
                                      const text =
                                        node.content
                                          ?.map((textNode: any) => {
                                            if (textNode.type === "text") {
                                              let html = textNode.text || "";
                                              if (textNode.marks) {
                                                textNode.marks.forEach(
                                                  (mark: any) => {
                                                    if (mark.type === "bold") {
                                                      html = `<strong>${html}</strong>`;
                                                    } else if (
                                                      mark.type === "italic"
                                                    ) {
                                                      html = `<em>${html}</em>`;
                                                    } else if (
                                                      mark.type === "underline"
                                                    ) {
                                                      html = `<u>${html}</u>`;
                                                    } else if (
                                                      mark.type ===
                                                        "textStyle" &&
                                                      mark.attrs?.color
                                                    ) {
                                                      html = `<span style="color: ${mark.attrs.color}">${html}</span>`;
                                                    } else if (
                                                      mark.type ===
                                                        "highlight" &&
                                                      mark.attrs?.color
                                                    ) {
                                                      html = `<mark style="background-color: ${mark.attrs.color}">${html}</mark>`;
                                                    }
                                                  },
                                                );
                                              }
                                              return html;
                                            }
                                            return "";
                                          })
                                          .join("") || "";
                                      return `<p>${text}</p>`;
                                    } else if (node.type === "heading") {
                                      const level = node.attrs?.level || 1;
                                      const text =
                                        node.content
                                          ?.map(
                                            (textNode: any) =>
                                              textNode.text || "",
                                          )
                                          .join("") || "";
                                      return `<h${level}>${text}</h${level}>`;
                                    } else if (node.type === "bulletList") {
                                      const items =
                                        node.content
                                          ?.map((item: any) => {
                                            const text =
                                              item.content?.[0]?.content
                                                ?.map(
                                                  (textNode: any) =>
                                                    textNode.text || "",
                                                )
                                                .join("") || "";
                                            return `<li>${text}</li>`;
                                          })
                                          .join("") || "";
                                      return `<ul>${items}</ul>`;
                                    } else if (node.type === "orderedList") {
                                      const items =
                                        node.content
                                          ?.map((item: any) => {
                                            const text =
                                              item.content?.[0]?.content
                                                ?.map(
                                                  (textNode: any) =>
                                                    textNode.text || "",
                                                )
                                                .join("") || "";
                                            return `<li>${text}</li>`;
                                          })
                                          .join("") || "";
                                      return `<ol>${items}</ol>`;
                                    }
                                    return "";
                                  })
                                  .join("");
                              }
                              return (
                                selectedSharedPage.content ||
                                "No content available"
                              );
                            } catch (error) {
                              console.error("Error parsing content:", error);
                              return (
                                selectedSharedPage.content ||
                                "Error displaying content"
                              );
                            }
                          })(),
                        }}
                      />
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-muted-foreground">
                          {selectedSharedPage.content ||
                            "This note appears to be empty."}
                        </p>
                      </div>
                    )}
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
