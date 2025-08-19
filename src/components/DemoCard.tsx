import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const DemoCard = () => {
  const features = [
    "3 real PubMed references with full abstracts",
    "Evidence-based PICO criteria from the papers",
    "Inclusion/exclusion criteria for ICP monitoring studies",
    "Ready for advanced AI-powered screening"
  ];

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

        <Button className="w-full">
          <Play className="w-4 h-4 mr-2" />
          Load Demo Data
        </Button>
      </CardContent>
    </Card>
  );
};

export default DemoCard;