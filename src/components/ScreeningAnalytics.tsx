import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, Brain, PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface AnalyticsData {
  totalScreened: number;
  agreementRate: number;
  avgConfidenceOpenAI: number;
  avgConfidenceGemini: number;
  avgProcessingTime: number;
  decisionDistribution: {
    include: number;
    exclude: number;
    uncertain: number;
  };
  conflictAnalysis: {
    total: number;
    lowConfidenceConflicts: number;
    highConfidenceConflicts: number;
  };
  modelPerformance: {
    openai: {
      include: number;
      exclude: number;
      uncertain: number;
      avgConfidence: number;
    };
    gemini: {
      include: number;
      exclude: number;
      uncertain: number;
      avgConfidence: number;
    };
  };
}

interface ScreeningAnalyticsProps {
  projectId: string;
}

const ScreeningAnalytics = ({ projectId }: ScreeningAnalyticsProps) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [projectId]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_screening_log')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;

      if (data && data.length > 0) {
        const analyticsData = calculateAnalytics(data);
        setAnalytics(analyticsData);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (logs: any[]): AnalyticsData => {
    const totalScreened = logs.length;
    
    // Agreement rate
    const agreementCount = logs.filter(log => 
      log.primary_model_decision === log.secondary_model_decision
    ).length;
    const agreementRate = totalScreened > 0 ? (agreementCount / totalScreened) * 100 : 0;

    // Average confidence scores
    const avgConfidenceOpenAI = logs.reduce((sum, log) => 
      sum + (log.primary_model_confidence || 0), 0) / totalScreened * 100;
    const avgConfidenceGemini = logs.reduce((sum, log) => 
      sum + (log.secondary_model_confidence || 0), 0) / totalScreened * 100;

    // Average processing time
    const validDurations = logs.filter(log => log.processing_duration_ms);
    const avgProcessingTime = validDurations.length > 0 
      ? validDurations.reduce((sum, log) => sum + log.processing_duration_ms, 0) / validDurations.length
      : 0;

    // Decision distribution
    const decisionDistribution = {
      include: logs.filter(log => log.final_decision === 'include').length,
      exclude: logs.filter(log => log.final_decision === 'exclude').length,
      uncertain: logs.filter(log => log.final_decision === 'uncertain').length,
    };

    // Conflict analysis
    const conflicts = logs.filter(log => 
      log.primary_model_decision !== log.secondary_model_decision
    );
    const lowConfidenceConflicts = conflicts.filter(log => 
      (log.primary_model_confidence < 0.7) || (log.secondary_model_confidence < 0.7)
    ).length;
    const highConfidenceConflicts = conflicts.length - lowConfidenceConflicts;

    // Model performance
    const openaiDecisions = {
      include: logs.filter(log => log.primary_model_decision === 'include').length,
      exclude: logs.filter(log => log.primary_model_decision === 'exclude').length,
      uncertain: logs.filter(log => log.primary_model_decision === 'uncertain').length,
    };

    const geminiDecisions = {
      include: logs.filter(log => log.secondary_model_decision === 'include').length,
      exclude: logs.filter(log => log.secondary_model_decision === 'exclude').length,
      uncertain: logs.filter(log => log.secondary_model_decision === 'uncertain').length,
    };

    return {
      totalScreened,
      agreementRate,
      avgConfidenceOpenAI,
      avgConfidenceGemini,
      avgProcessingTime,
      decisionDistribution,
      conflictAnalysis: {
        total: conflicts.length,
        lowConfidenceConflicts,
        highConfidenceConflicts,
      },
      modelPerformance: {
        openai: {
          ...openaiDecisions,
          avgConfidence: avgConfidenceOpenAI,
        },
        gemini: {
          ...geminiDecisions,
          avgConfidence: avgConfidenceGemini,
        },
      },
    };
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Loading analytics...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics || analytics.totalScreened === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            No screening data available for analytics.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Screened</p>
                <p className="text-2xl font-bold">{analytics.totalScreened}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Agreement Rate</p>
                <p className="text-2xl font-bold">{analytics.agreementRate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Processing</p>
                <p className="text-2xl font-bold">{formatTime(analytics.avgProcessingTime)}</p>
              </div>
              <Clock className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Conflicts</p>
                <p className="text-2xl font-bold">{analytics.conflictAnalysis.total}</p>
              </div>
              <Brain className="w-8 h-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Performance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Model Performance Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">OpenAI GPT-4</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Average Confidence</span>
                  <Badge variant="outline">{analytics.modelPerformance.openai.avgConfidence.toFixed(1)}%</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Include decisions</span>
                    <span>{analytics.modelPerformance.openai.include}</span>
                  </div>
                  <Progress 
                    value={(analytics.modelPerformance.openai.include / analytics.totalScreened) * 100} 
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Exclude decisions</span>
                    <span>{analytics.modelPerformance.openai.exclude}</span>
                  </div>
                  <Progress 
                    value={(analytics.modelPerformance.openai.exclude / analytics.totalScreened) * 100} 
                    className="h-2"
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Google Gemini</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Average Confidence</span>
                  <Badge variant="outline">{analytics.modelPerformance.gemini.avgConfidence.toFixed(1)}%</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Include decisions</span>
                    <span>{analytics.modelPerformance.gemini.include}</span>
                  </div>
                  <Progress 
                    value={(analytics.modelPerformance.gemini.include / analytics.totalScreened) * 100} 
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Exclude decisions</span>
                    <span>{analytics.modelPerformance.gemini.exclude}</span>
                  </div>
                  <Progress 
                    value={(analytics.modelPerformance.gemini.exclude / analytics.totalScreened) * 100} 
                    className="h-2"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Decision Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Final Decision Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-success rounded-full"></div>
                <span className="text-sm">Include</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">{analytics.decisionDistribution.include}</span>
                <Badge variant="outline">
                  {((analytics.decisionDistribution.include / analytics.totalScreened) * 100).toFixed(1)}%
                </Badge>
              </div>
            </div>
            <Progress 
              value={(analytics.decisionDistribution.include / analytics.totalScreened) * 100}
              className="h-2"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-destructive rounded-full"></div>
                <span className="text-sm">Exclude</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">{analytics.decisionDistribution.exclude}</span>
                <Badge variant="outline">
                  {((analytics.decisionDistribution.exclude / analytics.totalScreened) * 100).toFixed(1)}%
                </Badge>
              </div>
            </div>
            <Progress 
              value={(analytics.decisionDistribution.exclude / analytics.totalScreened) * 100}
              className="h-2"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-warning rounded-full"></div>
                <span className="text-sm">Uncertain</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">{analytics.decisionDistribution.uncertain}</span>
                <Badge variant="outline">
                  {((analytics.decisionDistribution.uncertain / analytics.totalScreened) * 100).toFixed(1)}%
                </Badge>
              </div>
            </div>
            <Progress 
              value={(analytics.decisionDistribution.uncertain / analytics.totalScreened) * 100}
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Conflict Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Conflict Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-destructive">{analytics.conflictAnalysis.total}</div>
              <div className="text-sm text-muted-foreground">Total Conflicts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{analytics.conflictAnalysis.lowConfidenceConflicts}</div>
              <div className="text-sm text-muted-foreground">Low Confidence</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{analytics.conflictAnalysis.highConfidenceConflicts}</div>
              <div className="text-sm text-muted-foreground">High Confidence</div>
            </div>
          </div>
          
          {analytics.conflictAnalysis.total > 0 && (
            <div className="mt-4 p-3 bg-destructive/10 rounded-md">
              <p className="text-sm text-destructive">
                {analytics.conflictAnalysis.highConfidenceConflicts > 0 && 
                  `${analytics.conflictAnalysis.highConfidenceConflicts} high-confidence conflicts require manual review.`
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScreeningAnalytics;