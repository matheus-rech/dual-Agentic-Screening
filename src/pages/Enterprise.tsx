import React from 'react';
import Header from '@/components/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProtocolManagement from '@/components/ProtocolManagement';
import QualityAssuranceDashboard from '@/components/QualityAssuranceDashboard';
import StatisticalAnalysis from '@/components/StatisticalAnalysis';

const Enterprise = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Enterprise Research Platform
          </h1>
          <p className="text-muted-foreground">
            Advanced tools for systematic reviews with scientific rigor and compliance
          </p>
        </div>
        
        <Tabs defaultValue="protocols" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="protocols">Protocol Management</TabsTrigger>
            <TabsTrigger value="quality">Quality Assurance</TabsTrigger>
            <TabsTrigger value="analysis">Statistical Analysis</TabsTrigger>
          </TabsList>
          
          <TabsContent value="protocols" className="mt-6">
            <ProtocolManagement />
          </TabsContent>
          
          <TabsContent value="quality" className="mt-6">
            <QualityAssuranceDashboard />
          </TabsContent>
          
          <TabsContent value="analysis" className="mt-6">
            <StatisticalAnalysis />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Enterprise;