import React from 'react';
import { Shield, Lock, Eye, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SecurityNotice = () => {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Shield className="w-5 h-5" />
          Privacy & Security Protection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-blue-800">
        <div className="flex items-start gap-3">
          <Lock className="w-4 h-4 mt-0.5 text-blue-600" />
          <div className="text-sm">
            <div className="font-medium">Email Protection</div>
            <div className="text-blue-700">
              Your email address and personal information are protected by strict security policies. Only you can view your own profile data.
            </div>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <Eye className="w-4 h-4 mt-0.5 text-blue-600" />
          <div className="text-sm">
            <div className="font-medium">Access Control</div>
            <div className="text-blue-700">
              Administrators can only access limited user information necessary for role management through secure, audited functions.
            </div>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-blue-600" />
          <div className="text-sm">
            <div className="font-medium">Data Security</div>
            <div className="text-blue-700">
              All profile access is logged for security monitoring. Your data cannot be harvested or exposed through unauthorized means.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecurityNotice;