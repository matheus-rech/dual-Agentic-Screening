import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
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
  const [autoScroll, setAutoScroll] = useState(true);
  const [timelinePosition, setTimelinePosition] = useState(100);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [groupedSteps, setGroupedSteps] = useState<{ [referenceId: string]: ReasoningStep[] }>({});

  // Calculate timeline cutoff based on position
  const timelineSteps = useMemo(() => {
    if (reasoningSteps.length === 0) return reasoningSteps;
    
    const totalSteps = reasoningSteps.length;
    const cutoffIndex = Math.floor((timelinePosition / 100) * totalSteps);
    return reasoningSteps.slice(0, cutoffIndex);
  }, [reasoningSteps, timelinePosition]);

  // Filter reasoning steps by timeline position for display
  const filteredByTimeline = useMemo(() => {
    return timelineSteps;
  }, [timelineSteps]);

  // Group reasoning steps by reference for better organization
  useEffect(() => {
    const grouped = filteredByTimeline.reduce((acc, step) => {
      const refId = step.id.split('-')[0] || 'unknown';
      if (!acc[refId]) acc[refId] = [];
      acc[refId].push(step);
      return acc;
    }, {} as { [referenceId: string]: ReasoningStep[] });
    setGroupedSteps(grouped);
  }, [filteredByTimeline]);

  // Auto-scroll to bottom when new steps are added
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [reasoningSteps, autoScroll]);

  if (!isVisible) return null;

  const getStepIcon = (step: string) => {
    if (step.includes('include')) return <CheckCircle className="w-4 h-4 text-success" />;
    if (step.includes('exclude')) return <XCircle className="w-4 h-4 text-destructive" />;
    if (step.includes('maybe') || step.includes('uncertain')) return <AlertCircle className="w-4 h-4 text-warning" />;
    return <Brain className="w-4 h-4 text-primary" />;
  };

  const getReviewerColor = (reviewer: string) => {
    return reviewer.includes('OpenAI') ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary';
  };

  const handleScrollToggle = () => {
    setAutoScroll(!autoScroll);
  };

  return (
    <Card className="w-full bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            AI Reasoning Stream
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {progress.current} of {progress.total}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleScrollToggle}
              className="text-xs"
            >
              {autoScroll ? 'Pause Auto-scroll' : 'Resume Auto-scroll'}
            </Button>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <Slider
            value={[timelinePosition]}
            onValueChange={([value]) => setTimelinePosition(value)}
            max={100}
            step={1}
            className="h-2"
          />
          <div className="text-xs text-muted-foreground flex justify-between">
            <span>Timeline: {Math.round(timelinePosition)}% of screening process</span>
            <span>{filteredByTimeline.length} reasoning steps shown</span>
          </div>
        </div>

        {/* Current Reference */}
        {currentReference && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg border-l-4 border-primary">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-primary">Currently Processing</span>
            </div>
            <div className="text-sm font-medium text-foreground line-clamp-2">
              {currentReference.title}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {currentReference.authors}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea ref={scrollAreaRef} className="h-[500px] px-6 pb-6">
          <div className="space-y-6">
            {reasoningSteps.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                <div className="text-center">
                  <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Waiting for AI reasoning...</p>
                  <p className="text-xs mt-1">Reasoning steps will appear here as they're generated</p>
                </div>
              </div>
            ) : (
              Object.entries(groupedSteps).map(([refId, steps]) => (
                <div key={refId} className="space-y-3">
                  {/* Reference Group Header */}
                  {Object.keys(groupedSteps).length > 1 && (
                    <div className="flex items-center gap-2 py-2 border-b border-border">
                      <div className="w-3 h-3 bg-muted rounded-full"></div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Reference {refId}
                      </span>
                      <div className="flex-1 h-px bg-border"></div>
                    </div>
                  )}
                  
                  {/* Reasoning Steps for this Reference */}
                  {steps.map((step, stepIndex) => (
                    <div key={step.id} className="space-y-2 animate-in slide-in-from-bottom-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getStepIcon(step.step)}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
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
                          <div className="text-sm text-foreground bg-muted/30 p-3 rounded-md border-l-2 border-primary/20">
                            <div className="font-medium text-primary mb-2">{step.step}</div>
                            <div className="text-muted-foreground leading-relaxed">
                              {step.reasoning}
                            </div>
                          </div>
                        </div>
                      </div>
                      {stepIndex < steps.length - 1 && (
                        <div className="ml-8">
                          <Separator className="my-2" />
                        </div>
                      )}
                    </div>
                  ))}
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