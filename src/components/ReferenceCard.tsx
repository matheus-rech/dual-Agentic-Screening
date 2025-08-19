import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Users, Calendar, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ReferenceCardProps {
  reference: {
    id: string;
    title: string;
    authors: string;
    abstract: string;
    journal: string;
    year: number;
    doi?: string;
    pmid?: string;
    url?: string;
    status: string;
    ai_screening_details?: any;
    ai_conflict_flag?: boolean;
  };
  aiResult?: {
    final_decision: string;
    agreement: boolean;
    primary_reviewer: {
      decision: string;
      confidence: number;
      reasoning: string;
    };
    secondary_reviewer: {
      decision: string;
      confidence: number;
      reasoning: string;
    };
  };
}

const ReferenceCard = ({ reference, aiResult }: ReferenceCardProps) => {
  const [showAbstract, setShowAbstract] = useState(false);
  const [showAIDetails, setShowAIDetails] = useState(false);

  const getStatusBadge = () => {
    if (!aiResult) {
      return <Badge variant="outline">Pending</Badge>;
    }

    const { final_decision, agreement } = aiResult;
    
    if (final_decision === 'include') {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
          Include {!agreement && " (Conflict)"}
        </Badge>
      );
    } else if (final_decision === 'exclude') {
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
          Exclude {!agreement && " (Conflict)"}
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
          Uncertain
        </Badge>
      );
    }
  };

  const getAgreementBadge = () => {
    if (!aiResult) return null;
    
    const { agreement } = aiResult;
    return (
      <Badge variant={agreement ? "outline" : "destructive"}>
        {agreement ? "Agreement" : "Conflict"}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground leading-tight">
              {reference.title}
            </h3>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span className="truncate">{reference.authors}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{reference.year}</span>
              </div>
              <div className="flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                <span className="truncate">{reference.journal}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {getStatusBadge()}
            {getAgreementBadge()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Abstract Section */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAbstract(!showAbstract)}
            className="h-auto p-0 font-medium text-primary hover:text-primary/80"
          >
            Abstract
            {showAbstract ? (
              <ChevronUp className="w-4 h-4 ml-1" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-1" />
            )}
          </Button>
          
          {showAbstract && (
            <div className="mt-2 p-3 bg-secondary/50 rounded-md">
              <p className="text-sm text-foreground leading-relaxed">
                {reference.abstract}
              </p>
            </div>
          )}
        </div>

        {/* AI Screening Results */}
        {aiResult && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAIDetails(!showAIDetails)}
              className="h-auto p-0 font-medium text-primary hover:text-primary/80"
            >
              AI Screening Details
              {showAIDetails ? (
                <ChevronUp className="w-4 h-4 ml-1" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-1" />
              )}
            </Button>
            
            {showAIDetails && (
              <div className="mt-2 p-3 bg-secondary/50 rounded-md space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Primary Reviewer */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">OpenAI Reviewer</span>
                      <Badge variant="outline" className="text-xs">
                        {(aiResult.primary_reviewer.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Decision: </span>
                      <span className={`capitalize ${
                        aiResult.primary_reviewer.decision === 'include' 
                          ? 'text-green-700' 
                          : aiResult.primary_reviewer.decision === 'exclude'
                          ? 'text-red-700'
                          : 'text-yellow-700'
                      }`}>
                        {aiResult.primary_reviewer.decision}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {aiResult.primary_reviewer.reasoning}
                    </p>
                  </div>

                  {/* Secondary Reviewer */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Gemini Reviewer</span>
                      <Badge variant="outline" className="text-xs">
                        {(aiResult.secondary_reviewer.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Decision: </span>
                      <span className={`capitalize ${
                        aiResult.secondary_reviewer.decision === 'include' 
                          ? 'text-green-700' 
                          : aiResult.secondary_reviewer.decision === 'exclude'
                          ? 'text-red-700'
                          : 'text-yellow-700'
                      }`}>
                        {aiResult.secondary_reviewer.decision}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {aiResult.secondary_reviewer.reasoning}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Reference Links */}
        <div className="flex items-center gap-2 text-sm">
          {reference.doi && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-auto p-1 text-xs text-primary hover:text-primary/80"
            >
              <a
                href={`https://doi.org/${reference.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                DOI: {reference.doi}
                <ExternalLink className="w-3 h-3" />
              </a>
            </Button>
          )}
          {reference.pmid && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-auto p-1 text-xs text-primary hover:text-primary/80"
            >
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/${reference.pmid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                PMID: {reference.pmid}
                <ExternalLink className="w-3 h-3" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ReferenceCard;