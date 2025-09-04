import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const StatisticalAnalysis = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState({
    name: '',
    type: '',
    method: '',
    outcome_measures: '',
    interpretation: '',
    limitations: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // For now, save analysis plan to review_projects criteria
      const { error } = await supabase
        .from('review_projects')
        .insert({
          name: analysis.name,
          description: `${analysis.type} - ${analysis.method}`,
          criteria: {
            analysis_type: analysis.type,
            statistical_method: analysis.method,
            outcome_measures: analysis.outcome_measures.split('\n').filter(o => o.trim()),
            interpretation: analysis.interpretation,
            limitations: analysis.limitations
          },
          user_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Statistical analysis plan saved (demo mode)",
      });

      // Reset form
      setAnalysis({
        name: '',
        type: '',
        method: '',
        outcome_measures: '',
        interpretation: '',
        limitations: ''
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Statistical Analysis Planning</CardTitle>
          <CardDescription>
            Define statistical methods and analysis plans for systematic review
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Analysis Name</label>
              <Input
                value={analysis.name}
                onChange={(e) => setAnalysis({ ...analysis, name: e.target.value })}
                placeholder="Enter analysis name"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Analysis Type</label>
                <Select value={analysis.type} onValueChange={(value) => setAnalysis({ ...analysis, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select analysis type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta-analysis">Meta-analysis</SelectItem>
                    <SelectItem value="narrative-synthesis">Narrative Synthesis</SelectItem>
                    <SelectItem value="network-meta-analysis">Network Meta-analysis</SelectItem>
                    <SelectItem value="descriptive">Descriptive Analysis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Statistical Method</label>
                <Select value={analysis.method} onValueChange={(value) => setAnalysis({ ...analysis, method: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random-effects">Random Effects Model</SelectItem>
                    <SelectItem value="fixed-effects">Fixed Effects Model</SelectItem>
                    <SelectItem value="mantel-haenszel">Mantel-Haenszel</SelectItem>
                    <SelectItem value="inverse-variance">Inverse Variance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Outcome Measures</label>
              <Textarea
                value={analysis.outcome_measures}
                onChange={(e) => setAnalysis({ ...analysis, outcome_measures: e.target.value })}
                placeholder="List outcome measures (one per line)"
                rows={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Statistical Interpretation Plan</label>
              <Textarea
                value={analysis.interpretation}
                onChange={(e) => setAnalysis({ ...analysis, interpretation: e.target.value })}
                placeholder="How will results be interpreted?"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Known Limitations</label>
              <Textarea
                value={analysis.limitations}
                onChange={(e) => setAnalysis({ ...analysis, limitations: e.target.value })}
                placeholder="Expected limitations and how they will be addressed"
                rows={3}
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Analysis Plan'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meta-Analysis Results</CardTitle>
          <CardDescription>Statistical outcomes and effect measures</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">12</div>
                <p className="text-sm text-muted-foreground">Studies Included</p>
                <Badge variant="outline">RCTs: 8, Cohort: 4</Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">0.75</div>
                <p className="text-sm text-muted-foreground">Pooled Effect Size</p>
                <Badge variant="default">95% CI: 0.60-0.90</Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">35%</div>
                <p className="text-sm text-muted-foreground">Heterogeneity (I²)</p>
                <Badge variant="secondary">Moderate</Badge>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <h4 className="font-medium mb-3">Publication Bias Assessment</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 border rounded">
                <span className="text-sm">Funnel Plot</span>
                <Badge variant="outline">Asymmetric</Badge>
              </div>
              <div className="flex justify-between items-center p-2 border rounded">
                <span className="text-sm">Egger's Test</span>
                <Badge variant="destructive">p = 0.03</Badge>
              </div>
              <div className="flex justify-between items-center p-2 border rounded">
                <span className="text-sm">Trim-and-Fill</span>
                <Badge variant="secondary">3 studies imputed</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GRADE Assessment</CardTitle>
          <CardDescription>Quality of evidence evaluation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 border rounded">
              <span>Risk of Bias</span>
              <Badge variant="secondary">Moderate</Badge>
            </div>
            <div className="flex justify-between items-center p-3 border rounded">
              <span>Inconsistency</span>
              <Badge variant="default">Low</Badge>
            </div>
            <div className="flex justify-between items-center p-3 border rounded">
              <span>Indirectness</span>
              <Badge variant="default">Low</Badge>
            </div>
            <div className="flex justify-between items-center p-3 border rounded">
              <span>Imprecision</span>
              <Badge variant="default">Low</Badge>
            </div>
            <div className="flex justify-between items-center p-3 border rounded">
              <span>Publication Bias</span>
              <Badge variant="destructive">High</Badge>
            </div>
            <div className="flex justify-between items-center p-3 border rounded font-semibold">
              <span>Overall Quality</span>
              <Badge variant="secondary">Moderate</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatisticalAnalysis;