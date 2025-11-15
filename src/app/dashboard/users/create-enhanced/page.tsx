'use client';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Unit, UserRole } from '@/types';
import { toast } from 'react-hot-toast';
import { 
  FaUser, FaEnvelope, FaPhone, FaBuilding, FaBriefcase, 
  FaUserPlus, FaSpinner, FaHome, FaKey, FaCheckCircle,
  FaInfoCircle, FaShieldAlt
} from 'react-icons/fa';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Enhanced validation schema
const createUserSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  role: z.enum(['tenant', 'propertyOwner', 'service', 'mixedProvider']),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
  idNumber: z.string().optional(),
  // Property Owner specific
  assignedProperties: z.array(z.string()).optional(),
  // Tenant specific
  unitId: z.string().optional(),
  moveInDate: z.string().optional(),
  // Service Provider specific
  serviceType: z.string().optional(),
  companyName: z.string().optional(),
  serviceAreas: z.array(z.string()).optional(),
  hourlyRate: z.number().optional(),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

interface Property {
  id: string;
  name: string;
  address: string;
  totalUnits: number;
  ownerId?: string;
}

export default function CreateUserEnhancedPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<UserRole>('tenant');

  const methods = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: '',
      email: '',
      role: 'tenant',
      phoneNumber: '',
      idNumber: '',
      assignedProperties: [],
      unitId: '',
      moveInDate: '',
      serviceType: '',
      companyName: '',
      serviceAreas: [],
      hourlyRate: 0
    }
  });

  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = methods;
  const watchedRole = watch('role');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setSelectedRole(watchedRole);
  }, [watchedRole]);

  const fetchData = async () => {
    try {
      // Fetch units
      const unitsQuery = query(collection(db, 'units'), orderBy('fullUnitNumber'));
      const unitsSnapshot = await getDocs(unitsQuery);
      const unitsData = unitsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Unit[];
      setUnits(unitsData);

      // Fetch properties
      const propertiesQuery = query(collection(db, 'buildings'), orderBy('name'));
      const propertiesSnapshot = await getDocs(propertiesQuery);
      const propertiesData = propertiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Property[];
      setProperties(propertiesData);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: CreateUserFormValues) => {
    setSubmitting(true);
    try {
      // Create user document with enhanced data
      const userData = {
        ...data,
        isApproved: true,
        hasSetPassword: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Add role-specific metadata
        ...(data.role === 'propertyOwner' && {
          assignedProperties: data.assignedProperties || [],
          totalProperties: data.assignedProperties?.length || 0
        }),
        ...(data.role === 'tenant' && {
          unitId: data.unitId,
          moveInDate: data.moveInDate,
          rentalStatus: 'active'
        }),
        ...((data.role === 'service' || data.role === 'mixedProvider') && {
          serviceType: data.serviceType,
          companyName: data.companyName,
          serviceAreas: data.serviceAreas || [],
          hourlyRate: data.hourlyRate || 0,
          serviceStatus: 'active'
        })
      };

      const docRef = await addDoc(collection(db, 'users'), userData);
      
      // Send professional welcome email
      await sendWelcomeEmail(data.email, docRef.id, data.role, data);
      
      toast.success(`${getRoleDisplayName(data.role)} created successfully! Welcome email sent.`);
      
      // Reset form
      reset();
      setCurrentStep(1);
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const sendWelcomeEmail = async (email: string, userId: string, role: UserRole, userData: CreateUserFormValues) => {
    try {
      const response = await fetch('/api/auth/send-welcome-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          userId, 
          role, 
          userData,
          emailType: 'welcome'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send welcome email');
      }
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  };

  const getRoleDisplayName = (role: UserRole) => {
    const roleNames = {
      tenant: 'Tenant',
      propertyOwner: 'Property Owner',
      service: 'Service Provider',
      mixedProvider: 'Mixed Service Provider'
    };
    return roleNames[role] || role;
  };

  const getRoleDescription = (role: UserRole) => {
    const descriptions = {
      tenant: 'Residents who rent units and need access to their personal dashboard',
      propertyOwner: 'Property owners who need to manage their properties and tenants',
      service: 'Contractors and vendors who provide maintenance services',
      mixedProvider: 'Service providers who offer multiple types of services'
    };
    return descriptions[role] || '';
  };

  const getRoleIcon = (role: UserRole) => {
    const icons = {
      tenant: FaUser,
      propertyOwner: FaBuilding,
      service: FaBriefcase,
      mixedProvider: FaBriefcase
    };
    return icons[role] || FaUser;
  };

  const getRoleColor = (role: UserRole) => {
    const colors = {
      tenant: 'blue',
      propertyOwner: 'green',
      service: 'orange',
      mixedProvider: 'purple'
    };
    return colors[role] || 'gray';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New User</h1>
        <p className="text-gray-600 mt-2">
          Add new users to your property management system with professional onboarding
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[
            { step: 1, title: 'User Type', icon: FaUser },
            { step: 2, title: 'Basic Info', icon: FaInfoCircle },
            { step: 3, title: 'Role Details', icon: FaShieldAlt },
            { step: 4, title: 'Review & Create', icon: FaCheckCircle }
          ].map(({ step, title, icon: Icon }) => (
            <div key={step} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep >= step 
                  ? 'bg-green-600 border-green-600 text-white' 
                  : 'border-gray-300 text-gray-400'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`ml-2 text-sm font-medium ${
                currentStep >= step ? 'text-green-600' : 'text-gray-400'
              }`}>
                {title}
              </span>
              {step < 4 && (
                <div className={`w-16 h-0.5 mx-4 ${
                  currentStep > step ? 'bg-green-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Step 1: User Type Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Select User Type</h3>
                <p className="text-gray-600 mb-6">
                  Choose the type of user you want to create. Each type has different permissions and features.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <div className={`p-6 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                      selectedRole === value 
                        ? 'border-green-500 bg-green-50 shadow-md' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <Icon className={`w-8 h-8 mx-auto mb-3 text-${color}-600`} />
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">{label}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {getRoleDescription(value as UserRole)}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="btn-primary"
                >
                  Next: Basic Information
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Basic Information */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Basic Information</h3>
                <p className="text-gray-600">
                  Enter the essential details for the {getRoleDisplayName(selectedRole).toLowerCase()}.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <div>
                  <label className="form-label">
                    <FaPhone className="inline mr-2" />
                    Phone Number *
                  </label>
                  <input
                    {...register('phoneNumber')}
                    className="form-input"
                    placeholder="+60 12-345 6789"
                  />
                  {errors.phoneNumber && (
                    <p className="text-red-500 text-xs mt-1">{errors.phoneNumber.message}</p>
                  )}
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
              
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="btn-secondary"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="btn-primary"
                >
                  Next: Role Details
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Role-Specific Details */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {getRoleDisplayName(selectedRole)} Details
                </h3>
                <p className="text-gray-600">
                  Configure specific settings for this {getRoleDisplayName(selectedRole).toLowerCase()}.
                </p>
              </div>

              {/* Property Owner Details */}
              {selectedRole === 'propertyOwner' && (
                <div className="space-y-4 p-6 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-900 flex items-center">
                    <FaBuilding className="mr-2" />
                    Property Assignment
                  </h4>
                  <div>
                    <label className="form-label">Assign Properties</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {properties.map(property => (
                        <label key={property.id} className="flex items-center">
                          <input
                            type="checkbox"
                            value={property.id}
                            {...register('assignedProperties')}
                            className="mr-2"
                          />
                          <span className="text-sm">
                            {property.name} - {property.address}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tenant Details */}
              {selectedRole === 'tenant' && (
                <div className="space-y-4 p-6 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 flex items-center">
                    <FaHome className="mr-2" />
                    Unit Assignment
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Assign to Unit</label>
                      <select
                        {...register('unitId')}
                        className="form-select"
                      >
                        <option value="">Select a unit</option>
                        {units.filter(u => u.status === 'vacant').map(unit => (
                          <option key={unit.id} value={unit.id}>
                            {unit.fullUnitNumber} - {unit.buildingName} (RM {unit.monthlyRent.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Move-in Date</label>
                      <input
                        {...register('moveInDate')}
                        type="date"
                        className="form-input"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Service Provider Details */}
              {(selectedRole === 'service' || selectedRole === 'mixedProvider') && (
                <div className="space-y-4 p-6 bg-orange-50 rounded-lg border border-orange-200">
                  <h4 className="font-semibold text-orange-900 flex items-center">
                    <FaBriefcase className="mr-2" />
                    Service Configuration
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Service Type</label>
                      <select
                        {...register('serviceType')}
                        className="form-select"
                      >
                        <option value="">Select service type</option>
                        <option value="Cleaning">Cleaning</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Plumbing">Plumbing</option>
                        <option value="Door Repair">Door Repair</option>
                        <option value="General Maintenance">General Maintenance</option>
                        <option value="Air Conditioning">Air Conditioning</option>
                        <option value="Security">Security</option>
                        <option value="Landscaping">Landscaping</option>
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
                    <div>
                      <label className="form-label">Hourly Rate (RM)</label>
                      <input
                        {...register('hourlyRate', { valueAsNumber: true })}
                        type="number"
                        step="0.01"
                        className="form-input"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="btn-secondary"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="btn-primary"
                >
                  Next: Review & Create
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Create */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Review & Create</h3>
                <p className="text-gray-600">
                  Review the information before creating the user account.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <h4 className="font-semibold text-gray-900">User Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Name:</span> {watch('fullName')}
                  </div>
                  <div>
                    <span className="font-medium">Email:</span> {watch('email')}
                  </div>
                  <div>
                    <span className="font-medium">Phone:</span> {watch('phoneNumber')}
                  </div>
                  <div>
                    <span className="font-medium">Role:</span> {getRoleDisplayName(selectedRole)}
                  </div>
                  {watch('idNumber') && (
                    <div>
                      <span className="font-medium">ID Number:</span> {watch('idNumber')}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• User account will be created and automatically approved</li>
                  <li>• Professional welcome email will be sent to their email address</li>
                  <li>• They'll receive a secure magic link to set their password</li>
                  <li>• After password setup, they'll have access to their role-specific dashboard</li>
                </ul>
              </div>
              
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="btn-secondary"
                >
                  Back
                </button>
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
                      Create User & Send Welcome Email
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

