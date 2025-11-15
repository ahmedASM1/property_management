/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onCall} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// Function to send admin notification when new user registers
exports.onUserRegistration = onDocumentCreated('users/{userId}', async (event) => {
  const userData = event.data.data();
  const userId = event.params.userId;

  // Skip if user is already approved or is an admin
  if (userData.isApproved || userData.role === 'admin') {
    return;
  }

  try {
    // Create notification for admin
    await db.collection('admin_notifications').add({
      type: 'new_registration',
      userId: userId,
      userEmail: userData.email,
      userFullName: userData.fullName,
      userRole: userData.role,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false
    });

    // Send email notification to admin (you'll need to configure email service)
    // await sendAdminEmail(userData);

    logger.info(`New user registration notification created for: ${userData.email}`);
  } catch (error) {
    logger.error('Error creating admin notification:', error);
  }
});

// Helper: determine if caller is admin via custom claim OR Firestore user role
async function isCallerAdmin(auth) {
  if (!auth) return false;
  if (auth.token && auth.token.admin) return true;
  try {
    const callerDoc = await db.collection('users').doc(auth.uid).get();
    if (callerDoc.exists) {
      const userData = callerDoc.data();
      return userData.role === 'admin';
    }
    return false;
  } catch (error) {
    logger.error('Error checking admin status:', error);
    return false;
  }
}

// Function to approve/reject user (callable from admin dashboard)
exports.approveUser = onCall(async (request) => {
  const { userId, approved, adminNotes } = request.data;
  const auth = request.auth;

  if (!(await isCallerAdmin(auth))) {
    throw new Error('Unauthorized: Admin access required');
  }

  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();

    if (approved) {
      // Approve the user
      await userRef.update({
        isApproved: true,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedBy: auth.uid,
        adminNotes: adminNotes || ''
      });

      // Set custom claims for role-based access
      await admin.auth().setCustomUserClaims(userId, {
        role: userData.role,
        approved: true
      });

      // Create approval notification
      await db.collection('notifications').add({
        userId: userId,
        type: 'account_approved',
        message: 'Your account has been approved. You can now log in.',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info(`User approved: ${userData.email}`);
    } else {
      // Reject the user
      await userRef.update({
        isApproved: false,
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
        rejectedBy: auth.uid,
        adminNotes: adminNotes || '',
        status: 'rejected'
      });

      // Create rejection notification
      await db.collection('notifications').add({
        userId: userId,
        type: 'account_rejected',
        message: `Your account registration has been rejected. ${adminNotes || ''}`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info(`User rejected: ${userData.email}`);
    }

    // Update admin notification status
    const adminNotifications = await db.collection('admin_notifications')
      .where('userId', '==', userId)
      .where('type', '==', 'new_registration')
      .get();

    adminNotifications.forEach(async (doc) => {
      await doc.ref.update({
        status: approved ? 'approved' : 'rejected',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        processedBy: auth.uid
      });
    });

    return { success: true, message: `User ${approved ? 'approved' : 'rejected'} successfully` };
  } catch (error) {
    logger.error('Error processing user approval:', error);
    throw new Error(`Failed to ${approved ? 'approve' : 'reject'} user: ${error.message}`);
  }
});

// Function to get pending registrations for admin
exports.getPendingRegistrations = onCall(async (request) => {
  const auth = request.auth;

  // For now, allow any authenticated user to access this
  // TODO: Re-enable admin check once admin users are properly set up
  if (!auth) {
    throw new Error('Authentication required');
  }

  try {
    const pendingUsers = await db.collection('users')
      .where('isApproved', '==', false)
      .where('role', '!=', 'admin')
      .orderBy('role')
      .orderBy('createdAt', 'desc')
      .get();

    const users = [];
    pendingUsers.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return { users };
  } catch (error) {
    logger.error('Error fetching pending registrations:', error);
    throw new Error('Failed to fetch pending registrations');
  }
});

// Function to get admin notifications
exports.getAdminNotifications = onCall(async (request) => {
  const auth = request.auth;

  // For now, allow any authenticated user to access this
  // TODO: Re-enable admin check once admin users are properly set up
  if (!auth) {
    throw new Error('Authentication required');
  }

  try {
    const notifications = await db.collection('admin_notifications')
      .where('read', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const results = [];
    notifications.forEach(doc => {
      results.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return { notifications: results };
  } catch (error) {
    logger.error('Error fetching admin notifications:', error);
    throw new Error('Failed to fetch admin notifications');
  }
});

// Function to mark admin notification as read
exports.markNotificationRead = onCall(async (request) => {
  const { notificationId } = request.data;
  const auth = request.auth;

  if (!auth) {
    throw new Error('Authentication required');
  }

  try {
    await db.collection('admin_notifications').doc(notificationId).update({
      read: true,
      readAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    throw new Error('Failed to mark notification as read');
  }
});

// Function to make current user an admin (for initial setup)
exports.makeMeAdmin = onCall(async (request) => {
  const auth = request.auth;

  if (!auth) {
    throw new Error('Authentication required');
  }

  try {
    // Update user document to admin role
    await db.collection('users').doc(auth.uid).update({
      role: 'admin',
      isApproved: true,
      adminSince: admin.firestore.FieldValue.serverTimestamp()
    });

    // Set custom claims
    await admin.auth().setCustomUserClaims(auth.uid, {
      role: 'admin',
      approved: true,
      admin: true
    });

    logger.info(`User ${auth.uid} has been made an admin`);
    return { success: true, message: 'You are now an admin!' };
  } catch (error) {
    logger.error('Error making user admin:', error);
    throw new Error('Failed to make user admin');
  }
});
