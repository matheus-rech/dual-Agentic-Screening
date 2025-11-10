import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Settings, Brain, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useProject } from "@/contexts/ProjectContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";

const studyTypes = [
  "Randomized Controlled Trial",
  "Systematic Review",
  "Meta-Analysis", 
  "Cohort Study",
  "Case-Control Study",
  "Cross-Sectional Study",
  "Case Series",
  "Case Report",
  "Observational Study",
  "Clinical Trial"
];

interface PICOTTData {
  population: string;
  intervention: string;
  comparator: string;
  outcome: string;
  timeframe_start: string;
  timeframe_end: string;
  timeframe_description: string;
  study_designs: string[];
  inclusion_criteria: string[];
  exclusion_criteria: string[];
  use_advanced_ai: boolean;
  dual_ai_review: boolean;
}

const Criteria = () => {
  const navigate = useNavigate();
  const { projectData, setCriteriaData } = useProject();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [criteriaData, setCriteriaDataState] = useState<PICOTTData>({
    population: "",
    intervention: "",
    comparator: "",
    outcome: "",
    timeframe_start: "",
    timeframe_end: "",
    timeframe_description: "",
    study_designs: [],
    inclusion_criteria: [""],
    exclusion_criteria: [""],
    use_advanced_ai: false,
    dual_ai_review: false,
  });

  useEffect(() => {
    if (!projectData.id) {
      toast({
        title: "No project found",
        description: "Please start from the import page",
        variant: "destructive",
      });
      navigate('/');
      return;
    } else {
      // Load existing criteria from project context or database
      loadExistingCriteria();
    }
  }, [projectData.id, navigate, toast]);

  // Load from project context first, then from database if needed
  useEffect(() => {
    if (projectData.criteria && Object.keys(projectData.criteria).length > 0) {
      setCriteriaDataState({
        population: projectData.criteria.population || '',
        intervention: projectData.criteria.intervention || '',
        comparator: projectData.criteria.comparator || '',
        outcome: projectData.criteria.outcome || '',
        timeframe_start: projectData.criteria.timeframe_start || '',
        timeframe_end: projectData.criteria.timeframe_end || '',
        timeframe_description: projectData.criteria.timeframe_description || '',
        study_designs: projectData.criteria.study_designs || [],
        inclusion_criteria: projectData.criteria.inclusion_criteria?.length ? projectData.criteria.inclusion_criteria : [''],
        exclusion_criteria: projectData.criteria.exclusion_criteria?.length ? projectData.criteria.exclusion_criteria : [''],
        use_advanced_ai: projectData.criteria.use_advanced_ai || false,
        dual_ai_review: projectData.criteria.dual_ai_review || false,
      });
    }
  }, [projectData.criteria]);

  const loadExistingCriteria = async () => {
    // Skip if we already have criteria in context
    if (projectData.criteria && Object.keys(projectData.criteria).length > 0) {
      return;
    }

    try {
      const { data: criteria, error } = await supabase
        .from('screening_criteria')
        .select('*')
        .eq('project_id', projectData.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (criteria) {
        const loadedCriteria = {
          population: criteria.population || '',
          intervention: criteria.intervention || '',
          comparator: criteria.comparator || '',
          outcome: criteria.outcome || '',
          timeframe_start: criteria.timeframe_start || '',
          timeframe_end: criteria.timeframe_end || '',
          timeframe_description: criteria.timeframe_description || '',
          study_designs: Array.isArray(criteria.study_designs) ? criteria.study_designs.map(s => String(s)) : [],
          inclusion_criteria: Array.isArray(criteria.inclusion_criteria) ? criteria.inclusion_criteria.map(s => String(s)) : [''],
          exclusion_criteria: Array.isArray(criteria.exclusion_criteria) ? criteria.exclusion_criteria.map(s => String(s)) : [''],
          use_advanced_ai: false,
          dual_ai_review: true
        };
        
        setCriteriaDataState(loadedCriteria);
        // Also update the project context
        setCriteriaData(loadedCriteria);
      }
    } catch (error) {
      console.error('Error loading existing criteria:', error);
    }
  };

  const handleInputChange = (field: keyof PICOTTData, value: any) => {
    setCriteriaDataState(prev => ({ ...prev, [field]: value }));
    // Auto-update project context
    setCriteriaData({ [field]: value });
  };

  const handleStudyDesignChange = (studyType: string, checked: boolean) => {
    const newStudyDesigns = checked 
      ? [...criteriaData.study_designs, studyType]
      : criteriaData.study_designs.filter(type => type !== studyType);
    
    setCriteriaDataState(prev => ({
      ...prev,
      study_designs: newStudyDesigns
    }));
    setCriteriaData({ study_designs: newStudyDesigns });
  };

  const handleCriteriaChange = (type: 'inclusion' | 'exclusion', index: number, value: string) => {
    const field = type === 'inclusion' ? 'inclusion_criteria' : 'exclusion_criteria';
    const newCriteria = criteriaData[field].map((item, i) => i === index ? value : item);
    
    setCriteriaDataState(prev => ({
      ...prev,
      [field]: newCriteria
    }));
    setCriteriaData({ [field]: newCriteria });
  };

  const addCriteria = (type: 'inclusion' | 'exclusion') => {
    const field = type === 'inclusion' ? 'inclusion_criteria' : 'exclusion_criteria';
    const newCriteria = [...criteriaData[field], ""];
    
    setCriteriaDataState(prev => ({
      ...prev,
      [field]: newCriteria
    }));
    setCriteriaData({ [field]: newCriteria });
  };

  const removeCriteria = (type: 'inclusion' | 'exclusion', index: number) => {
    const field = type === 'inclusion' ? 'inclusion_criteria' : 'exclusion_criteria';
    const newCriteria = criteriaData[field].filter((_, i) => i !== index);
    
    setCriteriaDataState(prev => ({
      ...prev,
      [field]: newCriteria
    }));
    setCriteriaData({ [field]: newCriteria });
  };

  const validateCriteria = () => {
    const errors = [];
    
    if (!criteriaData.population.trim()) errors.push("Population is required");
    if (!criteriaData.intervention.trim()) errors.push("Intervention is required");
    if (!criteriaData.outcome.trim()) errors.push("Outcome is required");
    if (criteriaData.study_designs.length === 0) errors.push("At least one study design must be selected");
    
    const validInclusion = criteriaData.inclusion_criteria.filter(c => c.trim());
    const validExclusion = criteriaData.exclusion_criteria.filter(c => c.trim());
    
    if (validInclusion.length === 0) errors.push("At least one inclusion criterion is required");
    
    return errors;
  };

  const handleSaveCriteria = async () => {
    const errors = validateCriteria();
    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Update the review project with PICO-TT data
      const { error: projectError } = await supabase
        .from('review_projects')
        .update({
          population: criteriaData.population,
          intervention: criteriaData.intervention,
          comparator: criteriaData.comparator,
          outcome: criteriaData.outcome,
          timeframe_start: criteriaData.timeframe_start,
          timeframe_end: criteriaData.timeframe_end,
          timeframe_description: criteriaData.timeframe_description,
          study_designs: criteriaData.study_designs,
          use_advanced_ai: criteriaData.use_advanced_ai,
          dual_ai_review: criteriaData.dual_ai_review,
          status: 'criteria_defined'
        })
        .eq('id', projectData.id);

      if (projectError) throw projectError;

      // Create or update screening criteria
      const { error: criteriaError } = await supabase
        .from('screening_criteria')
        .upsert({
          project_id: projectData.id,
          population: criteriaData.population,
          intervention: criteriaData.intervention,
          comparator: criteriaData.comparator,
          outcome: criteriaData.outcome,
          timeframe_start: criteriaData.timeframe_start,
          timeframe_end: criteriaData.timeframe_end,
          timeframe_description: criteriaData.timeframe_description,
          study_designs: criteriaData.study_designs,
          inclusion_criteria: criteriaData.inclusion_criteria.filter(c => c.trim()),
          exclusion_criteria: criteriaData.exclusion_criteria.filter(c => c.trim())
        });

      if (criteriaError) throw criteriaError;

      // Update project context with the saved criteria
      setCriteriaData({
        population: criteriaData.population,
        intervention: criteriaData.intervention,
        comparator: criteriaData.comparator,
        outcome: criteriaData.outcome,
        study_designs: criteriaData.study_designs,
        timeframe_start: criteriaData.timeframe_start,
        timeframe_end: criteriaData.timeframe_end,
        timeframe_description: criteriaData.timeframe_description,
        inclusion_criteria: criteriaData.inclusion_criteria.filter(c => c.trim()),
        exclusion_criteria: criteriaData.exclusion_criteria.filter(c => c.trim()),
        use_advanced_ai: criteriaData.use_advanced_ai,
        dual_ai_review: criteriaData.dual_ai_review
      });

      toast({
        title: "Criteria saved successfully",
        description: criteriaData.dual_ai_review 
          ? "Your screening criteria have been saved. Starting dual AI screening..."
          : "Your screening criteria have been saved and you can now start the screening process",
      });

      // Navigate to screening page with auto-start flag if dual AI review is enabled
      const searchParams = criteriaData.dual_ai_review ? '?autoStart=true' : '';
      navigate(`/screening${searchParams}`);

    } catch (error) {
      console.error('Error saving criteria:', error);
      toast({
        title: "Save failed",
        description: "There was an error saving your criteria. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const picoFields = [
    {
      id: 'population',
      label: 'Population (P)',
      placeholder: 'Describe the target population (e.g., adults with diabetes, children under 5, etc.)',
      value: criteriaData.population
    },
    {
      id: 'intervention',
      label: 'Intervention (I)', 
      placeholder: 'Describe the intervention being studied (e.g., a specific drug, therapy, procedure)',
      value: criteriaData.intervention
    },
    {
      id: 'comparator',
      label: 'Comparator (C)',
      placeholder: 'Describe what the intervention is compared against (e.g., placebo, standard care, another treatment)',
      value: criteriaData.comparator
    },
    {
      id: 'outcome',
      label: 'Outcome (O)',
      placeholder: 'Describe the primary outcomes of interest (e.g., mortality, quality of life, symptom improvement)',
      value: criteriaData.outcome
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Project Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">Define Screening Criteria</h1>
            <p className="text-muted-foreground">Project: <span className="font-medium">{projectData.name}</span></p>
          </div>

          {/* PICO-TT Criteria */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                PICO-TT Framework
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* PICO Fields */}
              {picoFields.map((field) => (
                <div key={field.id}>
                  <Label htmlFor={field.id} className="text-sm font-medium text-foreground">
                    {field.label}
                  </Label>
                  <Textarea
                    id={field.id}
                    placeholder={field.placeholder}
                    value={field.value}
                    onChange={(e) => handleInputChange(field.id as keyof PICOTTData, e.target.value)}
                    className="mt-1 min-h-20"
                  />
                </div>
              ))}

              {/* Timeframe Fields */}
              <div className="space-y-4">
                <Label className="text-sm font-medium text-foreground">Timeframe (T)</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="timeframe_start" className="text-xs text-muted-foreground">Start Date/Period</Label>
                    <Input
                      id="timeframe_start"
                      placeholder="e.g., 2010, January 2015"
                      value={criteriaData.timeframe_start}
                      onChange={(e) => handleInputChange('timeframe_start', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="timeframe_end" className="text-xs text-muted-foreground">End Date/Period</Label>
                    <Input
                      id="timeframe_end"
                      placeholder="e.g., 2023, Present"
                      value={criteriaData.timeframe_end}
                      onChange={(e) => handleInputChange('timeframe_end', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="timeframe_description" className="text-xs text-muted-foreground">Additional Timeframe Details</Label>
                  <Textarea
                    id="timeframe_description"
                    placeholder="Additional time-related criteria or constraints"
                    value={criteriaData.timeframe_description}
                    onChange={(e) => handleInputChange('timeframe_description', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Study Design Types */}
          <Card>
            <CardHeader>
              <CardTitle>Study Design Criteria (T)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {studyTypes.map((studyType) => (
                  <div key={studyType} className="flex items-center space-x-2">
                    <Checkbox
                      id={studyType}
                      checked={criteriaData.study_designs.includes(studyType)}
                      onCheckedChange={(checked) => handleStudyDesignChange(studyType, !!checked)}
                    />
                    <Label htmlFor={studyType} className="text-sm font-normal">
                      {studyType}
                    </Label>
                  </div>
                ))}
              </div>
              {criteriaData.study_designs.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Selected study designs:</p>
                  <div className="flex flex-wrap gap-2">
                    {criteriaData.study_designs.map((design) => (
                      <Badge key={design} variant="secondary">{design}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inclusion/Exclusion Criteria */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Inclusion Criteria */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Inclusion Criteria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {criteriaData.inclusion_criteria.map((criterion, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`Inclusion criterion ${index + 1}`}
                      value={criterion}
                      onChange={(e) => handleCriteriaChange('inclusion', index, e.target.value)}
                      className="flex-1"
                    />
                    {criteriaData.inclusion_criteria.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeCriteria('inclusion', index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addCriteria('inclusion')}
                  className="w-full"
                >
                  Add Inclusion Criterion
                </Button>
              </CardContent>
            </Card>

            {/* Exclusion Criteria */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Exclusion Criteria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {criteriaData.exclusion_criteria.map((criterion, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`Exclusion criterion ${index + 1}`}
                      value={criterion}
                      onChange={(e) => handleCriteriaChange('exclusion', index, e.target.value)}
                      className="flex-1"
                    />
                    {criteriaData.exclusion_criteria.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeCriteria('exclusion', index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addCriteria('exclusion')}
                  className="w-full"
                >
                  Add Exclusion Criterion
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* AI Processing Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                AI Processing Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="advanced-ai" className="text-base">
                    Advanced AI Processing
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Use advanced AI models for more accurate screening
                  </p>
                </div>
                <Switch
                  id="advanced-ai"
                  checked={criteriaData.use_advanced_ai}
                  onCheckedChange={(checked) => handleInputChange('use_advanced_ai', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="dual-ai" className="text-base">
                    Dual AI Review
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Use two AI models for consensus-based screening
                  </p>
                </div>
                <Switch
                  id="dual-ai"
                  checked={criteriaData.dual_ai_review}
                  onCheckedChange={(checked) => handleInputChange('dual_ai_review', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Import
            </Button>

            <Button onClick={handleSaveCriteria} disabled={isLoading} size="lg">
              {isLoading ? (
                "Saving..."
              ) : (
                <>
                  Start Screening Process
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Criteria;