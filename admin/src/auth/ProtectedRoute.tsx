import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { ShieldX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isAdmin, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading session…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
              <ShieldX className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Not authorized</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your account is signed in but does not have the{' '}
                <code className="rounded bg-muted px-1 font-mono text-xs">admin</code> role. Ask a
                project owner to set{' '}
                <code className="rounded bg-muted px-1 font-mono text-xs">
                  app_metadata.role = &quot;admin&quot;
                </code>{' '}
                on your user.
              </p>
            </div>
            <Button variant="outline" onClick={signOut}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
