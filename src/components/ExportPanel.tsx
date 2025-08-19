import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ExportPanelProps {
  projectId: string;
  references: any[];
  screeningResults: any[];
  analytics: any;
}

const ExportPanel = ({ projectId, references, screeningResults, analytics }: ExportPanelProps) => {
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf' | 'json'>('csv');
  const [includeOptions, setIncludeOptions] = useState({
    basicInfo: true,
    aiDecisions: true,
    detailedReasoning: false,
    userDecisions: true,
    analytics: false,
    logs: false,
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const exportToCSV = async () => {
    try {
      const headers = ['Title', 'Authors', 'Year', 'Journal', 'DOI'];
      
      if (includeOptions.aiDecisions) {
        headers.push('AI Decision', 'AI Confidence', 'Agreement', 'Primary Model Decision', 'Secondary Model Decision');
      }
      
      if (includeOptions.userDecisions) {
        headers.push('User Decision', 'User Notes');
      }

      const csvData = references.map(ref => {
        const result = screeningResults.find(r => r.reference_id === ref.id);
        const row = [
          `"${ref.title || ''}"`,
          `"${ref.authors || ''}"`,
          ref.year || '',
          `"${ref.journal || ''}"`,
          ref.doi || '',
        ];

        if (includeOptions.aiDecisions && result) {
          row.push(
            result.final_decision || '',
            result.primary_reviewer?.confidence?.toFixed(2) || '',
            result.agreement ? 'Yes' : 'No',
            result.primary_reviewer?.decision || '',
            result.secondary_reviewer?.decision || ''
          );
        } else if (includeOptions.aiDecisions) {
          row.push('', '', '', '', '');
        }

        if (includeOptions.userDecisions) {
          row.push(
            ref.user_decision || '',
            `"${ref.user_notes || ''}"`
          );
        }

        return row.join(',');
      });

      const csvContent = [headers.join(','), ...csvData].join('\n');
      downloadFile(csvContent, 'text/csv', 'screening-results.csv');
    } catch (error) {
      throw new Error('Failed to generate CSV');
    }
  };

  const exportToJSON = async () => {
    try {
      const exportData = {
        project: {
          id: projectId,
          exportDate: new Date().toISOString(),
        },
        references: references.map(ref => {
          const result = screeningResults.find(r => r.reference_id === ref.id);
          const exportRef: any = {
            id: ref.id,
            title: ref.title,
            authors: ref.authors,
            year: ref.year,
            journal: ref.journal,
            doi: ref.doi,
            pmid: ref.pmid,
            abstract: ref.abstract,
          };

          if (includeOptions.aiDecisions && result) {
            exportRef.aiScreening = {
              finalDecision: result.final_decision,
              agreement: result.agreement,
              primaryReviewer: result.primary_reviewer,
              secondaryReviewer: result.secondary_reviewer,
            };
          }

          if (includeOptions.userDecisions) {
            exportRef.userDecision = ref.user_decision;
            exportRef.userNotes = ref.user_notes;
          }

          return exportRef;
        }),
      };

      if (includeOptions.analytics && analytics) {
        (exportData as any).analytics = analytics;
      }

      if (includeOptions.logs) {
        const { data: logs } = await supabase
          .from('ai_screening_log')
          .select('*')
          .eq('project_id', projectId);
        (exportData as any).logs = logs || [];
      }

      const jsonContent = JSON.stringify(exportData, null, 2);
      downloadFile(jsonContent, 'application/json', 'screening-export.json');
    } catch (error) {
      throw new Error('Failed to generate JSON');
    }
  };

  const exportToPDF = async () => {
    try {
      // For PDF generation, we'll create a structured text document
      // In a real application, you'd use a PDF library like jsPDF or react-pdf
      const content = generateReportContent();
      downloadFile(content, 'text/plain', 'screening-report.txt');
      
      toast({
        title: "PDF Export Note",
        description: "PDF export generated as text file. Consider integrating a PDF library for better formatting.",
      });
    } catch (error) {
      throw new Error('Failed to generate PDF');
    }
  };

  const generateReportContent = () => {
    const lines = [];
    lines.push('SYSTEMATIC REVIEW SCREENING REPORT');
    lines.push('=' + '='.repeat(40));
    lines.push('');
    lines.push(`Export Date: ${new Date().toLocaleDateString()}`);
    lines.push(`Project ID: ${projectId}`);
    lines.push('');
    
    if (analytics) {
      lines.push('SUMMARY STATISTICS');
      lines.push('-'.repeat(20));
      lines.push(`Total References: ${references.length}`);
      lines.push(`Screened: ${screeningResults.length}`);
      lines.push(`Agreement Rate: ${analytics.agreementRate?.toFixed(1)}%`);
      lines.push(`Conflicts: ${analytics.conflictAnalysis?.total || 0}`);
      lines.push('');
    }

    lines.push('REFERENCES');
    lines.push('-'.repeat(20));
    references.forEach((ref, index) => {
      const result = screeningResults.find(r => r.reference_id === ref.id);
      lines.push(`${index + 1}. ${ref.title}`);
      lines.push(`   Authors: ${ref.authors}`);
      lines.push(`   Year: ${ref.year} | Journal: ${ref.journal}`);
      
      if (result) {
        lines.push(`   AI Decision: ${result.final_decision} (Agreement: ${result.agreement ? 'Yes' : 'No'})`);
      }
      
      if (ref.user_decision) {
        lines.push(`   User Decision: ${ref.user_decision}`);
      }
      
      lines.push('');
    });

    return lines.join('\n');
  };

  const downloadFile = (content: string, mimeType: string, filename: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      switch (exportFormat) {
        case 'csv':
          await exportToCSV();
          break;
        case 'json':
          await exportToJSON();
          break;
        case 'pdf':
          await exportToPDF();
          break;
        default:
          throw new Error('Unsupported export format');
      }
      
      toast({
        title: "Export successful",
        description: `Data exported as ${exportFormat.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: error.message || "Failed to export data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'csv':
      case 'excel':
        return <FileSpreadsheet className="w-4 h-4" />;
      case 'pdf':
        return <FileImage className="w-4 h-4" />;
      case 'json':
        return <FileText className="w-4 h-4" />;
      default:
        return <Download className="w-4 h-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Export Format Selection */}
        <div>
          <label className="text-sm font-medium mb-3 block">Export Format</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {['csv', 'json', 'pdf'].map((format) => (
              <Button
                key={format}
                variant={exportFormat === format ? "default" : "outline"}
                size="sm"
                onClick={() => setExportFormat(format as any)}
                className="justify-start"
              >
                {getFormatIcon(format)}
                <span className="ml-2 capitalize">{format}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Include Options */}
        <div>
          <label className="text-sm font-medium mb-3 block">Include in Export</label>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="basic-info"
                checked={includeOptions.basicInfo}
                onCheckedChange={(checked) => 
                  setIncludeOptions(prev => ({ ...prev, basicInfo: !!checked }))
                }
              />
              <label htmlFor="basic-info" className="text-sm">
                Basic reference information (title, authors, year, etc.)
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="ai-decisions"
                checked={includeOptions.aiDecisions}
                onCheckedChange={(checked) => 
                  setIncludeOptions(prev => ({ ...prev, aiDecisions: !!checked }))
                }
              />
              <label htmlFor="ai-decisions" className="text-sm">
                AI screening decisions and confidence scores
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="detailed-reasoning"
                checked={includeOptions.detailedReasoning}
                onCheckedChange={(checked) => 
                  setIncludeOptions(prev => ({ ...prev, detailedReasoning: !!checked }))
                }
              />
              <label htmlFor="detailed-reasoning" className="text-sm">
                Detailed AI reasoning (increases file size)
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="user-decisions"
                checked={includeOptions.userDecisions}
                onCheckedChange={(checked) => 
                  setIncludeOptions(prev => ({ ...prev, userDecisions: !!checked }))
                }
              />
              <label htmlFor="user-decisions" className="text-sm">
                Manual review decisions and notes
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="analytics"
                checked={includeOptions.analytics}
                onCheckedChange={(checked) => 
                  setIncludeOptions(prev => ({ ...prev, analytics: !!checked }))
                }
              />
              <label htmlFor="analytics" className="text-sm">
                Analytics and summary statistics
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="logs"
                checked={includeOptions.logs}
                onCheckedChange={(checked) => 
                  setIncludeOptions(prev => ({ ...prev, logs: !!checked }))
                }
              />
              <label htmlFor="logs" className="text-sm">
                Complete screening logs (large file)
              </label>
            </div>
          </div>
        </div>

        {/* Export Summary */}
        <div className="p-3 bg-muted rounded-md">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>References to export:</span>
              <Badge variant="outline">{references.length}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Screening results:</span>
              <Badge variant="outline">{screeningResults.length}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Format:</span>
              <Badge variant="outline">{exportFormat.toUpperCase()}</Badge>
            </div>
          </div>
        </div>

        {/* Export Button */}
        <Button
          onClick={handleExport}
          disabled={loading || references.length === 0}
          className="w-full"
        >
          {loading ? (
            'Exporting...'
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Export {exportFormat.toUpperCase()}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ExportPanel;