"use client";

import React, { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Image,
  Mic,
  Save,
  FileText,
  Paperclip,
  Link,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  Check,
  X,
} from "lucide-react";

interface NoteEditorProps {
  noteId?: string;
  initialTitle?: string;
  initialContent?: string;
  classId?: string;
  className?: string;
  onSave?: (note: {
    id: string;
    title: string;
    content: string;
    classId?: string;
  }) => void;
}

const NoteEditor = ({
  noteId = "",
  initialTitle = "Untitled Note",
  initialContent = "",
  classId = "",
  className = "",
  onSave = () => {},
}: NoteEditorProps) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("write");

  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Mock tags for the note
  const [tags, setTags] = useState<string[]>(["Physics", "Lecture", "Week 3"]);

  const handleSave = () => {
    setIsSaving(true);

    // Simulate saving delay
    setTimeout(() => {
      onSave({
        id: noteId || `note-${Date.now()}`,
        title,
        content,
        classId,
      });

      setIsSaving(false);
    }, 800);
  };

  const handleFormatText = (format: string) => {
    if (!editorRef.current) return;

    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    let formattedText = "";
    let cursorOffset = 0;

    switch (format) {
      case "bold":
        formattedText = `**${selectedText}**`;
        cursorOffset = 2;
        break;
      case "italic":
        formattedText = `*${selectedText}*`;
        cursorOffset = 1;
        break;
      case "underline":
        formattedText = `_${selectedText}_`;
        cursorOffset = 1;
        break;
      case "list":
        formattedText = `\n- ${selectedText}`;
        cursorOffset = 3;
        break;
      case "ordered-list":
        formattedText = `\n1. ${selectedText}`;
        cursorOffset = 4;
        break;
      case "h1":
        formattedText = `\n# ${selectedText}`;
        cursorOffset = 3;
        break;
      case "h2":
        formattedText = `\n## ${selectedText}`;
        cursorOffset = 4;
        break;
      case "h3":
        formattedText = `\n### ${selectedText}`;
        cursorOffset = 5;
        break;
      default:
        return;
    }

    const newContent =
      content.substring(0, start) + formattedText + content.substring(end);
    setContent(newContent);

    // Set cursor position after formatting
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + cursorOffset,
        start + formattedText.length - cursorOffset,
      );
    }, 0);
  };

  const handleInsertImage = () => {
    // In a real implementation, this would open a file picker
    const imageUrl = prompt("Enter image URL:");
    if (imageUrl) {
      const imageMarkdown = `\n![Image](${imageUrl})\n`;
      setContent(content + imageMarkdown);
    }
  };

  const toggleRecording = () => {
    // In a real implementation, this would use the Web Audio API
    setIsRecording(!isRecording);
    if (isRecording) {
      // Simulate adding transcribed text
      setContent(
        content +
          "\n[Transcribed audio: This is a placeholder for voice recording transcription.]\n",
      );
    }
  };

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <Card className={`w-full bg-background ${className}`}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-bold border-none focus-visible:ring-0 px-0 h-auto text-2xl"
            placeholder="Note Title"
          />
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Saving
                </span>
              ) : (
                <span className="flex items-center">
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </span>
              )}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-6">
                + Add Tag
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Add a new tag</AlertDialogTitle>
                <AlertDialogDescription>
                  Enter a tag to help organize your notes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                id="new-tag"
                placeholder="Enter tag name"
                className="mt-2"
              />
              <AlertDialogFooter className="mt-4">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const input = document.getElementById(
                      "new-tag",
                    ) as HTMLInputElement;
                    if (input) addTag(input.value);
                  }}
                >
                  Add Tag
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs
          defaultValue="write"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="mb-4">
            <TabsTrigger value="write" className="flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Write
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="write" className="space-y-4">
            <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/20">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatText("bold")}
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Bold</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatText("italic")}
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Italic</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatText("underline")}
                    >
                      <Underline className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Underline</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Separator orientation="vertical" className="h-6" />

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatText("h1")}
                    >
                      <Heading1 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Heading 1</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatText("h2")}
                    >
                      <Heading2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Heading 2</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatText("h3")}
                    >
                      <Heading3 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Heading 3</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Separator orientation="vertical" className="h-6" />

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatText("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Bullet List</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatText("ordered-list")}
                    >
                      <ListOrdered className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Numbered List</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Separator orientation="vertical" className="h-6" />

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleInsertImage}
                    >
                      <Image className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Insert Image</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => {}}>
                      <Link className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Insert Link</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => {}}>
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Attach File</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Separator orientation="vertical" className="h-6" />

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isRecording ? "destructive" : "ghost"}
                      size="sm"
                      onClick={toggleRecording}
                      className={isRecording ? "animate-pulse" : ""}
                    >
                      <Mic className="h-4 w-4" />
                      {isRecording && (
                        <span className="ml-1">Recording...</span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {isRecording ? "Stop Recording" : "Start Voice Recording"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <Textarea
              ref={editorRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start typing your notes here..."
              className="min-h-[400px] font-mono text-sm"
            />
          </TabsContent>

          <TabsContent
            value="preview"
            className="min-h-[400px] border rounded-md p-4 prose dark:prose-invert max-w-none"
          >
            {content ? (
              <div
                dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
              />
            ) : (
              <div className="text-muted-foreground italic">
                No content to preview
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="flex justify-between">
        <div className="text-sm text-muted-foreground">
          {content.length} characters • Last edited:{" "}
          {new Date().toLocaleString()}
        </div>
        <Button variant="default" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Note"}
        </Button>
      </CardFooter>
    </Card>
  );
};

// Simple markdown formatter for preview
const formatMarkdown = (text: string) => {
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/_(.*?)_/g, "<u>$1</u>")
    .replace(/# (.*?)\n/g, "<h1>$1</h1>")
    .replace(/## (.*?)\n/g, "<h2>$1</h2>")
    .replace(/### (.*?)\n/g, "<h3>$1</h3>")
    .replace(/\n- (.*?)\n/g, "<ul><li>$1</li></ul>")
    .replace(/\n\d+\. (.*?)\n/g, "<ol><li>$1</li></ol>")
    .replace(
      /!\[(.*?)\]\((.*?)\)/g,
      '<img alt="$1" src="$2" style="max-width: 100%;" />',
    );

  // Replace newlines with <br>
  formatted = formatted.replace(/\n/g, "<br>");

  return formatted;
};

// Missing Eye component for the preview tab
function Eye(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default NoteEditor;
