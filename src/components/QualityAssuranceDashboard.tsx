import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface QualityMetric {
  id: string;
  metric_type: string;
  metric_value: number;
  benchmark_value: number | null;
  meets_threshold: boolean;
  measurement_date: string;
}

const QualityAssuranceDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [metrics] = useState<QualityMetric[]>([]); // Mock data for now
  const [loading, setLoading] = useState(false);

  // Mock quality metrics since we don't have the table yet
  const mockMetrics: QualityMetric[] = [
    {
      id: '1',
      metric_type: 'Inter-rater Reliability',
      metric_value: 0.85,
      benchmark_value: 0.80,
      meets_threshold: true,
      measurement_date: new Date().toISOString()
    },
    {
      id: '2',
      metric_type: 'Search Completeness',
      metric_value: 0.92,
      benchmark_value: 0.90,
      meets_threshold: true,
      measurement_date: new Date().toISOString()
    },
    {
      id: '3',
      metric_type: 'Data Extraction Accuracy',
      metric_value: 0.88,
      benchmark_value: 0.85,
      meets_threshold: true,
      measurement_date: new Date().toISOString()
    }
  ];

  const generateReport = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Mock functionality - would save to quality_assurance_metrics table when available
      toast({
        title: "Success",
        description: "Quality assurance report generated (demo mode)",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const displayMetrics = metrics.length > 0 ? metrics : mockMetrics;

  const overallScore = displayMetrics.length > 0 
    ? displayMetrics.reduce((acc, m) => acc + m.metric_value, 0) / displayMetrics.length 
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quality Assurance Overview</CardTitle>
          <CardDescription>
            Monitor and maintain research quality standards across all project phases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{(overallScore * 100).toFixed(1)}%</div>
                <p className="text-sm text-muted-foreground">Overall Quality Score</p>
                <Progress value={overallScore * 100} className="mt-2" />
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{displayMetrics.filter(m => m.meets_threshold).length}</div>
                <p className="text-sm text-muted-foreground">Metrics Above Threshold</p>
                <Badge variant={displayMetrics.every(m => m.meets_threshold) ? "default" : "secondary"}>
                  {displayMetrics.every(m => m.meets_threshold) ? "All Passing" : "Needs Attention"}
                </Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{displayMetrics.length}</div>
                <p className="text-sm text-muted-foreground">Total Metrics Tracked</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Last updated: {displayMetrics[0]?.measurement_date ? new Date(displayMetrics[0].measurement_date).toLocaleDateString() : 'Never'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Quality Metrics</h3>
            {displayMetrics.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No quality metrics available yet</p>
                <Button onClick={generateReport} disabled={loading}>
                  {loading ? 'Generating...' : 'Generate Sample Report'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {displayMetrics.slice(0, 5).map((metric) => (
                  <Card key={metric.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">{metric.metric_type}</h4>
                          <p className="text-sm text-muted-foreground">
                            Target: {metric.benchmark_value ? (metric.benchmark_value * 100).toFixed(0) + '%' : 'Not set'}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold">
                            {(metric.metric_value * 100).toFixed(1)}%
                          </div>
                          <Badge variant={metric.meets_threshold ? "default" : "destructive"}>
                            {metric.meets_threshold ? "Pass" : "Fail"}
                          </Badge>
                        </div>
                      </div>
                      <Progress 
                        value={metric.metric_value * 100} 
                        className="mt-2" 
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Checkpoints</CardTitle>
          <CardDescription>Regulatory and methodological compliance status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 border rounded">
              <span>PRISMA Guidelines</span>
              <Badge variant="default">Compliant</Badge>
            </div>
            <div className="flex justify-between items-center p-3 border rounded">
              <span>Cochrane Standards</span>
              <Badge variant="secondary">In Progress</Badge>
            </div>
            <div className="flex justify-between items-center p-3 border rounded">
              <span>Data Protection</span>
              <Badge variant="default">Compliant</Badge>
            </div>
            <div className="flex justify-between items-center p-3 border rounded">
              <span>Ethics Approval</span>
              <Badge variant="outline">Pending</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QualityAssuranceDashboard;