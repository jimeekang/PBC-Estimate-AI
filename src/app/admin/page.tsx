'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import EstimatesTable from '@/components/admin/estimates-table';

const AdminPage = () => {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAdmin) {
    return (
        <div>
            <p>You are not authorized to view this page.</p>
        </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <EstimatesTable />
    </div>
  );
};

export default AdminPage;
