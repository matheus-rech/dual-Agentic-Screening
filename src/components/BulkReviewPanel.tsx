import React, { useState, useEffect } from 'react';
import { CheckSquare, XSquare, AlertTriangle, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Reference {
  id: string;
  title: string;
  authors: string;
  year: number;
  status: string;
  ai_conflict_flag?: boolean;
}

interface BulkReviewPanelProps {
  projectId: string;
  references: Reference[];
  screeningResults: any[];
  onReviewComplete: () => void;
}

const BulkReviewPanel = ({ projectId, references, screeningResults, onReviewComplete }: BulkReviewPanelProps) => {
  const [selectedReferences, setSelectedReferences] = useState<string[]>([]);
  const [bulkDecision, setBulkDecision] = useState('');
  const [bulkNotes, setBulkNotes] = useState('');
  const [confidenceLevel, setConfidenceLevel] = useState('3');
  const [filterType, setFilterType] = useState('conflicts');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Get references that need review based on filter
  const getFilteredReferences = () => {
    switch (filterType) {
      case 'conflicts':
        return references.filter(ref => {
          const result = screeningResults.find(r => r.reference_id === ref.id);
          return result && !result.agreement;
        });
      case 'low-confidence':
        return references.filter(ref => {
          const result = screeningResults.find(r => r.reference_id === ref.id);
          return result && (
            result.primary_reviewer?.confidence < 0.7 || 
            result.secondary_reviewer?.confidence < 0.7
          );
        });
      case 'uncertain':
        return references.filter(ref => {
          const result = screeningResults.find(r => r.reference_id === ref.id);
          return result && result.final_decision === 'uncertain';
        });
      case 'all-screened':
        return references.filter(ref => 
          screeningResults.some(r => r.reference_id === ref.id)
        );
      default:
        return [];
    }
  };

  const filteredReferences = getFilteredReferences();

  const toggleReferenceSelection = (referenceId: string) => {
    setSelectedReferences(prev => 
      prev.includes(referenceId)
        ? prev.filter(id => id !== referenceId)
        : [...prev, referenceId]
    );
  };

  const selectAllFiltered = () => {
    setSelectedReferences(filteredReferences.map(ref => ref.id));
  };

  const clearSelection = () => {
    setSelectedReferences([]);
  };

  const submitBulkDecision = async () => {
    if (!bulkDecision || selectedReferences.length === 0) {
      toast({
        title: "Invalid selection",
        description: "Please select references and a decision",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Insert user decisions for each selected reference
      const decisions = selectedReferences.map(referenceId => {
        const result = screeningResults.find(r => r.reference_id === referenceId);
        return {
          project_id: projectId,
          reference_id: referenceId,
          user_id: user.id,
          original_ai_decision: result?.final_decision || 'unknown',
          user_decision: bulkDecision,
          decision_reason: 'Bulk review decision',
          confidence_level: parseInt(confidenceLevel),
          notes: bulkNotes.trim() || null,
        };
      });

      const { error: insertError } = await supabase
        .from('user_decisions')
        .upsert(decisions, { 
          onConflict: 'reference_id,user_id',
          ignoreDuplicates: false 
        });

      if (insertError) throw insertError;

      // Update reference status in the references table
      const { error: updateError } = await supabase
        .from('references')
        .update({ 
          status: bulkDecision,
          user_decision: bulkDecision,
          user_notes: bulkNotes.trim() || null 
        })
        .in('id', selectedReferences);

      if (updateError) throw updateError;

      toast({
        title: "Bulk review completed",
        description: `Updated ${selectedReferences.length} references`,
      });

      // Reset form
      setSelectedReferences([]);
      setBulkDecision('');
      setBulkNotes('');
      setConfidenceLevel('3');
      
      onReviewComplete();
    } catch (error) {
      console.error('Error submitting bulk review:', error);
      toast({
        title: "Review failed",
        description: "Failed to save bulk review decisions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (reference: Reference) => {
    const result = screeningResults.find(r => r.reference_id === reference.id);
    if (!result) return <Badge variant="outline">Pending</Badge>;

    if (!result.agreement) {
      return <Badge variant="destructive">Conflict</Badge>;
    }

    switch (result.final_decision) {
      case 'include':
        return <Badge className="bg-success text-success-foreground">Include</Badge>;
      case 'exclude':
        return <Badge variant="destructive">Exclude</Badge>;
      default:
        return <Badge variant="secondary">Uncertain</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5" />
          Bulk Review Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter Selection */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Show:</label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conflicts">Conflicts Only</SelectItem>
              <SelectItem value="low-confidence">Low Confidence</SelectItem>
              <SelectItem value="uncertain">Uncertain Decisions</SelectItem>
              <SelectItem value="all-screened">All Screened</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline">
            {filteredReferences.length} references
          </Badge>
        </div>

        {/* Bulk Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAllFiltered}
            disabled={filteredReferences.length === 0}
          >
            Select All ({filteredReferences.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearSelection}
            disabled={selectedReferences.length === 0}
          >
            Clear Selection
          </Button>
          <Badge variant="secondary">
            {selectedReferences.length} selected
          </Badge>
        </div>

        {/* Reference List */}
        <div className="max-h-96 overflow-y-auto space-y-2 border rounded-md p-3">
          {filteredReferences.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No references match the current filter.
            </div>
          ) : (
            filteredReferences.map((reference) => (
              <div
                key={reference.id}
                className={`flex items-center space-x-3 p-2 rounded-md border ${
                  selectedReferences.includes(reference.id) 
                    ? 'bg-primary/10 border-primary' 
                    : 'hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  checked={selectedReferences.includes(reference.id)}
                  onCheckedChange={() => toggleReferenceSelection(reference.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{reference.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {reference.authors} ({reference.year})
                  </div>
                </div>
                {getStatusBadge(reference)}
              </div>
            ))
          )}
        </div>

        {/* Bulk Decision Form */}
        {selectedReferences.length > 0 && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium">Bulk Decision for {selectedReferences.length} references</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Decision</label>
                <Select value={bulkDecision} onValueChange={setBulkDecision}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select decision" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="include">Include</SelectItem>
                    <SelectItem value="exclude">Exclude</SelectItem>
                    <SelectItem value="uncertain">Uncertain</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Confidence Level</label>
                <Select value={confidenceLevel} onValueChange={setConfidenceLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Very Low</SelectItem>
                    <SelectItem value="2">2 - Low</SelectItem>
                    <SelectItem value="3">3 - Medium</SelectItem>
                    <SelectItem value="4">4 - High</SelectItem>
                    <SelectItem value="5">5 - Very High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
              <Textarea
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                placeholder="Add notes about this bulk decision..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={submitBulkDecision}
                disabled={loading || !bulkDecision}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Apply Bulk Decision'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setBulkDecision('');
                  setBulkNotes('');
                  setConfidenceLevel('3');
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BulkReviewPanel;