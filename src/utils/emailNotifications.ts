import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface EmailData {
  to: string;
  subject: string;
  html: string;
}

export const sendContractNotification = async (
  type: 'created' | 'signed' | 'rejected' | 'expiring' | 'expiring_soon' | 'expired',
  contractId: string,
  tenantId: string
) => {
  try {
    // Get contract details
    const contractRef = doc(db, 'contracts', contractId);
    const contractDoc = await getDoc(contractRef);
    const contract = contractDoc.data();

    // Get tenant details
    const tenantRef = doc(db, 'users', tenantId);
    const tenantDoc = await getDoc(tenantRef);
    const tenant = tenantDoc.data();

    if (!contract || !tenant) {
      throw new Error('Contract or tenant not found');
    }

    const emailData: EmailData = {
      to: tenant.email,
      subject: '',
      html: ''
    };

    switch (type) {
      case 'created':
        emailData.subject = 'New Contract Available for Review';
        emailData.html = `
          <h2>New Contract Available</h2>
          <p>Dear ${tenant.fullName},</p>
          <p>A new contract has been created for your review. Please log in to your account to view and sign the contract.</p>
          <p>Contract Details:</p>
          <ul>
            <li>Property: ${contract.propertyAddress}</li>
            <li>Term: ${contract.term}</li>
            <li>Move-in Date: ${contract.moveInDate}</li>
            <li>Monthly Rent: RM ${contract.rentalPerMonth}</li>
          </ul>
          <p>Please review and sign the contract at your earliest convenience.</p>
          <p>Best regards,<br>Green Bridge Realty Team</p>
        `;
        break;

      case 'signed':
        emailData.subject = 'Contract Signed Successfully';
        emailData.html = `
          <h2>Contract Signed</h2>
          <p>Dear ${tenant.fullName},</p>
          <p>Your contract has been successfully signed and recorded in our system.</p>
          <p>Contract Details:</p>
          <ul>
            <li>Property: ${contract.propertyAddress}</li>
            <li>Term: ${contract.term}</li>
            <li>Move-in Date: ${contract.moveInDate}</li>
            <li>Monthly Rent: RM ${contract.rentalPerMonth}</li>
          </ul>
          <p>Thank you for choosing Green Bridge Realty.</p>
          <p>Best regards,<br>Green Bridge Realty Team</p>
        `;
        break;

      case 'rejected':
        emailData.subject = 'Contract Rejected';
        emailData.html = `
          <h2>Contract Rejected</h2>
          <p>Dear ${tenant.fullName},</p>
          <p>Your contract has been rejected. Please contact our office for more information.</p>
          <p>Contract Details:</p>
          <ul>
            <li>Property: ${contract.propertyAddress}</li>
            <li>Term: ${contract.term}</li>
            <li>Move-in Date: ${contract.moveInDate}</li>
            <li>Monthly Rent: RM ${contract.rentalPerMonth}</li>
          </ul>
          <p>Please contact us if you have any questions.</p>
          <p>Best regards,<br>Green Bridge Realty Team</p>
        `;
        break;

      case 'expiring':
        emailData.subject = 'Contract Expiring Soon - 30 Days Notice';
        emailData.html = `
          <h2>Contract Expiring Soon</h2>
          <p>Dear ${tenant.fullName},</p>
          <p>This is a reminder that your contract will expire in 30 days.</p>
          <p>Contract Details:</p>
          <ul>
            <li>Property: ${contract.propertyAddress}</li>
            <li>Expiry Date: ${contract.expiryDate}</li>
            <li>Monthly Rent: RM ${contract.rentalPerMonth}</li>
          </ul>
          <p>Please contact us to discuss renewal options or make arrangements for moving out.</p>
          <p>Best regards,<br>Green Bridge Realty Team</p>
        `;
        break;

      case 'expiring_soon':
        emailData.subject = 'Contract Expiring Soon - 7 Days Notice';
        emailData.html = `
          <h2>Contract Expiring Soon</h2>
          <p>Dear ${tenant.fullName},</p>
          <p>This is a final reminder that your contract will expire in 7 days.</p>
          <p>Contract Details:</p>
          <ul>
            <li>Property: ${contract.propertyAddress}</li>
            <li>Expiry Date: ${contract.expiryDate}</li>
            <li>Monthly Rent: RM ${contract.rentalPerMonth}</li>
          </ul>
          <p>Please contact us immediately to discuss renewal options or make arrangements for moving out.</p>
          <p>Best regards,<br>Green Bridge Realty Team</p>
        `;
        break;

      case 'expired':
        emailData.subject = 'Contract Expired';
        emailData.html = `
          <h2>Contract Expired</h2>
          <p>Dear ${tenant.fullName},</p>
          <p>Your contract has expired. Please contact our office immediately to discuss your options.</p>
          <p>Contract Details:</p>
          <ul>
            <li>Property: ${contract.propertyAddress}</li>
            <li>Expiry Date: ${contract.expiryDate}</li>
            <li>Monthly Rent: RM ${contract.rentalPerMonth}</li>
          </ul>
          <p>Please note that continued occupation of the property without a valid contract may result in additional charges.</p>
          <p>Best regards,<br>Green Bridge Realty Team</p>
        `;
        break;
    }

    // Send email using your preferred email service
    // Example using a hypothetical email service:
    // await sendEmail(emailData);

    console.log('Email notification sent:', emailData);
  } catch (error) {
    console.error('Failed to send email notification:', error);
    throw error;
  }
}; 