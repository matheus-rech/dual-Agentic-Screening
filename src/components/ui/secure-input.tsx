import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeTextInput, sanitizeAIPrompt, validateEmail, validateURL, validateDOI } from "@/lib/security";
import { cn } from "@/lib/utils";

interface SecureInputProps extends React.ComponentProps<"input"> {
  sanitize?: boolean;
  validateType?: 'email' | 'url' | 'doi';
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const SecureInput = React.forwardRef<HTMLInputElement, SecureInputProps>(
  ({ className, sanitize = true, validateType, onValidationChange, onChange, ...props }, ref) => {
    const [error, setError] = React.useState<string>();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;
      let isValid = true;
      let errorMessage: string | undefined;

      // Sanitize input if enabled
      if (sanitize) {
        value = sanitizeTextInput(value);
        e.target.value = value;
      }

      // Validate based on type
      if (validateType && value) {
        switch (validateType) {
          case 'email':
            isValid = validateEmail(value);
            errorMessage = isValid ? undefined : 'Please enter a valid email address';
            break;
          case 'url':
            isValid = validateURL(value);
            errorMessage = isValid ? undefined : 'Please enter a valid URL (http/https)';
            break;
          case 'doi':
            isValid = validateDOI(value);
            errorMessage = isValid ? undefined : 'Please enter a valid DOI (e.g., 10.1000/xyz123)';
            break;
        }
      }

      setError(errorMessage);
      onValidationChange?.(isValid, errorMessage);
      onChange?.(e);
    };

    return (
      <div className="space-y-1">
        <Input
          className={cn(
            className,
            error && "border-destructive focus-visible:ring-destructive"
          )}
          ref={ref}
          onChange={handleChange}
          {...props}
        />
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);
SecureInput.displayName = "SecureInput";

interface SecureTextareaProps extends React.ComponentProps<"textarea"> {
  sanitize?: boolean;
  aiPromptSanitize?: boolean;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const SecureTextarea = React.forwardRef<HTMLTextAreaElement, SecureTextareaProps>(
  ({ className, sanitize = true, aiPromptSanitize = false, onValidationChange, onChange, ...props }, ref) => {
    const [error, setError] = React.useState<string>();

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      let value = e.target.value;
      let isValid = true;
      let errorMessage: string | undefined;

      // Sanitize input
      if (aiPromptSanitize) {
        const originalLength = value.length;
        value = sanitizeAIPrompt(value);
        if (value.includes('[FILTERED]')) {
          errorMessage = 'Some potentially harmful content was filtered from your input';
          isValid = false;
        }
        e.target.value = value;
      } else if (sanitize) {
        value = sanitizeTextInput(value);
        e.target.value = value;
      }

      setError(errorMessage);
      onValidationChange?.(isValid, errorMessage);
      onChange?.(e);
    };

    return (
      <div className="space-y-1">
        <Textarea
          className={cn(
            className,
            error && "border-destructive focus-visible:ring-destructive"
          )}
          ref={ref}
          onChange={handleChange}
          {...props}
        />
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);
SecureTextarea.displayName = "SecureTextarea";