import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Brain, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Reference {
  id: string;
  title?: string;
  abstract?: string;
  authors?: string;
  journal?: string;
  year?: number;
  doi?: string;
  status?: string;
  ai_screening_details?: any;
  ai_conflict_flag?: boolean;
}

interface ReferenceDetailsPanelProps {
  references: Reference[];
}

const ReferenceDetailsPanel: React.FC<ReferenceDetailsPanelProps> = ({ references }) => {
  const [selectedReference, setSelectedReference] = useState<Reference | null>(null);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'include':
      case 'included':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'exclude':
      case 'excluded':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'maybe':
      case 'uncertain':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case 'conflict':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Brain className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string, conflictFlag?: boolean) => {
    if (conflictFlag || status === 'conflict') {
      return <Badge variant="destructive">Conflict</Badge>;
    }
    
    switch (status) {
      case 'include':
      case 'included':
        return <Badge variant="default" className="bg-success text-success-foreground">Include</Badge>;
      case 'exclude':
      case 'excluded':
        return <Badge variant="secondary">Exclude</Badge>;
      case 'maybe':
      case 'uncertain':
        return <Badge variant="outline" className="border-warning text-warning">Maybe</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const renderAIReasoningDetails = (aiDetails: any) => {
    if (!aiDetails) return null;

    const { reviewer1, reviewer2 } = aiDetails;

    return (
      <div className="space-y-4">
        {reviewer1 && (
          <div className="p-4 bg-success/5 border border-success/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-success" />
              <span className="font-medium text-success">{reviewer1.reviewer || 'Reviewer 1'}</span>
              <Badge variant="outline" className="text-xs border-success/30 text-success">
                {Math.round((reviewer1.confidence || 0) * 100)}% confident
              </Badge>
            </div>
            <div className="mb-2">
              <span className="text-sm font-medium">Decision: </span>
              {getStatusIcon(reviewer1.recommendation)}
              <span className="ml-1 text-sm">{reviewer1.recommendation}</span>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium">Reasoning:</span>
              <p className="mt-1">{reviewer1.reasoning}</p>
            </div>
          </div>
        )}

        {reviewer2 && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-primary" />
              <span className="font-medium text-primary">{reviewer2.reviewer || 'Reviewer 2'}</span>
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                {Math.round((reviewer2.confidence || 0) * 100)}% confident
              </Badge>
            </div>
            <div className="mb-2">
              <span className="text-sm font-medium">Decision: </span>
              {getStatusIcon(reviewer2.recommendation)}
              <span className="ml-1 text-sm">{reviewer2.recommendation}</span>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium">Reasoning:</span>
              <p className="mt-1">{reviewer2.reasoning}</p>
            </div>
          </div>
        )}

        {reviewer1 && reviewer2 && (
          <div className="p-4 bg-muted/50 border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-sm">Agreement Analysis:</span>
            </div>
            <div className="text-sm">
              {reviewer1.recommendation === reviewer2.recommendation ? (
                <span className="text-success">✓ Both reviewers agreed on "{reviewer1.recommendation}"</span>
              ) : (
                <span className="text-destructive">✗ Reviewers disagreed - {reviewer1.reviewer}: {reviewer1.recommendation}, {reviewer2.reviewer}: {reviewer2.recommendation}</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const processedReferences = references.filter(ref => 
    ref.status && 
    ref.status !== 'pending' && 
    ['included', 'excluded', 'uncertain', 'conflict'].includes(ref.status)
  );
  const pendingReferences = references.filter(ref => 
    !ref.status || 
    ref.status === 'pending' ||
    !['included', 'excluded', 'uncertain', 'conflict'].includes(ref.status)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Reference List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Reference Analysis ({processedReferences.length} processed, {pendingReferences.length} pending)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {processedReferences.length > 0 && (
                <>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Processed References</div>
                  {processedReferences.map((ref) => (
                    <div
                      key={ref.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedReference?.id === ref.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedReference(ref)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(ref.status || '')}
                          {getStatusBadge(ref.status || '', ref.ai_conflict_flag)}
                        </div>
                      </div>
                      <div className="text-sm font-medium line-clamp-2 mb-1">
                        {ref.title || 'Untitled Reference'}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {ref.authors}
                      </div>
                    </div>
                  ))}
                </>
              )}
              
              {pendingReferences.length > 0 && (
                <>
                  {processedReferences.length > 0 && <Separator className="my-4" />}
                  <div className="text-sm font-medium text-muted-foreground mb-2">Pending References</div>
                  {pendingReferences.slice(0, 10).map((ref) => (
                    <div
                      key={ref.id}
                      className="p-3 rounded-lg border border-dashed border-muted-foreground/30 opacity-60"
                    >
                      <div className="text-sm font-medium line-clamp-2 mb-1">
                        {ref.title || 'Untitled Reference'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Awaiting screening...
                      </div>
                    </div>
                  ))}
                  {pendingReferences.length > 10 && (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      ... and {pendingReferences.length - 10} more pending references
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Reference Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {selectedReference ? 'Reference Details & AI Reasoning' : 'Select a Reference'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedReference ? (
            <ScrollArea className="h-[600px]">
              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Title</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedReference.title || 'No title provided'}
                  </p>
                </div>

                {selectedReference.authors && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Authors</h4>
                    <p className="text-sm text-muted-foreground">{selectedReference.authors}</p>
                  </div>
                )}

                {(selectedReference.journal || selectedReference.year) && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Publication</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedReference.journal} {selectedReference.year && `(${selectedReference.year})`}
                    </p>
                  </div>
                )}

                {selectedReference.abstract && (
                  <Collapsible
                    open={expandedSections.abstract}
                    onOpenChange={() => toggleSection('abstract')}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                        <h4 className="text-sm font-medium">Abstract</h4>
                        {expandedSections.abstract ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {selectedReference.abstract}
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <Separator />

                {/* AI Screening Results */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h4 className="text-sm font-medium">AI Screening Analysis</h4>
                    {getStatusBadge(selectedReference.status || '', selectedReference.ai_conflict_flag)}
                  </div>
                  
                  {selectedReference.ai_screening_details ? (
                    renderAIReasoningDetails(selectedReference.ai_screening_details)
                  ) : (
                    <div className="p-4 bg-muted/30 rounded-lg text-center">
                      <Brain className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No AI screening data available for this reference
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-[600px] text-muted-foreground">
              <div className="text-center">
                <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Select a reference from the list to view its details and AI reasoning</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReferenceDetailsPanel;