import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FiUpload, FiAlertCircle, FiCheckCircle, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

const schema = yup.object().shape({
  description: yup.string()
    .required('Please provide a detailed description')
    .min(10, 'Description should be at least 10 characters'),
  requestType: yup.string()
    .required('Please select a request type')
    .oneOf(['Maintenance', 'Cleaning', 'New Item/Service']),
  serviceType: yup.string()
    .test('conditional-required', 'Please select a service type', function(value) {
      const requestType = this.parent.requestType;
      if (requestType === 'Cleaning' || requestType === 'New Item/Service') {
        return !!value;
      }
      return true;
    }),
  unitProperty: yup.string().required('Unit/Property is required'),
  priority: yup.string()
    .required('Please select a priority level')
    .oneOf(['Low', 'Medium', 'High', 'Emergency']),
});

const serviceTypeOptions = {
  'Cleaning': ['One-time', 'Weekly', 'Bi-weekly', 'Monthly', 'Urgent'],
  'New Item/Service': ['Table', 'Chair', 'Fan', 'TV', 'Lighting', 'Storage', 'Other'],
};

export default function MaintenanceForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      unitProperty: user?.unitNumber || '',
      requestType: 'Maintenance',
    }
  });

  const requestType = watch('requestType');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size should be less than 5MB');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      let attachmentUrl = '';
      if (selectedFile) {
        const storageRef = ref(storage, `maintenance-requests/${Date.now()}-${selectedFile.name}`);
        await uploadBytes(storageRef, selectedFile);
        attachmentUrl = await getDownloadURL(storageRef);
      }

      const requestData = {
        ...data,
        userId: user?.id,
        status: 'Pending',
        attachmentUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'maintenance_requests'), requestData);
      
      // Notify admin
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin',
        message: `New ${data.requestType.toLowerCase()} request from ${user?.unitNumber || 'a tenant'}`,
        read: false,
        createdAt: serverTimestamp(),
      });

      toast.success('Request submitted successfully!');
      reset();
      setSelectedFile(null);
      setFilePreview(null);
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 font-[Inter]">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-2xl font-semibold text-gray-900">Submit Request to Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Submit your maintenance, cleaning, or item request. We'll process it as soon as possible.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Request Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Request Type
              <span className="text-red-500">*</span>
            </label>
            <select
              {...register('requestType')}
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="Maintenance">Maintenance</option>
              <option value="Cleaning">Cleaning</option>
              <option value="New Item/Service">New Item/Service</option>
            </select>
            {errors.requestType && (
              <p className="mt-1 text-sm text-red-600">{errors.requestType.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
              <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <textarea
                {...register('description')}
                rows={4}
                className="block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="Describe the issue or your request in detail..."
              />
              <p className="mt-1 text-sm text-gray-500">
                Include as much detail as possible to speed up processing
              </p>
            </div>
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Service Type - Conditional */}
          {(requestType === 'Cleaning' || requestType === 'New Item/Service') && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Service Type
                <span className="text-red-500">*</span>
              </label>
              <select
                {...register('serviceType')}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="">Select service type</option>
                {serviceTypeOptions[requestType as keyof typeof serviceTypeOptions]?.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              {errors.serviceType && (
                <p className="mt-1 text-sm text-red-600">{errors.serviceType.message}</p>
              )}
            </div>
          )}

          {/* Unit/Property */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Unit / Property
              <span className="text-red-500">*</span>
            </label>
            <input
              {...register('unitProperty')}
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="e.g., D-11-1"
              readOnly={!!user?.unitNumber}
            />
            {errors.unitProperty && (
              <p className="mt-1 text-sm text-red-600">{errors.unitProperty.message}</p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Priority Level
              <span className="text-red-500">*</span>
            </label>
            <select
              {...register('priority')}
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="">Select priority</option>
              <option value="Low">Low - Can wait</option>
              <option value="Medium">Medium - Need attention</option>
              <option value="High">High - Urgent</option>
              <option value="Emergency">Emergency - Immediate action required</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Choose based on urgency. Emergency requests will be handled immediately.
            </p>
            {errors.priority && (
              <p className="mt-1 text-sm text-red-600">{errors.priority.message}</p>
            )}
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Attachment
              <span className="text-sm font-normal text-gray-500 ml-1">(optional)</span>
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                {filePreview ? (
                  <div className="relative">
                    <img src={filePreview} alt="Preview" className="mx-auto h-32 w-auto" />
                    <button
                      type="button"
                      onClick={removeFile}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <FiUpload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label className="relative cursor-pointer rounded-md font-medium text-green-600 hover:text-green-500">
                        <span>Upload a file</span>
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/*,.pdf"
                          onChange={handleFileChange}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, PDF up to 5MB</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 