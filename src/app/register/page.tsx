'use client';
// =======================================
// REGISTER PAGE - /pages/register/page.tsx
// =======================================

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

type Role = 'tenant' | 'service-provider' | 'property-owner';

const buildingNames = ["Sky Suite KLCC", "Vortex Suite KLCC", "Mutiara Ville Cyberjaya", "Tamarind Suite Cyberjaya", "Cybersquare Cyberjaya", "10 Stonor KLCC", "Holiday place KLCC", "Summer suite KLCC", "Cormar Suite KLCC", "Star Residences KLCC", "Other"];
const serviceTypes = ["Cleaning", "Electrical", "Plumbing", "Door Repair", "General Maintenance"];

export default function RegisterPage() {
    const { registerUser } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [role, setRole] = useState<Role>('tenant');
    
    // State for the success modal
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Common fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');

    // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Tenant-specific
    const [buildingName, setBuildingName] = useState('');
    const [otherBuilding, setOtherBuilding] = useState('');
    const [passport, setPassport] = useState('');
    const [unitNumber, setUnitNumber] = useState('');
    const [rentType, setRentType] = useState('');
    
    // Service Provider-specific
    const [services, setServices] = useState<string[]>([]);
    const [otherService, setOtherService] = useState('');

    const resetForm = () => {
        setFullName('');
        setEmail('');
        setPhone('');
        setPassword('');
        setConfirmPassword('');
        setBuildingName('');
        setOtherBuilding('');
        setPassport('');
        setUnitNumber('');
        setRentType('');
        setServices([]);
        setOtherService('');
        setRole('tenant');
    };

    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        // Reset all role-specific fields to avoid data leakage between roles
        setBuildingName('');
        setOtherBuilding('');
        setPassport('');
        setUnitNumber('');
        setRentType('');
        setServices([]);
        setOtherService('');
        // Set the new role
        setRole(e.target.value as Role);
    };

    const handleMultiSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
        setServices(selectedOptions);
    };

    const handleAddOtherService = () => {
        if (otherService && !services.includes(otherService)) {
            setServices([...services, otherService]);
        }
        setOtherService('');
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast.error("Passwords do not match.");
            return;
        }
        setLoading(true);
        try {
            let userData: { email: string; password: string; } & Record<string, unknown> = { email, password, fullName, phone, role };
            if (role === 'tenant') {
                userData = { ...userData, buildingName: buildingName === 'Other' ? otherBuilding : buildingName, passport, unitNumber, rentType };
            } else if (role === 'service-provider') {
                userData = { ...userData, services };
            }
            
            await registerUser(userData);
            setShowSuccessModal(true); // Show success modal
            resetForm(); // Reset form state in the background
        } catch (error: unknown) {
            const errorMessage = (error as { code?: string; message?: string }).code === 'auth/email-already-in-use'
                ? 'An account with this email already exists.'
                : ((error as { message?: string }).message || "Something went wrong. Please try again later.");
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };
    
    const renderTenantFields = () => (
        <>
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Building Name</label>
                <select value={buildingName} onChange={(e) => setBuildingName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="" disabled>Select a building</option>
                    {buildingNames.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {buildingName === 'Other' && (
                    <input type="text" placeholder="Please specify building name" value={otherBuilding} onChange={(e) => setOtherBuilding(e.target.value)} className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg"/>
                )}
              </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Passport Number</label>
                <input type="text" placeholder="Your Passport Number" value={passport} onChange={(e) => setPassport(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Unit Number</label>
                <input type="text" placeholder="e.g., A-12-03" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Type of Rent</label>
                <select value={rentType} onChange={(e) => setRentType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="" disabled>Select rent type</option>
                    <option>Room 1</option>
                    <option>Room 2</option>
                    <option>Room 3</option>
                    <option>Studio</option>
                    <option>Whole Unit</option>
                </select>
            </div>
        </>
    );

    const renderServiceProviderFields = () => (
        <>
             <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Services Provided</label>
                <select multiple value={services} onChange={handleMultiSelectChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg h-32">
                    {serviceTypes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex gap-2 mt-2">
                    <input type="text" placeholder="Add another service" value={otherService} onChange={(e) => setOtherService(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
                    <button type="button" onClick={handleAddOtherService} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium">Add</button>
          </div>
                <div className="flex flex-wrap gap-2 mt-2">
                    {services.map(s => <span key={s} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">{s}</span>)}
        </div>
      </div>
        </>
    );

    if (showSuccessModal) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
                <div className="max-w-lg w-full bg-white p-8 sm:p-10 rounded-2xl shadow-lg text-center">
                     <h2 className="text-2xl font-bold mb-4 text-green-700">✅ Thank you for registering!</h2>
                    <p className="text-gray-600 mb-6">
                        Your details have been submitted successfully. Our admin team will review your information and approve your account shortly. You&apos;ll receive an email notification once your account is activated.
                    </p>
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
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
            <div className="max-w-lg w-full bg-white p-8 sm:p-10 rounded-2xl shadow-lg">
                <header className="text-center mb-8">
                    <Image src="/Green Bridge.png" alt="Green Bridge Logo" width={60} height={60} className="mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
                    <p className="text-gray-600 text-sm mt-1">Sign up to Green Bridge Realty</p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Register as</label>
                        <select value={role} onChange={handleRoleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                            <option value="tenant">Tenant</option>
                            <option value="service-provider">Service Provider</option>
                            <option value="property-owner">Property Owner</option>
                        </select>
      </div>

                    {/* Common Fields */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Full Name</label>
                        <input type="text" placeholder="Your Full Name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" autoComplete="off" />
          </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Email Address</label>
                        <input type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" autoComplete="off" />
        </div>
                     <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Phone Number</label>
                        <input type="tel" placeholder="Your Phone Number" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" autoComplete="off" />
      </div>

                    {/* Role-specific fields */}
                    {role === 'tenant' && renderTenantFields()}
                    {role === 'service-provider' && renderServiceProviderFields()}

                    <div className="relative space-y-2">
                        <label className="text-sm font-medium text-gray-700">Password</label>
          <input
                            type={showPassword ? "text" : "password"} 
                            placeholder="••••••••" 
                            required 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500" style={{top: '1.75rem'}}>
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
        </div>
                    <div className="relative space-y-2">
                        <label className="text-sm font-medium text-gray-700">Confirm Password</label>
          <input
                            type={showConfirmPassword ? "text" : "password"} 
                            placeholder="••••••••" 
                            required 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500" style={{top: '1.75rem'}}>
                            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
      </div>

                    <button type="submit" disabled={loading} className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition duration-300 disabled:opacity-50">
                        {loading ? 'Registering...' : 'Create Account'}
      </button>

                    <p className="text-center text-sm text-gray-600">
                        Already have an account?{' '}
                        <Link href="/login" className="font-medium text-green-600 hover:underline">
                            &larr; Back to Login
                        </Link>
                    </p>
                </form>
          </div>
    </div>
  );
}