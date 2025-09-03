import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Users, Target, FlaskConical, Calendar } from 'lucide-react';

interface CriteriaSummaryProps {
  criteria: {
    population?: string;
    intervention?: string;
    comparator?: string;
    outcome?: string;
    study_designs?: string[];
    timeframe_start?: string;
    timeframe_end?: string;
    timeframe_description?: string;
    inclusion_criteria?: string[];
    exclusion_criteria?: string[];
  };
  onEdit?: () => void;
}

const CriteriaSummary: React.FC<CriteriaSummaryProps> = ({ criteria, onEdit }) => {
  const hasTimeframe = criteria.timeframe_start || criteria.timeframe_end || criteria.timeframe_description;
  const hasInclusionCriteria = criteria.inclusion_criteria?.filter(c => c.trim()).length > 0;
  const hasExclusionCriteria = criteria.exclusion_criteria?.filter(c => c.trim()).length > 0;

  return (
    <Card className="bg-muted/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Screening Criteria Summary
          </CardTitle>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Criteria
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* PICO Elements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Population</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {criteria.population || 'Not specified'}
            </p>
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Intervention</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {criteria.intervention || 'Not specified'}
            </p>
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Comparator</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {criteria.comparator || 'Not specified'}
            </p>
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Outcome</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {criteria.outcome || 'Not specified'}
            </p>
          </div>
        </div>

        {/* Study Designs */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Study Types</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {criteria.study_designs && criteria.study_designs.length > 0 ? (
              criteria.study_designs.map((design) => (
                <Badge key={design} variant="secondary" className="text-xs">
                  {design}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Not specified</span>
            )}
          </div>
        </div>

        {/* Timeframe / Follow-up Time */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Timeframe / Follow-up Time</span>
          </div>
          {hasTimeframe ? (
            <div className="text-sm text-muted-foreground space-y-1">
              {(criteria.timeframe_start || criteria.timeframe_end) && (
                <p>
                  <span className="font-medium">Study Period:</span> {criteria.timeframe_start || 'Not specified'} to {criteria.timeframe_end || 'Present'}
                </p>
              )}
              {criteria.timeframe_description && (
                <p>
                  <span className="font-medium">Follow-up Details:</span> {criteria.timeframe_description}
                </p>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Not specified</span>
          )}
        </div>

        {/* Inclusion Criteria */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-success" />
            <span className="font-medium text-sm">Inclusion Criteria</span>
          </div>
          {hasInclusionCriteria ? (
            <ul className="text-sm text-muted-foreground space-y-1">
              {criteria.inclusion_criteria
                ?.filter(c => c.trim())
                .map((criterion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-success mt-0.5">•</span>
                    <span>{criterion}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <span className="text-sm text-muted-foreground">Not specified</span>
          )}
        </div>

        {/* Exclusion Criteria */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-destructive" />
            <span className="font-medium text-sm">Exclusion Criteria</span>
          </div>
          {hasExclusionCriteria ? (
            <ul className="text-sm text-muted-foreground space-y-1">
              {criteria.exclusion_criteria
                ?.filter(c => c.trim())
                .map((criterion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">•</span>
                    <span>{criterion}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <span className="text-sm text-muted-foreground">Not specified</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CriteriaSummary;