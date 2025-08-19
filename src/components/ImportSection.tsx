import { useState } from "react";
import { Upload, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useProject } from "@/contexts/ProjectContext";
import { FileParserService } from "@/services/fileParserService";
import { supabase } from "@/integrations/supabase/client";
import { validateFile, sanitizeTextInput } from "@/lib/security";

const ImportSection = () => {
  const [projectName, setProjectName] = useState("");
  const [importFormat, setImportFormat] = useState("auto-detect");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { setProjectData } = useProject();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Enhanced security validation
      const validation = validateFile(file, 'documents');
      
      if (!validation.isValid) {
        toast({
          title: "File validation failed",
          description: validation.errors.join('. '),
          variant: "destructive",
        });
        // Clear the input
        event.target.value = '';
        return;
      }

      setUploadedFile(file);
      toast({
        title: "File uploaded",
        description: `${file.name} is ready for processing`,
      });
    }
  };

  const handleSubmit = async () => {
    const sanitizedProjectName = sanitizeTextInput(projectName);
    
    if (!sanitizedProjectName.trim()) {
      toast({
        title: "Project name required",
        description: "Please enter a valid project name to continue",
        variant: "destructive",
      });
      return;
    }

    if (!uploadedFile) {
      toast({
        title: "File required",
        description: "Please upload a reference file to continue",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Parse the uploaded file
      const references = await FileParserService.parseFile(uploadedFile, importFormat);

      if (references.length === 0) {
        toast({
          title: "No references found",
          description: "The uploaded file doesn't contain any valid references",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Create project in database with sanitized input
      const { data: project, error: projectError } = await supabase
        .from('review_projects')
        .insert({
          name: sanitizedProjectName,
          status: 'draft'
        })
        .select()
        .single();

      if (projectError) {
        throw projectError;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Insert references into database
      const referencesToInsert = references.map(ref => ({
        project_id: project.id,
        user_id: user?.id,
        title: ref.title,
        authors: ref.authors,
        abstract: ref.abstract,
        journal: ref.journal,
        year: ref.year,
        doi: ref.doi,
        pmid: ref.pmid,
        url: ref.url,
        status: 'pending'
      }));

      const { error: referencesError } = await supabase
        .from('references')
        .insert(referencesToInsert);

      if (referencesError) {
        throw referencesError;
      }

      // Update project context
      setProjectData({
        id: project.id,
        name: sanitizedProjectName,
        importFormat,
        uploadedFile,
        references
      });

      toast({
        title: "Import successful",
        description: `${references.length} references imported successfully`,
      });

      // Navigate to criteria page
      navigate('/criteria');

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: "There was an error importing your references. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Import References</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="project-name" className="text-sm font-medium text-foreground">
            Project Name
          </Label>
          <Input
            id="project-name"
            placeholder="Enter project name"
            className="mt-1"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            maxLength={255}
          />
        </div>
        
        <div>
          <Label htmlFor="import-format" className="text-sm font-medium text-foreground">
            Import Format
          </Label>
          <Select value={importFormat} onValueChange={setImportFormat}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto-detect">Auto-detect</SelectItem>
              <SelectItem value="pubmed">PubMed</SelectItem>
              <SelectItem value="endnote">EndNote</SelectItem>
              <SelectItem value="bibtex">BibTeX</SelectItem>
              <SelectItem value="ris">RIS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="file-upload" className="text-sm font-medium text-foreground">
            Reference File
          </Label>
          <div className="mt-1">
            <Input
              id="file-upload"
              type="file"
              accept=".bib,.ris,.txt,.enw,.nbib,.pdf,.doc,.docx,.json,.csv"
              onChange={handleFileUpload}
              className="file:text-primary file:border-primary/20"
            />
            {uploadedFile && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-secondary/50 rounded-md">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">{uploadedFile.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(uploadedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4">
          <Button 
            onClick={handleSubmit}
            disabled={isLoading || !sanitizeTextInput(projectName).trim() || !uploadedFile}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              "Processing..."
            ) : (
              <>
                Next: Define Criteria
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ImportSection;