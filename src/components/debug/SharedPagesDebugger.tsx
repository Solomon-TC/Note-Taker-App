"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  debugSharedPagesAccess,
  getFriendSharedPages,
} from "@/lib/supabase/friends";
import { Bug, Play, RefreshCw } from "lucide-react";

export default function SharedPagesDebugger() {
  const { user } = useAuth();
  const [friendId, setFriendId] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [debugResult, setDebugResult] = useState<any>(null);
  const [sharedPagesResult, setSharedPagesResult] = useState<any>(null);

  const runDebugTest = async () => {
    if (!user || !friendId.trim()) {
      alert("Please enter a friend ID");
      return;
    }

    setIsRunning(true);
    setDebugResult(null);
    setSharedPagesResult(null);

    try {
      console.log("🔍 Starting comprehensive debug test...");

      // Run the new comprehensive debug function
      const { createClient } = await import("@/lib/supabase-client");
      const supabase = createClient();

      // Test 1: Comprehensive friendship and pages debug
      console.log("🔍 Test 1: Running comprehensive debug...");
      const { data: comprehensiveDebug, error: comprehensiveError } =
        await supabase.rpc("get_friendship_and_pages_debug", {
          p_current_user_id: user.id,
          p_friend_id: friendId.trim(),
        });

      // Test 2: Basic friendship access debug
      console.log("🔍 Test 2: Running friendship access debug...");
      const { data: friendshipDebug, error: friendshipError } =
        await supabase.rpc("debug_friendship_access", {
          p_current_user_id: user.id,
          p_page_owner_id: friendId.trim(),
        });

      // Test 3: Get friend's pages and test individual access
      console.log("🔍 Test 3: Testing individual page access...");
      const { data: friendPages, error: friendPagesError } = await supabase
        .from("pages")
        .select("id, title, user_id, visibility")
        .eq("user_id", friendId.trim())
        .eq("visibility", "friends")
        .limit(5);

      let pageAccessTests: any[] = [];
      if (friendPages && friendPages.length > 0) {
        for (const page of friendPages) {
          try {
            const { data: accessTest, error: accessError } = await supabase.rpc(
              "test_page_access",
              {
                p_page_id: page.id,
                p_user_id: user.id,
              },
            );
            pageAccessTests.push({
              pageId: page.id,
              pageTitle: page.title,
              accessTest,
              accessError: accessError?.message,
            });
          } catch (err) {
            pageAccessTests.push({
              pageId: page.id,
              pageTitle: page.title,
              accessTest: null,
              accessError: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }
      }

      // Compile debug results
      const debugResults = {
        success: true,
        debug: {
          comprehensiveDebug: {
            success: !comprehensiveError,
            error: comprehensiveError?.message,
            data: comprehensiveDebug,
          },
          friendshipDebug: {
            success: !friendshipError,
            error: friendshipError?.message,
            data: friendshipDebug,
          },
          friendPages: {
            success: !friendPagesError,
            error: friendPagesError?.message,
            count: friendPages?.length || 0,
            pages: friendPages?.map((p) => ({
              id: p.id,
              title: p.title,
              visibility: p.visibility,
            })),
          },
          pageAccessTests,
        },
      };

      setDebugResult(debugResults);

      // Run actual shared pages function
      console.log("🔍 Test 4: Running actual shared pages function...");
      const sharedPages = await getFriendSharedPages(user.id, friendId.trim());
      setSharedPagesResult(sharedPages);

      console.log("🔍 Debug test complete:", { debugResults, sharedPages });

      // Enhanced summary logging
      // Safely access comprehensiveDebug properties with type checking
      const comprehensiveDebugObj =
        comprehensiveDebug &&
        typeof comprehensiveDebug === "object" &&
        !Array.isArray(comprehensiveDebug)
          ? (comprehensiveDebug as Record<string, any>)
          : {};

      // Safely access friendshipDebug properties with type checking
      const friendshipDebugObj =
        friendshipDebug &&
        typeof friendshipDebug === "object" &&
        !Array.isArray(friendshipDebug)
          ? (friendshipDebug as Record<string, any>)
          : {};

      console.log("🔍 Enhanced Summary:", {
        comprehensiveFriendshipExists:
          comprehensiveDebugObj.friendship_exists ?? "unknown",
        basicFriendshipExists:
          friendshipDebugObj.friendship_exists ?? "unknown",
        friendshipDirection:
          friendshipDebugObj.friendship_direction ?? "unknown",
        totalFriendPages: comprehensiveDebugObj.friend_pages_total ?? 0,
        friendsVisibilityPages: comprehensiveDebugObj.friend_pages_friends ?? 0,
        accessiblePagesFromDebug:
          comprehensiveDebugObj.accessible_pages?.length || 0,
        pageAccessTestsCount: pageAccessTests.length,
        pageAccessTestsSuccessful: pageAccessTests.filter((t) => {
          const accessTestObj =
            t.accessTest &&
            typeof t.accessTest === "object" &&
            !Array.isArray(t.accessTest)
              ? (t.accessTest as Record<string, any>)
              : {};
          return accessTestObj.can_access ?? false;
        }).length,
        finalSharedPagesCount: sharedPages?.data?.length || 0,
        finalSuccess: sharedPages?.success,
        finalError: sharedPages?.error,
      });
    } catch (error) {
      console.error("🔍 Debug test error:", error);
      setDebugResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setDebugResult(null);
    setSharedPagesResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 bg-white">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Shared Pages Debugger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="current-user">Current User ID</Label>
              <Input
                id="current-user"
                value={user?.id || "Not logged in"}
                disabled
                className="bg-gray-100"
              />
            </div>
            <div>
              <Label htmlFor="friend-id">Friend User ID</Label>
              <Input
                id="friend-id"
                value={friendId}
                onChange={(e) => setFriendId(e.target.value)}
                placeholder="Enter friend's user ID"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={runDebugTest}
              disabled={isRunning || !user || !friendId.trim()}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isRunning ? "Running..." : "Run Debug Test"}
            </Button>

            <Button
              variant="outline"
              onClick={clearResults}
              disabled={!debugResult && !sharedPagesResult}
            >
              Clear Results
            </Button>
          </div>
        </CardContent>
      </Card>

      {debugResult && (
        <Card>
          <CardHeader>
            <CardTitle>Debug Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert
              className={
                debugResult.success ? "border-green-500" : "border-red-500"
              }
            >
              <AlertDescription>
                <strong>Status:</strong>{" "}
                {debugResult.success ? "Success" : "Failed"}
                {debugResult.error && (
                  <>
                    <br />
                    <strong>Error:</strong> {debugResult.error}
                  </>
                )}
              </AlertDescription>
            </Alert>

            {debugResult.debug && (
              <div className="mt-4">
                <Label>Detailed Debug Information:</Label>
                <Textarea
                  value={JSON.stringify(debugResult.debug, null, 2)}
                  readOnly
                  className="mt-2 h-64 font-mono text-xs"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {sharedPagesResult && (
        <Card>
          <CardHeader>
            <CardTitle>Shared Pages Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert
              className={
                sharedPagesResult.success
                  ? "border-green-500"
                  : "border-red-500"
              }
            >
              <AlertDescription>
                <strong>Status:</strong>{" "}
                {sharedPagesResult.success ? "Success" : "Failed"}
                {sharedPagesResult.error && (
                  <>
                    <br />
                    <strong>Error:</strong> {sharedPagesResult.error}
                  </>
                )}
                {sharedPagesResult.success && (
                  <>
                    <br />
                    <strong>Pages Found:</strong>{" "}
                    {sharedPagesResult.data?.length || 0}
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="mt-4">
              <Label>Full Response:</Label>
              <Textarea
                value={JSON.stringify(sharedPagesResult, null, 2)}
                readOnly
                className="mt-2 h-32 font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              <strong>1.</strong> Make sure you're logged in and have a friend
              relationship established.
            </p>
            <p>
              <strong>2.</strong> Enter your friend's user ID in the field
              above.
            </p>
            <p>
              <strong>3.</strong> Click "Run Debug Test" to analyze the shared
              pages system.
            </p>
            <p>
              <strong>4.</strong> Check the results to identify any issues with:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>User existence verification</li>
              <li>Friendship relationship verification</li>
              <li>Authentication context</li>
              <li>Page visibility and access</li>
              <li>RLS policy functionality</li>
            </ul>
            <p>
              <strong>5.</strong> Check the browser console for additional
              detailed logs.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
