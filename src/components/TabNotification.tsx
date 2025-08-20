import React from 'react';
import { Badge } from '@/components/ui/badge';

interface TabNotificationProps {
  hasNewData: boolean;
  children: React.ReactNode;
}

export const TabNotification: React.FC<TabNotificationProps> = ({ hasNewData, children }) => {
  return (
    <div className="flex items-center gap-2">
      {children}
      {hasNewData && (
        <Badge variant="destructive" className="animate-pulse text-xs">
          New
        </Badge>
      )}
    </div>
  );
};