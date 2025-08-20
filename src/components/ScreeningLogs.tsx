import React, { useState, useEffect } from 'react';
import { Search, Clock, Filter, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ScreeningLog {
  id: string;
  reference_id: string;
  screening_stage: string;
  primary_model_decision: string;
  primary_model_confidence: number;
  secondary_model_decision: string;
  secondary_model_confidence: number;
  final_decision: string;
  model_agreement_score: number;
  decision_reason: any;
  created_at: string;
  screening_start_time?: string;
  screening_end_time?: string;
  processing_duration_ms?: number;
}

interface ScreeningLogsProps {
  projectId: string;
}

const ScreeningLogs = ({ projectId }: ScreeningLogsProps) => {
  const [logs, setLogs] = useState<ScreeningLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ScreeningLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [agreementFilter, setAgreementFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ScreeningLog | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();
    
    // Set up real-time subscription for logs updates
    const channel = supabase
      .channel('screening-logs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_screening_log',
          filter: `project_id=eq.${projectId}`
        },
        () => {
          console.log('Screening logs updated, refreshing...');
          loadLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, decisionFilter, agreementFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_screening_log')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading screening logs:', error);
      toast({
        title: "Error loading logs",
        description: "Failed to load screening logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = logs;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.reference_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.primary_model_decision.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.secondary_model_decision.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Decision filter
    if (decisionFilter !== 'all') {
      filtered = filtered.filter(log => log.final_decision === decisionFilter);
    }

    // Agreement filter
    if (agreementFilter !== 'all') {
      const hasAgreement = agreementFilter === 'agreement';
      filtered = filtered.filter(log => 
        (log.primary_model_decision === log.secondary_model_decision) === hasAgreement
      );
    }

    setFilteredLogs(filtered);
  };

  const exportLogs = async () => {
    try {
      const csvContent = [
        'Reference ID,Primary Decision,Primary Confidence,Secondary Decision,Secondary Confidence,Final Decision,Agreement Score,Processing Time (ms),Created At',
        ...filteredLogs.map(log => [
          log.reference_id,
          log.primary_model_decision,
          log.primary_model_confidence,
          log.secondary_model_decision,
          log.secondary_model_confidence,
          log.final_decision,
          log.model_agreement_score,
          log.processing_duration_ms || 'N/A',
          new Date(log.created_at).toISOString()
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `screening-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: "Screening logs exported to CSV",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export screening logs",
        variant: "destructive",
      });
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'include':
        return <Badge className="bg-success text-success-foreground">Include</Badge>;
      case 'exclude':
        return <Badge variant="destructive">Exclude</Badge>;
      case 'uncertain':
        return <Badge variant="secondary">Uncertain</Badge>;
      default:
        return <Badge variant="outline">{decision}</Badge>;
    }
  };

  const getAgreementBadge = (log: ScreeningLog) => {
    const agreement = log.primary_model_decision === log.secondary_model_decision;
    return (
      <Badge variant={agreement ? "outline" : "destructive"}>
        {agreement ? "Agreement" : "Conflict"}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Screening Logs ({filteredLogs.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadLogs}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportLogs}
              disabled={filteredLogs.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={decisionFilter} onValueChange={setDecisionFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Decision" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Decisions</SelectItem>
              <SelectItem value="include">Include</SelectItem>
              <SelectItem value="exclude">Exclude</SelectItem>
              <SelectItem value="uncertain">Uncertain</SelectItem>
            </SelectContent>
          </Select>
          <Select value={agreementFilter} onValueChange={setAgreementFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Agreement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agreement</SelectItem>
              <SelectItem value="agreement">Agreement</SelectItem>
              <SelectItem value="conflict">Conflict</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Logs Table */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No logs found matching the current filters.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="border rounded-lg p-4 hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-mono text-muted-foreground">
                      {log.reference_id.slice(0, 8)}...
                    </div>
                    {getDecisionBadge(log.final_decision)}
                    {getAgreementBadge(log)}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                      {formatDuration(log.processing_duration_ms)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Screening Log Details</DialogTitle>
                        </DialogHeader>
                        {selectedLog && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-medium mb-2">OpenAI Decision</h4>
                                <div className="space-y-1">
                                  {getDecisionBadge(selectedLog.primary_model_decision)}
                                  <div className="text-sm text-muted-foreground">
                                    Confidence: {(selectedLog.primary_model_confidence * 100).toFixed(1)}%
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2">Gemini Decision</h4>
                                <div className="space-y-1">
                                  {getDecisionBadge(selectedLog.secondary_model_decision)}
                                  <div className="text-sm text-muted-foreground">
                                    Confidence: {(selectedLog.secondary_model_confidence * 100).toFixed(1)}%
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="font-medium mb-2">Final Decision</h4>
                              <div className="flex items-center gap-2">
                                {getDecisionBadge(selectedLog.final_decision)}
                                {getAgreementBadge(selectedLog)}
                                <span className="text-sm text-muted-foreground">
                                  Agreement Score: {(selectedLog.model_agreement_score * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>

                            {selectedLog.decision_reason && (
                              <div>
                                <h4 className="font-medium mb-2">Decision Reasoning</h4>
                                <div className="bg-muted p-3 rounded-md">
                                  <pre className="text-sm whitespace-pre-wrap">
                                    {JSON.stringify(selectedLog.decision_reason, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Processing Time:</span>
                                <span className="ml-2">{formatDuration(selectedLog.processing_duration_ms)}</span>
                              </div>
                              <div>
                                <span className="font-medium">Created:</span>
                                <span className="ml-2">{new Date(selectedLog.created_at).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ScreeningLogs;