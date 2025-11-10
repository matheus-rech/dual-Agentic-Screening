import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, Clock, Zap, DollarSign, Timer } from 'lucide-react';

interface ReadinessCheckProps {
  projectId?: string;
  criteriaData?: any;
  references: any[];
  isScreening: boolean;
  onStartScreening: () => void;
  estimatedCost?: number;
  estimatedTime?: string;
}

interface ReadinessItem {
  id: string;
  title: string;
  status: 'complete' | 'incomplete' | 'warning';
  message: string;
  weight: number; // For calculating overall readiness percentage
}

export const ScreeningReadinessCheck = ({
  projectId,
  criteriaData,
  references,
  isScreening,
  onStartScreening,
  estimatedCost,
  estimatedTime
}: ReadinessCheckProps) => {
  const [readinessItems, setReadinessItems] = useState<ReadinessItem[]>([]);
  const [overallReadiness, setOverallReadiness] = useState(0);

  useEffect(() => {
    const items: ReadinessItem[] = [
      {
        id: 'project',
        title: 'Project Selected',
        status: projectId ? 'complete' : 'incomplete',
        message: projectId ? 'Project loaded' : 'No project selected',
        weight: 15
      },
      {
        id: 'criteria-basic',
        title: 'Basic PICO Criteria',
        status: criteriaData?.population && criteriaData?.intervention && criteriaData?.outcome 
          ? 'complete' : 'incomplete',
        message: criteriaData?.population && criteriaData?.intervention && criteriaData?.outcome
          ? 'PICO elements defined' : 'Define Population, Intervention, and Outcome',
        weight: 25
      },
      {
        id: 'criteria-detailed',
        title: 'Detailed Screening Criteria',
        status: criteriaData?.inclusion_criteria?.length > 0 && criteriaData?.exclusion_criteria?.length > 0
          ? 'complete' 
          : criteriaData?.inclusion_criteria?.length > 0 || criteriaData?.exclusion_criteria?.length > 0
            ? 'warning'
            : 'incomplete',
        message: criteriaData?.inclusion_criteria?.length > 0 && criteriaData?.exclusion_criteria?.length > 0
          ? `${criteriaData.inclusion_criteria.length} inclusion, ${criteriaData.exclusion_criteria.length} exclusion criteria`
          : criteriaData?.inclusion_criteria?.length > 0 || criteriaData?.exclusion_criteria?.length > 0
            ? 'Partial criteria defined - add both inclusion and exclusion criteria'
            : 'Define detailed inclusion and exclusion criteria',
        weight: 30
      },
      {
        id: 'references',
        title: 'Reference Data',
        status: references.length >= 10 
          ? 'complete'
          : references.length > 0
            ? 'warning' 
            : 'incomplete',
        message: references.length >= 10
          ? `${references.length} references ready for screening`
          : references.length > 0
            ? `${references.length} references (recommend 10+ for meaningful results)`
            : 'No references imported',
        weight: 30
      }
    ];

    setReadinessItems(items);

    // Calculate overall readiness
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    const completedWeight = items.reduce((sum, item) => {
      if (item.status === 'complete') return sum + item.weight;
      if (item.status === 'warning') return sum + (item.weight * 0.5);
      return sum;
    }, 0);
    
    setOverallReadiness((completedWeight / totalWeight) * 100);
  }, [projectId, criteriaData, references.length]);

  const canStartScreening = readinessItems.every(item => item.status === 'complete' || item.status === 'warning') &&
    readinessItems.some(item => item.id === 'project' && item.status === 'complete') &&
    readinessItems.some(item => item.id === 'references' && item.status !== 'incomplete');

  const getStatusIcon = (status: ReadinessItem['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case 'incomplete':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: ReadinessItem['status']) => {
    switch (status) {
      case 'complete':
        return 'text-success';
      case 'warning':
        return 'text-warning';
      case 'incomplete':
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Screening Readiness
          </div>
          <Badge 
            variant={overallReadiness >= 90 ? "default" : overallReadiness >= 70 ? "secondary" : "outline"}
            className={overallReadiness >= 90 ? "bg-success text-success-foreground" : ""}
          >
            {Math.round(overallReadiness)}% Ready
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Overall Readiness Progress */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Overall Readiness</span>
              <span className="text-muted-foreground">{Math.round(overallReadiness)}%</span>
            </div>
            <Progress 
              value={overallReadiness} 
              className="h-2"
            />
          </div>

          {/* Individual Readiness Checks */}
          <div className="space-y-3">
            {readinessItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card/50">
                {getStatusIcon(item.status)}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{item.title}</span>
                    <span className={`text-xs ${getStatusColor(item.status)}`}>
                      {item.status === 'complete' ? 'Ready' : 
                       item.status === 'warning' ? 'Partial' : 'Needed'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.message}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Screening Estimates */}
          {canStartScreening && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-center">
                {estimatedTime && (
                  <div>
                    <Timer className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-sm font-medium">Est. Time</div>
                    <div className="text-xs text-muted-foreground">{estimatedTime}</div>
                  </div>
                )}
                {estimatedCost && (
                  <div>
                    <DollarSign className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-sm font-medium">Est. Cost</div>
                    <div className="text-xs text-muted-foreground">${estimatedCost.toFixed(2)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <Button 
              onClick={onStartScreening}
              disabled={!canStartScreening || isScreening}
              className="w-full"
              size="lg"
            >
              {isScreening ? (
                <>
                  <div className="animate-spin w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                  Screening in Progress...
                </>
              ) : canStartScreening ? (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Start AI Screening ({references.length} references)
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Complete Setup to Enable Screening
                </>
              )}
            </Button>
            
            {!canStartScreening && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                Complete the items above to enable AI screening
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};