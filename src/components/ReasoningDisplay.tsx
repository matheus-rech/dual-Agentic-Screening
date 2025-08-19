import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, AlertCircle, Brain, Zap } from 'lucide-react';

interface ReasoningStep {
  id: string;
  reviewer: string;
  step: string;
  reasoning: string;
  confidence?: number;
  timestamp: Date;
}

interface CurrentReference {
  id: string;
  title: string;
  authors: string;
}

interface ReasoningDisplayProps {
  isVisible: boolean;
  currentReference: CurrentReference | null;
  reasoningSteps: ReasoningStep[];
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
}

const ReasoningDisplay: React.FC<ReasoningDisplayProps> = ({
  isVisible,
  currentReference,
  reasoningSteps,
  progress
}) => {
  if (!isVisible) return null;

  const getStepIcon = (step: string) => {
    if (step.includes('include')) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (step.includes('exclude')) return <XCircle className="w-4 h-4 text-red-500" />;
    if (step.includes('maybe')) return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    return <Brain className="w-4 h-4 text-blue-500" />;
  };

  const getReviewerColor = (reviewer: string) => {
    return reviewer.includes('OpenAI') ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
  };

  return (
    <Card className="w-full h-[600px] bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Live AI Reasoning
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {progress.current} of {progress.total}
          </Badge>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress.percentage} className="h-2" />
          <div className="text-xs text-muted-foreground">
            Processing reference {progress.current} of {progress.total} ({progress.percentage}%)
          </div>
        </div>

        {/* Current Reference */}
        {currentReference && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium text-foreground truncate">
              {currentReference.title}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {currentReference.authors}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[420px] px-6 pb-6">
          <div className="space-y-4">
            {reasoningSteps.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                <div className="text-center">
                  <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Waiting for AI reasoning...</p>
                </div>
              </div>
            ) : (
              reasoningSteps.map((step, index) => (
                <div key={step.id} className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getStepIcon(step.step)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getReviewerColor(step.reviewer)}`}
                        >
                          {step.reviewer.includes('OpenAI') ? 'OpenAI' : 'Gemini'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {step.timestamp.toLocaleTimeString()}
                        </span>
                        {step.confidence && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(step.confidence * 100)}% confident
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-foreground bg-muted/30 p-3 rounded-md">
                        <div className="font-medium text-primary mb-1">{step.step}</div>
                        <div className="text-muted-foreground leading-relaxed">
                          {step.reasoning}
                        </div>
                      </div>
                    </div>
                  </div>
                  {index < reasoningSteps.length - 1 && (
                    <Separator className="my-3" />
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default ReasoningDisplay;