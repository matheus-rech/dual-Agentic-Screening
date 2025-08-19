import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, UserMinus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'researcher' | 'user';
  created_at: string;
  profiles?: {
    email: string;
    full_name: string;
  };
}

const RoleManagement = () => {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'researcher' | 'user'>('user');
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminStatus();
    loadUserRoles();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;

    try {
      const { data } = await supabase.rpc('current_user_has_role', { _role: 'admin' });
      setIsCurrentUserAdmin(!!data);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const loadUserRoles = async () => {
    try {
      // First get user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;

      // Then get profile data for each user
      const rolesWithProfiles = await Promise.all(
        (rolesData || []).map(async (role) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', role.user_id)
            .single();
          
          return {
            ...role,
            profiles: profile || { email: 'Unknown', full_name: 'Unknown User' }
          };
        })
      );

      setUserRoles(rolesWithProfiles as UserRole[]);
    } catch (error) {
      console.error('Error loading user roles:', error);
      toast({
        title: "Error loading roles",
        description: "Failed to load user roles",
        variant: "destructive",
      });
    }
  };

  const assignRole = async () => {
    if (!newUserEmail || !newUserRole) {
      toast({
        title: "Missing information",
        description: "Please provide email and role",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // First, find the user by email
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newUserEmail.toLowerCase().trim())
        .single();

      if (profileError || !profiles) {
        toast({
          title: "User not found",
          description: "No user found with this email address",
          variant: "destructive",
        });
        return;
      }

      // Then assign the role
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: profiles.id,
          role: newUserRole
        }, {
          onConflict: 'user_id,role'
        });

      if (roleError) throw roleError;

      toast({
        title: "Role assigned",
        description: `Successfully assigned ${newUserRole} role to ${newUserEmail}`,
      });

      setNewUserEmail('');
      setNewUserRole('user');
      loadUserRoles();
    } catch (error) {
      console.error('Error assigning role:', error);
      toast({
        title: "Error assigning role",
        description: "Failed to assign role to user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeRole = async (roleId: string, userEmail: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast({
        title: "Role removed",
        description: `Successfully removed role from ${userEmail}`,
      });

      loadUserRoles();
    } catch (error) {
      console.error('Error removing role:', error);
      toast({
        title: "Error removing role",
        description: "Failed to remove role from user",
        variant: "destructive",
      });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-destructive text-destructive-foreground">Admin</Badge>;
      case 'researcher':
        return <Badge className="bg-primary text-primary-foreground">Researcher</Badge>;
      case 'user':
        return <Badge variant="secondary">User</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (!isCurrentUserAdmin) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center space-y-2">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto" />
            <h3 className="text-lg font-medium">Access Denied</h3>
            <p className="text-muted-foreground">
              You need administrator privileges to access role management.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            User Role Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">Security Notice</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              Paper references can only be modified by users with admin roles. This ensures research integrity and prevents unauthorized citation manipulation.
            </p>
          </div>

          {/* Assign New Role */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">Assign Role to User</h4>
            <div className="flex gap-3">
              <Input
                placeholder="User email address"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="flex-1"
              />
              <Select value={newUserRole} onValueChange={(value: any) => setNewUserRole(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="researcher">Researcher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={assignRole}
                disabled={loading || !newUserEmail}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Assign
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current User Roles */}
      <Card>
        <CardHeader>
          <CardTitle>Current User Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {userRoles.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No user roles assigned yet.
              </p>
            ) : (
              userRoles.map((userRole) => (
                <div
                  key={userRole.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium">
                        {userRole.profiles?.full_name || userRole.profiles?.email || 'Unknown User'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {userRole.profiles?.email}
                      </div>
                    </div>
                    {getRoleBadge(userRole.role)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(userRole.created_at).toLocaleDateString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeRole(userRole.id, userRole.profiles?.email || '')}
                      disabled={userRole.user_id === user?.id} // Prevent self-removal
                    >
                      <UserMinus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role Descriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Role Descriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge className="bg-destructive text-destructive-foreground">Admin</Badge>
              <div className="text-sm">
                <div className="font-medium">Administrator</div>
                <div className="text-muted-foreground">
                  Full access to all features including paper reference management, user role assignment, and system configuration.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="bg-primary text-primary-foreground">Researcher</Badge>
              <div className="text-sm">
                <div className="font-medium">Researcher</div>
                <div className="text-muted-foreground">
                  Can create and manage their own review projects and references, but cannot modify paper references or manage users.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary">User</Badge>
              <div className="text-sm">
                <div className="font-medium">User</div>
                <div className="text-muted-foreground">
                  Basic access to view public data and participate in collaborative projects when invited.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleManagement;