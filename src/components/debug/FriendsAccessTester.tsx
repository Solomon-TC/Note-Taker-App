"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/components/auth/AuthProvider";
import { createClient } from "@/lib/supabase-client";
import { getFriendSharedPages } from "@/lib/supabase/friends";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  RefreshCw,
} from "lucide-react";

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

export default function FriendsAccessTester() {
  const { user } = useAuth();
  const [friendId, setFriendId] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [finalResult, setFinalResult] = useState<any>(null);

  const runComprehensiveTest = async () => {
    if (!user || !friendId.trim()) {
      alert("Please enter a friend ID");
      return;
    }

    setIsRunning(true);
    setTestResults([]);
    setFinalResult(null);

    const results: TestResult[] = [];
    const supabase = createClient();

    try {
      // Test 1: Authentication Context
      results.push({
        step: "Authentication Context",
        success: true,
        message: `Authenticated as ${user.email} (${user.id})`,
        data: { userId: user.id, email: user.email },
      });

      // Test 2: Check if both users exist
      try {
        const { data: users, error } = await supabase
          .from("users")
          .select("id, email, full_name")
          .in("id", [user.id, friendId.trim()]);

        if (error) throw error;

        const currentUserExists = users?.some((u) => u.id === user.id);
        const friendExists = users?.some((u) => u.id === friendId.trim());

        results.push({
          step: "User Existence Check",
          success: currentUserExists && friendExists,
          message: `Current user exists: ${currentUserExists}, Friend exists: ${friendExists}`,
          data: { users, currentUserExists, friendExists },
        });
      } catch (error) {
        results.push({
          step: "User Existence Check",
          success: false,
          message: `Error checking users: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }

      // Test 3: Comprehensive Debug Function
      try {
        const { data: debugData, error } = await supabase.rpc(
          "get_friendship_and_pages_debug",
          {
            p_current_user_id: user.id,
            p_friend_id: friendId.trim(),
          },
        );

        if (error) throw error;

        results.push({
          step: "Comprehensive Debug Function",
          success: true,
          message: `Friendship exists: ${debugData?.friendship_exists}, Friend has ${debugData?.friend_pages_friends} friends pages`,
          data: debugData,
        });
      } catch (error) {
        results.push({
          step: "Comprehensive Debug Function",
          success: false,
          message: `Debug function error: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }

      // Test 4: Manual Friendship Check
      try {
        const { data: friendship, error } = await supabase
          .from("friends")
          .select("*")
          .or(
            `and(user_id.eq.${user.id},friend_id.eq.${friendId.trim()}),and(user_id.eq.${friendId.trim()},friend_id.eq.${user.id})`,
          )
          .maybeSingle();

        if (error && error.code !== "PGRST116") throw error;

        results.push({
          step: "Manual Friendship Check",
          success: !!friendship,
          message: friendship
            ? `Friendship found: ${friendship.user_id} ↔ ${friendship.friend_id}`
            : "No friendship found",
          data: friendship,
        });
      } catch (error) {
        results.push({
          step: "Manual Friendship Check",
          success: false,
          message: `Friendship check error: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }

      // Test 5: Direct RLS Query Test
      try {
        const { data: pages, error } = await supabase
          .from("pages")
          .select("id, title, visibility, user_id")
          .eq("user_id", friendId.trim())
          .eq("visibility", "friends");

        if (error) throw error;

        results.push({
          step: "Direct RLS Query Test",
          success: true,
          message: `Found ${pages?.length || 0} friends pages via RLS query`,
          data: { pagesCount: pages?.length || 0, pages },
        });
      } catch (error) {
        results.push({
          step: "Direct RLS Query Test",
          success: false,
          message: `RLS query error: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }

      // Test 6: Individual Page Access Test
      try {
        // First get friend's pages
        const { data: friendPages, error: pagesError } = await supabase
          .from("pages")
          .select("id, title, visibility")
          .eq("user_id", friendId.trim())
          .eq("visibility", "friends")
          .limit(3);

        if (pagesError) throw pagesError;

        const accessTests = [];
        if (friendPages && friendPages.length > 0) {
          for (const page of friendPages) {
            try {
              const { data: accessTest, error: accessError } =
                await supabase.rpc("test_page_access", {
                  p_page_id: page.id,
                  p_user_id: user.id,
                });

              accessTests.push({
                pageId: page.id,
                pageTitle: page.title,
                canAccess: accessTest?.can_access,
                accessReason: accessTest?.access_reason,
                error: accessError?.message,
              });
            } catch (err) {
              accessTests.push({
                pageId: page.id,
                pageTitle: page.title,
                canAccess: false,
                accessReason: "Test function error",
                error: err instanceof Error ? err.message : "Unknown error",
              });
            }
          }
        }

        const successfulAccess = accessTests.filter((t) => t.canAccess).length;
        results.push({
          step: "Individual Page Access Test",
          success: successfulAccess > 0,
          message: `${successfulAccess}/${accessTests.length} pages accessible`,
          data: { accessTests, totalPages: friendPages?.length || 0 },
        });
      } catch (error) {
        results.push({
          step: "Individual Page Access Test",
          success: false,
          message: `Page access test error: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }

      // Test 7: Final Integration Test
      try {
        const sharedPagesResult = await getFriendSharedPages(
          user.id,
          friendId.trim(),
        );

        results.push({
          step: "Final Integration Test",
          success: sharedPagesResult.success,
          message: sharedPagesResult.success
            ? `Successfully retrieved ${sharedPagesResult.data?.length || 0} shared pages`
            : `Integration test failed: ${sharedPagesResult.error}`,
          data: sharedPagesResult,
        });

        setFinalResult(sharedPagesResult);
      } catch (error) {
        results.push({
          step: "Final Integration Test",
          success: false,
          message: `Integration test error: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }

      setTestResults(results);

      // Log comprehensive summary
      console.log("🧪 Comprehensive Test Results:", {
        totalTests: results.length,
        successfulTests: results.filter((r) => r.success).length,
        failedTests: results.filter((r) => !r.success).length,
        results,
        finalResult,
      });
    } catch (error) {
      console.error("🧪 Test suite error:", error);
      results.push({
        step: "Test Suite Error",
        success: false,
        message: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      setTestResults(results);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 bg-white">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Friends Access Comprehensive Tester
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

          <Button
            onClick={runComprehensiveTest}
            disabled={isRunning || !user || !friendId.trim()}
            className="w-full flex items-center gap-2"
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isRunning ? "Running Tests..." : "Run Comprehensive Test"}
          </Button>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <Alert
                  key={index}
                  className={
                    result.success ? "border-green-500" : "border-red-500"
                  }
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.success)}
                    <div className="flex-1">
                      <AlertDescription>
                        <div className="font-semibold">{result.step}</div>
                        <div className="text-sm mt-1">{result.message}</div>
                        {result.data && (
                          <details className="mt-2">
                            <summary className="text-xs cursor-pointer text-blue-600">
                              View Details
                            </summary>
                            <pre className="text-xs mt-1 p-2 bg-gray-100 rounded overflow-auto max-h-32">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>

            {finalResult && (
              <div className="mt-6 p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Final Result Summary:</h4>
                <div className="text-sm space-y-1">
                  <div>Success: {finalResult.success ? "✅" : "❌"}</div>
                  <div>Pages Found: {finalResult.data?.length || 0}</div>
                  {finalResult.error && <div>Error: {finalResult.error}</div>}
                </div>
              </div>
            )}
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
              <strong>1.</strong> Make sure you're logged in and have
              established a friendship.
            </p>
            <p>
              <strong>2.</strong> Enter your friend's user ID in the field
              above.
            </p>
            <p>
              <strong>3.</strong> Click "Run Comprehensive Test" to analyze the
              entire system.
            </p>
            <p>
              <strong>4.</strong> The test will check:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Authentication context</li>
              <li>User existence verification</li>
              <li>Comprehensive debug function results</li>
              <li>Manual friendship verification</li>
              <li>Direct RLS query testing</li>
              <li>Individual page access testing</li>
              <li>Final integration test</li>
            </ul>
            <p>
              <strong>5.</strong> Check the browser console for additional
              detailed logs.
            </p>
            <p>
              <strong>6.</strong> If any test fails, the details will help
              identify the specific issue.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
