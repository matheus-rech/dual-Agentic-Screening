import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const TestScreening = ({ projectId }: { projectId: string }) => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const testEdgeFunction = async () => {
    setTesting(true);
    setResult(null);

    try {
      console.log('Testing edge function with project ID:', projectId);

      const testReference = {
        id: 'test-ref-' + Date.now(),
        title: 'Test Reference for AI Screening',
        abstract: 'This is a test abstract to verify the AI screening functionality is working properly.',
        authors: 'Test Author',
        journal: 'Test Journal',
        year: 2024
      };

      const testCriteria = {
        population: 'Test population',
        intervention: 'Test intervention', 
        comparator: 'Test comparator',
        outcome: 'Test outcome',
        studyDesigns: ['RCT']
      };

      console.log('Calling ai-screening edge function...');
      
      const { data, error } = await supabase.functions.invoke('ai-screening', {
        body: {
          referenceId: testReference.id,
          reference: testReference,
          criteria: testCriteria,
          projectId: projectId
        }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }

      setResult(data);
      
      toast({
        title: "Test Successful",
        description: "AI screening edge function is working properly",
      });
    } catch (error) {
      console.error('Test failed:', error);
      setResult({ error: error.message });
      
      toast({
        title: "Test Failed",
        description: `Error: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="mb-6 border-blue-200">
      <CardHeader>
        <CardTitle className="text-blue-700">Debug: Test AI Screening</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button 
            onClick={testEdgeFunction} 
            disabled={testing}
            variant="outline"
          >
            {testing ? 'Testing...' : 'Test Edge Function'}
          </Button>
          
          {result && (
            <div className="p-4 bg-gray-100 rounded-lg">
              <h4 className="font-semibold mb-2">Test Result:</h4>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TestScreening;