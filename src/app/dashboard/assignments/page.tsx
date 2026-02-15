'use client';
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Unit } from '@/types';
import { toast } from 'react-hot-toast';
import { FaUser, FaCheck, FaTimes, FaBuilding, FaSearch } from 'react-icons/fa';

export default function TenantUnitAssignmentsPage() {
  const [tenants, setTenants] = useState<User[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');

  const toDateSafe = (value: unknown): Date => {
    if (!value) return new Date();
    if (typeof value === 'string') return new Date(value);
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') return (value as { toDate: () => Date }).toDate();
    if (typeof value === 'object' && value !== null && 'seconds' in value) return new Date((value as { seconds: number }).seconds * 1000);
    try { return new Date(value as string | number); } catch { return new Date(); }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const fetchData = async () => {
    try {
      // Fetch tenants
      // Use only equality filters to avoid composite index requirement; sort client-side
      const tenantsQuery = query(
        collection(db, 'users'), 
        where('role', '==', 'tenant'), 
        where('isApproved', '==', true)
      );
      const tenantsSnapshot = await getDocs(tenantsQuery);
      const tenantsData = tenantsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toDateSafe(doc.data().createdAt),
        updatedAt: toDateSafe(doc.data().updatedAt)
      })) as User[];
      tenantsData.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
      setTenants(tenantsData);

      // Fetch units
      const unitsQuery = query(collection(db, 'units'), orderBy('fullUnitNumber'));
      const unitsSnapshot = await getDocs(unitsQuery);
      const unitsData = unitsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toDateSafe(doc.data().createdAt),
        updatedAt: toDateSafe(doc.data().updatedAt)
      })) as Unit[];
      setUnits(unitsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTenant = async (tenantId: string, unitId: string) => {
    try {
      const unit = units.find(u => u.id === unitId);
      const tenant = tenants.find(t => t.id === tenantId);
      
      if (!unit || !tenant) {
        toast.error('Unit or tenant not found');
        return;
      }

      // Update unit with tenant assignment
      await updateDoc(doc(db, 'units', unitId), {
        currentTenantId: tenantId,
        currentTenantName: tenant.fullName,
        status: 'occupied',
        updatedAt: new Date().toISOString()
      });

      // Update tenant with unit assignment
      await updateDoc(doc(db, 'users', tenantId), {
        unitNumber: unit.fullUnitNumber,
        buildingName: unit.buildingName,
        updatedAt: new Date().toISOString()
      });

      toast.success(`${tenant.fullName} assigned to ${unit.fullUnitNumber}`);
      // Reset selections and refresh
      setSelectedTenantId('');
      setSelectedUnitId('');
      fetchData();
    } catch (error) {
      console.error('Error assigning tenant:', error);
      toast.error('Failed to assign tenant');
    }
  };

  const handleUnassignTenant = async (unitId: string) => {
    try {
      const unit = units.find(u => u.id === unitId);
      if (!unit) {
        toast.error('Unit not found');
        return;
      }

      // Update unit to remove tenant assignment
      await updateDoc(doc(db, 'units', unitId), {
        currentTenantId: null,
        currentTenantName: null,
        status: 'vacant',
        updatedAt: new Date().toISOString()
      });

      // Update tenant to remove unit assignment only if the user document still exists
      if (unit.currentTenantId) {
        const userRef = doc(db, 'users', unit.currentTenantId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          await updateDoc(userRef, {
            unitNumber: null,
            buildingName: null,
            updatedAt: new Date().toISOString()
          });
        }
      }

      toast.success(`Tenant unassigned from ${unit.fullUnitNumber}`);
      fetchData();
    } catch (error) {
      console.error('Error unassigning tenant:', error);
      toast.error('Failed to unassign tenant');
    }
  };

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tenant.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'assigned') {
      return matchesSearch && tenant.unitNumber;
    } else if (filterStatus === 'unassigned') {
      return matchesSearch && !tenant.unitNumber;
    }
    
    return matchesSearch;
  });

  const filteredUnits = units.filter(unit => {
    const matchesSearch = unit.fullUnitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         unit.buildingName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'occupied': return 'badge-success';
      case 'vacant': return 'badge-gray';
      case 'maintenance': return 'badge-warning';
      default: return 'badge-gray';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'occupied': return 'Leased';
      case 'vacant': return 'Vacant';
      case 'maintenance': return 'Maintenance';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tenant-Unit Assignments</h1>
        <p className="text-gray-600 mt-2">Manage tenant assignments to units</p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tenants or units..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'assigned' | 'unassigned')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="all">All Tenants</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tenants Section */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <FaUser className="mr-2" />
            Tenants ({filteredTenants.length})
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredTenants.map((tenant) => (
              <div key={tenant.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{tenant.fullName}</h3>
                    <p className="text-sm text-gray-600">{tenant.email}</p>
                    {tenant.phoneNumber && (
                      <p className="text-sm text-gray-500">{tenant.phoneNumber}</p>
                    )}
                    {tenant.unitNumber && (
                      <div className="mt-2">
                        <span className="badge badge-success">
                          Assigned to {tenant.unitNumber}
                        </span>
                      </div>
                    )}
                  </div>
                  {!tenant.unitNumber && (
                    <div className="ml-4">
                      <span className="badge badge-gray">Unassigned</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredTenants.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No tenants found
              </div>
            )}
          </div>
        </div>

        {/* Units Section */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <FaBuilding className="mr-2" />
            Units ({filteredUnits.length})
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredUnits.map((unit) => (
              <div key={unit.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{unit.fullUnitNumber}</h3>
                    <p className="text-sm text-gray-600">{unit.buildingName}</p>
                    <p className="text-sm text-gray-500">RM {unit.monthlyRent.toLocaleString()}/month</p>
                    {unit.currentTenantName && (
                      <div className="mt-2">
                        <span className="badge badge-success">
                          Leased to {unit.currentTenantName}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex flex-col gap-2">
                    <span className={`badge ${getStatusColor(unit.status)}`}>
                      {getStatusLabel(unit.status)}
                    </span>
                    {unit.status === 'occupied' ? (
                      <button
                        onClick={() => handleUnassignTenant(unit.id)}
                        className="btn-secondary text-xs py-1 px-2"
                      >
                        <FaTimes className="inline mr-1" />
                        Unassign
                      </button>
                    ) : (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAssignTenant(e.target.value, unit.id);
                            e.target.value = '';
                          }
                        }}
                        className="text-xs py-1 px-2 border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                        defaultValue=""
                      >
                        <option value="">Assign Tenant</option>
                        {tenants.filter(t => !t.unitNumber).map(tenant => (
                          <option key={tenant.id} value={tenant.id}>
                            {tenant.fullName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredUnits.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No units found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Assignment Section */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Assignment</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Select Tenant</label>
          <select className="form-select" value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)}>
              <option value="">Choose a tenant</option>
              {tenants.filter(t => !t.unitNumber).map(tenant => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.fullName} ({tenant.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Select Unit</label>
          <select className="form-select" value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}>
              <option value="">Choose a unit</option>
              {units.filter(u => u.status === 'vacant').map(unit => (
                <option key={unit.id} value={unit.id}>
                  {unit.fullUnitNumber} - {unit.buildingName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
        <button className="btn-primary disabled:opacity-50" disabled={!selectedTenantId || !selectedUnitId} onClick={() => handleAssignTenant(selectedTenantId, selectedUnitId)}>
            <FaCheck className="inline mr-2" />
            Assign Tenant to Unit
          </button>
        </div>
      </div>
    </div>
  );
}



