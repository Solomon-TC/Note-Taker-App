"use client";

import { useAuth } from "./AuthProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User, Sun, Moon, Laptop, CreditCard } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function UserMenu() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!user) return null;

  const initials =
    user.email
      ?.split("@")[0]
      .split(".")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user.user_metadata?.avatar_url}
              alt={user.email || ""}
            />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.user_metadata?.full_name || "User"}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Theme Toggle */}
        {mounted && (
          <>
            <DropdownMenuItem
              onClick={() => {
                if (theme === "light") {
                  setTheme("dark");
                } else if (theme === "dark") {
                  setTheme("system");
                } else {
                  setTheme("light");
                }
              }}
            >
              {theme === "light" ? (
                <Sun className="mr-2 h-4 w-4" />
              ) : theme === "dark" ? (
                <Moon className="mr-2 h-4 w-4" />
              ) : (
                <Laptop className="mr-2 h-4 w-4" />
              )}
              <span>
                {theme === "light"
                  ? "Light mode"
                  : theme === "dark"
                    ? "Dark mode"
                    : "System theme"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Manage Subscription */}
        <DropdownMenuItem onClick={() => window.open('/paywall', '_blank')}>
          <CreditCard className="mr-2 h-4 w-4" />
          <span>Manage Subscription</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}