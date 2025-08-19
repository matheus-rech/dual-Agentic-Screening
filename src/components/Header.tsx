import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Brain, LogOut, User, Shield, Home, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user) {
        try {
          const { data } = await supabase.rpc('current_user_has_role', { _role: 'admin' });
          setIsAdmin(!!data);
        } catch (error) {
          console.error('Error checking admin status:', error);
        }
      }
    };
    checkAdminStatus();
  }, [user]);

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Brain className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              AI-Powered Systematic Review Screening
            </h1>
            <p className="text-sm text-muted-foreground">
              Intelligent Abstract Screening Assistant
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Navigation */}
          {user && (
            <nav className="flex items-center gap-1">
              <Button
                variant={location.pathname === '/' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => navigate('/')}
              >
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
              <Button
                variant={location.pathname === '/criteria' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => navigate('/criteria')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Criteria
              </Button>
              <Button
                variant={location.pathname === '/screening' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => navigate('/screening')}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Screening
              </Button>
              {isAdmin && (
                <Button
                  variant={location.pathname === '/roles' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigate('/roles')}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Roles
                </Button>
              )}
            </nav>
          )}

          {/* User Menu */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {user.email?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem className="flex-col items-start">
                  <div className="font-medium">{user.user_metadata?.full_name || 'User'}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                  {isAdmin && (
                    <div className="text-xs text-orange-600 font-medium">Administrator</div>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/roles')}>
                    <Shield className="mr-2 h-4 w-4" />
                    <span>Manage Roles</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;