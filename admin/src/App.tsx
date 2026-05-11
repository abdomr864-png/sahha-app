import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import ResourcePage from './pages/Resource';
import { isConfigured } from './lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';

export default function App() {
  if (!isConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Setup required</CardTitle>
            <CardDescription>
              <code>admin/.env</code> is missing or has empty values.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Create <code>admin/.env</code> with:
            </p>
            <pre className="rounded-md bg-muted p-3 font-mono text-xs">
              {`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
            </pre>
            <p className="text-muted-foreground">
              Restart <code>npm run dev</code> after creating the file — Vite only reads{' '}
              <code>.env</code> at startup.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="users/:id" element={<UserDetail />} />
        <Route path="r/:slug" element={<ResourcePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
