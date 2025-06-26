import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { sendContractNotification } from './emailNotifications';

interface Contract {
  id: string;
  tenantId: string;
  tenantName: string;
  expiryDate: string;
  status: 'pending' | 'signed' | 'rejected';
  notificationSent?: boolean;
}

export const checkExpiringContracts = async () => {
  try {
    const now = new Date();

    // Get all active contracts
    const contractsRef = collection(db, 'contracts');
    const q = query(
      contractsRef,
      where('status', '==', 'signed')
    );
    const querySnapshot = await getDocs(q);
    const contracts = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Contract[];

    // Check each contract
    for (const contract of contracts) {
      const expiryDate = new Date(contract.expiryDate);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Send notifications based on expiry date
      if (daysUntilExpiry <= 30 && daysUntilExpiry > 7 && !contract.notificationSent) {
        // Send 30-day notification
        await sendContractNotification('expiring', contract.id, contract.tenantId);
        await updateDoc(doc(db, 'contracts', contract.id), {
          notificationSent: true
        });
      } else if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        // Send 7-day notification
        await sendContractNotification('expiring_soon', contract.id, contract.tenantId);
      } else if (daysUntilExpiry <= 0) {
        // Mark contract as expired
        await updateDoc(doc(db, 'contracts', contract.id), {
          status: 'expired'
        });
        await sendContractNotification('expired', contract.id, contract.tenantId);
      }
    }
  } catch (error) {
    console.error('Error checking expiring contracts:', error);
    throw error;
  }
};

// Function to be called by a scheduled task (e.g., Firebase Cloud Functions)
export const scheduleContractNotifications = async () => {
  try {
    await checkExpiringContracts();
  } catch (error) {
    console.error('Error in scheduled contract notifications:', error);
  }
}; 