import React from 'react';
import Header from '@/components/Header';
import RoleManagement from '@/components/RoleManagement';

const RoleManagementPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Role Management
          </h1>
          <p className="text-muted-foreground">
            Manage user roles and permissions for secure access control
          </p>
        </div>
        <RoleManagement />
      </main>
    </div>
  );
};

export default RoleManagementPage;