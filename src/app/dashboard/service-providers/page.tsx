'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';

interface ServiceProvider {
  id: string;
  name: string;
  services: string[];
}

const SERVICE_TYPES = ["Cleaning", "Electrical", "Plumbing", "Door Repair", "General Maintenance"];

export default function ServiceProvidersPage() {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [form, setForm] = useState<{name: string, services: string[]}>({ name: '', services: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProviders() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'serviceProviders'));
        setProviders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceProvider)));
      } catch (error) {
        console.error("Failed to fetch service providers:", error);
      }
      setLoading(false);
    }
    fetchProviders();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setForm(f => ({
        ...f,
        services: checked
          ? [...f.services, value]
          : f.services.filter(s => s !== value)
      }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.services.length === 0) {
      alert("Please fill out all fields.");
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await updateDoc(doc(db, 'serviceProviders', editId), form);
      } else {
        await addDoc(collection(db, 'serviceProviders'), form);
      }
      setForm({ name: '', services: [] });
      setEditId(null);
      // Refetch after submission
      const snap = await getDocs(collection(db, 'serviceProviders'));
      setProviders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceProvider)));
    } catch (error) {
      console.error("Failed to save provider:", error);
    }
    setSaving(false);
  };

  const handleEdit = (provider: ServiceProvider) => {
    setForm({ name: provider.name, services: provider.services });
    setEditId(provider.id);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this provider?")) {
      try {
        await deleteDoc(doc(db, 'serviceProviders', id));
        setProviders(providers.filter(p => p.id !== id));
      } catch (error) {
        console.error("Failed to delete provider:", error);
      }
    }
  };

  const handleCancelEdit = () => {
    setForm({ name: '', services: [] });
    setEditId(null);
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">Manage Service Providers</h1>

      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">{editId ? 'Edit Provider' : 'Add a New Provider'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Provider Name</label>
            <input id="name" name="name" value={form.name} onChange={handleChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Services Offered</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {SERVICE_TYPES.map(type => (
                <label key={type} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg hover:bg-gray-100 transition">
                  <input
                    type="checkbox"
                    name="services"
                    value={type}
                    checked={form.services.includes(type)}
                    onChange={handleChange}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-800">{type}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-2">
            {editId && (
              <button type="button" onClick={handleCancelEdit} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition" disabled={saving}>
                Cancel
              </button>
            )}
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2" disabled={saving}>
              <FaPlus /> {saving ? 'Saving...' : (editId ? 'Update Provider' : 'Add Provider')}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-md">
        <h2 className="text-xl font-semibold p-6 border-b text-gray-700">Current Providers</h2>
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading providers...</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {providers.map(p => (
              <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-gray-50 transition">
                <div className="flex-1">
                  <p className="font-semibold text-lg text-gray-900">{p.name}</p>
                  <p className="text-sm text-gray-600">{p.services.join(', ')}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(p)} className="p-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition">
                    <FaEdit />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition">
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 
 