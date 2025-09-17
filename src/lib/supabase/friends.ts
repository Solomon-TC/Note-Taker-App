"use client";

import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, isAdminClientAvailable, getAdminClient } from '@/lib/supabaseAdmin';
import { Database } from '@/types/supabase';

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
 * Send a friend request to a user by their email address
 */
export async function sendFriendRequest(senderId: string, receiverEmail: string) {
  try {
    console.log('🔍 Looking up user by email:', receiverEmail);
    
    // Check if admin client is available
    if (!isAdminClientAvailable()) {
      console.error('❌ Admin client not available for friend request functionality');
      return {
        success: false,
        error: 'Friend request functionality is currently unavailable. Please contact support.',
      };
    }

    const adminClient = getAdminClient();
    
    // First, look up the user by email in auth.users
    const { data: receiverUser, error: lookupError } = await adminClient.auth.admin.listUsers();
    
    const foundUser = receiverUser?.users?.find((user: any) => user.email === receiverEmail);
    
    console.log('📊 Friend request debug info:', {
      senderUserId: senderId,
      receiverEmail,
      foundUser: foundUser ? {
        id: foundUser.id,
        email: foundUser.email,
        fullName: foundUser.user_metadata?.full_name
      } : null,
      userId: foundUser?.id,
      userEmail: foundUser?.email,
      finalError: lookupError?.message,
    });

    // Check if user lookup failed for reasons other than "not found"
    if (lookupError && (lookupError as any).code !== "PGRST116") {
      console.error('❌ Database error during user lookup:', lookupError);
      return {
        success: false,
        error: `Database error: ${(lookupError as any).message}. Please try again.`,
      };
    }

    // If no user found, return appropriate error
    if (!foundUser) {
      console.log('❌ User not found with email:', receiverEmail);
      return {
        success: false,
        error: 'No user found with that email address. Please check the email and try again.',
      };
    }

    // Create receiver user object for further processing
    const receiverUserData = {
      id: foundUser.id,
      email: foundUser.email,
      fullName: foundUser.user_metadata?.full_name,
    };

    // Check if trying to send friend request to self
    if (receiverUserData.id === senderId) {
      return {
        success: false,
        error: "You cannot send a friend request to yourself.",
      };
    }

    console.log('✅ Found receiver user:', receiverUserData);

    // Check if they're already friends or have pending requests
    const { data: existingRelation, error: relationError } = await adminClient
      .from('friend_requests')
      .select('*')
      .or(
        `and(sender_id.eq.${senderId},receiver_id.eq.${receiverUserData.id}),and(sender_id.eq.${receiverUserData.id},receiver_id.eq.${senderId})`,
      )
      .maybeSingle();

    if (relationError) {
      console.error('❌ Error checking existing relations:', relationError);
      return {
        success: false,
        error: 'Failed to check existing friend requests. Please try again.',
      };
    }

    if (existingRelation) {
      if (existingRelation.status === 'accepted') {
        return {
          success: false,
          error: 'You are already friends with this user.',
        };
      } else if (existingRelation.status === 'pending') {
        if (existingRelation.sender_id === senderId) {
          return {
            success: false,
            error: 'You have already sent a friend request to this user.',
          };
        } else {
          return {
            success: false,
            error: 'This user has already sent you a friend request. Check your pending requests.',
          };
        }
      }
    }

    // Create the friend request
    console.log('📤 Creating friend request...');
    const { data: friendRequest, error: createError } = await adminClient
      .from('friend_requests')
      .insert({
        sender_id: senderId,
        receiver_id: receiverUserData.id,
        status: 'pending',
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating friend request:', createError);
      return {
        success: false,
        error: 'Failed to send friend request. Please try again.',
      };
    }

    console.log('✅ Friend request created successfully:', friendRequest);

    return {
      success: true,
      message: `Friend request sent to ${receiverEmail}!`,
      data: {
        friendRequest,
        receiverUser: receiverUserData,
      },
    };
  } catch (error) {
    console.error('❌ Unexpected error in sendFriendRequest:', error);
    
    // Check if this is the admin client error
    if (error instanceof Error && error.message.includes('admin client is not available')) {
      return {
        success: false,
        error: 'Friend request functionality is currently unavailable. Please ensure all required environment variables are configured.',
      };
    }
    
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Get pending friend requests for a user (requests they've received)
 */
export async function getPendingFriendRequests(
  userId: string,
): Promise<FriendRequestWithUser[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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

/**
 * Get pages shared by a friend (DIRECT DATABASE ACCESS VERSION)
 * This version bypasses RLS entirely and uses direct database functions
 */
export async function getFriendSharedPages(
  currentUserId: string,
  friendId: string,
): Promise<GetSharedPagesResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    // Validate input
    if (!currentUserId || !friendId) {
      console.error("📖 [DIRECT] Invalid input:", { currentUserId, friendId });
      return {
        success: false,
        error: "Current user ID and friend ID are required",
      };
    }

    console.log("📖 [DIRECT] Starting direct database access:", {
      currentUserId,
      friendId,
      timestamp: new Date().toISOString(),
    });

    // Step 1: Use the direct database function that bypasses RLS
    console.log("📖 [DIRECT] Calling direct database function...");
    const { data: pagesData, error: pagesError } = await supabase
      .rpc("get_friend_pages_direct", {
        requesting_user_id: currentUserId,
        friend_user_id: friendId,
      });

    if (pagesError) {
      console.error("📖 [DIRECT] Database function error:", pagesError);
      return {
        success: false,
        error: `Database error: ${pagesError.message}`,
      };
    }

    console.log("📖 [DIRECT] Database function succeeded:", {
      pagesFound: pagesData?.length || 0,
      pages: pagesData?.map((p: any) => ({
        id: p.id,
        title: p.title,
        visibility: p.visibility,
      })),
    });

    // Transform the data
    const transformedPages: SharedPage[] = (pagesData || []).map(
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
        author_name: page.author_name || null,
        author_email: page.author_email || "Unknown",
        section_name: null,
        notebook_name: null,
      }),
    );

    console.log("📖 [DIRECT] Final result:", {
      success: true,
      friendId,
      pagesCount: transformedPages.length,
      publicPages: transformedPages.filter(p => p.visibility === 'public').length,
      friendsPages: transformedPages.filter(p => p.visibility === 'friends').length,
    });

    return {
      success: true,
      data: transformedPages,
    };
  } catch (error) {
    console.error("📖 [DIRECT] Unexpected error:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      currentUserId,
      friendId,
    });
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Debug function to test shared pages access (DIRECT DATABASE VERSION)
 */
export async function debugSharedPagesAccess(
  currentUserId: string,
  friendId: string,
): Promise<{
  success: boolean;
  debug: any;
  error?: string;
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    console.log("🔍 [DIRECT] Starting direct database debug:", {
      currentUserId,
      friendId,
      timestamp: new Date().toISOString(),
    });

    const debug: any = {
      step1_comprehensive_debug: null,
      step2_test_pages_access: null,
      step3_direct_function_test: null,
    };

    // Step 1: Run comprehensive debug
    const { data: debugResult, error: debugError } = await supabase
      .rpc("debug_friend_pages_access", {
        requesting_user_id: currentUserId,
        friend_user_id: friendId,
      });

    debug.step1_comprehensive_debug = {
      success: !debugError,
      error: debugError?.message,
      result: debugResult,
    };

    // Step 2: Test pages access directly
    const { data: testResult, error: testError } = await supabase
      .rpc("test_pages_access", {
        friend_user_id: friendId,
      });

    debug.step2_test_pages_access = {
      success: !testError,
      error: testError?.message,
      result: testResult,
    };

    // Step 3: Test the direct function
    const { data: directResult, error: directError } = await supabase
      .rpc("get_friend_pages_direct", {
        requesting_user_id: currentUserId,
        friend_user_id: friendId,
      });

    debug.step3_direct_function_test = {
      success: !directError,
      error: directError?.message,
      pagesFound: directResult?.length || 0,
      pages: directResult?.map((p: any) => ({
        id: p.id,
        title: p.title,
        visibility: p.visibility,
      })),
    };

    console.log("🔍 [DIRECT] Debug complete:", debug);

    return {
      success: true,
      debug,
    };
  } catch (error) {
    console.error("🔍 [DIRECT] Debug error:", error);
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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