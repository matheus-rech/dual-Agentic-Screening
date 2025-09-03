import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, ExternalLink, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ErrorInfo {
  type: 'database' | 'api' | 'configuration' | 'validation' | 'network';
  title: string;
  message: string;
  details?: string;
  code?: string;
  suggestions?: string[];
  retryAction?: () => void;
  documentationUrl?: string;
}

interface EnhancedErrorDisplayProps {
  error: string | Error | null;
  context?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

const parseError = (error: string | Error, context?: string): ErrorInfo => {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorString = errorMessage.toLowerCase();

  // Database errors
  if (errorString.includes('pgrst116') || errorString.includes('no rows returned')) {
    return {
      type: 'database',
      title: 'No Data Found',
      message: 'The requested data was not found in the database.',
      details: errorMessage,
      suggestions: [
        'Ensure the project has been properly configured',
        'Check if screening criteria have been defined',
        'Verify that references have been imported',
        'Try refreshing the page or reloading the project'
      ]
    };
  }

  if (errorString.includes('permission denied') || errorString.includes('rls')) {
    return {
      type: 'database',
      title: 'Access Permission Error',
      message: 'You do not have permission to access this data.',
      details: errorMessage,
      suggestions: [
        'Ensure you are logged in with the correct account',
        'Check that you own this project',
        'Contact support if this persists'
      ]
    };
  }

  if (errorString.includes('connection') || errorString.includes('network')) {
    return {
      type: 'network',
      title: 'Connection Error',
      message: 'Unable to connect to the database or API service.',
      details: errorMessage,
      suggestions: [
        'Check your internet connection',
        'Try refreshing the page',
        'Wait a moment and try again',
        'Contact support if the issue persists'
      ]
    };
  }

  // API errors
  if (errorString.includes('api') || errorString.includes('openai') || errorString.includes('gemini')) {
    return {
      type: 'api',
      title: 'AI Service Error',
      message: 'There was an issue communicating with the AI screening service.',
      details: errorMessage,
      suggestions: [
        'Check that AI services are properly configured',
        'Verify API keys are valid and have sufficient credits',
        'Try again in a few moments',
        'Consider switching to a different AI model'
      ]
    };
  }

  // Configuration errors
  if (errorString.includes('criteria') || errorString.includes('config')) {
    return {
      type: 'configuration',
      title: 'Configuration Error',
      message: 'The system configuration is incomplete or invalid.',
      details: errorMessage,
      suggestions: [
        'Complete the screening criteria setup',
        'Verify all required fields are filled',
        'Check the project settings',
        'Review the configuration guide'
      ],
      documentationUrl: '/criteria'
    };
  }

  // Validation errors
  if (errorString.includes('validation') || errorString.includes('invalid') || errorString.includes('required')) {
    return {
      type: 'validation',
      title: 'Validation Error',
      message: 'The provided data did not pass validation checks.',
      details: errorMessage,
      suggestions: [
        'Check all required fields are completed',
        'Ensure data is in the correct format',
        'Review input validation requirements',
        'Contact support for assistance'
      ]
    };
  }

  // Generic error
  return {
    type: 'api',
    title: 'Unexpected Error',
    message: 'An unexpected error occurred while processing your request.',
    details: errorMessage,
    suggestions: [
      'Try refreshing the page',
      'Clear your browser cache and cookies',
      'Try again in a few minutes',
      'Contact support if the problem continues'
    ]
  };
};

export const EnhancedErrorDisplay = ({ error, context, onRetry, onDismiss }: EnhancedErrorDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  if (!error) return null;

  const errorInfo = parseError(error, context);

  const copyErrorDetails = () => {
    const details = `
Context: ${context || 'Unknown'}
Type: ${errorInfo.type}
Message: ${errorInfo.message}
Details: ${errorInfo.details || 'None'}
Timestamp: ${new Date().toISOString()}
    `.trim();
    
    navigator.clipboard.writeText(details);
    toast({
      title: "Error details copied",
      description: "Error information has been copied to your clipboard",
    });
  };

  const getErrorColor = (type: ErrorInfo['type']) => {
    switch (type) {
      case 'database':
        return 'border-red-200 bg-red-50';
      case 'api':
        return 'border-yellow-200 bg-yellow-50';
      case 'configuration':
        return 'border-blue-200 bg-blue-50';
      case 'validation':
        return 'border-orange-200 bg-orange-50';
      case 'network':
        return 'border-purple-200 bg-purple-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <Card className={`border-l-4 border-l-destructive ${getErrorColor(errorInfo.type)}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <CardTitle className="text-base text-destructive">
                {errorInfo.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {errorInfo.message}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {errorInfo.type}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Suggested Actions */}
          {errorInfo.suggestions && errorInfo.suggestions.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">Suggested Solutions:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {errorInfo.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            {onRetry && (
              <Button onClick={onRetry} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
            
            {errorInfo.documentationUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = errorInfo.documentationUrl!}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Fix Configuration
              </Button>
            )}

            <Button onClick={copyErrorDetails} variant="ghost" size="sm">
              <Copy className="w-4 h-4 mr-2" />
              Copy Details
            </Button>

            {onDismiss && (
              <Button onClick={onDismiss} variant="ghost" size="sm">
                Dismiss
              </Button>
            )}
          </div>

          {/* Expandable Technical Details */}
          {errorInfo.details && (
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                Show Technical Details
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="p-3 bg-muted rounded-md">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                    {errorInfo.details}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </CardContent>
    </Card>
  );
};