import { Check, Clock, Save, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/contexts/ProjectContext";

const SaveIndicator = () => {
  const { isLoading, lastSaved, hasUnsavedChanges } = useProject();

  if (isLoading) {
    return (
      <Badge variant="secondary" className="animate-pulse">
        <Clock className="w-3 h-3 mr-1" />
        Saving...
      </Badge>
    );
  }

  if (hasUnsavedChanges) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Save className="w-3 h-3 mr-1" />
        Unsaved changes
      </Badge>
    );
  }

  if (lastSaved) {
    const timeSince = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    const timeDisplay = timeSince < 60 
      ? 'Just now' 
      : timeSince < 3600 
        ? `${Math.floor(timeSince / 60)}m ago`
        : `${Math.floor(timeSince / 3600)}h ago`;

    return (
      <Badge variant="secondary" className="text-green-600">
        <Check className="w-3 h-3 mr-1" />
        Saved {timeDisplay}
      </Badge>
    );
  }

  return null;
};

export default SaveIndicator;