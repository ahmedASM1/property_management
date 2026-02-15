'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, EyeOff, Mail, User, Phone, Building, Briefcase } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/types';

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

export default function EnhancedRegisterPage() {
  const { registerUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phoneNumber: '',
    idNumber: '',
    role: 'tenant' as UserRole,
    buildingName: '',
    unitNumber: '',
    rentalType: 'Room1',
    serviceType: '',
    companyName: ''
  });

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      phoneNumber: '',
      idNumber: '',
      role: 'tenant',
      buildingName: '',
      unitNumber: '',
      rentalType: 'Room1',
      serviceType: '',
      companyName: ''
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match.");
      return false;
    }
    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return false;
    }
    if (formData.password.length > 15) {
      toast.error("Password must be at most 15 characters.");
      return false;
    }
    if (!formData.email || !formData.fullName || !formData.phoneNumber) {
      toast.error("Please fill in all required fields.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Mark registration in progress to avoid auth-state race
      if (typeof window !== 'undefined') localStorage.setItem('gb_pending_registration', '1');
      
      const userData = {
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        idNumber: formData.idNumber,
        role: formData.role,
        buildingName: formData.buildingName,
        unitNumber: formData.unitNumber,
        rentalType: formData.rentalType,
        serviceType: formData.serviceType,
        companyName: formData.companyName,
        isApproved: false // Require admin approval
      };

      await registerUser(userData);
      setShowSuccessModal(true);
      resetForm();
    } catch (error: unknown) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      if (typeof window !== 'undefined') localStorage.removeItem('gb_pending_registration');
      setLoading(false);
    }
  };

  if (showSuccessModal) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-lg w-full bg-white p-8 sm:p-10 rounded-2xl shadow-lg text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4 text-green-700">Thank you for registering!</h2>
          <p className="text-gray-600 mb-4">
            We&apos;ve sent a verification link to <strong>{formData.email}</strong>. Please check your email and click the verification link to verify your email address.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-blue-800 font-medium mb-2">What happens next?</p>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Verify your email address by clicking the link we sent you</li>
              <li>Wait for admin approval of your registration</li>
              <li>Once approved, you&apos;ll be able to log in and access your account</li>
            </ol>
            <p className="text-sm text-blue-700 mt-3 font-medium">
              You will be able to log in once your registration has been approved by an administrator.
            </p>
          </div>
          <button
            onClick={() => {
              setShowSuccessModal(false);
              router.push('/login');
            }} 
            className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition duration-300"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-2xl w-full bg-white p-8 sm:p-10 rounded-2xl shadow-lg">
        <header className="text-center mb-8">
          <Image src="/Green Bridge.png" alt="Green Bridge Logo" width={60} height={60} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-600 text-sm mt-1">Join Green Bridge Realty Platform</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">I am a:</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'tenant', label: 'Tenant', icon: User },
                { value: 'propertyOwner', label: 'Property Owner', icon: Building },
                { value: 'service', label: 'Service Provider', icon: Briefcase },
                { value: 'mixedProvider', label: 'Mixed Provider', icon: Briefcase }
              ].map(({ value, label, icon: Icon }) => (
                <label key={value} className="relative">
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={formData.role === value}
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.role === value 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <Icon className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                    <div className="text-sm font-medium text-center">{label}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Your full name"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="+60 12-345 6789"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
              <input
                type="text"
                name="idNumber"
                value={formData.idNumber}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="NRIC/Passport Number"
              />
            </div>
          </div>

          {/* Role-specific fields */}
          {formData.role === 'tenant' && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900">Tenant Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
                  <select
                    name="buildingName"
                    value={formData.buildingName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">Select building</option>
                    {predefinedBuildings.map((building) => (
                      <option key={building} value={building}>{building}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Number</label>
                  <input
                    type="text"
                    name="unitNumber"
                    value={formData.unitNumber}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="A-15-02"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rental Type</label>
                <select
                  name="rentalType"
                  value={formData.rentalType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="Room1">Single Room</option>
                  <option value="Room2">Double Room</option>
                  <option value="Room3">Triple Room</option>
                  <option value="Studio">Studio</option>
                  <option value="Whole Unit">Whole Unit</option>
                </select>
              </div>
            </div>
          )}

          {(formData.role === 'service_provider' || formData.role === 'mixedProvider') && (
            <div className="space-y-4 p-4 bg-orange-50 rounded-lg">
              <h3 className="font-medium text-orange-900">Service Provider Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                  <select
                    name="serviceType"
                    value={formData.serviceType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">Select service type</option>
                    {serviceTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Your company name"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Password fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-green-600 hover:underline">
              Sign in here
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}