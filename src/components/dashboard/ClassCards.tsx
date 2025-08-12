"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { PlusCircle, BookOpen, BarChart } from "lucide-react";

interface ClassCardProps {
  id: string;
  name: string;
  description: string;
  progress: number;
  noteCount: number;
  onSelect: (id: string) => void;
}

const ClassCard = ({
  id,
  name,
  description,
  progress,
  noteCount,
  onSelect = () => {},
}: ClassCardProps) => {
  return (
    <Card className="bg-card hover:shadow-md transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>{name}</span>
          <BarChart className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <span>{noteCount} notes</span>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onSelect(id)}
        >
          View Notes
        </Button>
      </CardFooter>
    </Card>
  );
};

interface ClassCardsProps {
  classes?: ClassCardProps[];
  onSelectClass?: (id: string) => void;
  onAddClass?: (newClass: {
    name: string;
    description: string;
    progress: number;
    noteCount: number;
  }) => void;
}

const ClassCards = ({
  classes = [],
  onSelectClass = () => {},
  onAddClass = () => {},
}: ClassCardsProps) => {
  const handleAddClass = () => {
    const className = prompt("Enter class name:");
    const classDescription = prompt("Enter class description:");

    if (className && classDescription) {
      const newClass = {
        name: className,
        description: classDescription,
        progress: 0,
        noteCount: 0,
      };
      onAddClass(newClass);
    }
  };
  return (
    <div className="bg-background w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">My Classes</h2>
        <Button onClick={handleAddClass} variant="outline" size="sm">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Class
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {classes.length > 0 ? (
          classes.map((classItem) => (
            <ClassCard
              key={classItem.id}
              id={classItem.id}
              name={classItem.name}
              description={classItem.description}
              progress={classItem.progress}
              noteCount={classItem.noteCount}
              onSelect={onSelectClass}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No classes yet</h3>
            <p className="mb-4">
              Add your first class to start organizing your notes!
            </p>
            <Button onClick={handleAddClass}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Your First Class
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassCards;
