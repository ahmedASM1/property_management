'use client';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

const schema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string()
    .required('Password is required')
    .min(8, 'Password must be 8–15 characters')
    .max(15, 'Password must be 8–15 characters'),
  confirmPassword: yup.string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
  fullName: yup.string().required('Full name is required'),
  idNumber: yup.string().required('ID/Passport number is required'),
  phoneNumber: yup.string().required('Phone number is required'),
  unitNumber: yup.string().required('Unit number is required'),
  buildingName: yup.string().required('Building name is required'),
  rentalType: yup.string().oneOf(['Room1', 'Room2', 'Room3', 'Studio', 'Whole Unit'] as const).required('Rental type is required'),
}).required();

type FormData = yup.InferType<typeof schema>;

export default function TenantRegistrationForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [passwordValue, setPasswordValue] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormData>({
    resolver: yupResolver(schema),
  });

  // Watch password and confirmPassword for match validation
  const password = watch('password');
  const confirmPassword = watch('confirmPassword');
  useEffect(() => {
    if (step === 1 && confirmPassword !== undefined) {
      if (password !== confirmPassword) {
        setError('confirmPassword', { type: 'manual', message: 'Passwords do not match' });
      } else {
        clearErrors('confirmPassword');
      }
    }
  }, [password, confirmPassword, setError, clearErrors, step]);

  const onSubmit = async (data: FormData) => {
    try {
      setIsLoading(true);
      
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      // Create user document in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: data.email,
        fullName: data.fullName,
        idNumber: data.idNumber,
        phoneNumber: data.phoneNumber,
        role: 'tenant',
        unitNumber: data.unitNumber,
        buildingName: data.buildingName,
        rentalType: data.rentalType,
        isApproved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      toast.success('Registration successful! Please wait for admin approval.');
      router.push('/');
    } catch (error: unknown) {
      const errorMessage = (error as { code?: string; message?: string }).code === 'auth/email-already-in-use'
        ? 'An account with this email already exists.'
        : ((error as { message?: string }).message || "Something went wrong. Please try again later.");
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  // Step 1: Account Info
  const Step1 = (
    <>
      <div className="mb-6">
        <div className="flex justify-center mb-2">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${step === 1 ? 'bg-indigo-600' : 'bg-gray-300'}`}></span>
            <span className={`h-2 w-2 rounded-full ${step === 2 ? 'bg-indigo-600' : 'bg-gray-300'}`}></span>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800">Sign up</h2>
        <p className="text-sm text-gray-500 text-center mt-1">Create your tenant account</p>
      </div>
      {/* Email */}
      <div className="relative mb-4">
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register('email')}
          className={`peer w-full border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-transparent placeholder-transparent`}
          placeholder="Email Address"
        />
        <label htmlFor="email" className="absolute left-3 top-2 text-gray-500 text-sm transition-all peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-3 peer-focus:text-xs peer-focus:text-indigo-600 bg-white px-1 pointer-events-none">Email Address *</label>
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
      </div>
      {/* Password */}
      <div className="relative mb-4">
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register('password')}
          className={`peer w-full border ${errors.password ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-transparent placeholder-transparent`}
          placeholder="Password"
          onChange={e => { setPasswordValue(e.target.value); }}
        />
        <label htmlFor="password" className="absolute left-3 top-2 text-gray-500 text-sm transition-all peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-3 peer-focus:text-xs peer-focus:text-indigo-600 bg-white px-1 pointer-events-none">Password *</label>
        {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
      </div>
      {/* Confirm Password */}
      <div className="relative mb-4">
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          className={`peer w-full border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-transparent placeholder-transparent`}
          placeholder="Confirm Password"
        />
        <label htmlFor="confirmPassword" className="absolute left-3 top-2 text-gray-500 text-sm transition-all peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-3 peer-focus:text-xs peer-focus:text-indigo-600 bg-white px-1 pointer-events-none">Confirm Password *</label>
        {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
      </div>
      <button
        type="button"
        onClick={() => setStep(2)}
        className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md mt-2 hover:bg-indigo-700 transition"
        disabled={!!errors.email || !!errors.password || !!errors.confirmPassword || !passwordValue || password !== confirmPassword}
      >
        Next
      </button>
    </>
  );

  // Step 2: Tenant Details
  const Step2 = (
    <>
      <div className="mb-6">
        <div className="flex justify-center mb-2">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${step === 1 ? 'bg-indigo-600' : 'bg-gray-300'}`}></span>
            <span className={`h-2 w-2 rounded-full ${step === 2 ? 'bg-indigo-600' : 'bg-gray-300'}`}></span>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800">Tenant Details</h2>
        <p className="text-sm text-gray-500 text-center mt-1">Fill in your property and contact info</p>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {/* Full Name */}
        <div className="relative">
          <input
            id="fullName"
            type="text"
            {...register('fullName')}
            className={`peer w-full border ${errors.fullName ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-transparent placeholder-transparent`}
            placeholder="Full Name"
          />
          <label htmlFor="fullName" className="absolute left-3 top-2 text-gray-500 text-sm transition-all peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-3 peer-focus:text-xs peer-focus:text-indigo-600 bg-white px-1 pointer-events-none">Full Name (as per ID/Passport) *</label>
          {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>}
        </div>
        {/* ID/Passport Number */}
        <div className="relative">
          <input
            id="idNumber"
            type="text"
            {...register('idNumber')}
            className={`peer w-full border ${errors.idNumber ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-transparent placeholder-transparent`}
            placeholder="ID/Passport Number"
          />
          <label htmlFor="idNumber" className="absolute left-3 top-2 text-gray-500 text-sm transition-all peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-3 peer-focus:text-xs peer-focus:text-indigo-600 bg-white px-1 pointer-events-none">ID/Passport Number *</label>
          {errors.idNumber && <p className="mt-1 text-xs text-red-600">{errors.idNumber.message}</p>}
        </div>
        {/* Phone Number */}
        <div className="relative">
          <input
            id="phoneNumber"
            type="tel"
            {...register('phoneNumber')}
            className={`peer w-full border ${errors.phoneNumber ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-transparent placeholder-transparent`}
            placeholder="Phone Number"
          />
          <label htmlFor="phoneNumber" className="absolute left-3 top-2 text-gray-500 text-sm transition-all peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-3 peer-focus:text-xs peer-focus:text-indigo-600 bg-white px-1 pointer-events-none">Phone Number *</label>
          {errors.phoneNumber && <p className="mt-1 text-xs text-red-600">{errors.phoneNumber.message}</p>}
        </div>
        {/* Unit Number */}
        <div className="relative">
          <input
            id="unitNumber"
            type="text"
            {...register('unitNumber')}
            className={`peer w-full border ${errors.unitNumber ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-transparent placeholder-transparent`}
            placeholder="Unit Number"
          />
          <label htmlFor="unitNumber" className="absolute left-3 top-2 text-gray-500 text-sm transition-all peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-3 peer-focus:text-xs peer-focus:text-indigo-600 bg-white px-1 pointer-events-none">Unit Number *</label>
          {errors.unitNumber && <p className="mt-1 text-xs text-red-600">{errors.unitNumber.message}</p>}
        </div>
        {/* Building Name */}
        <div className="relative">
          <input
            id="buildingName"
            type="text"
            {...register('buildingName')}
            className={`peer w-full border ${errors.buildingName ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-transparent placeholder-transparent`}
            placeholder="Building Name"
          />
          <label htmlFor="buildingName" className="absolute left-3 top-2 text-gray-500 text-sm transition-all peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-3 peer-focus:text-xs peer-focus:text-indigo-600 bg-white px-1 pointer-events-none">Building Name *</label>
          {errors.buildingName && <p className="mt-1 text-xs text-red-600">{errors.buildingName.message}</p>}
        </div>
        {/* Rental Type */}
        <div className="relative">
          <select
            id="rentalType"
            {...register('rentalType')}
            className={`peer w-full border ${errors.rentalType ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-transparent`}
          >
            <option value="" className="text-gray-400">Select rental type</option>
            <option value="Room1">Room 1</option>
            <option value="Room2">Room 2</option>
            <option value="Room3">Room 3</option>
            <option value="Studio">Studio</option>
            <option value="Whole Unit">Whole Unit</option>
          </select>
          <label htmlFor="rentalType" className="absolute left-3 top-2 text-gray-500 text-sm transition-all peer-focus:-top-3 peer-focus:text-xs peer-focus:text-indigo-600 bg-white px-1 pointer-events-none">Rental Type *</label>
          {errors.rentalType && <p className="mt-1 text-xs text-red-600">{errors.rentalType.message}</p>}
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-2 mt-6">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="w-full md:w-auto text-indigo-600 hover:underline text-sm font-medium border border-transparent rounded-md py-2 px-4"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full md:w-auto bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Registering...' : 'Register'}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md bg-white shadow-lg rounded-lg p-8 mt-12">
        <form onSubmit={handleSubmit(onSubmit)}>
          {step === 1 ? Step1 : Step2}
        </form>
      </div>
      <button
        type="button"
        onClick={() => router.push('/login')}
        className="mt-6 text-indigo-600 hover:text-indigo-800 underline font-medium transition"
        aria-label="Back to Login"
      >
        &larr; Back to Login
      </button>
    </div>
  );
} 