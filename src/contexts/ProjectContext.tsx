import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CriteriaData {
  population?: string;
  intervention?: string;
  comparator?: string;
  outcome?: string;
  study_designs?: string[];
  timeframe_start?: string;
  timeframe_end?: string;
  timeframe_description?: string;
  inclusion_criteria?: string[];
  exclusion_criteria?: string[];
  use_advanced_ai?: boolean;
  dual_ai_review?: boolean;
}

interface ProjectData {
  id?: string;
  name: string;
  description?: string;
  importFormat: string;
  uploadedFile?: File;
  references?: any[];
  status?: string;
  criteria?: CriteriaData;
  total_references?: number;
}

interface ProjectContextType {
  projectData: ProjectData;
  setProjectData: (data: Partial<ProjectData>) => void;
  setCriteriaData: (criteria: Partial<CriteriaData>) => void;
  clearProject: () => void;
  saveProject: () => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
  isLoading: boolean;
  lastSaved?: Date;
  hasUnsavedChanges: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

interface ProjectProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'project_session_backup';

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const [projectData, setProjectDataState] = useState<ProjectData>({
    name: '',
    importFormat: 'auto-detect',
    status: 'draft',
    criteria: {}
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  // Auto-save functionality with debouncing
  const autoSave = useCallback(async (data: ProjectData) => {
    if (!data.id || !hasUnsavedChanges) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('review_projects')
        .update({
          name: data.name,
          description: data.description,
          population: data.criteria?.population,
          intervention: data.criteria?.intervention,
          comparator: data.criteria?.comparator,
          outcome: data.criteria?.outcome,
          study_designs: data.criteria?.study_designs,
          timeframe_start: data.criteria?.timeframe_start,
          timeframe_end: data.criteria?.timeframe_end,
          timeframe_description: data.criteria?.timeframe_description,
          use_advanced_ai: data.criteria?.use_advanced_ai,
          dual_ai_review: data.criteria?.dual_ai_review,
          status: data.status
        })
        .eq('id', data.id);

      if (error) throw error;

      // Update criteria in separate table if they exist
      if (data.criteria && Object.keys(data.criteria).length > 0) {
        const { error: criteriaError } = await supabase
          .from('screening_criteria')
          .upsert({
            project_id: data.id,
            population: data.criteria.population,
            intervention: data.criteria.intervention,
            comparator: data.criteria.comparator,
            outcome: data.criteria.outcome,
            study_designs: data.criteria.study_designs,
            timeframe_start: data.criteria.timeframe_start,
            timeframe_end: data.criteria.timeframe_end,
            timeframe_description: data.criteria.timeframe_description,
            inclusion_criteria: data.criteria.inclusion_criteria,
            exclusion_criteria: data.criteria.exclusion_criteria
          }, {
            onConflict: 'project_id'
          });

        if (criteriaError) throw criteriaError;
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Auto-save error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [hasUnsavedChanges]);

  // Debounced auto-save
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      autoSave(projectData);
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [projectData, autoSave]);

  // Save to localStorage as backup
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projectData));
  }, [projectData]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsedData = JSON.parse(stored);
        if (parsedData.id) {
          setProjectDataState(parsedData);
        }
      } catch (error) {
        console.error('Error loading from localStorage:', error);
      }
    }
  }, []);

  const setProjectData = useCallback((data: Partial<ProjectData>) => {
    setProjectDataState(prev => ({ ...prev, ...data }));
    setHasUnsavedChanges(true);
  }, []);

  const setCriteriaData = useCallback((criteria: Partial<CriteriaData>) => {
    setProjectDataState(prev => ({ 
      ...prev, 
      criteria: { ...prev.criteria, ...criteria }
    }));
    setHasUnsavedChanges(true);
  }, []);

  const saveProject = useCallback(async () => {
    if (!projectData.id) return;

    setIsLoading(true);
    try {
      await autoSave(projectData);
      toast({
        title: "Project saved",
        description: "Your progress has been saved successfully"
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Unable to save project. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectData, autoSave, toast]);

  const loadProject = useCallback(async (projectId: string) => {
    setIsLoading(true);
    try {
      // Load project data
      const { data: project, error: projectError } = await supabase
        .from('review_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // Load criteria data
      const { data: criteria, error: criteriaError } = await supabase
        .from('screening_criteria')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (criteriaError) throw criteriaError;

      // Load references count
      const { count: referencesCount } = await supabase
        .from('references')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId);

      const combinedData: ProjectData = {
        id: project.id,
        name: project.name,
        description: project.description,
        importFormat: 'auto-detect',
        status: project.status,
        total_references: referencesCount || 0,
        criteria: criteria ? {
          population: criteria.population,
          intervention: criteria.intervention,
          comparator: criteria.comparator,
          outcome: criteria.outcome,
          study_designs: criteria.study_designs,
          timeframe_start: criteria.timeframe_start,
          timeframe_end: criteria.timeframe_end,
          timeframe_description: criteria.timeframe_description,
          inclusion_criteria: Array.isArray(criteria.inclusion_criteria) 
            ? criteria.inclusion_criteria.filter(item => typeof item === 'string') as string[]
            : [],
          exclusion_criteria: Array.isArray(criteria.exclusion_criteria) 
            ? criteria.exclusion_criteria.filter(item => typeof item === 'string') as string[]
            : [],
          use_advanced_ai: project.use_advanced_ai,
          dual_ai_review: project.dual_ai_review
        } : {}
      };

      setProjectDataState(combinedData);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());

    } catch (error) {
      console.error('Error loading project:', error);
      toast({
        title: "Load failed",
        description: "Unable to load project data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const clearProject = useCallback(() => {
    setProjectDataState({
      name: '',
      importFormat: 'auto-detect',
      status: 'draft',
      criteria: {}
    });
    setHasUnsavedChanges(false);
    setLastSaved(undefined);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <ProjectContext.Provider value={{ 
      projectData, 
      setProjectData, 
      setCriteriaData,
      clearProject,
      saveProject,
      loadProject,
      isLoading,
      lastSaved,
      hasUnsavedChanges
    }}>
      {children}
    </ProjectContext.Provider>
  );
};