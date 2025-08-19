import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, Zap, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ProgressStats {
  current: number;
  total: number;
  percentage: number;
  included: number;
  excluded: number;
  conflicts: number;
  estimatedTimeRemaining?: string;
}

interface CurrentReference {
  id: string;
  title: string;
  authors: string;
}

interface ScreeningProgressProps {
  isVisible: boolean;
  stats: ProgressStats;
  currentReference: CurrentReference | null;
  isComplete: boolean;
}

const ScreeningProgress: React.FC<ScreeningProgressProps> = ({
  isVisible,
  stats,
  currentReference,
  isComplete
}) => {
  if (!isVisible) return null;

  return (
    <Card className="w-full bg-card border-border">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Main Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {isComplete ? 'Screening Complete' : 'AI Screening Progress'}
              </h3>
              <Badge variant={isComplete ? "default" : "secondary"} className="text-sm">
                {stats.current} of {stats.total}
              </Badge>
            </div>
            
            <Progress 
              value={stats.percentage} 
              className="h-3"
            />
            
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{stats.percentage}% complete</span>
              {stats.estimatedTimeRemaining && !isComplete && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{stats.estimatedTimeRemaining} remaining</span>
                </div>
              )}
            </div>
          </div>

          {/* Current Reference Being Processed */}
          {currentReference && !isComplete && (
            <div className="p-3 bg-muted/50 rounded-lg border-l-4 border-primary">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground mb-1">
                    Currently analyzing:
                  </div>
                  <div className="text-sm text-foreground truncate">
                    {currentReference.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {currentReference.authors}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Included
                </span>
              </div>
              <div className="text-2xl font-bold text-green-600">{stats.included}</div>
            </div>

            <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  Excluded
                </span>
              </div>
              <div className="text-2xl font-bold text-red-600">{stats.excluded}</div>
            </div>

            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  Conflicts
                </span>
              </div>
              <div className="text-2xl font-bold text-yellow-600">{stats.conflicts}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScreeningProgress;