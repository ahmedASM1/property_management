import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface CreateNotificationParams {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  userId?: string;
  role?: 'admin' | 'tenant' | 'service_provider' | 'property_owner';
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Creates a notification in Firestore with consistent formatting
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    const notificationData = {
      message: params.message,
      type: params.type || 'info',
      userId: params.userId || null,
      role: params.role || null,
      priority: params.priority || 'medium',
      read: false,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Creates a notification for admin users
 */
export async function createAdminNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  return createNotification({
    message,
    type,
    role: 'admin',
    priority: 'medium'
  });
}

/**
 * Creates a notification for a specific user
 */
export async function createUserNotification(
  userId: string, 
  message: string, 
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
) {
  return createNotification({
    message,
    type,
    userId,
    priority: 'medium'
  });
}

/**
 * Creates a high-priority notification
 */
export async function createUrgentNotification(
  message: string,
  userId?: string,
  role?: 'admin' | 'tenant' | 'service_provider' | 'property_owner'
) {
  return createNotification({
    message,
    type: 'error',
    userId,
    role,
    priority: 'high'
  });
}

/**
 * Common notification messages
 */
export const NotificationMessages = {
  // User registration
  USER_REGISTRATION: (userName: string, role: string) => 
    `${userName} has registered as a ${role}. Please review and approve.`,
  
  // Maintenance requests
  MAINTENANCE_REQUEST: (tenantName: string, unitNumber: string) => 
    `Maintenance request submitted by ${tenantName} for unit ${unitNumber}`,
  
  MAINTENANCE_ASSIGNED: (providerName: string, unitNumber: string) => 
    `Maintenance request for unit ${unitNumber} has been assigned to ${providerName}`,
  
  MAINTENANCE_COMPLETED: (unitNumber: string) => 
    `Maintenance request for unit ${unitNumber} has been completed`,
  
  // Invoice notifications
  INVOICE_CREATED: (tenantName: string, amount: number) => 
    `New invoice created for ${tenantName} - Amount: $${amount}`,
  
  INVOICE_PAID: (tenantName: string, amount: number) => 
    `Invoice paid by ${tenantName} - Amount: $${amount}`,
  
  INVOICE_OVERDUE: (tenantName: string, amount: number) => 
    `Overdue invoice for ${tenantName} - Amount: $${amount}`,
  
  // Contract notifications
  CONTRACT_EXPIRING: (tenantName: string, daysLeft: number) => 
    `Contract for ${tenantName} expires in ${daysLeft} days`,
  
  CONTRACT_EXPIRED: (tenantName: string) => 
    `Contract for ${tenantName} has expired`,
  
  CONTRACT_RENEWED: (tenantName: string) => 
    `Contract for ${tenantName} has been renewed`,
  
  // System notifications
  SYSTEM_ERROR: (error: string) => 
    `System error: ${error}`,
  
  SYSTEM_MAINTENANCE: (message: string) => 
    `System maintenance: ${message}`,
};


