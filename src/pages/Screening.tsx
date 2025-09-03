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
import { SystemStatusDashboard } from '@/components/SystemStatusDashboard';
import { EnhancedErrorDisplay } from '@/components/EnhancedErrorDisplay';
import { ScreeningReadinessCheck } from '@/components/ScreeningReadinessCheck';
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
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
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
    const initializeScreen = async () => {
      setIsInitializing(true);
      setInitializationError(null);
      
      try {
        console.log('🚀 Initializing Screening component with project:', projectData?.id);
        if (projectData?.id) {
          console.log('📂 Loading project from context:', projectData.id);
          await Promise.all([loadReferences(), loadProject()]);
        } else {
          // If no project in context, try to load the most recent project
          console.log('📂 Loading most recent project');
          await loadMostRecentProject();
        }
      } catch (error) {
        console.error('Initialization error:', error);
        setInitializationError(error instanceof Error ? error.message : 'Failed to initialize screening');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeScreen();
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
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        setInitializationError(`Failed to load screening criteria: ${error.message}`);
        throw error;
      }

      if (criteria) {
        console.log('✅ Criteria loaded from DB:', criteria);
        setCriteriaData(criteria);
        const inclusionCount = Array.isArray(criteria.inclusion_criteria) ? criteria.inclusion_criteria.length : 0;
        const exclusionCount = Array.isArray(criteria.exclusion_criteria) ? criteria.exclusion_criteria.length : 0;
        toast({
          title: "Criteria loaded",
          description: `Loaded ${inclusionCount} inclusion and ${exclusionCount} exclusion criteria`,
        });
      } else {
        console.log('❌ No criteria found for project:', projectId);
        // Try to load from project context as fallback
        if (projectData?.criteria) {
          console.log('📋 Using criteria from project context');
          setCriteriaData(projectData.criteria);
        } else {
          toast({
            title: "No screening criteria found",
            description: "Please define screening criteria to enable AI analysis",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Error loading criteria:', error);
      setInitializationError(error instanceof Error ? error.message : 'Failed to load criteria');
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

        {/* System Status Dashboard */}
        <SystemStatusDashboard 
          projectId={selectedProject?.id}
          criteriaData={criteriaData}
          references={references}
          onRetry={() => window.location.reload()}
        />

        {/* Initialization Error Display */}
        {initializationError && (
          <EnhancedErrorDisplay 
            error={initializationError}
            context="System Initialization"
            onRetry={() => {
              setInitializationError(null);
              window.location.reload();
            }}
            onDismiss={() => setInitializationError(null)}
          />
        )}

        {/* Screening Error Display */}
        {screeningError && (
          <EnhancedErrorDisplay 
            error={screeningError}
            context="AI Screening Process"
            onRetry={() => {
              resetScreening();
              handleStartScreening();
            }}
            onDismiss={() => resetScreening()}
          />
        )}

        {/* Criteria Summary */}
        {criteriaData ? (
          <div className="mb-8">
            <CriteriaSummary 
              criteria={criteriaData} 
              onEdit={() => navigate('/criteria')}
            />
          </div>
        ) : !isInitializing && (
          <div className="mb-8">
            <Card className="bg-muted/50 border-warning">
              <CardContent className="pt-6">
                <div className="text-center">
                  <AlertCircle className="w-8 h-8 text-warning mx-auto mb-2" />
                  <p className="text-foreground font-medium">No screening criteria defined</p>
                  <p className="text-muted-foreground text-sm mb-4">
                    Define your screening criteria to enable AI-powered analysis
                  </p>
                  <Button onClick={() => navigate('/criteria')} variant="outline">
                    <Edit className="w-4 h-4 mr-2" />
                    Define Criteria
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Screening Readiness Check */}
        <ScreeningReadinessCheck 
          projectId={selectedProject?.id}
          criteriaData={criteriaData}
          references={references}
          isScreening={isScreening}
          onStartScreening={handleStartScreening}
          estimatedCost={references.length * 0.05} // Rough estimate
          estimatedTime={`${Math.ceil(references.length * 0.1)} minutes`}
        />


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