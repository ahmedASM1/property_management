import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function createTestNotification(userId?: string, role?: string) {
  try {
    const notificationData = {
      message: 'Test notification - system is working!',
      type: 'info',
      read: false,
      createdAt: serverTimestamp(),
      priority: 'medium'
    };

    // Add userId or role based on what's provided
    if (userId) {
      notificationData.userId = userId;
    }
    if (role) {
      notificationData.role = role;
    }

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    console.log('Test notification created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating test notification:', error);
    throw error;
  }
}

export async function createAdminTestNotification() {
  return createTestNotification(undefined, 'admin');
}

export async function createUserTestNotification(userId: string) {
  return createTestNotification(userId, undefined);
}


