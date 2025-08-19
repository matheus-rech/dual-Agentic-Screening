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
    "8 real PubMed references with full abstracts",
    "Evidence-based PICO-TT criteria for ICP monitoring",
    "Comprehensive inclusion/exclusion criteria",
    "Ready for advanced AI-powered screening"
  ];

  const handleLoadDemo = async () => {
    setIsLoading(true);
    try {
      const result = await loadDemoData();
      
      // Update project context
      setProjectData({
        id: result.project.id,
        name: result.project.name,
        importFormat: 'demo'
      });

      toast({
        title: "Demo data loaded successfully",
        description: `Created project with ${result.referencesCount} research references about ICP monitoring in TBI`,
      });

      // Navigate to criteria page to review/modify criteria before screening
      navigate('/criteria');

    } catch (error) {
      console.error('Error loading demo data:', error);
      toast({
        title: "Failed to load demo data",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
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
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <Play className="w-4 h-4 text-primary-foreground fill-current" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Try the Demo</h3>
        </div>
        
        <p className="text-sm text-foreground mb-4">
          Load a complete systematic review demo with real PubMed references about intracranial pressure monitoring and pre-configured PICO criteria derived from the literature.
        </p>

        <div className="space-y-2 mb-6">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
              <span className="text-sm text-foreground">{feature}</span>
            </div>
          ))}
        </div>

        <Button 
          className="w-full" 
          onClick={handleLoadDemo}
          disabled={isLoading}
        >
          <Play className="w-4 h-4 mr-2" />
          {isLoading ? "Loading Demo Data..." : "Load Demo Data"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DemoCard;