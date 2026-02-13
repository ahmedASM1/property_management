'use client';
import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Building, User } from '@/types';
import { toast } from 'react-hot-toast';
import { FaPlus, FaEdit, FaTrash, FaBuilding } from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';

const predefinedBuildings = [
  "Sky Suite KLCC",
  "Vortex Suite KLCC", 
  "Mutiara Ville Cyberjaya",
  "Tamarind Suite Cyberjaya",
  "Cybersquare Cyberjaya",
  "10 Stonor KLCC",
  "Holiday place KLCC",
  "Summer suite KLCC",
  "Cormar Suite KLCC",
  "Star Residences KLCC"
];

export default function BuildingsPage() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    totalFloors: 0,
    totalUnits: 0,
    description: '',
    amenities: [] as string[],
    assignedAgentIds: [] as string[]
  });

  const isAgent = user?.role === 'agent';

  useEffect(() => {
    if (!user) return;
    fetchBuildings();
    if (user.role === 'admin') fetchAgents();
  }, [user?.id, user?.role]);

  const fetchAgents = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'agent'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
      setAgents(list);
    } catch (e) {
      console.error('Error fetching agents:', e);
    }
  };

  const fetchBuildings = async () => {
    if (!user) return;
    try {
      setLoading(true);
      if (isAgent) {
        try {
          const q = query(
            collection(db, 'buildings'),
            where('assignedAgentIds', 'array-contains', user.id),
            orderBy('name')
          );
          const snapshot = await getDocs(q);
          const buildingsData = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
            };
          }) as Building[];
          setBuildings(buildingsData);
        } catch {
          // Fallback if composite index not yet created: fetch all and filter client-side
          const allQuery = query(collection(db, 'buildings'), orderBy('name'));
          const snapshot = await getDocs(allQuery);
          const allData = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
            };
          }) as Building[];
          setBuildings(allData.filter(b => (b.assignedAgentIds || []).includes(user.id)));
        }
      } else {
        const q = query(collection(db, 'buildings'), orderBy('name'));
        const snapshot = await getDocs(q);
        const buildingsData = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
          };
        }) as Building[];
        setBuildings(buildingsData);
      }
    } catch (error) {
      console.error('Error fetching buildings:', error);
      toast.error('Failed to fetch buildings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const buildingData = {
        name: formData.name,
        address: formData.address,
        totalFloors: formData.totalFloors,
        totalUnits: formData.totalUnits,
        description: formData.description || '',
        amenities: formData.amenities || [],
        assignedAgentIds: formData.assignedAgentIds || [],
        updatedAt: new Date()
      };

      if (editingBuilding) {
        await updateDoc(doc(db, 'buildings', editingBuilding.id), buildingData);
        toast.success('Building updated successfully');
      } else {
        await addDoc(collection(db, 'buildings'), {
          ...buildingData,
          createdAt: new Date()
        });
        toast.success('Building added successfully');
      }

      setShowModal(false);
      setEditingBuilding(null);
      resetForm();
      fetchBuildings();
    } catch (error) {
      console.error('Error saving building:', error);
      toast.error('Failed to save building');
    }
  };

  const handleEdit = (building: Building) => {
    setEditingBuilding(building);
    setFormData({
      name: building.name,
      address: building.address,
      totalFloors: building.totalFloors,
      totalUnits: building.totalUnits,
      description: building.description || '',
      amenities: building.amenities || [],
      assignedAgentIds: building.assignedAgentIds || []
    });
    setShowModal(true);
  };

  const handleDelete = async (building: Building) => {
    if (window.confirm(`Are you sure you want to delete ${building.name}?`)) {
      try {
        await deleteDoc(doc(db, 'buildings', building.id));
        toast.success('Building deleted successfully');
        fetchBuildings();
      } catch (error) {
        console.error('Error deleting building:', error);
        toast.error('Failed to delete building');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      totalFloors: 0,
      totalUnits: 0,
      description: '',
      amenities: [],
      assignedAgentIds: []
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingBuilding(null);
    resetForm();
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isAgent ? 'Buildings' : 'Buildings Management'}
          </h1>
          <p className="text-gray-600 mt-2">
            {isAgent ? 'Buildings assigned to you' : 'Manage your building portfolio'}
          </p>
        </div>
        {!isAgent && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <FaPlus /> Add Building
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {buildings.map((building) => (
          <div key={building.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FaBuilding className="text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">{building.name}</h3>
                  <p className="text-sm text-gray-600">{building.address}</p>
                </div>
              </div>
              {!isAgent && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(building)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(building)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <FaTrash />
                  </button>
                </div>
              )}
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Floors:</span>
                <span className="font-medium">{building.totalFloors}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Units:</span>
                <span className="font-medium">{building.totalUnits}</span>
              </div>
              {building.description && (
                <p className="text-gray-600 mt-3">{building.description}</p>
              )}
              {building.amenities && building.amenities.length > 0 && (
                <div className="mt-3">
                  <p className="text-gray-600 mb-1">Amenities:</p>
                  <div className="flex flex-wrap gap-1">
                    {building.amenities.map((amenity, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {buildings.length === 0 && (
        <div className="text-center py-12">
          <FaBuilding className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No buildings</h3>
          <p className="mt-1 text-sm text-gray-500">
            {isAgent ? 'No buildings have been assigned to you yet.' : 'Get started by adding a new building.'}
          </p>
        </div>
      )}

      {/* Add/Edit Building Modal - admin only */}
      {showModal && !isAgent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">
              {editingBuilding ? 'Edit Building' : 'Add New Building'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Building Name
                </label>
                <select
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                >
                  <option value="">Select a building</option>
                  {predefinedBuildings.map((building) => (
                    <option key={building} value={building}>
                      {building}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Floors
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.totalFloors}
                    onChange={(e) => setFormData({ ...formData, totalFloors: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Units
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.totalUnits}
                    onChange={(e) => setFormData({ ...formData, totalUnits: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign agents (optional)
                </label>
                <p className="text-xs text-gray-500 mb-2">Agents assigned to this building can view it and manage its units and tenants.</p>
                <select
                  multiple
                  value={formData.assignedAgentIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, o => o.value);
                    setFormData({ ...formData, assignedAgentIds: selected });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 min-h-[80px]"
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.fullName} ({agent.email})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple agents.</p>
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
                  {editingBuilding ? 'Update' : 'Add'} Building
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



