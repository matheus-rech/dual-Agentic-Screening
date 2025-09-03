import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Clock, AlertTriangle, Zap, Database, Settings, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SystemCheck {
  id: string;
  name: string;
  status: 'checking' | 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
  action?: () => void;
  actionLabel?: string;
}

interface SystemStatusProps {
  projectId?: string;
  criteriaData?: any;
  references: any[];
  onRetry?: () => void;
}

export const SystemStatusDashboard = ({ projectId, criteriaData, references, onRetry }: SystemStatusProps) => {
  const [checks, setChecks] = useState<SystemCheck[]>([]);
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const { toast } = useToast();

  const runSystemChecks = async () => {
    setIsRunningChecks(true);
    const newChecks: SystemCheck[] = [];

    // 1. Project Configuration Check
    newChecks.push({
      id: 'project',
      name: 'Project Configuration',
      status: projectId ? 'pass' : 'fail',
      message: projectId ? 'Project loaded successfully' : 'No project selected',
      details: projectId ? `Project ID: ${projectId}` : 'Select or create a project to continue'
    });

    // 2. Screening Criteria Check
    let criteriaStatus: SystemCheck['status'] = 'checking';
    let criteriaMessage = 'Checking criteria...';
    let criteriaDetails = '';

    try {
      if (projectId) {
        const { data: dbCriteria, error } = await supabase
          .from('screening_criteria')
          .select('*')
          .eq('project_id', projectId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          criteriaStatus = 'fail';
          criteriaMessage = 'Database error loading criteria';
          criteriaDetails = `Error: ${error.message}`;
        } else if (dbCriteria || criteriaData) {
          const criteria = dbCriteria || criteriaData;
          const hasRequired = criteria.population && criteria.intervention && criteria.outcome;
          const inclusionArray = Array.isArray(criteria.inclusion_criteria) ? criteria.inclusion_criteria : [];
          const exclusionArray = Array.isArray(criteria.exclusion_criteria) ? criteria.exclusion_criteria : [];
          const hasInclusionExclusion = inclusionArray.length > 0 && exclusionArray.length > 0;
          
          if (hasRequired && hasInclusionExclusion) {
            criteriaStatus = 'pass';
            criteriaMessage = 'Complete criteria configured';
            criteriaDetails = `PICO + ${inclusionArray.length} inclusion, ${exclusionArray.length} exclusion criteria`;
          } else if (hasRequired) {
            criteriaStatus = 'warning';
            criteriaMessage = 'Basic criteria set, missing inclusion/exclusion';
            criteriaDetails = 'PICO elements defined but detailed criteria needed for AI screening';
          } else {
            criteriaStatus = 'fail';
            criteriaMessage = 'Incomplete criteria configuration';
            criteriaDetails = 'Define population, intervention, and outcome at minimum';
          }
        } else {
          criteriaStatus = 'fail';
          criteriaMessage = 'No screening criteria found';
          criteriaDetails = 'Create screening criteria to enable AI analysis';
        }
      } else {
        criteriaStatus = 'fail';
        criteriaMessage = 'No project selected';
      }
    } catch (error) {
      criteriaStatus = 'fail';
      criteriaMessage = 'Failed to check criteria';
      criteriaDetails = error instanceof Error ? error.message : 'Unknown error';
    }

    newChecks.push({
      id: 'criteria',
      name: 'Screening Criteria',
      status: criteriaStatus,
      message: criteriaMessage,
      details: criteriaDetails,
      action: criteriaStatus !== 'pass' ? () => window.location.href = '/criteria' : undefined,
      actionLabel: 'Configure Criteria'
    });

    // 3. References Check
    newChecks.push({
      id: 'references',
      name: 'Reference Data',
      status: references.length > 0 ? 'pass' : 'fail',
      message: references.length > 0 ? `${references.length} references loaded` : 'No references found',
      details: references.length > 0 
        ? `Ready to screen ${references.length} references`
        : 'Import references from your reference manager or upload files',
      action: references.length === 0 ? () => window.location.href = '/' : undefined,
      actionLabel: 'Import References'
    });

    // 4. AI Service Connectivity Check
    let aiStatus: SystemCheck['status'] = 'checking';
    let aiMessage = 'Testing AI services...';
    let aiDetails = '';

    try {
      // Test edge function connectivity
      const response = await fetch('/api/test-ai-connectivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.services?.some((s: any) => s.available)) {
          aiStatus = 'pass';
          const available = result.services.filter((s: any) => s.available);
          aiMessage = `${available.length} AI service(s) available`;
          aiDetails = available.map((s: any) => s.name).join(', ');
        } else {
          aiStatus = 'warning';
          aiMessage = 'AI services not responding';
          aiDetails = 'Check API keys and service status';
        }
      } else {
        aiStatus = 'fail';
        aiMessage = 'Cannot connect to AI services';
        aiDetails = 'Edge function or API configuration issue';
      }
    } catch (error) {
      aiStatus = 'warning';
      aiMessage = 'AI connectivity test skipped';
      aiDetails = 'Will test during actual screening process';
    }

    newChecks.push({
      id: 'ai-services',
      name: 'AI Services',
      status: aiStatus,
      message: aiMessage,
      details: aiDetails
    });

    // 5. Database Connectivity Check  
    let dbStatus: SystemCheck['status'] = 'checking';
    let dbMessage = 'Testing database...';
    let dbDetails = '';

    try {
      const { error } = await supabase.from('review_projects').select('id').limit(1);
      if (error) {
        dbStatus = 'fail';
        dbMessage = 'Database connection failed';
        dbDetails = error.message;
      } else {
        dbStatus = 'pass';
        dbMessage = 'Database connection healthy';
        dbDetails = 'All database operations available';
      }
    } catch (error) {
      dbStatus = 'fail';
      dbMessage = 'Database error';
      dbDetails = error instanceof Error ? error.message : 'Connection failed';
    }

    newChecks.push({
      id: 'database',
      name: 'Database Connection',
      status: dbStatus,
      message: dbMessage,
      details: dbDetails
    });

    setChecks(newChecks);
    setIsRunningChecks(false);
  };

  useEffect(() => {
    runSystemChecks();
  }, [projectId, criteriaData, references.length]);

  const getStatusIcon = (status: SystemCheck['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'checking':
        return <Clock className="w-4 h-4 text-muted-foreground animate-pulse" />;
    }
  };

  const getStatusBadge = (status: SystemCheck['status']) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-success text-success-foreground">Ready</Badge>;
      case 'fail':
        return <Badge variant="destructive">Failed</Badge>;
      case 'warning':
        return <Badge variant="outline" className="text-warning border-warning">Warning</Badge>;
      case 'checking':
        return <Badge variant="secondary">Checking...</Badge>;
    }
  };

  const overallStatus = checks.length > 0 ? (
    checks.every(check => check.status === 'pass') ? 'ready' :
    checks.some(check => check.status === 'fail') ? 'error' : 'warning'
  ) : 'checking';

  const readyForScreening = overallStatus === 'ready';
  const hasErrors = checks.some(check => check.status === 'fail');

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            System Status Dashboard
          </CardTitle>
          <div className="flex items-center gap-2">
            {readyForScreening && (
              <Badge className="bg-success text-success-foreground">
                <Zap className="w-3 h-3 mr-1" />
                Ready to Screen
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={runSystemChecks}
              disabled={isRunningChecks}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRunningChecks ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        {hasErrors && (
          <div className="text-sm text-destructive">
            System configuration issues detected. Resolve them before starting AI screening.
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {checks.map((check) => (
            <div key={check.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <div className="mt-0.5">
                {getStatusIcon(check.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-sm">{check.name}</h4>
                  {getStatusBadge(check.status)}
                </div>
                <p className="text-sm text-muted-foreground">{check.message}</p>
                {check.details && (
                  <p className="text-xs text-muted-foreground mt-1 opacity-75">
                    {check.details}
                  </p>
                )}
              </div>
              {check.action && check.actionLabel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={check.action}
                  className="ml-2"
                >
                  {check.actionLabel}
                </Button>
              )}
            </div>
          ))}

          {onRetry && hasErrors && (
            <div className="pt-4 border-t">
              <Button
                onClick={onRetry}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry System Initialization
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};