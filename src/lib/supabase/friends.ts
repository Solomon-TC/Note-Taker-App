"use client";

import { createClient } from "@/lib/supabase-client";
import { Database } from "@/types/supabase";

type FriendRequest = Database["public"]["Tables"]["friend_requests"]["Row"];
type User = Database["public"]["Tables"]["users"]["Row"];

export interface SendFriendRequestResult {
  success: boolean;
  error?: string;
  data?: FriendRequest;
}

export interface FriendRequestWithUser extends FriendRequest {
  sender?: User;
  receiver?: User;
}

export interface AcceptFriendRequestResult {
  success: boolean;
  error?: string;
}

export interface DeclineFriendRequestResult {
  success: boolean;
  error?: string;
}

export interface Friend {
  friend_id: string;
  friend_email: string;
  friend_name: string | null;
  friendship_created_at: string;
}

export interface UnfriendResult {
  success: boolean;
  error?: string;
}

/**
 * Send a friend request to a user by their email address
 */
export async function sendFriendRequest(
  senderId: string,
  receiverEmail: string,
): Promise<SendFriendRequestResult> {
  const supabase = createClient();

  try {
    // Validate input
    if (!senderId || !receiverEmail) {
      return {
        success: false,
        error: "Sender ID and receiver email are required",
      };
    }

    // Normalize email - handle various formats
    const normalizedEmail = receiverEmail.toLowerCase().trim();

    console.log("🔍 Friend Request Debug:", {
      senderId,
      originalEmail: receiverEmail,
      normalizedEmail,
      timestamp: new Date().toISOString(),
    });

    // First, let's check what users exist in the database for debugging
    console.log("🔍 Debugging: Checking all users in database...");
    const { data: allUsers, error: debugError } = await supabase
      .from("users")
      .select("id, email, full_name")
      .limit(10);

    console.log("🔍 Debug - Users in database:", {
      totalUsers: allUsers?.length || 0,
      users:
        allUsers?.map((u: { id: string; email: string; full_name: string | null }) => ({
          id: u.id,
          email: u.email,
          name: u.full_name,
        })) || [],
      debugError: debugError?.message,
    });

    // Search for user in the custom users table by email (case-insensitive)
    console.log("🔍 Searching for user by email:", {
      originalEmail: receiverEmail,
      normalizedEmail,
    });

    // Try multiple approaches to find the user
    let receiverUser = null;
    let lookupError = null;

    // Method 1: Case-insensitive search with ilike
    console.log("🔍 Method 1: Using ilike for case-insensitive search");
    const { data: user1, error: error1 } = await supabase
      .from("users")
      .select("id, email, full_name")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (user1) {
      receiverUser = user1;
      console.log("🔍 ✅ Found user with ilike:", user1);
    } else if (error1 && error1.code !== "PGRST116") {
      console.log("🔍 Method 1 error:", error1);
    }

    // Method 2: Exact match search if Method 1 failed
    if (!receiverUser) {
      console.log("🔍 Method 2: Using exact match search");
      const { data: user2, error: error2 } = await supabase
        .from("users")
        .select("id, email, full_name")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (user2) {
        receiverUser = user2;
        console.log("🔍 ✅ Found user with exact match:", user2);
      } else if (error2 && error2.code !== "PGRST116") {
        console.log("🔍 Method 2 error:", error2);
        lookupError = error2;
      }
    }

    // Method 3: Search with original email format if still not found
    if (!receiverUser && receiverEmail !== normalizedEmail) {
      console.log("🔍 Method 3: Using original email format");
      const { data: user3, error: error3 } = await supabase
        .from("users")
        .select("id, email, full_name")
        .eq("email", receiverEmail)
        .maybeSingle();

      if (user3) {
        receiverUser = user3;
        console.log("🔍 ✅ Found user with original email:", user3);
      } else if (error3 && error3.code !== "PGRST116") {
        console.log("🔍 Method 3 error:", error3);
        lookupError = error3;
      }
    }

    // Method 4: Wildcard search as last resort
    if (!receiverUser) {
      console.log("🔍 Method 4: Using wildcard search");
      const { data: users4, error: error4 } = await supabase
        .from("users")
        .select("id, email, full_name")
        .ilike("email", `%${normalizedEmail}%`);

      if (users4 && users4.length > 0) {
        // Find exact match in results
        const exactMatch = users4.find(
          (u: { id: string; email: string; full_name: string | null }) =>
            u.email.toLowerCase() === normalizedEmail ||
            u.email === receiverEmail,
        );
        if (exactMatch) {
          receiverUser = exactMatch;
          console.log("🔍 ✅ Found user with wildcard search:", exactMatch);
        } else {
          console.log(
            "🔍 Wildcard search found users but no exact match:",
            users4,
          );
        }
      } else if (error4) {
        console.log("🔍 Method 4 error:", error4);
        lookupError = error4;
      }
    }

    console.log("🔍 Final user lookup result:", {
      foundUser: !!receiverUser,
      userId: receiverUser?.id,
      userEmail: receiverUser?.email,
      finalError: lookupError?.message,
    });

    // Handle database errors
    if (lookupError && lookupError.code !== "PGRST116") {
      // Other database errors (not "no rows found")
      console.error("🔍 Database lookup error:", lookupError);
      return {
        success: false,
        error: `Database error: ${lookupError.message}. Please try again.`,
      };
    }

    // User not found after all methods
    if (!receiverUser) {
      console.log("🔍 ❌ No user found after all search methods:", {
        originalEmail: receiverEmail,
        normalizedEmail,
        totalUsersInDb: allUsers?.length || 0,
        availableEmails: allUsers?.map((u: { id: string; email: string; full_name: string | null }) => u.email) || [],
      });

      // Provide more helpful error message
      const availableEmails =
        allUsers?.map((u: { id: string; email: string; full_name: string | null }) => u.email).join(", ") || "none";
      return {
        success: false,
        error: `User not found with email "${receiverEmail}". Available emails in database: ${availableEmails}. Please ensure the user has created an account.`,
      };
    }

    console.log("🔍 Found receiver user:", {
      id: receiverUser.id,
      email: receiverUser.email,
      fullName: receiverUser.full_name,
    });

    // Check if trying to send request to self
    if (receiverUser.id === senderId) {
      return {
        success: false,
        error: "You cannot send a friend request to yourself.",
      };
    }

    // Check if a friend request already exists in either direction
    const { data: existingRequests, error: requestError } = await supabase
      .from("friend_requests")
      .select("*")
      .or(
        `and(sender_id.eq.${senderId},receiver_id.eq.${receiverUser.id}),and(sender_id.eq.${receiverUser.id},receiver_id.eq.${senderId})`,
      );

    if (requestError) {
      console.error("Error checking existing requests:", requestError);
      return {
        success: false,
        error: "Failed to check existing friend requests. Please try again.",
      };
    }

    if (existingRequests && existingRequests.length > 0) {
      const existingRequest = existingRequests[0];

      if (existingRequest.status === "accepted") {
        return {
          success: false,
          error: "You are already friends with this user.",
        };
      } else if (existingRequest.status === "pending") {
        if (existingRequest.sender_id === senderId) {
          return {
            success: false,
            error: "You have already sent a friend request to this user.",
          };
        } else {
          return {
            success: false,
            error:
              "This user has already sent you a friend request. Check your pending requests.",
          };
        }
      } else if (existingRequest.status === "denied") {
        // Allow sending a new request if the previous one was denied
        // First, delete the old denied request
        const { error: deleteError } = await supabase
          .from("friend_requests")
          .delete()
          .eq("id", existingRequest.id);

        if (deleteError) {
          console.error("Error deleting old request:", deleteError);
          return {
            success: false,
            error: "Failed to process request. Please try again.",
          };
        }
      }
    }

    // Create the friend request
    const { data: newRequest, error: insertError } = await supabase
      .from("friend_requests")
      .insert({
        sender_id: senderId,
        receiver_id: receiverUser.id,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating friend request:", insertError);

      // Handle specific database constraint errors
      if (insertError.code === "23505") {
        return {
          success: false,
          error: "A friend request already exists between you and this user.",
        };
      }

      if (insertError.code === "23514") {
        return {
          success: false,
          error: "You cannot send a friend request to yourself.",
        };
      }

      // Handle RLS policy violations
      if (
        insertError.code === "42501" ||
        insertError.message?.includes("policy")
      ) {
        return {
          success: false,
          error: "You are not authorized to send this friend request.",
        };
      }

      return {
        success: false,
        error: "Failed to send friend request. Please try again.",
      };
    }

    return {
      success: true,
      data: newRequest,
    };
  } catch (error) {
    console.error("Unexpected error in sendFriendRequest:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Get pending friend requests for a user (requests they've received)
 */
export async function getPendingFriendRequests(
  userId: string,
): Promise<FriendRequestWithUser[]> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("friend_requests")
      .select(
        `
        *,
        sender:users!friend_requests_sender_id_fkey(
          id,
          email,
          full_name,
          avatar_url,
          created_at,
          updated_at
        )
      `,
      )
      .eq("receiver_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching pending requests:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Unexpected error in getPendingFriendRequests:", error);
    return [];
  }
}

/**
 * Get sent friend requests for a user (requests they've sent)
 */
export async function getSentFriendRequests(
  userId: string,
): Promise<FriendRequestWithUser[]> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("friend_requests")
      .select(
        `
        *,
        receiver:users!friend_requests_receiver_id_fkey(
          id,
          email,
          full_name,
          avatar_url,
          created_at,
          updated_at
        )
      `,
      )
      .eq("sender_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching sent requests:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Unexpected error in getSentFriendRequests:", error);
    return [];
  }
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(
  requestId: string,
  userId: string,
): Promise<AcceptFriendRequestResult> {
  const supabase = createClient();

  try {
    // Validate input
    if (!requestId || !userId) {
      return {
        success: false,
        error: "Request ID and user ID are required",
      };
    }

    console.log("🤝 Accepting friend request:", { requestId, userId });

    // First, get the friend request to validate and get sender info
    const { data: request, error: fetchError } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("id", requestId)
      .eq("receiver_id", userId) // Ensure user can only accept requests sent to them
      .eq("status", "pending")
      .single();

    if (fetchError) {
      console.error("Error fetching friend request:", fetchError);
      if (fetchError.code === "PGRST116") {
        return {
          success: false,
          error: "Friend request not found or already processed",
        };
      }
      return {
        success: false,
        error: "Failed to fetch friend request",
      };
    }

    if (!request) {
      return {
        success: false,
        error: "Friend request not found or already processed",
      };
    }

    console.log("🤝 Found request to accept:", {
      requestId: request.id,
      senderId: request.sender_id,
      receiverId: request.receiver_id,
    });

    // Check if friendship already exists
    const { data: existingFriendship, error: friendshipError } = await supabase
      .from("friends")
      .select("*")
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${request.sender_id}),and(user_id.eq.${request.sender_id},friend_id.eq.${userId})`,
      )
      .maybeSingle();

    if (friendshipError && friendshipError.code !== "PGRST116") {
      console.error("Error checking existing friendship:", friendshipError);
      return {
        success: false,
        error: "Failed to check existing friendship",
      };
    }

    if (existingFriendship) {
      console.log("🤝 Friendship already exists, just updating request status");
      // Just update the request status if friendship already exists
      const { error: updateError } = await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("id", requestId)
        .eq("receiver_id", userId);

      if (updateError) {
        console.error("Error updating request status:", updateError);

        // Handle RLS policy violations
        if (
          updateError.code === "42501" ||
          updateError.message?.includes("policy")
        ) {
          return {
            success: false,
            error: "You are not authorized to accept this friend request.",
          };
        }

        return {
          success: false,
          error: "Failed to update request status",
        };
      }

      return { success: true };
    }

    // Use a transaction to update request status and create friendship
    const { error: transactionError } = await supabase.rpc(
      "accept_friend_request_transaction",
      {
        p_request_id: requestId,
        p_user_id: userId,
        p_friend_id: request.sender_id,
      },
    );

    if (transactionError) {
      console.error("Transaction error:", transactionError);

      // Fallback to manual transaction if RPC doesn't exist
      console.log("🤝 Falling back to manual transaction");

      // Update request status
      const { error: updateError } = await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("id", requestId)
        .eq("receiver_id", userId);

      if (updateError) {
        console.error("Error updating request status:", updateError);

        // Handle RLS policy violations
        if (
          updateError.code === "42501" ||
          updateError.message?.includes("policy")
        ) {
          return {
            success: false,
            error: "You are not authorized to accept this friend request.",
          };
        }

        return {
          success: false,
          error: "Failed to update request status",
        };
      }

      // Create friendship record
      const { error: insertError } = await supabase.from("friends").insert({
        user_id: userId,
        friend_id: request.sender_id,
      });

      if (insertError) {
        console.error("Error creating friendship:", insertError);

        // Try to revert the request status update
        await supabase
          .from("friend_requests")
          .update({ status: "pending" })
          .eq("id", requestId);

        if (insertError.code === "23505") {
          return {
            success: false,
            error: "Friendship already exists",
          };
        }

        // Handle RLS policy violations
        if (
          insertError.code === "42501" ||
          insertError.message?.includes("policy")
        ) {
          return {
            success: false,
            error: "You are not authorized to create this friendship.",
          };
        }

        return {
          success: false,
          error: "Failed to create friendship",
        };
      }
    }

    console.log("🤝 Successfully accepted friend request");
    return { success: true };
  } catch (error) {
    console.error("Unexpected error in acceptFriendRequest:", error);
    return {
      success: false,
      error: "An unexpected error occurred",
    };
  }
}

/**
 * Decline a friend request
 */
export async function declineFriendRequest(
  requestId: string,
  userId: string,
): Promise<DeclineFriendRequestResult> {
  const supabase = createClient();

  try {
    // Validate input
    if (!requestId || !userId) {
      return {
        success: false,
        error: "Request ID and user ID are required",
      };
    }

    console.log("❌ Declining friend request:", { requestId, userId });

    // Update request status to declined
    const { error: updateError } = await supabase
      .from("friend_requests")
      .update({ status: "declined" })
      .eq("id", requestId)
      .eq("receiver_id", userId) // Ensure user can only decline requests sent to them
      .eq("status", "pending"); // Only decline pending requests

    if (updateError) {
      console.error("Error declining friend request:", updateError);

      // Handle RLS policy violations
      if (
        updateError.code === "42501" ||
        updateError.message?.includes("policy")
      ) {
        return {
          success: false,
          error: "You are not authorized to decline this friend request.",
        };
      }

      return {
        success: false,
        error: "Failed to decline friend request",
      };
    }

    console.log("❌ Successfully declined friend request");
    return { success: true };
  } catch (error) {
    console.error("Unexpected error in declineFriendRequest:", error);
    return {
      success: false,
      error: "An unexpected error occurred",
    };
  }
}

/**
 * Get user's friends list
 */
export async function getFriends(userId: string): Promise<Friend[]> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase.rpc("get_user_friends", {
      user_uuid: userId,
    });

    if (error) {
      console.error("Error fetching friends:", error);
      return [];
    }

    // Client-side deduplication as a fallback measure
    // Remove any duplicate friends based on friend_id
    const uniqueFriends = (data || []).reduce(
      (acc: Friend[], current: Friend) => {
        const existingFriend = acc.find(
          (friend) => friend.friend_id === current.friend_id,
        );
        if (!existingFriend) {
          acc.push(current);
        }
        return acc;
      },
      [],
    );

    console.log("🤝 Friends fetched:", {
      totalReturned: data?.length || 0,
      uniqueFriends: uniqueFriends.length,
      duplicatesRemoved: (data?.length || 0) - uniqueFriends.length,
    });

    return uniqueFriends;
  } catch (error) {
    console.error("Unexpected error in getFriends:", error);
    return [];
  }
}

export interface SharedPage {
  id: string;
  title: string;
  content: string | null;
  content_json: any | null;
  created_at: string | null;
  updated_at: string | null;
  user_id: string;
  section_id: string;
  visibility: string;
  author_name: string | null;
  author_email: string;
  section_name: string | null;
  notebook_name: string | null;
}

export interface GetSharedPagesResult {
  success: boolean;
  error?: string;
  data?: SharedPage[];
}

/**
 * Get pages shared by a friend (pages with visibility='friends' from a specific friend)
 */
export async function getFriendSharedPages(
  currentUserId: string,
  friendId: string,
): Promise<GetSharedPagesResult> {
  const supabase = createClient();

  try {
    // Validate input
    if (!currentUserId || !friendId) {
      console.error("📖 Invalid input:", { currentUserId, friendId });
      return {
        success: false,
        error: "Current user ID and friend ID are required",
      };
    }

    console.log("📖 Starting enhanced shared pages fetch:", {
      currentUserId,
      friendId,
      timestamp: new Date().toISOString(),
    });

    // Step 1: Verify authentication context
    const {
      data: { user: currentAuthUser },
      error: authError,
    } = await supabase.auth.getUser();

    console.log("📖 Step 1: Auth context verification:", {
      authUserId: currentAuthUser?.id,
      expectedUserId: currentUserId,
      authMatch: currentAuthUser?.id === currentUserId,
      authError: authError?.message,
    });

    if (!currentAuthUser || currentAuthUser.id !== currentUserId) {
      console.error("📖 Auth context mismatch - this will cause RLS to fail");
      return {
        success: false,
        error: "Authentication context mismatch. Please refresh and try again.",
      };
    }

    // Step 2: Use the comprehensive debug function to check everything
    console.log(
      "📖 Step 2: Running comprehensive friendship and pages debug...",
    );
    try {
      const { data: debugResult, error: debugError } = await supabase.rpc(
        "get_friendship_and_pages_debug",
        {
          p_current_user_id: currentUserId,
          p_friend_id: friendId,
        },
      );

      if (debugError) {
        console.error("📖 Debug function error:", debugError);
      } else {
        // Safely access debugResult properties with type checking
        const debugResultObj =
          debugResult &&
          typeof debugResult === "object" &&
          !Array.isArray(debugResult)
            ? (debugResult as Record<string, any>)
            : {};

        console.log("📖 Comprehensive debug result:", {
          friendshipExists: debugResultObj.friendship_exists ?? false,
          friendshipData: debugResultObj.friendship_data ?? null,
          totalPages: debugResultObj.friend_pages_total ?? 0,
          privatePages: debugResultObj.friend_pages_private ?? 0,
          friendsPages: debugResultObj.friend_pages_friends ?? 0,
          accessiblePages: debugResultObj.accessible_pages ?? [],
        });

        // If no friendship exists, return early
        if (!debugResultObj.friendship_exists) {
          return {
            success: false,
            error:
              "You are not friends with this user. Please ensure you have accepted each other's friend requests.",
          };
        }

        // If friendship exists but no friends pages, return empty result
        if (debugResultObj.friend_pages_friends === 0) {
          console.log("📖 Friendship exists but no friends pages found");
          return {
            success: true,
            data: [],
          };
        }
      }
    } catch (debugErr) {
      console.warn(
        "📖 Debug function not available, continuing with manual checks:",
        debugErr,
      );
    }

    // Step 3: Manual friendship verification as fallback
    console.log("📖 Step 3: Manual friendship verification...");
    const { data: friendship, error: friendshipError } = await supabase
      .from("friends")
      .select("*")
      .or(
        `and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`,
      )
      .limit(1)
      .maybeSingle();

    if (friendshipError && friendshipError.code !== "PGRST116") {
      console.error("📖 Friendship verification error:", friendshipError);
      return {
        success: false,
        error: `Failed to verify friendship: ${friendshipError.message}`,
      };
    }

    if (!friendship) {
      console.log("📖 No friendship found between users");
      return {
        success: false,
        error:
          "You are not friends with this user. Please ensure you have accepted each other's friend requests.",
      };
    }

    console.log("📖 Friendship verified:", {
      friendship_id: friendship.id,
      user_id: friendship.user_id,
      friend_id: friendship.friend_id,
      created_at: friendship.created_at,
    });

    // Step 4: Test individual page access before bulk query
    console.log("📖 Step 4: Testing page access with debug function...");

    // First get all friend's pages to test access
    const { data: allFriendPages, error: allPagesError } = await supabase
      .from("pages")
      .select("id, title, user_id, visibility, created_at, updated_at")
      .eq("user_id", friendId)
      .eq("visibility", "friends");

    if (allPagesError) {
      console.error(
        "📖 Error fetching friend's pages for testing:",
        allPagesError,
      );
    } else {
      console.log("📖 Friend's pages found for testing:", {
        total: allFriendPages?.length || 0,
        pages: allFriendPages?.map((p: { id: string; title: string; visibility: string }) => ({
          id: p.id,
          title: p.title,
          visibility: p.visibility,
        })),
      });

      // Test access to first few pages
      if (allFriendPages && allFriendPages.length > 0) {
        for (const page of allFriendPages.slice(0, 3)) {
          try {
            const { data: accessTest, error: accessError } = await supabase.rpc(
              "test_page_access",
              {
                p_page_id: page.id,
                p_user_id: currentUserId,
              },
            );
            // Safely access accessTest properties with type checking
            const accessTestObj =
              accessTest &&
              typeof accessTest === "object" &&
              !Array.isArray(accessTest)
                ? (accessTest as Record<string, any>)
                : {};

            console.log(`📖 Access test for page ${page.id} (${page.title}):`, {
              canAccess: accessTestObj.can_access ?? null,
              accessReason: accessTestObj.access_reason ?? null,
              friendshipCheck: accessTestObj.friendship_check ?? null,
              error: accessError?.message,
            });
          } catch (testErr) {
            console.log(`📖 Access test error for page ${page.id}:`, testErr);
          }
        }
      }
    }

    // Step 5: Attempt the actual RLS-filtered query
    console.log("📖 Step 5: Attempting RLS-filtered pages query...");
    const { data: sharedPagesData, error: sharedPagesError } = await supabase
      .from("pages")
      .select(
        `
        id,
        title,
        content,
        content_json,
        created_at,
        updated_at,
        user_id,
        section_id,
        visibility,
        sections!pages_section_id_fkey(
          id,
          name,
          notebooks!sections_notebook_id_fkey(
            id,
            name
          )
        ),
        users!pages_user_id_fkey(
          id,
          full_name,
          email
        )
        `,
      )
      .eq("user_id", friendId)
      .eq("visibility", "friends")
      .order("updated_at", { ascending: false });

    if (sharedPagesError) {
      console.error("📖 RLS-filtered pages query error:", {
        error: sharedPagesError,
        code: sharedPagesError.code,
        message: sharedPagesError.message,
        details: sharedPagesError.details,
        hint: sharedPagesError.hint,
      });

      // Provide specific error guidance
      if (sharedPagesError.code === "42501") {
        return {
          success: false,
          error: `Access denied by RLS policies. This indicates the friendship verification in the database policies is failing. Error: ${sharedPagesError.message}`,
        };
      }

      if (sharedPagesError.message?.includes("policy")) {
        return {
          success: false,
          error: `RLS policy error: ${sharedPagesError.message}. Please check that the friendship exists and RLS policies are correctly configured.`,
        };
      }

      return {
        success: false,
        error: `Failed to fetch shared pages: ${sharedPagesError.message}`,
      };
    }

    console.log("📖 RLS-filtered pages query result:", {
      found: sharedPagesData?.length || 0,
      pages: sharedPagesData?.map((p: { 
        id: string; 
        title: string; 
        visibility: string; 
        user_id: string;
        sections?: { 
          name: string; 
          notebooks?: { name: string } 
        };
        users?: { full_name: string | null; email: string }
      }) => ({
        id: p.id,
        title: p.title,
        visibility: p.visibility,
        user_id: p.user_id,
        section_name: p.sections?.name,
        notebook_name: p.sections?.notebooks?.name,
        author_name: p.users?.full_name,
        author_email: p.users?.email,
      })),
    });

    // Transform the data to match our interface
    const transformedPages: SharedPage[] = (sharedPagesData || []).map(
      (page: any) => ({
        id: page.id,
        title: page.title || "Untitled Note",
        content: page.content,
        content_json: page.content_json,
        created_at: page.created_at,
        updated_at: page.updated_at,
        user_id: page.user_id,
        section_id: page.section_id,
        visibility: page.visibility,
        author_name: page.users?.full_name || null,
        author_email: page.users?.email || "Unknown",
        section_name: page.sections?.name || null,
        notebook_name: page.sections?.notebooks?.name || null,
      }),
    );

    console.log("📖 Final enhanced result:", {
      success: true,
      friendId,
      pagesCount: transformedPages.length,
      pages: transformedPages.map((p) => ({
        id: p.id,
        title: p.title,
        visibility: p.visibility,
        author_email: p.author_email,
        section_name: p.section_name,
        notebook_name: p.notebook_name,
      })),
    });

    return {
      success: true,
      data: transformedPages,
    };
  } catch (error) {
    console.error("📖 Unexpected error in getFriendSharedPages:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
      currentUserId,
      friendId,
      timestamp: new Date().toISOString(),
    });
    return {
      success: false,
      error: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Debug function to test shared pages access
 * This function helps identify issues with the shared pages system
 */
export async function debugSharedPagesAccess(
  currentUserId: string,
  friendId: string,
): Promise<{
  success: boolean;
  debug: any;
  error?: string;
}> {
  const supabase = createClient();

  try {
    console.log("🔍 DEBUG: Starting comprehensive shared pages debug", {
      currentUserId,
      friendId,
      timestamp: new Date().toISOString(),
    });

    const debug: any = {
      step1_users: null,
      step2_friendship: null,
      step3_auth: null,
      step4_pages_all: null,
      step5_pages_friends: null,
      step6_rls_test: null,
    };

    // Step 1: Verify both users exist
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, full_name")
      .in("id", [currentUserId, friendId]);

    debug.step1_users = {
      success: !usersError,
      error: usersError?.message,
      users: users?.map((u: { id: string; email: string }) => ({ id: u.id, email: u.email })),
      currentUserExists: users?.some((u: { id: string; email: string }) => u.id === currentUserId),
      friendExists: users?.some((u: { id: string; email: string }) => u.id === friendId),
    };

    // Step 2: Check friendship
    const { data: friendship, error: friendshipError } = await supabase
      .from("friends")
      .select("*")
      .or(
        `and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`,
      );

    debug.step2_friendship = {
      success: !friendshipError,
      error: friendshipError?.message,
      friendshipExists: friendship && friendship.length > 0,
      friendshipData: friendship,
    };

    // Step 3: Check auth context
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();
    debug.step3_auth = {
      success: !authError,
      error: authError?.message,
      authUserId: authUser?.id,
      expectedUserId: currentUserId,
      authMatch: authUser?.id === currentUserId,
    };

    // Step 4: Check all pages by friend
    const { data: allPages, error: allPagesError } = await supabase
      .from("pages")
      .select("id, title, user_id, visibility, created_at")
      .eq("user_id", friendId);

    debug.step4_pages_all = {
      success: !allPagesError,
      error: allPagesError?.message,
      totalPages: allPages?.length || 0,
      pagesByVisibility: {
        private:
          allPages?.filter((p: { visibility: string }) => p.visibility === "private").length || 0,
        friends:
          allPages?.filter((p: { visibility: string }) => p.visibility === "friends").length || 0,
      },
      friendsPages: allPages
        ?.filter((p) => p.visibility === "friends")
        .map((p) => ({
          id: p.id,
          title: p.title,
          visibility: p.visibility,
        })),
    };

    // Step 5: Try to fetch friends pages with RLS
    const { data: friendsPages, error: friendsPagesError } = await supabase
      .from("pages")
      .select(
        "id, title, content, content_json, created_at, updated_at, user_id, section_id, visibility",
      )
      .eq("user_id", friendId)
      .eq("visibility", "friends")
      .order("updated_at", { ascending: false });

    debug.step5_pages_friends = {
      success: !friendsPagesError,
      error: friendsPagesError?.message,
      errorCode: friendsPagesError?.code,
      pagesFound: friendsPages?.length || 0,
      pages: friendsPages?.map((p) => ({
        id: p.id,
        title: p.title,
        visibility: p.visibility,
      })),
    };

    // Step 6: Test RLS policy directly if debug function exists
    try {
      const { data: rlsTest, error: rlsError } = await supabase.rpc(
        "debug_friendship_access",
        {
          p_current_user_id: currentUserId,
          p_page_owner_id: friendId,
        },
      );

      debug.step6_rls_test = {
        success: !rlsError,
        error: rlsError?.message,
        result: rlsTest,
      };
    } catch (rlsErr) {
      debug.step6_rls_test = {
        success: false,
        error: "Debug function not available",
        exception: rlsErr instanceof Error ? rlsErr.message : "Unknown error",
      };
    }

    console.log("🔍 DEBUG: Complete debug results:", debug);

    return {
      success: true,
      debug,
    };
  } catch (error) {
    console.error("🔍 DEBUG: Error in debug function:", error);
    return {
      success: false,
      debug: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Remove a friend (unfriend)
 */
export async function unfriendUser(
  userId: string,
  friendId: string,
): Promise<UnfriendResult> {
  const supabase = createClient();

  try {
    // Validate input
    if (!userId || !friendId) {
      return {
        success: false,
        error: "User ID and friend ID are required",
      };
    }

    // Prevent unfriending self
    if (userId === friendId) {
      return {
        success: false,
        error: "You cannot unfriend yourself",
      };
    }

    console.log("💔 Unfriending user:", { userId, friendId });

    // Delete friendship record - handle both directions
    // The friendship could be stored as (user_id, friend_id) or (friend_id, user_id)
    const { error: deleteError } = await supabase
      .from("friends")
      .delete()
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`,
      );

    if (deleteError) {
      console.error("Error unfriending user:", deleteError);

      // Handle specific error cases
      if (deleteError.code === "PGRST116") {
        return {
          success: false,
          error: "Friendship not found or already removed",
        };
      }

      // Handle RLS policy violations
      if (
        deleteError.code === "42501" ||
        deleteError.message?.includes("policy")
      ) {
        return {
          success: false,
          error: "You are not authorized to remove this friendship.",
        };
      }

      return {
        success: false,
        error: "Failed to remove friend. Please try again.",
      };
    }

    // Also delete any associated friend requests between these users
    // This allows them to send new friend requests in the future
    console.log("💔 Cleaning up associated friend requests");
    const { error: requestDeleteError } = await supabase
      .from("friend_requests")
      .delete()
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`,
      );

    if (requestDeleteError) {
      console.warn(
        "Warning: Failed to delete associated friend requests:",
        requestDeleteError,
      );
      // Don't fail the entire operation since the main friendship removal was successful
      // This is just cleanup to allow future friend requests
    } else {
      console.log("💔 Successfully cleaned up friend requests");
    }

    console.log(
      "💔 Successfully unfriended user and cleaned up associated data",
    );
    return { success: true };
  } catch (error) {
    console.error("Unexpected error in unfriendUser:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}