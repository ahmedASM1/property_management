'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { User } from '@/types';

interface Unit {
  id: string;
  buildingName: string;
  unitNumber: string;
  status: 'available' | 'booked' | 'rented out' | 'in service';
  ownerId?: string;
  rentalType?: string;
  rentPrice?: string | number;
}

const statusOptions = ['available', 'booked', 'rented out', 'in service'] as const;

const buildingNameOptions = [
  'Sky Suite KLCC',
  'Vortex Suite KLCC',
  'Mutiara Ville Cyberjaya',
  'Tamarind Suite Cyberjaya',
  'Cybersquare Cyberjaya',
  '10 Stonor KLCC',
  'Holiday place KLCC',
  'Summer suite KLCC',
  'Cormar Suite KLCC',
  'Star Residences KLCC',
  'Other',
];

const rentalTypeOptions = [
  'Whole Unit',
  'Room 1',
  'Room 2',
  'Room 3',
  'Studio',
];

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [newUnit, setNewUnit] = useState({ buildingName: '', unitNumber: '', status: 'available' as Unit['status'], ownerId: '', rentalType: '', rentPrice: '' });
  const [customBuildingName, setCustomBuildingName] = useState('');
  const [isManaged, setIsManaged] = useState(false);
  const [owners, setOwners] = useState<User[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUnit, setEditUnit] = useState<Partial<Unit & { rentPrice: string }>>({});

  useEffect(() => {
    async function fetchInitialData() {
      // Fetch units
      const unitsSnapshot = await getDocs(collection(db, 'units'));
      setUnits(unitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));
      
      // Fetch owners
      const ownersQuery = query(collection(db, 'users'), where('role', '==', 'owner'));
      const ownersSnapshot = await getDocs(ownersQuery);
      setOwners(ownersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    }
    fetchInitialData();
  }, []);

  async function fetchUnits() {
    const snapshot = await getDocs(collection(db, 'units'));
    setUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));
  }

  async function handleAddUnit(e: React.FormEvent) {
    e.preventDefault();
    const finalBuildingName = newUnit.buildingName === 'Other' ? customBuildingName : newUnit.buildingName;

    if (!finalBuildingName || !newUnit.unitNumber) return;
    
    const unitToAdd: Omit<Unit, 'id'> = {
      buildingName: finalBuildingName,
      unitNumber: newUnit.unitNumber,
      status: newUnit.status,
      rentalType: newUnit.status === 'rented out' ? newUnit.rentalType : '',
      rentPrice: newUnit.status === 'rented out' ? Number(newUnit.rentPrice) : undefined,
    };

    if (isManaged && newUnit.ownerId) {
      unitToAdd.ownerId = newUnit.ownerId;
    }

    await addDoc(collection(db, 'units'), unitToAdd);
    setNewUnit({ buildingName: '', unitNumber: '', status: 'available', ownerId: '', rentalType: '', rentPrice: '' });
    setCustomBuildingName('');
    setIsManaged(false);
    fetchUnits();
  }

  async function handleEditSave(id: string) {
    if (!editUnit.buildingName || !editUnit.unitNumber || !editUnit.status) return;
    const updateData: Partial<Unit> = {
      buildingName: editUnit.buildingName,
      unitNumber: editUnit.unitNumber,
      status: editUnit.status,
      rentalType: editUnit.status === 'rented out' ? (editUnit.rentalType || '') : '',
    };
    if (editUnit.status === 'rented out') {
      updateData.rentPrice = Number(editUnit.rentPrice);
    }
    await updateDoc(doc(db, 'units', id), updateData);
    setEditingId(null);
    setEditUnit({});
    fetchUnits();
  }

  const handleEdit = (unit: Unit) => {
    setEditingId(unit.id);
    setEditUnit({
      ...unit,
      rentPrice: unit.rentPrice !== undefined ? String(unit.rentPrice) : '',
    });
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-2 sm:px-0">
      <div className="mb-4 flex justify-start">
        <Link href="/dashboard">
          <span className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium">&larr; Back to Dashboard</span>
        </Link>
      </div>
      <h2 className="text-2xl font-bold mb-6 text-center">Unit Management</h2>
      {/* Add Unit Form */}
      <form onSubmit={handleAddUnit} className="mb-6 p-4 bg-gray-50 rounded-lg border">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Building Name</label>
            <select
              className="border rounded px-3 py-2 w-full"
          value={newUnit.buildingName}
          onChange={e => setNewUnit({ ...newUnit, buildingName: e.target.value })}
              required
            >
              <option value="">Select Building</option>
              {buildingNameOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {newUnit.buildingName === 'Other' && (
            <div>
              <label className="block text-sm font-medium mb-1">Custom Building Name</label>
              <input
                type="text"
                placeholder="Enter Building Name"
                className="border rounded px-3 py-2 w-full"
                value={customBuildingName}
                onChange={e => setCustomBuildingName(e.target.value)}
          required
        />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-1">Unit Number</label>
        <input
          type="text"
          placeholder="Unit Number"
              className="border rounded px-3 py-2 w-full"
          value={newUnit.unitNumber}
          onChange={e => setNewUnit({ ...newUnit, unitNumber: e.target.value })}
          required
        />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
        <select
              className="border rounded px-3 py-2 w-full"
          value={newUnit.status}
          onChange={e => setNewUnit({ ...newUnit, status: e.target.value as Unit['status'] })}
        >
          {statusOptions.map(status => (
            <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
          ))}
        </select>
          </div>
        </div>
        <div className="mt-4">
            <label className="flex items-center gap-2">
              <input 
                type="checkbox"
                checked={isManaged}
                onChange={(e) => setIsManaged(e.target.checked)}
                className="rounded"
              />
              <span>Assign to a property owner</span>
            </label>
        </div>
        {isManaged && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Select Owner</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={newUnit.ownerId}
              onChange={e => setNewUnit({ ...newUnit, ownerId: e.target.value })}
              required
            >
              <option value="">-- Select an Owner --</option>
              {owners.map(owner => (
                <option key={owner.id} value={owner.id}>{owner.fullName}</option>
              ))}
            </select>
          </div>
        )}
        {newUnit.status === 'rented out' && (
          <>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Rental Type</label>
              <select
                className="border rounded px-3 py-2 w-full"
                value={newUnit.rentalType}
                onChange={e => setNewUnit({ ...newUnit, rentalType: e.target.value })}
                required
              >
                <option value="">Select Rental Type</option>
                {rentalTypeOptions.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Rent Price (RM)</label>
              <input
                type="number"
                min="0"
                className="border rounded px-3 py-2 w-full"
                value={newUnit.rentPrice}
                onChange={e => setNewUnit({ ...newUnit, rentPrice: e.target.value })}
                required
              />
            </div>
          </>
        )}
        <div className="mt-6 flex justify-end">
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Add Unit</button>
        </div>
      </form>
      {/* Table for desktop */}
      <div className="overflow-x-auto hidden md:block">
        <table className="min-w-full bg-white rounded shadow text-sm md:text-base">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Building Name</th>
              <th className="py-2 px-4 border-b">Unit Number</th>
              <th className="py-2 px-4 border-b">Status</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {units.map(unit => (
              <tr key={unit.id} className="border-b last:border-b-0">
                {editingId === unit.id ? (
                  <>
                    <td className="py-2 px-4"><input className="border rounded px-2 py-1 w-full" value={editUnit.buildingName || ''} onChange={e => setEditUnit({ ...editUnit, buildingName: e.target.value })} /></td>
                    <td className="py-2 px-4"><input className="border rounded px-2 py-1 w-full" value={editUnit.unitNumber || ''} onChange={e => setEditUnit({ ...editUnit, unitNumber: e.target.value })} /></td>
                    <td className="py-2 px-4">
                      <select className="border rounded px-2 py-1 w-full" value={editUnit.status || 'available'} onChange={e => setEditUnit({ ...editUnit, status: e.target.value as Unit['status'] })}>
                        {statusOptions.map(status => (
                          <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                        ))}
                      </select>
                      {editUnit.status === 'rented out' && (
                        <>
                          <div className="mt-2">
                            <label className="block text-xs font-medium mb-1">Rental Type</label>
                            <select
                              className="border rounded px-2 py-1 w-full"
                              value={editUnit.rentalType || ''}
                              onChange={e => setEditUnit({ ...editUnit, rentalType: e.target.value })}
                              required
                            >
                              <option value="">Select Rental Type</option>
                              {rentalTypeOptions.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>
                          <div className="mt-2">
                            <label className="block text-xs font-medium mb-1">Rent Price (RM)</label>
                            <input
                              type="number"
                              min="0"
                              className="border rounded px-2 py-1 w-full"
                              value={editUnit.rentPrice || ''}
                              onChange={e => setEditUnit({ ...editUnit, rentPrice: e.target.value })}
                              required
                            />
                          </div>
                        </>
                      )}
                    </td>
                    <td className="py-2 px-4">
                      <button className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 mr-2" onClick={() => handleEditSave(unit.id)}>Save</button>
                      <button className="bg-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-400" onClick={() => { setEditingId(null); setEditUnit({}); }}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 px-4">{unit.buildingName}</td>
                    <td className="py-2 px-4">{unit.unitNumber}</td>
                    <td className="py-2 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold 
                        ${unit.status === 'available' ? 'bg-green-100 text-green-700' : ''}
                        ${unit.status === 'booked' ? 'bg-yellow-100 text-yellow-700' : ''}
                        ${unit.status === 'rented out' ? 'bg-red-100 text-red-700' : ''}
                        ${unit.status === 'in service' ? 'bg-blue-100 text-blue-700' : ''}
                      `}>
                        {unit.status.charAt(0).toUpperCase() + unit.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      <button className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700" onClick={() => handleEdit(unit)}>Edit</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <div className="block md:hidden mt-6 space-y-4">
        {units.map(unit => (
          <div key={unit.id} className="bg-white rounded shadow p-4 flex flex-col gap-2">
            {editingId === unit.id ? (
              <>
                <input className="border rounded px-2 py-1 mb-2" value={editUnit.buildingName || ''} onChange={e => setEditUnit({ ...editUnit, buildingName: e.target.value })} />
                <input className="border rounded px-2 py-1 mb-2" value={editUnit.unitNumber || ''} onChange={e => setEditUnit({ ...editUnit, unitNumber: e.target.value })} />
                <select className="border rounded px-2 py-1 mb-2" value={editUnit.status || 'available'} onChange={e => setEditUnit({ ...editUnit, status: e.target.value as Unit['status'] })}>
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                  ))}
                </select>
                {editUnit.status === 'rented out' && (
                  <>
                    <div className="mt-2">
                      <label className="block text-xs font-medium mb-1">Rental Type</label>
                      <select
                        className="border rounded px-2 py-1 w-full"
                        value={editUnit.rentalType || ''}
                        onChange={e => setEditUnit({ ...editUnit, rentalType: e.target.value })}
                        required
                      >
                        <option value="">Select Rental Type</option>
                        {rentalTypeOptions.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-2">
                      <label className="block text-xs font-medium mb-1">Rent Price (RM)</label>
                      <input
                        type="number"
                        min="0"
                        className="border rounded px-2 py-1 w-full"
                        value={editUnit.rentPrice || ''}
                        onChange={e => setEditUnit({ ...editUnit, rentPrice: e.target.value })}
                        required
                      />
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <button className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700" onClick={() => handleEditSave(unit.id)}>Save</button>
                  <button className="bg-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-400" onClick={() => { setEditingId(null); setEditUnit({}); }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold">{unit.buildingName}</div>
                <div className="text-xs text-gray-500">Unit: {unit.unitNumber}</div>
                <div className="text-xs">
                  Status: <span className={`px-2 py-1 rounded-full text-xs font-semibold 
                    ${unit.status === 'available' ? 'bg-green-100 text-green-700' : ''}
                    ${unit.status === 'booked' ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${unit.status === 'rented out' ? 'bg-red-100 text-red-700' : ''}
                    ${unit.status === 'in service' ? 'bg-blue-100 text-blue-700' : ''}
                  `}>{unit.status.charAt(0).toUpperCase() + unit.status.slice(1)}</span>
                </div>
                <button className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 mt-2 w-full" onClick={() => handleEdit(unit)}>Edit</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 