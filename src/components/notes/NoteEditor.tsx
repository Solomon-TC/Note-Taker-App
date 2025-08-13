"use client";

import React, { useState, useRef, useCallback } from "react";
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
  pageId?: string;
  initialTitle?: string;
  initialContent?: string;
  sectionId?: string;
  parentPageId?: string;
  className?: string;
  onSave?: (page: {
    id: string;
    title: string;
    content: string;
    sectionId?: string;
    parentPageId?: string;
  }) => void;
  onTitleChange?: (title: string) => void;
}

const NoteEditor = ({
  pageId = "",
  initialTitle = "Untitled Page",
  initialContent = "",
  sectionId = "",
  parentPageId,
  className = "",
  onSave = () => {},
  onTitleChange = () => {},
}: NoteEditorProps) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("write");
  const [isDragOver, setIsDragOver] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock tags for the page
  const [tags, setTags] = useState<string[]>(["Physics", "Lecture", "Week 3"]);

  // Sync with props when page changes
  React.useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
  }, [initialTitle, initialContent, pageId]);

  // Auto-title functionality
  React.useEffect(() => {
    if (content && (!title || title === "Untitled Page")) {
      const firstLine = content.split("\n")[0].trim();
      if (firstLine && firstLine.length > 0) {
        const autoTitle = firstLine.substring(0, 100);
        setTitle(autoTitle);
        onTitleChange(autoTitle);
      }
    }
  }, [content, title, onTitleChange]);

  const handleSave = () => {
    setIsSaving(true);

    // Auto-generate title from first line if title is empty or default
    let finalTitle = title;
    if (!title || title === "Untitled Page") {
      const firstLine = content.split("\n")[0].trim();
      if (firstLine) {
        finalTitle = firstLine.substring(0, 100); // Limit title length
      }
    }

    // Simulate saving delay
    setTimeout(() => {
      onSave({
        id: pageId || `page-${Date.now()}`,
        title: finalTitle,
        content,
        sectionId,
        parentPageId,
      });

      setIsSaving(false);
    }, 800);
  };

  const handleFormatText = useCallback(
    (format: string) => {
      if (!editorRef.current) return;

      const textarea = editorRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);

      let formattedText = "";
      let newCursorStart = start;
      let newCursorEnd = start;

      switch (format) {
        case "bold":
          if (selectedText) {
            formattedText = `**${selectedText}**`;
            newCursorStart = start + 2;
            newCursorEnd = start + 2 + selectedText.length;
          } else {
            formattedText = "****";
            newCursorStart = newCursorEnd = start + 2;
          }
          break;
        case "italic":
          if (selectedText) {
            formattedText = `*${selectedText}*`;
            newCursorStart = start + 1;
            newCursorEnd = start + 1 + selectedText.length;
          } else {
            formattedText = "**";
            newCursorStart = newCursorEnd = start + 1;
          }
          break;
        case "underline":
          if (selectedText) {
            formattedText = `_${selectedText}_`;
            newCursorStart = start + 1;
            newCursorEnd = start + 1 + selectedText.length;
          } else {
            formattedText = "__";
            newCursorStart = newCursorEnd = start + 1;
          }
          break;
        case "list":
          const listText = selectedText || "List item";
          // Check if we're at the beginning of a line
          const beforeCursor = content.substring(0, start);
          const needsNewline =
            beforeCursor.length > 0 && !beforeCursor.endsWith("\n");
          formattedText = `${needsNewline ? "\n" : ""}- ${listText}`;
          newCursorStart = start + (needsNewline ? 3 : 2);
          newCursorEnd = newCursorStart + listText.length;
          break;
        case "ordered-list":
          const orderedText = selectedText || "List item";
          const beforeCursorOrdered = content.substring(0, start);
          const needsNewlineOrdered =
            beforeCursorOrdered.length > 0 &&
            !beforeCursorOrdered.endsWith("\n");
          formattedText = `${needsNewlineOrdered ? "\n" : ""}1. ${orderedText}`;
          newCursorStart = start + (needsNewlineOrdered ? 4 : 3);
          newCursorEnd = newCursorStart + orderedText.length;
          break;
        case "h1":
          const h1Text = selectedText || "Heading 1";
          const beforeCursorH1 = content.substring(0, start);
          const needsNewlineH1 =
            beforeCursorH1.length > 0 && !beforeCursorH1.endsWith("\n");
          formattedText = `${needsNewlineH1 ? "\n" : ""}# ${h1Text}`;
          newCursorStart = start + (needsNewlineH1 ? 3 : 2);
          newCursorEnd = newCursorStart + h1Text.length;
          break;
        case "h2":
          const h2Text = selectedText || "Heading 2";
          const beforeCursorH2 = content.substring(0, start);
          const needsNewlineH2 =
            beforeCursorH2.length > 0 && !beforeCursorH2.endsWith("\n");
          formattedText = `${needsNewlineH2 ? "\n" : ""}## ${h2Text}`;
          newCursorStart = start + (needsNewlineH2 ? 4 : 3);
          newCursorEnd = newCursorStart + h2Text.length;
          break;
        case "h3":
          const h3Text = selectedText || "Heading 3";
          const beforeCursorH3 = content.substring(0, start);
          const needsNewlineH3 =
            beforeCursorH3.length > 0 && !beforeCursorH3.endsWith("\n");
          formattedText = `${needsNewlineH3 ? "\n" : ""}### ${h3Text}`;
          newCursorStart = start + (needsNewlineH3 ? 5 : 4);
          newCursorEnd = newCursorStart + h3Text.length;
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
        textarea.setSelectionRange(newCursorStart, newCursorEnd);
      }, 0);
    },
    [content],
  );

  const handleInsertImage = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) {
              const imageMarkdown = `\n![${file.name}](${result})\n`;
              setContent((prev) => prev + imageMarkdown);
            }
          };
          reader.readAsDataURL(file);
        } else {
          alert("Please select an image file.");
        }
      }
      // Reset the input
      event.target.value = "";
    },
    [],
  );

  const handleInsertImageUrl = useCallback(() => {
    const imageUrl = prompt("Enter image URL:");
    if (imageUrl) {
      const imageMarkdown = `\n![Image](${imageUrl})\n`;
      setContent((prev) => prev + imageMarkdown);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          if (result) {
            const imageMarkdown = `\n![${file.name}](${result})\n`;
            setContent((prev) => prev + imageMarkdown);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const handleInsertLink = useCallback(() => {
    const url = prompt("Enter URL:");
    if (url) {
      const linkText = prompt("Enter link text:") || url;
      const linkMarkdown = `[${linkText}](${url})`;

      if (editorRef.current) {
        const textarea = editorRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent =
          content.substring(0, start) + linkMarkdown + content.substring(end);
        setContent(newContent);

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(
            start + linkMarkdown.length,
            start + linkMarkdown.length,
          );
        }, 0);
      }
    }
  }, [content]);

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
            placeholder="Page Title"
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
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleInsertImage}
                      >
                        <Image className="h-4 w-4" />
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Upload Image from Computer</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleInsertLink}
                    >
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleInsertImageUrl}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Insert Image from URL</p>
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

            <div
              className={`relative ${isDragOver ? "border-2 border-dashed border-primary bg-primary/5" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Textarea
                ref={editorRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start typing your page content here... You can also drag and drop images!"
                className="min-h-[400px] font-mono text-sm resize-none"
              />
              {isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-md">
                  <div className="text-center">
                    <Image className="h-12 w-12 mx-auto mb-2 text-primary" />
                    <p className="text-primary font-medium">Drop images here</p>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              multiple={false}
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
          {isSaving ? "Saving..." : "Save Page"}
        </Button>
      </CardFooter>
    </Card>
  );
};

// Enhanced markdown formatter for preview
const formatMarkdown = (text: string) => {
  let formatted = text
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Italic text
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Underline text
    .replace(/_(.*?)_/g, "<u>$1</u>")
    // Headers
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    // Images
    .replace(
      /!\[(.*?)\]\((.*?)\)/g,
      '<img alt="$1" src="$2" style="max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0;" />',
    )
    // Links
    .replace(
      /\[([^\]]+)\]\(([^\)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: hsl(var(--primary)); text-decoration: underline;">$1</a>',
    );

  // Handle lists more carefully
  const lines = formatted.split("\n");
  const processedLines: string[] = [];
  let inUnorderedList = false;
  let inOrderedList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isUnorderedItem = /^- (.+)/.test(line);
    const isOrderedItem = /^\d+\. (.+)/.test(line);

    if (isUnorderedItem) {
      if (!inUnorderedList) {
        processedLines.push("<ul>");
        inUnorderedList = true;
      }
      if (inOrderedList) {
        processedLines.push("</ol>");
        inOrderedList = false;
      }
      processedLines.push(`<li>${line.replace(/^- /, "")}</li>`);
    } else if (isOrderedItem) {
      if (!inOrderedList) {
        processedLines.push("<ol>");
        inOrderedList = true;
      }
      if (inUnorderedList) {
        processedLines.push("</ul>");
        inUnorderedList = false;
      }
      processedLines.push(`<li>${line.replace(/^\d+\. /, "")}</li>`);
    } else {
      if (inUnorderedList) {
        processedLines.push("</ul>");
        inUnorderedList = false;
      }
      if (inOrderedList) {
        processedLines.push("</ol>");
        inOrderedList = false;
      }
      processedLines.push(line);
    }
  }

  // Close any remaining lists
  if (inUnorderedList) {
    processedLines.push("</ul>");
  }
  if (inOrderedList) {
    processedLines.push("</ol>");
  }

  // Join lines and replace remaining newlines with <br>
  formatted = processedLines.join("\n").replace(/\n/g, "<br>");

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
