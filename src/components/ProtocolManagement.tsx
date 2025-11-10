import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ProtocolManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [protocol, setProtocol] = useState({
    title: '',
    objectives: '',
    pico_population: '',
    pico_intervention: '',
    pico_comparator: '',
    pico_outcome: '',
    search_strategy: '',
    inclusion_criteria: '',
    exclusion_criteria: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // For now, save to review_projects table with criteria
      const { error } = await supabase
        .from('review_projects')
        .insert({
          name: protocol.title,
          description: protocol.objectives,
          population: protocol.pico_population,
          intervention: protocol.pico_intervention,
          comparator: protocol.pico_comparator,
          outcome: protocol.pico_outcome,
          criteria: {
            search_strategy: protocol.search_strategy,
            inclusion_criteria: protocol.inclusion_criteria.split('\n').filter(c => c.trim()),
            exclusion_criteria: protocol.exclusion_criteria.split('\n').filter(c => c.trim())
          },
          user_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Protocol saved successfully",
      });

      // Reset form
      setProtocol({
        title: '',
        objectives: '',
        pico_population: '',
        pico_intervention: '',
        pico_comparator: '',
        pico_outcome: '',
        search_strategy: '',
        inclusion_criteria: '',
        exclusion_criteria: ''
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Systematic Review Protocol</CardTitle>
          <CardDescription>
            Create and manage systematic review protocols following PRISMA guidelines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Protocol Title</label>
              <Input
                value={protocol.title}
                onChange={(e) => setProtocol({ ...protocol, title: e.target.value })}
                placeholder="Enter protocol title"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Objectives</label>
              <Textarea
                value={protocol.objectives}
                onChange={(e) => setProtocol({ ...protocol, objectives: e.target.value })}
                placeholder="Primary and secondary objectives"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Population</label>
                <Input
                  value={protocol.pico_population}
                  onChange={(e) => setProtocol({ ...protocol, pico_population: e.target.value })}
                  placeholder="Target population"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Intervention</label>
                <Input
                  value={protocol.pico_intervention}
                  onChange={(e) => setProtocol({ ...protocol, pico_intervention: e.target.value })}
                  placeholder="Intervention being studied"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Comparator</label>
                <Input
                  value={protocol.pico_comparator}
                  onChange={(e) => setProtocol({ ...protocol, pico_comparator: e.target.value })}
                  placeholder="Control or comparison"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Outcome</label>
                <Input
                  value={protocol.pico_outcome}
                  onChange={(e) => setProtocol({ ...protocol, pico_outcome: e.target.value })}
                  placeholder="Primary outcome measures"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Search Strategy</label>
              <Textarea
                value={protocol.search_strategy}
                onChange={(e) => setProtocol({ ...protocol, search_strategy: e.target.value })}
                placeholder="Databases, search terms, and search strategy"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Inclusion Criteria</label>
                <Textarea
                  value={protocol.inclusion_criteria}
                  onChange={(e) => setProtocol({ ...protocol, inclusion_criteria: e.target.value })}
                  placeholder="One criterion per line"
                  rows={4}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Exclusion Criteria</label>
                <Textarea
                  value={protocol.exclusion_criteria}
                  onChange={(e) => setProtocol({ ...protocol, exclusion_criteria: e.target.value })}
                  placeholder="One criterion per line"
                  rows={4}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Protocol'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Protocol Status</CardTitle>
          <CardDescription>Current protocol compliance and registration status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Badge variant="outline">Draft</Badge>
            <Badge variant="secondary">PRISMA Compliant</Badge>
            <Badge variant="outline">Not Registered</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProtocolManagement;