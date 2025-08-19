import * as React from "react";
import { Upload, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateFile, ALLOWED_FILE_TYPES } from "@/lib/security";
import { cn } from "@/lib/utils";

interface SecureFileUploadProps {
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  selectedFile?: File | null;
  fileType?: 'documents' | 'images';
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function SecureFileUpload({
  onFileSelect,
  onFileRemove,
  selectedFile,
  fileType = 'documents',
  disabled = false,
  className,
  children
}: SecureFileUploadProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileValidation = (file: File) => {
    const validation = validateFile(file, fileType);
    
    if (!validation.isValid) {
      setError(validation.errors.join(' '));
      return false;
    }
    
    setError(undefined);
    return true;
  };

  const handleFileSelection = (file: File) => {
    if (handleFileValidation(file)) {
      onFileSelect(file);
    }
  };

  const handleDrag = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  }, [disabled]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const openFileDialog = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleRemove = () => {
    setError(undefined);
    onFileRemove?.();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary/50",
          error ? "border-destructive bg-destructive/5" : ""
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ALLOWED_FILE_TYPES[fileType].join(',')}
          onChange={handleFileInputChange}
          disabled={disabled}
        />

        {selectedFile ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{selectedFile.name}</span>
              <span className="text-xs text-muted-foreground">
                ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              disabled={disabled}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">
              {children || `Drop your ${fileType === 'documents' ? 'document' : 'image'} here or click to browse`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supported formats: {ALLOWED_FILE_TYPES[fileType].map(type => 
                type.split('/')[1].toUpperCase()
              ).join(', ')}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center space-x-2 text-destructive">
          <AlertTriangle className="w-4 h-4" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}