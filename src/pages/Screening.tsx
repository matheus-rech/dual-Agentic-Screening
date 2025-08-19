import React, { useState, useEffect } from 'react';
import { Play, Pause, CheckCircle, XCircle, AlertCircle, BarChart3, Filter, Download, Users, Edit, FileText, Database, Settings } from 'lucide-react';
import Header from '@/components/Header';
import ReferenceCard from '@/components/ReferenceCard';
import CriteriaSummary from '@/components/CriteriaSummary';
import ScreeningLogs from '@/components/ScreeningLogs';
import ScreeningAnalytics from '@/components/ScreeningAnalytics';
import BulkReviewPanel from '@/components/BulkReviewPanel';
import ExportPanel from '@/components/ExportPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DualLLMScreener } from '@/services/aiScreeningService';
import { useProject } from '@/contexts/ProjectContext';
import { useNavigate } from 'react-router-dom';

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
  const { toast } = useToast();
  const { projectData } = useProject();
  const navigate = useNavigate();

  useEffect(() => {
    if (projectData?.id) {
      loadReferences();
      loadProject();
    } else {
      // If no project in context, try to load the most recent project
      loadMostRecentProject();
    }
  }, [projectData]);

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
      // Fetch detailed criteria from screening_criteria table
      const { data: detailedCriteria, error: criteriaError } = await supabase
        .from('screening_criteria')
        .select('*')
        .eq('project_id', selectedProject.id)
        .single();

      if (criteriaError && criteriaError.code !== 'PGRST116') {
        throw criteriaError;
      }

      const criteria = {
        population: detailedCriteria?.population || selectedProject.population,
        intervention: detailedCriteria?.intervention || selectedProject.intervention,
        comparator: detailedCriteria?.comparator || selectedProject.comparator,
        outcome: detailedCriteria?.outcome || selectedProject.outcome,
        studyDesigns: detailedCriteria?.study_designs || selectedProject.study_designs,
        inclusionCriteria: detailedCriteria?.inclusion_criteria || [],
        exclusionCriteria: detailedCriteria?.exclusion_criteria || [],
        timeframeStart: detailedCriteria?.timeframe_start,
        timeframeEnd: detailedCriteria?.timeframe_end,
        timeframeDescription: detailedCriteria?.timeframe_description
      };

      const results = await DualLLMScreener.bulkScreenReferences(
        references.map(ref => ({
          id: ref.id,
          title: ref.title || '',
          abstract: ref.abstract || '',
          authors: ref.authors || '',
          journal: ref.journal,
          year: ref.year,
          doi: ref.doi
        })),
        criteria,
        selectedProject.id,
        (completed, total) => {
          setProgress((completed / total) * 100);
        }
      );

      setScreeningResults(results);
      
      toast({
        title: "Screening Complete!",
        description: `Processed ${results.length} references with ${(DualLLMScreener.getAgreementRate(results) * 100).toFixed(1)}% AI agreement rate.`
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