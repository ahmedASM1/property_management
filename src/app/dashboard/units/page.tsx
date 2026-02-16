'use client';
import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Unit, Building, User, RentalType } from '@/types';
import { toast } from 'react-hot-toast';
import { FaPlus, FaEdit, FaTrash, FaHome, FaUser } from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';

const rentalTypes: RentalType[] = ['Room1', 'Room2', 'Room3', 'Studio', 'Whole Unit'];

export default function UnitsPage() {
  const { user } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [tenants, setTenants] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({
    buildingId: '',
    buildingName: '',
    block: '',
    floor: 0,
    unitNumber: '',
    monthlyRent: 0,
    rentalType: 'Room1' as RentalType,
    size: 0,
    bedrooms: 0,
    bathrooms: 0,
    currentTenantId: '',
    amenities: [] as string[]
  });

  const isAgent = user?.role === 'agent';

  useEffect(() => {
    if (!user) return;
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchData and user used intentionally
  }, [user?.id, user?.role]);

  const fetchData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      let buildingsData: Building[];
      if (isAgent) {
        const buildingsQuery = query(collection(db, 'buildings'), orderBy('name'));
        const buildingsSnapshot = await getDocs(buildingsQuery);
        buildingsData = buildingsSnapshot.docs
          .map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
            };
          }) as Building[];
        buildingsData = buildingsData.filter(b => (b.assignedAgentIds || []).includes(user.id));
      } else {
        const buildingsQuery = query(collection(db, 'buildings'), orderBy('name'));
        const buildingsSnapshot = await getDocs(buildingsQuery);
        buildingsData = buildingsSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
          };
        }) as Building[];
      }
      setBuildings(buildingsData);

      const tenantsQuery = query(collection(db, 'users'), where('role', '==', 'tenant'));
      const tenantsSnapshot = await getDocs(tenantsQuery);
      const tenantsData = tenantsSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
        };
      }) as User[];
      setTenants(tenantsData);

      const buildingIds = new Set(buildingsData.map(b => b.id));
      const unitsQuery = query(collection(db, 'units'), orderBy('fullUnitNumber'));
      const unitsSnapshot = await getDocs(unitsQuery);
      let unitsData = unitsSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
        };
      }) as Unit[];
      if (isAgent) {
        unitsData = unitsData.filter(u => buildingIds.has(u.buildingId));
      }
      setUnits(unitsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const generateFullUnitNumber = (block: string, floor: number, unitNumber: string) => {
    return `${block}-${floor.toString().padStart(2, '0')}-${unitNumber.padStart(2, '0')}`;
  };

  const cleanDataForFirestore = (data: Record<string, unknown>) => {
    const cleaned = { ...data };
    Object.keys(cleaned).forEach(key => {
      if (cleaned[key] === undefined) {
        delete cleaned[key];
      }
    });
    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isAgent && editingUnit) {
        const currentTenantName = formData.currentTenantId
          ? tenants.find(t => t.id === formData.currentTenantId)?.fullName || null
          : null;
        await updateDoc(doc(db, 'units', editingUnit.id), {
          currentTenantId: formData.currentTenantId || null,
          currentTenantName: currentTenantName || null,
          status: formData.currentTenantId ? 'occupied' : 'vacant',
          updatedAt: new Date()
        });
        toast.success('Tenant assignment updated');
        setShowModal(false);
        setEditingUnit(null);
        resetForm();
        fetchData();
        return;
      }

      const selectedBuilding = buildings.find(b => b.id === formData.buildingId);
      if (!selectedBuilding) {
        toast.error('Please select a building');
        return;
      }

      const fullUnitNumber = generateFullUnitNumber(formData.block, formData.floor, formData.unitNumber);
      
      const existingUnit = units.find(u => 
        u.buildingId === formData.buildingId && 
        u.fullUnitNumber === fullUnitNumber && 
        u.id !== editingUnit?.id
      );
      
      if (existingUnit) {
        toast.error('A unit with this number already exists in this building');
        return;
      }

      const unitData = {
        ...formData,
        buildingName: selectedBuilding.name,
        fullUnitNumber,
        status: formData.currentTenantId ? 'occupied' : 'vacant',
        currentTenantName: formData.currentTenantId ? 
          tenants.find(t => t.id === formData.currentTenantId)?.fullName || null : null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const cleanedUnitData = cleanDataForFirestore(unitData);

      if (editingUnit) {
        await updateDoc(doc(db, 'units', editingUnit.id), {
          ...cleanedUnitData,
          updatedAt: new Date()
        });
        toast.success('Unit updated successfully');
      } else {
        await addDoc(collection(db, 'units'), cleanedUnitData);
        toast.success('Unit added successfully');
      }

      setShowModal(false);
      setEditingUnit(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving unit:', error);
      toast.error('Failed to save unit');
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      buildingId: unit.buildingId,
      buildingName: unit.buildingName,
      block: unit.block,
      floor: unit.floor,
      unitNumber: unit.unitNumber,
      monthlyRent: unit.monthlyRent,
      rentalType: unit.rentalType,
      size: unit.size || 0,
      bedrooms: unit.bedrooms || 0,
      bathrooms: unit.bathrooms || 0,
      currentTenantId: unit.currentTenantId || '',
      amenities: unit.amenities || []
    });
    setShowModal(true);
  };

  const handleDelete = async (unit: Unit) => {
    if (window.confirm(`Are you sure you want to delete unit ${unit.fullUnitNumber}?`)) {
      try {
        await deleteDoc(doc(db, 'units', unit.id));
        toast.success('Unit deleted successfully');
        fetchData();
      } catch (error) {
        console.error('Error deleting unit:', error);
        toast.error('Failed to delete unit');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      buildingId: '',
      buildingName: '',
      block: '',
      floor: 0,
      unitNumber: '',
      monthlyRent: 0,
      rentalType: 'Room1',
      size: 0,
      bedrooms: 0,
      bathrooms: 0,
      currentTenantId: '',
      amenities: []
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUnit(null);
    resetForm();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'occupied': return 'bg-green-100 text-green-800';
      case 'vacant': return 'bg-gray-100 text-gray-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
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
    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 truncate">
            {isAgent ? 'Units' : 'Units Management'}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
            {isAgent ? 'Units in your assigned buildings' : 'Manage your property units'}
          </p>
        </div>
        {!isAgent && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-green-600 text-white px-3 py-2 sm:px-4 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 text-sm sm:text-base flex-shrink-0"
          >
            <FaPlus className="w-4 h-4" /> <span className="whitespace-nowrap">Add Unit</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {units.map((unit) => (
          <div key={unit.id} className="bg-white rounded-lg shadow-md p-4 sm:p-6 border border-gray-200 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <FaHome className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-base sm:text-lg text-gray-900 truncate">{unit.fullUnitNumber}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">{unit.buildingName}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(unit)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  title={isAgent ? 'Assign tenant' : 'Edit unit'}
                >
                  <FaEdit />
                </button>
                {!isAgent && (
                  <button
                    onClick={() => handleDelete(unit)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <FaTrash />
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(unit.status)}`}>
                  {getStatusLabel(unit.status)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rent:</span>
                <span className="font-medium">RM {unit.monthlyRent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium">{unit.rentalType}</span>
              </div>
              {unit.currentTenantName && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                  <FaUser className="text-gray-400" />
                  <span className="text-sm text-gray-600">{unit.currentTenantName}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {units.length === 0 && (
        <div className="text-center py-12">
          <FaHome className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No units</h3>
          <p className="mt-1 text-sm text-gray-500">
            {isAgent ? 'No units in your assigned buildings.' : 'Get started by adding a new unit.'}
          </p>
        </div>
      )}

      {/* Add/Edit Unit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-2xl my-auto max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold mb-4">
              {isAgent && editingUnit ? 'Assign Tenant to Unit' : editingUnit ? 'Edit Unit' : 'Add New Unit'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {isAgent && editingUnit ? (
                <>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                    <p><strong>Unit:</strong> {editingUnit.fullUnitNumber} — {editingUnit.buildingName}</p>
                    <p><strong>Rent:</strong> RM {editingUnit.monthlyRent?.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assign Tenant
                    </label>
                    <select
                      value={formData.currentTenantId}
                      onChange={(e) => setFormData({ ...formData, currentTenantId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">No tenant assigned</option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.fullName} ({tenant.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Update Assignment</button>
                  </div>
                </>
              ) : (
                <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Building
                </label>
                <select
                  value={formData.buildingId}
                  onChange={(e) => {
                    const selectedBuilding = buildings.find(b => b.id === e.target.value);
                    setFormData({ 
                      ...formData, 
                      buildingId: e.target.value,
                      buildingName: selectedBuilding?.name || ''
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                >
                  <option value="">Select a building</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Block
                  </label>
                  <input
                    type="text"
                    value={formData.block}
                    onChange={(e) => setFormData({ ...formData, block: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="A"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Floor
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.unitNumber}
                    onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monthly Rent (RM)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.monthlyRent}
                    onChange={(e) => setFormData({ ...formData, monthlyRent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rental Type
                  </label>
                  <select
                    value={formData.rentalType}
                    onChange={(e) => setFormData({ ...formData, rentalType: e.target.value as RentalType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  >
                    {rentalTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Size (sq ft)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bedrooms
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.bedrooms}
                    onChange={(e) => setFormData({ ...formData, bedrooms: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bathrooms
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.bathrooms}
                    onChange={(e) => setFormData({ ...formData, bathrooms: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign Tenant (Optional)
                </label>
                <select
                  value={formData.currentTenantId}
                  onChange={(e) => setFormData({ ...formData, currentTenantId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">No tenant assigned</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.fullName} ({tenant.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  {isAgent && editingUnit ? 'Update Assignment' : editingUnit ? 'Update' : 'Add'} Unit
                </button>
              </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}