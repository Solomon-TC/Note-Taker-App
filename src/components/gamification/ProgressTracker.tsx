"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Flame, Trophy, Star, Award, BookOpen, Calendar } from "lucide-react";

interface ProgressTrackerProps {
  level?: number;
  currentXP?: number;
  maxXP?: number;
  streakDays?: number;
  achievements?: {
    id: string;
    name: string;
    icon: string;
    description: string;
    unlocked: boolean;
  }[];
}

const ProgressTracker = ({
  level = 5,
  currentXP = 350,
  maxXP = 500,
  streakDays = 7,
  achievements = [
    {
      id: "1",
      name: "Note Master",
      icon: "BookOpen",
      description: "Created 50 notes",
      unlocked: true,
    },
    {
      id: "2",
      name: "Study Streak",
      icon: "Flame",
      description: "Maintained a 7-day study streak",
      unlocked: true,
    },
    {
      id: "3",
      name: "Quiz Champion",
      icon: "Trophy",
      description: "Completed 20 practice quizzes",
      unlocked: false,
    },
    {
      id: "4",
      name: "Perfect Score",
      icon: "Star",
      description: "Achieved 100% on a practice quiz",
      unlocked: true,
    },
    {
      id: "5",
      name: "Dedicated Scholar",
      icon: "Award",
      description: "Studied for 30 days total",
      unlocked: false,
    },
    {
      id: "6",
      name: "Consistent Learner",
      icon: "Calendar",
      description: "Added notes for 5 consecutive days",
      unlocked: true,
    },
  ],
}: ProgressTrackerProps) => {
  const xpPercentage = Math.round((currentXP / maxXP) * 100);

  // Function to render the appropriate icon based on the icon name
  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case "BookOpen":
        return <BookOpen className="h-4 w-4" />;
      case "Flame":
        return <Flame className="h-4 w-4" />;
      case "Trophy":
        return <Trophy className="h-4 w-4" />;
      case "Star":
        return <Star className="h-4 w-4" />;
      case "Award":
        return <Award className="h-4 w-4" />;
      case "Calendar":
        return <Calendar className="h-4 w-4" />;
      default:
        return <Star className="h-4 w-4" />;
    }
  };

  return (
    <Card className="w-full bg-background border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex justify-between items-center">
          <span>Your Progress</span>
          <Badge variant="secondary" className="text-sm">
            Level {level}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* XP Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">XP Progress</span>
              <span className="font-medium">
                {currentXP}/{maxXP} XP
              </span>
            </div>
            <Progress value={xpPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {maxXP - currentXP} XP needed for Level {level + 1}
            </p>
          </div>

          {/* Study Streak */}
          <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-md">
            <div className="bg-orange-500/20 p-1.5 rounded-full">
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Study Streak</p>
              <p className="text-xs text-muted-foreground">
                {streakDays} day{streakDays !== 1 ? "s" : ""} in a row
              </p>
            </div>
          </div>

          {/* Achievements */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Achievements</h4>
            <div className="flex flex-wrap gap-2">
              <TooltipProvider>
                {achievements.map((achievement) => (
                  <Tooltip key={achievement.id}>
                    <TooltipTrigger asChild>
                      <div
                        className={`p-2 rounded-full cursor-pointer transition-all ${
                          achievement.unlocked
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground opacity-50"
                        }`}
                      >
                        {renderIcon(achievement.icon)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="text-xs">
                        <p className="font-medium">{achievement.name}</p>
                        <p>{achievement.description}</p>
                        {!achievement.unlocked && (
                          <p className="italic mt-1">Not yet unlocked</p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressTracker;
