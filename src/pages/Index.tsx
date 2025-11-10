import { Link } from "react-router-dom";
import { LogIn, RefreshCw, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Header from "@/components/Header";
import DemoCard from "@/components/DemoCard";
import ImportSection from "@/components/ImportSection";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { user } = useAuth();
  const { projectData, loadProject, clearProject } = useProject();
  const [incompleteProjects, setIncompleteProjects] = useState<any[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const navigate = useNavigate();

  // Load incomplete projects on mount
  useEffect(() => {
    if (user) {
      loadIncompleteProjects();
    }
  }, [user]);

  const loadIncompleteProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const { data: projects, error } = await supabase
        .from('review_projects')
        .select('id, name, status, created_at, total_references')
        .eq('user_id', user?.id)
        .in('status', ['draft', 'criteria_defined'])
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setIncompleteProjects(projects || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleResumeProject = async (project: any) => {
    await loadProject(project.id);
    
    // Navigate to appropriate page based on status
    if (project.status === 'draft') {
      navigate('/criteria');
    } else if (project.status === 'criteria_defined') {
      navigate('/screening');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6 py-8">
        {user ? (
          <div className="space-y-8">
            {/* Resume existing projects */}
            {incompleteProjects.length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold text-foreground">Continue Previous Work</h3>
                  <p className="text-sm text-muted-foreground">
                    Resume your incomplete projects
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {incompleteProjects.map((project) => (
                    <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium text-foreground">{project.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Status: {project.status} • {project.total_references || 0} references
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleResumeProject(project)}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resume
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <DemoCard />
            <ImportSection />
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                <Brain className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              AI Research Screening Platform
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Advanced systematic review automation powered by dual AI reasoning models with conflict detection and evidence-based screening
            </p>
            <Button asChild size="lg" className="shadow-lg">
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
