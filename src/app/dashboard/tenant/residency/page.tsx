'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FaBuilding, FaMapMarkerAlt, FaHome } from 'react-icons/fa';

interface BuildingDoc {
  id: string;
  name: string;
  address?: string;
  description?: string;
}

export default function TenantResidencyPage() {
  const { user } = useAuth();
  const [building, setBuilding] = useState<BuildingDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        const userSnap = await getDoc(doc(db, 'users', user.id));
        const data = userSnap.data();
        const buildingId = data?.buildingId;
        if (buildingId) {
          const buildingSnap = await getDoc(doc(db, 'buildings', buildingId));
          if (buildingSnap.exists()) {
            setBuilding({
              id: buildingSnap.id,
              ...buildingSnap.data(),
            } as BuildingDoc);
          }
        }
      } catch (e) {
        console.error('Failed to load residency:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.id]);

  if (!user) return null;
  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="animate-pulse rounded-lg bg-gray-200 h-40 w-full" />
      </div>
    );
  }

  const buildingName = building?.name || user.buildingName || '—';
  const unitNumber = user.unitNumber || '—';
  const address = building?.address || '—';

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <FaHome className="text-green-600" />
        My residency
      </h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <FaBuilding className="text-green-600 text-xl" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Building</p>
              <p className="text-lg font-semibold text-gray-900">{buildingName}</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-500">Unit</p>
            <p className="text-lg font-semibold text-gray-900">{unitNumber}</p>
          </div>
          {address && address !== '—' && (
            <div className="border-t border-gray-100 pt-4 flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <FaMapMarkerAlt className="text-gray-600 text-xl" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Address</p>
                <p className="text-gray-900">{address}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-500">
        This information is assigned from your tenancy contract and cannot be edited here.
      </p>
    </div>
  );
}
