import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import DemoCard from "@/components/DemoCard";
import ImportSection from "@/components/ImportSection";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6 py-8">
        {user ? (
          <div className="space-y-8">
            <DemoCard />
            <ImportSection />
          </div>
        ) : (
          <div className="text-center py-16">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Welcome to AI Research Screening
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Advanced systematic review tools powered by dual AI screening
            </p>
            <Button asChild size="lg">
              <Link to="/auth">
                <LogIn className="w-4 h-4 mr-2" />
                Get Started
              </Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
