import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DualLLMScreener, type ScreeningReference, type DualScreeningResult } from "@/services/aiScreeningService";
import { Play, Pause, Users, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import Header from "@/components/Header";

const Screening = () => {
  const { toast } = useToast();
  const [references, setReferences] = useState<ScreeningReference[]>([]);
  const [screeningResults, setScreeningResults] = useState<DualScreeningResult[]>([]);
  const [isScreening, setIsScreening] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedProject, setSelectedProject] = useState<any>(null);

  useEffect(() => {
    loadReferences();
    loadProject();
  }, []);

  const loadProject = async () => {
    const { data: projects } = await supabase
      .from('review_projects')
      .select('*')
      .limit(1)
      .single();
    
    if (projects) {
      setSelectedProject(projects);
    }
  };

  const loadReferences = async () => {
    const { data } = await supabase
      .from('references')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setReferences(data.map(ref => ({
        id: ref.id,
        title: ref.title || '',
        abstract: ref.abstract || '',
        authors: ref.authors || '',
        journal: ref.journal,
        year: ref.year,
        doi: ref.doi
      })));
    }
  };

  const startScreening = async () => {
    if (!selectedProject) {
      toast({
        title: "No Project Selected",
        description: "Please select a project before starting screening.",
        variant: "destructive"
      });
      return;
    }

    setIsScreening(true);
    setProgress(0);
    
    try {
      const criteria = {
        population: selectedProject.population,
        intervention: selectedProject.intervention,
        comparator: selectedProject.comparator,
        outcome: selectedProject.outcome,
        studyDesigns: selectedProject.study_designs
      };

      const results = await DualLLMScreener.bulkScreenReferences(
        references,
        criteria,
        selectedProject.id,
        (completed, total) => {
          setProgress((completed / total) * 100);
        }
      );

      setScreeningResults(results);
      
      toast({
        title: "Screening Complete!",
        description: `Processed ${results.length} references with ${DualLLMScreener.getAgreementRate(results) * 100}% AI agreement rate.`
      });
    } catch (error) {
      toast({
        title: "Screening Error",
        description: "An error occurred during screening. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsScreening(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'include':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'exclude':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'conflict':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string, agreement: boolean) => {
    if (!agreement) {
      return <Badge variant="destructive">Conflict</Badge>;
    }
    
    switch (status) {
      case 'include':
        return <Badge variant="default" className="bg-success text-success-foreground">Include</Badge>;
      case 'exclude':
        return <Badge variant="secondary">Exclude</Badge>;
      default:
        return <Badge variant="outline">Maybe</Badge>;
    }
  };

  const agreementRate = screeningResults.length > 0 ? DualLLMScreener.getAgreementRate(screeningResults) : 0;
  const conflictCount = DualLLMScreener.getConflictResults(screeningResults).length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Dual LLM Screening Dashboard
          </h1>
          <p className="text-muted-foreground">
            AI-powered systematic review screening with dual reviewers
          </p>
        </div>

        {/* Screening Controls */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Screening Control Panel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Ready to screen {references.length} references
                </p>
                {isScreening && (
                  <div className="space-y-2">
                    <Progress value={progress} className="w-[300px]" />
                    <p className="text-sm text-muted-foreground">
                      Progress: {Math.round(progress)}%
                    </p>
                  </div>
                )}
              </div>
              
              <Button 
                onClick={startScreening}
                disabled={isScreening || references.length === 0}
                size="lg"
              >
                {isScreening ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Screening...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Dual AI Screening
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        {screeningResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-foreground">{screeningResults.length}</div>
                <p className="text-sm text-muted-foreground">Total Screened</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-success">{Math.round(agreementRate * 100)}%</div>
                <p className="text-sm text-muted-foreground">AI Agreement</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-warning">{conflictCount}</div>
                <p className="text-sm text-muted-foreground">Conflicts</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-primary">
                  {screeningResults.filter(r => r.finalDecision === 'include').length}
                </div>
                <p className="text-sm text-muted-foreground">Included</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* References List */}
        <Card>
          <CardHeader>
            <CardTitle>References & Screening Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {references.map((reference, index) => {
                const result = screeningResults.find(r => r.referenceId === reference.id);
                
                return (
                  <div key={reference.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground line-clamp-2">
                          {reference.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {reference.authors} • {reference.journal} • {reference.year}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {result && (
                          <>
                            {getStatusIcon(result.finalDecision)}
                            {getStatusBadge(result.finalDecision, result.agreement)}
                          </>
                        )}
                      </div>
                    </div>

                    {result && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-foreground">
                            {result.reviewer1.reviewer}
                          </h4>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {result.reviewer1.recommendation}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {Math.round(result.reviewer1.confidence * 100)}% confidence
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {result.reviewer1.reasoning}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-foreground">
                            {result.reviewer2.reviewer}
                          </h4>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {result.reviewer2.recommendation}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {Math.round(result.reviewer2.confidence * 100)}% confidence
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {result.reviewer2.reasoning}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Screening;