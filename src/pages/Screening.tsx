import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, XCircle, AlertCircle, BarChart3, Filter, Download, Users, Edit, FileText, Database, Settings, Clock } from 'lucide-react';
import { TabNotification } from '@/components/TabNotification';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/Header';
import ReferenceCard from '@/components/ReferenceCard';
import CriteriaSummary from '@/components/CriteriaSummary';
import ScreeningLogs from '@/components/ScreeningLogs';
import ScreeningAnalytics from '@/components/ScreeningAnalytics';
import BulkReviewPanel from '@/components/BulkReviewPanel';
import ExportPanel from '@/components/ExportPanel';

import ReasoningDisplay from '@/components/ReasoningDisplay';
import ReferenceDetailsPanel from '@/components/ReferenceDetailsPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DualLLMScreener } from '@/services/aiScreeningService';
import { useEnhancedScreening } from '@/hooks/useEnhancedScreening';
import { useProject } from '@/contexts/ProjectContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

const Screening = () => {
  const [references, setReferences] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [criteriaData, setCriteriaData] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [agreementFilter, setAgreementFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('references');
  const [hasNewAnalytics, setHasNewAnalytics] = useState(false);
  const [hasNewLogs, setHasNewLogs] = useState(false);
  const [lastResultsCount, setLastResultsCount] = useState(0);
  
  const { toast } = useToast();
  const { projectData } = useProject();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Use the enhanced screening hook
  const {
    isScreening,
    progress,
    results: screeningResults,
    error: screeningError,
    startScreening,
    resetScreening
  } = useEnhancedScreening();

  useEffect(() => {
    console.log('🚀 Initializing Screening component with project:', projectData?.id);
    if (projectData?.id) {
      console.log('📂 Loading project from context:', projectData.id);
      loadReferences();
      loadProject();
    } else {
      // If no project in context, try to load the most recent project
      console.log('📂 Loading most recent project');
      loadMostRecentProject();
    }
  }, [projectData]);

  // Auto-start screening if the autoStart flag is present and conditions are met
  useEffect(() => {
    const shouldAutoStart = searchParams.get('autoStart') === 'true';
    
    console.log('Auto-start check:', {
      shouldAutoStart,
      selectedProject: !!selectedProject,
      criteriaData: !!criteriaData,
      referencesLength: references.length,
      isScreening,
      dualAiReview: selectedProject?.dual_ai_review
    });
    
    if (shouldAutoStart && selectedProject && criteriaData && references.length > 0 && !isScreening) {
      // Check if dual AI review is enabled
      if (selectedProject.dual_ai_review) {
        console.log('Auto-starting screening...');
        toast({
          title: "Auto-starting dual AI screening",
          description: "Dual AI review is enabled. Starting screening process automatically...",
        });
        
        // Clear the autoStart parameter from URL
        setSearchParams({});
        
        // Start screening after a short delay to allow UI to update
        setTimeout(() => {
          handleStartScreening();
        }, 1000);
      } else {
        console.log('Dual AI review not enabled, skipping auto-start');
      }
    } else {
      console.log('Auto-start conditions not met');
    }
  }, [selectedProject, criteriaData, references, searchParams, isScreening]);

  // Track new results for tab notifications
  useEffect(() => {
    if (screeningResults.length > lastResultsCount) {
      setHasNewAnalytics(true);
      setHasNewLogs(true);
      setLastResultsCount(screeningResults.length);
    }
  }, [screeningResults.length, lastResultsCount]);

  // Reset notifications when switching tabs
  const handleTabChange = React.useCallback((tabValue: string) => {
    setActiveTab(tabValue);
    if (tabValue === 'analytics') {
      setHasNewAnalytics(false);
    } else if (tabValue === 'logs') {
      setHasNewLogs(false);
    }
  }, []);

  const loadMostRecentProject = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: projects, error } = await supabase
        .from('review_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (projects && projects.length > 0) {
        setSelectedProject(projects[0]);
        loadReferencesForProject(projects[0].id);
      }
    } catch (error) {
      console.error('Error loading recent project:', error);
    }
  };

  const loadProject = async () => {
    const projectId = projectData?.id;
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('review_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setSelectedProject(data);
      
      // Always load complete criteria from screening_criteria table
      // This ensures we get inclusion/exclusion criteria along with PICO elements
      await loadCriteriaData(projectId);
    } catch (error) {
      console.error('Error loading project:', error);
    }
  };

  const loadCriteriaData = async (projectId: string) => {
    try {
      console.log('🔍 Loading criteria for project:', projectId);
      const { data: criteria, error } = await supabase
        .from('screening_criteria')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (criteria) {
        console.log('✅ Criteria loaded from DB:', criteria);
        console.log('📋 Inclusion criteria:', criteria.inclusion_criteria);
        console.log('📋 Exclusion criteria:', criteria.exclusion_criteria);
        setCriteriaData(criteria);
      } else {
        console.log('❌ No criteria found for project:', projectId);
      }
    } catch (error) {
      console.error('Error loading criteria:', error);
    }
  };

  const loadReferences = async () => {
    const projectId = projectData?.id || selectedProject?.id;
    if (!projectId) return;
    
    await loadReferencesForProject(projectId);
  };

  const loadReferencesForProject = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('references')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReferences(data || []);
    } catch (error) {
      console.error('Error loading references:', error);
      toast({
        title: "Error loading references",
        description: "Failed to load references from database",
        variant: "destructive",
      });
    }
  };

  const handleStartScreening = async () => {
    if (!criteriaData || references.length === 0) {
      toast({
        title: "Cannot start screening",
        description: "Please ensure criteria are set and references are loaded.",
        variant: "destructive",
      });
      return;
    }

    // Add debug logging
    console.log('DEBUG: Starting screening process', {
      referencesCount: references.length,
      criteria: criteriaData,
      projectId: selectedProject?.id
    });

    try {
      await startScreening(
        references.map(ref => ({
          id: ref.id,
          title: ref.title || '',
          abstract: ref.abstract || '',
          authors: ref.authors || '',
          journal: ref.journal,
          year: ref.year,
          doi: ref.doi
        })),
        {
          population: criteriaData.population,
          intervention: criteriaData.intervention,
          comparator: criteriaData.comparator,
          outcome: criteriaData.outcome,
          studyDesigns: criteriaData.study_designs || criteriaData.studyDesigns
        },
        selectedProject.id
      );
      
      if (!screeningError) {
        toast({
          title: "Screening Complete",
          description: `Processed ${references.length} references successfully.`,
        });
        loadReferences(); // Reload to get updated results
      }
    } catch (error) {
      console.error('DEBUG: Error starting screening:', error);
      toast({
        title: "Screening Failed",
        description: `Failed to start screening: ${error.message}`,
        variant: "destructive",
      });
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

  // Filter references based on current filters
  const filteredReferences = references.filter(ref => {
    const result = screeningResults.find(r => r.id === ref.id);
    
    // Status filter
    if (statusFilter !== 'all') {
      if (!result && statusFilter !== 'pending') return false;
      if (result && result.finalDecision !== statusFilter && statusFilter !== 'pending') return false;
      if (statusFilter === 'pending' && result) return false;
    }
    
    // Agreement filter
    if (agreementFilter !== 'all') {
      if (!result) return agreementFilter === 'pending';
      if (agreementFilter === 'agreement' && !result.agreement) return false;
      if (agreementFilter === 'conflict' && result.agreement) return false;
    }
    
    return true;
  });

  // Calculate statistics
  const agreementRate = screeningResults.length > 0 
    ? (screeningResults.filter(result => result.agreement).length / screeningResults.length * 100).toFixed(1)
    : 0;
  
  const conflictCount = progress.stats.conflicts || screeningResults.filter(result => !result.agreement).length;
  const includedCount = progress.stats.included || screeningResults.filter(result => result.finalDecision === 'include').length;
  const excludedCount = progress.stats.excluded || screeningResults.filter(result => result.finalDecision === 'exclude').length;

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

        {/* Criteria Summary */}
        {criteriaData ? (
          <div className="mb-8">
            <CriteriaSummary 
              criteria={criteriaData} 
              onEdit={() => navigate('/criteria')}
            />
          </div>
        ) : (
          <div className="mb-8">
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <p>Loading screening criteria...</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Screening Controls */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Screening Control Panel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Ready to screen {references.length} references
                  </p>
                  {!criteriaData && (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">Define criteria before screening</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => navigate('/criteria')}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Define Criteria
                      </Button>
                    </div>
                  )}
                </div>
                
                <Button 
                  onClick={handleStartScreening}
                  disabled={isScreening || references.length === 0 || !criteriaData}
                  size="lg"
                >
                  {isScreening ? (
                    <>
                      <div className="animate-spin w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                      Screening...
                    </>
                  ) : screeningResults.length > 0 ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Screening Complete
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start AI Screening
                    </>
                  )}
                </Button>
                
                {screeningError && (
                  <div className="text-sm text-destructive mt-2">
                    Error: {screeningError}
                  </div>
                )}
              </div>

            </div>
          </CardContent>
        </Card>


        {/* Live Reasoning Display */}
        <ReasoningDisplay 
          isVisible={isScreening || progress.reasoningSteps.length > 0}
          currentReference={progress.currentReference}
          reasoningSteps={progress.reasoningSteps}
          progress={progress.stats}
        />

        {/* Reference Details with AI Reasoning */}
        {!isScreening && references.length > 0 && (
          <ReferenceDetailsPanel references={references} />
        )}

        {/* Results Summary */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Screening Results Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{references.length}</div>
                <div className="text-sm text-muted-foreground">Total References</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{screeningResults.length}</div>
                <div className="text-sm text-muted-foreground">Screened</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{includedCount}</div>
                <div className="text-sm text-muted-foreground">Included</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{excludedCount}</div>
                <div className="text-sm text-muted-foreground">Excluded</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{conflictCount}</div>
                <div className="text-sm text-muted-foreground">Conflicts</div>
              </div>
            </div>
            
            {screeningResults.length > 0 && (
              <div className="mt-4 p-3 bg-secondary/50 rounded-md">
                <div className="text-sm text-muted-foreground">
                  AI Agreement Rate: <span className="font-medium text-foreground">{agreementRate}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="references" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              References
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TabNotification hasNewData={hasNewAnalytics}>
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabNotification>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <TabNotification hasNewData={hasNewLogs}>
                <Clock className="w-4 h-4" />
                Logs
              </TabNotification>
            </TabsTrigger>
            <TabsTrigger value="review" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Bulk Review
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </TabsTrigger>
          </TabsList>


          {/* Tab Content */}
          <TabsContent value="references">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  References ({filteredReferences.length} of {references.length})
                </CardTitle>
              </CardHeader>
           <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="include">Include</SelectItem>
                  <SelectItem value="exclude">Exclude</SelectItem>
                </SelectContent>
              </Select>
              <Select value={agreementFilter} onValueChange={setAgreementFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Agreement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agreement</SelectItem>
                  <SelectItem value="agreement">Agreement</SelectItem>
                  <SelectItem value="conflict">Conflict</SelectItem>
                  <SelectItem value="pending">Not Screened</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              {filteredReferences.map((reference) => {
                const result = screeningResults.find(r => r.id === reference.id);
                
                // Convert DualScreeningResult to expected format for ReferenceCard
                const aiResult = result ? {
                  final_decision: result.finalDecision,
                  agreement: result.agreement,
                  primary_reviewer: {
                    decision: result.primaryReviewer.decision,
                    confidence: result.primaryReviewer.confidence,
                    reasoning: result.primaryReviewer.reasoning
                  },
                  secondary_reviewer: {
                    decision: result.secondaryReviewer.decision,
                    confidence: result.secondaryReviewer.confidence,
                    reasoning: result.secondaryReviewer.reasoning
                  }
                } : null;
                
                return (
                  <ReferenceCard
                    key={reference.id}
                    reference={reference}
                    aiResult={aiResult}
                  />
                );
              })}
              
              {filteredReferences.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {references.length === 0 
                    ? "No references available. Please import references first."
                    : "No references match the current filters."
                  }
                </div>
              )}
            </div>
            </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            {selectedProject && <ScreeningAnalytics projectId={selectedProject.id} />}
          </TabsContent>

          <TabsContent value="logs">
            {selectedProject && <ScreeningLogs projectId={selectedProject.id} />}
          </TabsContent>

          <TabsContent value="review">
            {selectedProject && (
              <BulkReviewPanel 
                projectId={selectedProject.id}
                references={references}
                screeningResults={screeningResults}
                onReviewComplete={loadReferences}
              />
            )}
          </TabsContent>

          <TabsContent value="export">
            {selectedProject && (
              <ExportPanel
                projectId={selectedProject.id}
                references={references}
                screeningResults={screeningResults}
                analytics={null}
              />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Screening;