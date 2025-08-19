import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, XCircle, AlertCircle, BarChart3, Filter, Download, Users, Edit, FileText, Database, Settings } from 'lucide-react';
import Header from '@/components/Header';
import ReferenceCard from '@/components/ReferenceCard';
import CriteriaSummary from '@/components/CriteriaSummary';
import ScreeningLogs from '@/components/ScreeningLogs';
import ScreeningAnalytics from '@/components/ScreeningAnalytics';
import BulkReviewPanel from '@/components/BulkReviewPanel';
import ExportPanel from '@/components/ExportPanel';
import ScreeningProgress from '@/components/ScreeningProgress';
import ReasoningDisplay from '@/components/ReasoningDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DualLLMScreener } from '@/services/aiScreeningService';
import { useProject } from '@/contexts/ProjectContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

const ScreeningDashboard = () => {
  const [references, setReferences] = useState([]);
  const [screeningResults, setScreeningResults] = useState([]);
  const [isScreening, setIsScreening] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedProject, setSelectedProject] = useState(null);
  const [criteriaData, setCriteriaData] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [agreementFilter, setAgreementFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('references');
  const [currentReference, setCurrentReference] = useState(null);
  const [reasoningSteps, setReasoningSteps] = useState([]);
  const [showReasoningDisplay, setShowReasoningDisplay] = useState(false);
  const [screeningStats, setScreeningStats] = useState({
    current: 0,
    total: 0,
    percentage: 0,
    included: 0,
    excluded: 0,
    conflicts: 0
  });
  const { toast } = useToast();
  const { projectData } = useProject();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (projectData?.id) {
      loadReferences();
      loadProject();
    } else {
      // If no project in context, try to load the most recent project
      loadMostRecentProject();
    }
  }, [projectData]);

  // Auto-start screening if the autoStart flag is present and conditions are met
  useEffect(() => {
    const shouldAutoStart = searchParams.get('autoStart') === 'true';
    
    if (shouldAutoStart && selectedProject && criteriaData && references.length > 0 && !isScreening) {
      // Check if dual AI review is enabled
      if (selectedProject.dual_ai_review) {
        toast({
          title: "Auto-starting dual AI screening",
          description: "Dual AI review is enabled. Starting screening process automatically...",
        });
        
        // Clear the autoStart parameter from URL
        setSearchParams({});
        
        // Start screening after a short delay to allow UI to update
        setTimeout(() => {
          startScreening();
        }, 1000);
      }
    }
  }, [selectedProject, criteriaData, references, searchParams, isScreening]);

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
      
      // Load criteria data
      await loadCriteriaData(projectId);
    } catch (error) {
      console.error('Error loading project:', error);
    }
  };

  const loadCriteriaData = async (projectId: string) => {
    try {
      const { data: criteria, error } = await supabase
        .from('screening_criteria')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (criteria) {
        setCriteriaData(criteria);
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

  const startScreening = async () => {
    if (!criteriaData || references.length === 0) {
      toast({
        title: "Cannot start screening",
        description: "Please ensure criteria are set and references are loaded.",
        variant: "destructive",
      });
      return;
    }

    setIsScreening(true);
    setProgress(0);
    setScreeningResults([]);
    setShowReasoningDisplay(true);
    setReasoningSteps([]);
    
    // Initialize stats
    setScreeningStats({
      current: 0,
      total: references.length,
      percentage: 0,
      included: 0,
      excluded: 0,
      conflicts: 0
    });

    try {
      const referencesToScreen = references.map(ref => ({
        id: ref.id,
        title: ref.title,
        abstract: ref.abstract,
        authors: ref.authors,
        journal: ref.journal,
        year: ref.year,
        doi: ref.doi
      }));

      const results = await DualLLMScreener.bulkScreenReferences(
        referencesToScreen,
        criteriaData,
        selectedProject.id,
        (completed, total) => {
          const percentage = Math.round((completed / total) * 100);
          setProgress(percentage);
          
          // Update current reference being processed
          if (completed < referencesToScreen.length) {
            setCurrentReference({
              id: referencesToScreen[completed].id,
              title: referencesToScreen[completed].title,
              authors: referencesToScreen[completed].authors
            });
          }
          
          // Update stats
          const processedResults = results.slice(0, completed);
          const included = processedResults.filter(r => r.finalDecision === 'include').length;
          const excluded = processedResults.filter(r => r.finalDecision === 'exclude').length;
          const conflicts = processedResults.filter(r => !r.agreement).length;
          
          setScreeningStats({
            current: completed,
            total,
            percentage,
            included,
            excluded,
            conflicts
          });
        }
      );

      setScreeningResults(results);
      setCurrentReference(null);
      
      // Final stats update
      const included = results.filter(r => r.finalDecision === 'include').length;
      const excluded = results.filter(r => r.finalDecision === 'exclude').length;
      const conflicts = results.filter(r => !r.agreement).length;
      
      setScreeningStats({
        current: results.length,
        total: results.length,
        percentage: 100,
        included,
        excluded,
        conflicts
      });
      
      // Reload references to get updated status
      loadReferences();

      toast({
        title: "Screening Complete",
        description: `Processed ${results.length} references. Agreement rate: ${Math.round(DualLLMScreener.getAgreementRate(results) * 100)}%`,
      });

    } catch (error) {
      console.error('Error during screening:', error);
      toast({
        title: "Screening Error",
        description: error.message || "An error occurred during screening",
        variant: "destructive",
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

  // Filter references based on current filters
  const filteredReferences = references.filter(ref => {
    const result = screeningResults.find(r => r.reference_id === ref.id);
    
    // Status filter
    if (statusFilter !== 'all') {
      if (!result && statusFilter !== 'pending') return false;
      if (result && result.final_decision !== statusFilter && statusFilter !== 'pending') return false;
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
  
  const conflictCount = screeningResults.filter(result => !result.agreement).length;
  const includedCount = screeningResults.filter(result => result.final_decision === 'include').length;
  const excludedCount = screeningResults.filter(result => result.final_decision === 'exclude').length;

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
        {criteriaData && (
          <div className="mb-8">
            <CriteriaSummary 
              criteria={criteriaData} 
              onEdit={() => navigate('/criteria')}
            />
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
                disabled={isScreening || references.length === 0 || !criteriaData}
                size="lg"
              >
                {isScreening ? (
                  <>
                    <div className="animate-spin w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                    Screening... ({screeningStats.percentage}%)
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
            </div>
          </CardContent>
        </Card>

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
        <div className="flex border-b mb-6">
          {[
            { id: 'references', label: 'References', icon: FileText },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'logs', label: 'Logs', icon: Database },
            { id: 'review', label: 'Bulk Review', icon: Settings },
            { id: 'export', label: 'Export', icon: Download },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Progress Display */}
        {(isScreening || screeningResults.length > 0) && (
          <div className="mb-6">
            <ScreeningProgress
              isVisible={true}
              stats={screeningStats}
              currentReference={currentReference}
              isComplete={!isScreening && screeningResults.length > 0}
            />
          </div>
        )}

        {/* Live Reasoning Display */}
        {showReasoningDisplay && (
          <div className="mb-6">
            <ReasoningDisplay
              isVisible={showReasoningDisplay}
              currentReference={currentReference}
              reasoningSteps={reasoningSteps}
              progress={screeningStats}
            />
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'references' && (
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
                const result = screeningResults.find(r => r.reference_id === reference.id);
                
                return (
                  <ReferenceCard
                    key={reference.id}
                    reference={reference}
                    aiResult={result}
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
        )}

        {activeTab === 'analytics' && selectedProject && (
          <ScreeningAnalytics projectId={selectedProject.id} />
        )}

        {activeTab === 'logs' && selectedProject && (
          <ScreeningLogs projectId={selectedProject.id} />
        )}

        {activeTab === 'review' && selectedProject && (
          <BulkReviewPanel 
            projectId={selectedProject.id}
            references={references}
            screeningResults={screeningResults}
            onReviewComplete={loadReferences}
          />
        )}

        {activeTab === 'export' && selectedProject && (
          <ExportPanel
            projectId={selectedProject.id}
            references={references}
            screeningResults={screeningResults}
            analytics={null}
          />
        )}
      </main>
    </div>
  );
};

export default ScreeningDashboard;