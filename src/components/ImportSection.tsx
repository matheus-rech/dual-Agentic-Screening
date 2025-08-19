import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ImportSection = () => {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Import References</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="project-name" className="text-sm font-medium text-foreground">
            Project Name
          </Label>
          <Input
            id="project-name"
            placeholder="Enter project name"
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="import-format" className="text-sm font-medium text-foreground">
            Import Format
          </Label>
          <Select defaultValue="auto-detect">
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
      </CardContent>
    </Card>
  );
};

export default ImportSection;