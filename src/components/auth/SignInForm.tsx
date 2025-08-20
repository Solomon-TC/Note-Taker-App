"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, Mail } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Create a fresh client for each auth attempt
      const authClient = createClient();

      console.log("Attempting authentication:", {
        isSignUp,
        email,
        origin: window.location.origin,
      });

      if (isSignUp) {
        const { data, error } = await authClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });

        console.log("Sign up result:", { data: !!data, error });

        if (error) throw error;
        setMessage("Check your email for the confirmation link!");
      } else {
        const { data, error } = await authClient.auth.signInWithPassword({
          email,
          password,
        });

        console.log("Sign in result:", {
          hasSession: !!data.session,
          hasUser: !!data.user,
          error,
        });

        if (error) throw error;

        // Check if sign in was successful
        if (data.session) {
          console.log("Sign in successful, redirecting to dashboard");
          // Force a full page reload to ensure proper session handling
          window.location.href = "/dashboard";
          return;
        }
      }
    } catch (error: any) {
      console.error("Authentication error:", error);
      setMessage(error.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setMessage("");

    try {
      const authClient = createClient();

      console.log("Attempting Google OAuth:", {
        origin: window.location.origin,
      });

      const { data, error } = await authClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        console.error("Google OAuth error:", error);
        throw error;
      }

      console.log("Google OAuth initiated successfully");
      // The redirect will happen automatically, so we don't need to do anything else
    } catch (error: any) {
      console.error("Google authentication error:", error);
      setMessage(
        error.message || "Google authentication failed. Please try again.",
      );
      setGoogleLoading(false);
    }
    // Note: We don't set googleLoading to false here because the page will redirect
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Mail className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </CardTitle>
          <CardDescription>
            {isSignUp
              ? "Create your account to start taking notes"
              : "Sign in to your account to continue"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Google OAuth Button */}
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleAuth}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FcGoogle className="mr-2 h-4 w-4" />
              )}
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || googleLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>
            {message && (
              <Alert
                className={
                  message.includes("Check your email")
                    ? "border-green-500"
                    : "border-red-500"
                }
              >
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || googleLoading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage("");
              }}
              disabled={loading}
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
