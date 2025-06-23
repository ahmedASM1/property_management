import { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ServiceProvider {
  id?: string;
  name: string;
  email: string;
  phone: string;
  serviceTypes: string[];
  active: boolean;
}

const SERVICE_TYPES = [
  'Cleaning',
  'AC Repair',
  'Plumbing',
  'Furniture',
  'Electrical',
  'TV Repair',
  'Other',
];

export default function ServiceProvidersPage() {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [form, setForm] = useState<ServiceProvider>({
    name: '',
    email: '',
    phone: '',
    serviceTypes: [],
    active: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProviders() {
      setLoading(true);
      const snap = await getDocs(collection(db, 'serviceProviders'));
      setProviders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceProvider)));
      setLoading(false);
    }
    fetchProviders();
  }, []);

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    if (name === 'serviceTypes') {
      setForm(f => ({
        ...f,
        serviceTypes: checked
          ? [...f.serviceTypes, value]
          : f.serviceTypes.filter((t) => t !== value),
      }));
    } else if (type === 'checkbox') {
      setForm(f => ({ ...f, [name]: checked }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    const { id, ...formData } = form;
    if (editId) {
      await updateDoc(doc(db, 'serviceProviders', editId), formData);
    } else {
      await addDoc(collection(db, 'serviceProviders'), formData);
    }
    setForm({ name: '', email: '', phone: '', serviceTypes: [], active: true });
    setEditId(null);
    const snap = await getDocs(collection(db, 'serviceProviders'));
    setProviders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceProvider)));
    setSaving(false);
  };

  const handleEdit = (provider: ServiceProvider) => {
    setForm(provider);
    setEditId(provider.id!);
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-2">
      <h1 className="text-2xl font-bold mb-6 text-center">Service Providers</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded shadow p-6 mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1">Name</label>
            <input name="name" value={form.name} onChange={handleChange} className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block font-semibold mb-1">Email</label>
            <input name="email" value={form.email} onChange={handleChange} className="w-full border rounded px-3 py-2" required type="email" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Phone</label>
            <input name="phone" value={form.phone} onChange={handleChange} className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block font-semibold mb-1">Active</label>
            <input name="active" type="checkbox" checked={form.active} onChange={handleChange} className="ml-2" />
          </div>
        </div>
        <div>
          <label className="block font-semibold mb-1">Service Types</label>
          <div className="flex flex-wrap gap-3">
            {SERVICE_TYPES.map(type => (
              <label key={type} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name="serviceTypes"
                  value={type}
                  checked={form.serviceTypes.includes(type)}
                  onChange={handleChange}
                />
                {type}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition" disabled={saving}>
          {saving ? 'Saving...' : editId ? 'Update Provider' : 'Add Provider'}
        </button>
      </form>
      <h2 className="text-xl font-bold mb-4">All Providers</h2>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-3">
          {providers.map(p => (
            <div key={p.id} className="bg-gray-50 rounded shadow p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-gray-600">{p.email} | {p.phone}</div>
                <div className="text-xs text-gray-500">{p.serviceTypes.join(', ')}</div>
                <div className="text-xs font-medium {p.active ? 'text-green-600' : 'text-red-600'}">{p.active ? 'Active' : 'Inactive'}</div>
              </div>
              <button onClick={() => handleEdit(p)} className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-700 text-sm">Edit</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
 
 
 
import { collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ServiceProvider {
  id?: string;
  name: string;
  email: string;
  phone: string;
  serviceTypes: string[];
  active: boolean;
}

const SERVICE_TYPES = [
  'Cleaning',
  'AC Repair',
  'Plumbing',
  'Furniture',
  'Electrical',
  'TV Repair',
  'Other',
];

export default function ServiceProvidersPage() {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [form, setForm] = useState<ServiceProvider>({
    name: '',
    email: '',
    phone: '',
    serviceTypes: [],
    active: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProviders() {
      setLoading(true);
      const snap = await getDocs(collection(db, 'serviceProviders'));
      setProviders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceProvider)));
      setLoading(false);
    }
    fetchProviders();
  }, []);

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    if (name === 'serviceTypes') {
      setForm(f => ({
        ...f,
        serviceTypes: checked
          ? [...f.serviceTypes, value]
          : f.serviceTypes.filter((t) => t !== value),
      }));
    } else if (type === 'checkbox') {
      setForm(f => ({ ...f, [name]: checked }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    const { id, ...formData } = form;
    if (editId) {
      await updateDoc(doc(db, 'serviceProviders', editId), formData);
    } else {
      await addDoc(collection(db, 'serviceProviders'), formData);
    }
    setForm({ name: '', email: '', phone: '', serviceTypes: [], active: true });
    setEditId(null);
    const snap = await getDocs(collection(db, 'serviceProviders'));
    setProviders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceProvider)));
    setSaving(false);
  };

  const handleEdit = (provider: ServiceProvider) => {
    setForm(provider);
    setEditId(provider.id!);
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-2">
      <h1 className="text-2xl font-bold mb-6 text-center">Service Providers</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded shadow p-6 mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1">Name</label>
            <input name="name" value={form.name} onChange={handleChange} className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block font-semibold mb-1">Email</label>
            <input name="email" value={form.email} onChange={handleChange} className="w-full border rounded px-3 py-2" required type="email" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Phone</label>
            <input name="phone" value={form.phone} onChange={handleChange} className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block font-semibold mb-1">Active</label>
            <input name="active" type="checkbox" checked={form.active} onChange={handleChange} className="ml-2" />
          </div>
        </div>
        <div>
          <label className="block font-semibold mb-1">Service Types</label>
          <div className="flex flex-wrap gap-3">
            {SERVICE_TYPES.map(type => (
              <label key={type} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name="serviceTypes"
                  value={type}
                  checked={form.serviceTypes.includes(type)}
                  onChange={handleChange}
                />
                {type}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition" disabled={saving}>
          {saving ? 'Saving...' : editId ? 'Update Provider' : 'Add Provider'}
        </button>
      </form>
      <h2 className="text-xl font-bold mb-4">All Providers</h2>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-3">
          {providers.map(p => (
            <div key={p.id} className="bg-gray-50 rounded shadow p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-gray-600">{p.email} | {p.phone}</div>
                <div className="text-xs text-gray-500">{p.serviceTypes.join(', ')}</div>
                <div className="text-xs font-medium {p.active ? 'text-green-600' : 'text-red-600'}">{p.active ? 'Active' : 'Inactive'}</div>
              </div>
              <button onClick={() => handleEdit(p)} className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-700 text-sm">Edit</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
 
 
 
import { collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ServiceProvider {
  id?: string;
  name: string;
  email: string;
  phone: string;
  serviceTypes: string[];
  active: boolean;
}

const SERVICE_TYPES = [
  'Cleaning',
  'AC Repair',
  'Plumbing',
  'Furniture',
  'Electrical',
  'TV Repair',
  'Other',
];

export default function ServiceProvidersPage() {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [form, setForm] = useState<ServiceProvider>({
    name: '',
    email: '',
    phone: '',
    serviceTypes: [],
    active: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProviders() {
      setLoading(true);
      const snap = await getDocs(collection(db, 'serviceProviders'));
      setProviders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceProvider)));
      setLoading(false);
    }
    fetchProviders();
  }, []);

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    if (name === 'serviceTypes') {
      setForm(f => ({
        ...f,
        serviceTypes: checked
          ? [...f.serviceTypes, value]
          : f.serviceTypes.filter((t) => t !== value),
      }));
    } else if (type === 'checkbox') {
      setForm(f => ({ ...f, [name]: checked }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    const { id, ...formData } = form;
    if (editId) {
      await updateDoc(doc(db, 'serviceProviders', editId), formData);
    } else {
      await addDoc(collection(db, 'serviceProviders'), formData);
    }
    setForm({ name: '', email: '', phone: '', serviceTypes: [], active: true });
    setEditId(null);
    const snap = await getDocs(collection(db, 'serviceProviders'));
    setProviders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceProvider)));
    setSaving(false);
  };

  const handleEdit = (provider: ServiceProvider) => {
    setForm(provider);
    setEditId(provider.id!);
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-2">
      <h1 className="text-2xl font-bold mb-6 text-center">Service Providers</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded shadow p-6 mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1">Name</label>
            <input name="name" value={form.name} onChange={handleChange} className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block font-semibold mb-1">Email</label>
            <input name="email" value={form.email} onChange={handleChange} className="w-full border rounded px-3 py-2" required type="email" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Phone</label>
            <input name="phone" value={form.phone} onChange={handleChange} className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block font-semibold mb-1">Active</label>
            <input name="active" type="checkbox" checked={form.active} onChange={handleChange} className="ml-2" />
          </div>
        </div>
        <div>
          <label className="block font-semibold mb-1">Service Types</label>
          <div className="flex flex-wrap gap-3">
            {SERVICE_TYPES.map(type => (
              <label key={type} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name="serviceTypes"
                  value={type}
                  checked={form.serviceTypes.includes(type)}
                  onChange={handleChange}
                />
                {type}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition" disabled={saving}>
          {saving ? 'Saving...' : editId ? 'Update Provider' : 'Add Provider'}
        </button>
      </form>
      <h2 className="text-xl font-bold mb-4">All Providers</h2>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-3">
          {providers.map(p => (
            <div key={p.id} className="bg-gray-50 rounded shadow p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-gray-600">{p.email} | {p.phone}</div>
                <div className="text-xs text-gray-500">{p.serviceTypes.join(', ')}</div>
                <div className="text-xs font-medium {p.active ? 'text-green-600' : 'text-red-600'}">{p.active ? 'Active' : 'Inactive'}</div>
              </div>
              <button onClick={() => handleEdit(p)} className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-700 text-sm">Edit</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
 
 
 
import { collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ServiceProvider {
  id?: string;
  name: string;
  email: string;
  phone: string;
  serviceTypes: string[];
  active: boolean;
}

const SERVICE_TYPES = [
  'Cleaning',
  'AC Repair',
  'Plumbing',
  'Furniture',
  'Electrical',
  'TV Repair',
  'Other',
];

export default function ServiceProvidersPage() {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [form, setForm] = useState<ServiceProvider>({
    name: '',
    email: '',
    phone: '',
    serviceTypes: [],
    active: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProviders() {
      setLoading(true);
      const snap = await getDocs(collection(db, 'serviceProviders'));
      setProviders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceProvider)));
      setLoading(false);
    }
    fetchProviders();
  }, []);

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    if (name === 'serviceTypes') {
      setForm(f => ({
        ...f,
        serviceTypes: checked
          ? [...f.serviceTypes, value]
          : f.serviceTypes.filter((t) => t !== value),
      }));
    } else if (type === 'checkbox') {
      setForm(f => ({ ...f, [name]: checked }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    const { id, ...formData } = form;
    if (editId) {
      await updateDoc(doc(db, 'serviceProviders', editId), formData);
    } else {
      await addDoc(collection(db, 'serviceProviders'), formData);
    }
    setForm({ name: '', email: '', phone: '', serviceTypes: [], active: true });
    setEditId(null);
    const snap = await getDocs(collection(db, 'serviceProviders'));
    setProviders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceProvider)));
    setSaving(false);
  };

  const handleEdit = (provider: ServiceProvider) => {
    setForm(provider);
    setEditId(provider.id!);
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-2">
      <h1 className="text-2xl font-bold mb-6 text-center">Service Providers</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded shadow p-6 mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1">Name</label>
            <input name="name" value={form.name} onChange={handleChange} className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block font-semibold mb-1">Email</label>
            <input name="email" value={form.email} onChange={handleChange} className="w-full border rounded px-3 py-2" required type="email" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Phone</label>
            <input name="phone" value={form.phone} onChange={handleChange} className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block font-semibold mb-1">Active</label>
            <input name="active" type="checkbox" checked={form.active} onChange={handleChange} className="ml-2" />
          </div>
        </div>
        <div>
          <label className="block font-semibold mb-1">Service Types</label>
          <div className="flex flex-wrap gap-3">
            {SERVICE_TYPES.map(type => (
              <label key={type} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name="serviceTypes"
                  value={type}
                  checked={form.serviceTypes.includes(type)}
                  onChange={handleChange}
                />
                {type}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition" disabled={saving}>
          {saving ? 'Saving...' : editId ? 'Update Provider' : 'Add Provider'}
        </button>
      </form>
      <h2 className="text-xl font-bold mb-4">All Providers</h2>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-3">
          {providers.map(p => (
            <div key={p.id} className="bg-gray-50 rounded shadow p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-gray-600">{p.email} | {p.phone}</div>
                <div className="text-xs text-gray-500">{p.serviceTypes.join(', ')}</div>
                <div className="text-xs font-medium {p.active ? 'text-green-600' : 'text-red-600'}">{p.active ? 'Active' : 'Inactive'}</div>
              </div>
              <button onClick={() => handleEdit(p)} className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-700 text-sm">Edit</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
 
 
 