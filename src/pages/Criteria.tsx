import { ArrowLeft, ArrowRight, Settings, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import Header from "@/components/Header";

const Criteria = () => {
  const studyTypes = [
    "Randomized Controlled Trial",
    "Meta-Analysis", 
    "Case-Control Study",
    "Case Series",
    "Review",
    "Systematic Review",
    "Cohort Study",
    "Cross-sectional Study",
    "Case Report",
    "Editorial"
  ];

  const picoFields = [
    {
      id: "population",
      label: "Population",
      placeholder: "Describe the target population (e.g., adults with diabetes)"
    },
    {
      id: "intervention", 
      label: "Intervention",
      placeholder: "Describe the intervention being studied"
    },
    {
      id: "comparator",
      label: "Comparator", 
      placeholder: "Describe the control or comparison group"
    },
    {
      id: "outcome",
      label: "Outcome",
      placeholder: "Describe the primary outcomes of interest"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Setup Screening Criteria
          </h1>
          <p className="text-muted-foreground">
            Define your inclusion and exclusion criteria using the PICO framework
          </p>
        </div>

        <div className="space-y-8">
          {/* PICO Criteria */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">PICO Criteria</h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {picoFields.map((field) => (
                  <div key={field.id}>
                    <Label htmlFor={field.id} className="text-sm font-medium text-foreground">
                      {field.label}
                    </Label>
                    <Textarea
                      id={field.id}
                      placeholder={field.placeholder}
                      className="mt-1 min-h-[100px]"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Study Design Criteria */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-foreground">Study Design Criteria</h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {studyTypes.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox id={type} />
                    <Label
                      htmlFor={type}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Processing Options */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">AI Processing Options</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium text-foreground">Advanced AI Processing</h3>
                    <p className="text-sm text-muted-foreground">
                      Enable enhanced AI recommendations with more sophisticated screening algorithms
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    Better accuracy
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <div className="w-2 h-2 bg-info rounded-full"></div>
                    Detailed analysis
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium text-foreground">Dual AI Review</h3>
                    <p className="text-sm text-muted-foreground">
                      Use two independent AI reviewers to screen all references automatically. You only need to resolve disagreements.
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <div className="w-2 h-2 bg-accent rounded-full"></div>
                    Automated screening
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <div className="w-2 h-2 bg-warning rounded-full"></div>
                    Conflict resolution
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    Time-saving
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Import
          </Button>
          <Button>
            Start Screening Process
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Criteria;