import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useProject } from "@/contexts/ProjectContext";
import { loadDemoData } from "@/services/demoDataService";
import { useState } from "react";

const DemoCard = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { setProjectData } = useProject();

  const features = [
    { icon: "📚", text: "8 real PubMed references with full abstracts" },
    { icon: "🎯", text: "Evidence-based PICO-TT criteria for ICP monitoring" },
    { icon: "✅", text: "Pre-configured inclusion/exclusion criteria" },
    { icon: "🤖", text: "Dual AI screening with reasoning models (GPT-4, Claude)" },
    { icon: "📊", text: "Live screening analytics and conflict detection" }
  ];

  const handleLoadDemo = async () => {
    setIsLoading(true);
    try {
      const result = await loadDemoData();
      const { demoReferences } = await import('@/services/demoDataService');
      
      // Load complete project data into context
      setProjectData({
        id: result.project.id,
        name: result.project.name,
        description: result.project.description,
        importFormat: 'demo',
        references: demoReferences,
        status: 'criteria_defined',
        total_references: result.referencesCount,
        criteria: {
          population: result.criteria.population,
          intervention: result.criteria.intervention,
          comparator: result.criteria.comparator,
          outcome: result.criteria.outcome,
          study_designs: result.criteria.study_designs,
          timeframe_start: result.criteria.timeframe_start,
          timeframe_end: result.criteria.timeframe_end,
          timeframe_description: result.criteria.timeframe_description,
          inclusion_criteria: result.criteria.inclusion_criteria,
          exclusion_criteria: result.criteria.exclusion_criteria,
          use_advanced_ai: result.project.use_advanced_ai,
          dual_ai_review: result.project.dual_ai_review
        }
      });

      toast({
        title: "Demo loaded successfully!",
        description: `Loaded ${result.referencesCount} sample references with pre-configured PICO criteria.`,
      });

      navigate('/criteria');
    } catch (error) {
      console.error('Error loading demo:', error);
      toast({
        title: "Demo load failed",
        description: "There was an error loading the demo data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-demo-bg border-demo-border">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-lg">
            <Play className="w-4 h-4 text-primary-foreground fill-current" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Interactive Demo</h3>
            <p className="text-xs text-muted-foreground">Complete AI screening workflow</p>
          </div>
        </div>
        
        <div className="bg-demo-accent/10 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-foreground mb-2">🧠 ICP Monitoring in Traumatic Brain Injury</h4>
          <p className="text-sm text-foreground/80">
            Experience dual AI screening with real PubMed references featuring advanced reasoning models for systematic review automation.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="text-lg">{feature.icon}</span>
              <span className="text-sm text-foreground">{feature.text}</span>
            </div>
          ))}
        </div>

        <Button 
          className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg" 
          onClick={handleLoadDemo}
          disabled={isLoading}
          size="lg"
        >
          <Play className="w-4 h-4 mr-2" />
          {isLoading ? "Loading Demo Data..." : "Launch Demo Experience"}
        </Button>
        
        <div className="mt-3 text-center">
          <p className="text-xs text-muted-foreground">
            ⚡ Demo includes live AI screening with detailed reasoning steps
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DemoCard;