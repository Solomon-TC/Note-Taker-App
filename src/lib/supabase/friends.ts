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
        allUsers?.map((u) => ({
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
          (u) =>
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
        availableEmails: allUsers?.map((u) => u.email) || [],
      });

      // Provide more helpful error message
      const availableEmails =
        allUsers?.map((u) => u.email).join(", ") || "none";
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
          avatar_url
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
          avatar_url
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

    return data || [];
  } catch (error) {
    console.error("Unexpected error in getFriends:", error);
    return [];
  }
}
