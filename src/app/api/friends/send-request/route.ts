import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, isAdminClientAvailable } from '@/lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { senderId, receiverEmail } = await request.json();

    if (!senderId || !receiverEmail) {
      return NextResponse.json(
        { success: false, error: 'Sender ID and receiver email are required' },
        { status: 400 }
      );
    }

    console.log('🔍 API: Looking up user by email:', receiverEmail);
    
    // Check if admin client is available
    if (!isAdminClientAvailable()) {
      console.error('❌ API: Admin client not available');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Friend request functionality is currently unavailable. Please contact support.' 
        },
        { status: 503 }
      );
    }

    const adminClient = getAdminClient();
    
    // Look up the user by email in auth.users
    const { data: receiverUser, error: lookupError } = await adminClient.auth.admin.listUsers();
    
    const foundUser = receiverUser?.users?.find((user: any) => user.email === receiverEmail);
    
    console.log('📊 API: Friend request debug info:', {
      senderUserId: senderId,
      receiverEmail,
      foundUser: foundUser ? {
        id: foundUser.id,
        email: foundUser.email,
      } : null,
    });

    if (lookupError && (lookupError as any).code !== "PGRST116") {
      console.error('❌ API: Database error during user lookup:', lookupError);
      return NextResponse.json(
        { success: false, error: `Database error: ${(lookupError as any).message}` },
        { status: 500 }
      );
    }

    if (!foundUser) {
      console.log('❌ API: User not found with email:', receiverEmail);
      return NextResponse.json(
        { success: false, error: 'No user found with that email address.' },
        { status: 404 }
      );
    }

    const receiverUserData = {
      id: foundUser.id,
      email: foundUser.email,
      fullName: foundUser.user_metadata?.full_name,
    };

    // Check if trying to send friend request to self
    if (receiverUserData.id === senderId) {
      return NextResponse.json(
        { success: false, error: 'You cannot send a friend request to yourself.' },
        { status: 400 }
      );
    }

    console.log('✅ API: Found receiver user:', receiverUserData);

    // Check if they're already friends or have pending requests
    const { data: existingRelation, error: relationError } = await adminClient
      .from('friend_requests')
      .select('*')
      .or(
        `and(sender_id.eq.${senderId},receiver_id.eq.${receiverUserData.id}),and(sender_id.eq.${receiverUserData.id},receiver_id.eq.${senderId})`,
      )
      .maybeSingle();

    if (relationError) {
      console.error('❌ API: Error checking existing relations:', relationError);
      return NextResponse.json(
        { success: false, error: 'Failed to check existing friend requests.' },
        { status: 500 }
      );
    }

    if (existingRelation) {
      if (existingRelation.status === 'accepted') {
        return NextResponse.json(
          { success: false, error: 'You are already friends with this user.' },
          { status: 400 }
        );
      } else if (existingRelation.status === 'pending') {
        if (existingRelation.sender_id === senderId) {
          return NextResponse.json(
            { success: false, error: 'You have already sent a friend request to this user.' },
            { status: 400 }
          );
        } else {
          // AUTO-ACCEPT: The other user has already sent a request to this user
          // Instead of returning an error, accept the existing request and create friendship
          console.log('🤝 API: Auto-accepting existing friend request:', existingRelation.id);
          
          // Check if friendship already exists
          const { data: existingFriendship, error: friendshipCheckError } = await adminClient
            .from('friends')
            .select('*')
            .or(
              `and(user_id.eq.${senderId},friend_id.eq.${receiverUserData.id}),and(user_id.eq.${receiverUserData.id},friend_id.eq.${senderId})`
            )
            .maybeSingle();

          if (friendshipCheckError && friendshipCheckError.code !== 'PGRST116') {
            console.error('❌ API: Error checking existing friendship:', friendshipCheckError);
            return NextResponse.json(
              { success: false, error: 'Failed to check existing friendship.' },
              { status: 500 }
            );
          }

          if (existingFriendship) {
            console.log('🤝 API: Friendship already exists, just updating request status');
            // Just update the request status
            const { error: updateError } = await adminClient
              .from('friend_requests')
              .update({ status: 'accepted' })
              .eq('id', existingRelation.id);

            if (updateError) {
              console.error('�� API: Error updating request status:', updateError);
              return NextResponse.json(
                { success: false, error: 'Failed to update friend request.' },
                { status: 500 }
              );
            }

            return NextResponse.json({
              success: true,
              autoAccepted: true,
              message: `You are now friends with ${receiverEmail}!`,
              data: {
                friendRequest: existingRelation,
                receiverUser: receiverUserData,
              },
            });
          }

          // Update the existing request to 'accepted'
          const { error: updateError } = await adminClient
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', existingRelation.id);

          if (updateError) {
            console.error('❌ API: Error updating friend request:', updateError);
            return NextResponse.json(
              { success: false, error: 'Failed to accept friend request.' },
              { status: 500 }
            );
          }

          // Create the friendship record
          const { error: friendshipError } = await adminClient
            .from('friends')
            .insert({
              user_id: senderId,
              friend_id: receiverUserData.id,
            });

          if (friendshipError) {
            console.error('❌ API: Error creating friendship:', friendshipError);
            
            // Try to revert the request status
            await adminClient
              .from('friend_requests')
              .update({ status: 'pending' })
              .eq('id', existingRelation.id);

            if (friendshipError.code === '23505') {
              // Duplicate key - friendship already exists
              return NextResponse.json({
                success: true,
                autoAccepted: true,
                message: `You are now friends with ${receiverEmail}!`,
                data: {
                  friendRequest: existingRelation,
                  receiverUser: receiverUserData,
                },
              });
            }

            return NextResponse.json(
              { success: false, error: 'Failed to create friendship.' },
              { status: 500 }
            );
          }

          console.log('✅ API: Auto-accepted friend request and created friendship');
          return NextResponse.json({
            success: true,
            autoAccepted: true,
            message: `You are now friends with ${receiverEmail}!`,
            data: {
              friendRequest: existingRelation,
              receiverUser: receiverUserData,
            },
          });
        }
      }
    }

    // Create the friend request
    console.log('📤 API: Creating friend request...');
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
      console.error('❌ API: Error creating friend request:', createError);
      return NextResponse.json(
        { success: false, error: 'Failed to send friend request.' },
        { status: 500 }
      );
    }

    console.log('✅ API: Friend request created successfully:', friendRequest);

    return NextResponse.json({
      success: true,
      message: `Friend request sent to ${receiverEmail}!`,
      data: {
        friendRequest,
        receiverUser: receiverUserData,
      },
    });
  } catch (error) {
    console.error('❌ API: Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}