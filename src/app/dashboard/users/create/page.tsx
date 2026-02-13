'use client';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Unit } from '@/types';
import { toast } from 'react-hot-toast';
import { FaUser, FaEnvelope, FaPhone, FaBuilding, FaBriefcase, FaUserPlus, FaSpinner } from 'react-icons/fa';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const createUserSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  role: z.enum(['tenant', 'propertyOwner', 'service', 'mixedProvider']),
  phoneNumber: z.string().optional(),
  idNumber: z.string().optional(),
  unitId: z.string().optional(),
  serviceType: z.string().optional(),
  companyName: z.string().optional()
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

export default function CreateUserPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const methods = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: '',
      email: '',
      role: 'tenant',
      phoneNumber: '',
      idNumber: '',
      unitId: '',
      serviceType: '',
      companyName: ''
    }
  });

  const { register, handleSubmit, formState: { errors }, watch } = methods;
  const selectedRole = watch('role');

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const unitsQuery = query(collection(db, 'units'), orderBy('fullUnitNumber'));
      const unitsSnapshot = await getDocs(unitsQuery);
      const unitsData = unitsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Unit[];
      setUnits(unitsData);
    } catch (error) {
      console.error('Error fetching units:', error);
      toast.error('Failed to fetch units');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: CreateUserFormValues) => {
    setSubmitting(true);
    try {
      console.log('Creating user with data:', data);
      
      // Create user document in Firestore
      const userData = {
        ...data,
        isApproved: true, // Admin-created users are automatically approved
        hasSetPassword: false, // They need to set password on first login
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('User data to be saved:', userData);

      const docRef = await addDoc(collection(db, 'users'), userData);
      console.log('User document created with ID:', docRef.id);
      
      // Generate magic link and send email
      await sendMagicLink(data.email, docRef.id);
      
      toast.success('User created successfully! Magic link sent to their email.');
      
      // Reset form
      methods.reset();
    } catch (error) {
      console.error('Error creating user:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to create user';
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('magic link')) {
        errorMessage = 'User created but failed to send magic link. Please try again.';
      } else if (errorMsg.includes('permission')) {
        errorMessage = 'Permission denied. Please check your admin access.';
      } else if (errorMsg.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const sendMagicLink = async (email: string, userId: string) => {
    try {
      console.log('Sending magic link for user:', { email, userId });
      
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, userId }),
      });

      console.log('Magic link API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Magic link API error:', errorData);
        throw new Error(errorData.error || 'Failed to send magic link');
      }

      const result = await response.json();
      console.log('Magic link sent successfully:', result);
      
    } catch (error) {
      console.error('Error sending magic link:', error);
      throw error;
    }
  };

  const serviceTypes = [
    "Cleaning",
    "Electrical", 
    "Plumbing",
    "Door Repair",
    "General Maintenance",
    "Air Conditioning",
    "Security",
    "Landscaping"
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New User</h1>
        <p className="text-gray-600 mt-2">Create a new user account and send them a secure login link</p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">
                  <FaUser className="inline mr-2" />
                  Full Name *
                </label>
                <input
                  {...register('fullName')}
                  className="form-input"
                  placeholder="Enter full name"
                />
                {errors.fullName && (
                  <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <label className="form-label">
                  <FaEnvelope className="inline mr-2" />
                  Email Address *
                </label>
                <input
                  {...register('email')}
                  type="email"
                  className="form-input"
                  placeholder="user@example.com"
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">
                  <FaPhone className="inline mr-2" />
                  Phone Number
                </label>
                <input
                  {...register('phoneNumber')}
                  className="form-input"
                  placeholder="+60 12-345 6789"
                />
              </div>

              <div>
                <label className="form-label">ID Number</label>
                <input
                  {...register('idNumber')}
                  className="form-input"
                  placeholder="NRIC/Passport Number"
                />
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Role Assignment</h3>
            
            <div>
              <label className="form-label">User Role *</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'tenant', label: 'Tenant', icon: FaUser, color: 'blue' },
                  { value: 'propertyOwner', label: 'Property Owner', icon: FaBuilding, color: 'green' },
                  { value: 'service', label: 'Service Provider', icon: FaBriefcase, color: 'orange' },
                  { value: 'mixedProvider', label: 'Mixed Provider', icon: FaBriefcase, color: 'purple' }
                ].map(({ value, label, icon: Icon, color }) => (
                  <label key={value} className="relative">
                    <input
                      type="radio"
                      {...register('role')}
                      value={value}
                      className="sr-only"
                    />
                    <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedRole === value 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <Icon className={`w-6 h-6 mx-auto mb-2 text-${color}-600`} />
                      <div className="text-sm font-medium text-center">{label}</div>
                    </div>
                  </label>
                ))}
              </div>
              {errors.role && (
                <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>
              )}
            </div>
          </div>

          {/* Role-specific fields */}
          {selectedRole === 'tenant' && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900">Tenant Information</h3>
              <div>
                <label className="form-label">Assign to Unit (Optional)</label>
                <select
                  {...register('unitId')}
                  className="form-select"
                >
                  <option value="">No unit assignment</option>
                  {units.filter(u => u.status === 'vacant').map(unit => (
                    <option key={unit.id} value={unit.id}>
                      {unit.fullUnitNumber} - {unit.buildingName} (RM {unit.monthlyRent.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {(selectedRole === 'service' || selectedRole === 'mixedProvider') && (
            <div className="space-y-4 p-4 bg-orange-50 rounded-lg">
              <h3 className="font-medium text-orange-900">Service Provider Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Service Type</label>
                  <select
                    {...register('serviceType')}
                    className="form-select"
                  >
                    <option value="">Select service type</option>
                    {serviceTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Company Name</label>
                  <input
                    {...register('companyName')}
                    className="form-input"
                    placeholder="Company name"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <FaSpinner className="animate-spin" />
                  Creating User...
                </>
              ) : (
                <>
                  <FaUserPlus />
                  Create User & Send Login Link
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Information Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">How it works:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• User account is created and automatically approved</li>
          <li>• A secure magic link is sent to their email</li>
          <li>• They click the link to set their password and log in</li>
          <li>• After first login, they use email + password normally</li>
        </ul>
      </div>
    </div>
  );
}


