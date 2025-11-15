import jsPDF from 'jspdf';
import { Tenant } from '@/types';

export interface ContractFields {
  propertyAddress: string;
  unitNumber?: string;
  term: string;
  moveInDate: string;
  expiryDate: string;
  rentalPerMonth: number;
  securityDeposit: number;
  utilityDeposit: number;
  accessCardDeposit: number;
  agreementFee: number;
  dateOfAgreement: string;
  companySignName?: string;
  companySignNRIC?: string;
  companySignDesignation?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
}

export const generateComprehensiveContractPDF = (tenant: Tenant, contractFields: ContractFields): jsPDF => {
  const doc = new jsPDF();
  let yPosition = 24;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 22;
  const contentWidth = pageWidth - (margin * 2);
  
  // Helper function to add text with word wrapping
  const addText = (text: string, x: number, y: number, maxWidth?: number, fontSize?: number) => {
    if (fontSize) doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth || contentWidth);
    doc.text(lines, x, y);
    return y + (lines.length * (fontSize || 12) * 0.4);
  };

  // Helper function to add section header
  const addSectionHeader = (text: string, y: number) => {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    y = addText(text, margin, y, contentWidth, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    // underline separator
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y + 2, margin + contentWidth, y + 2);
    return y + 8;
  };

  // Helper function to add subsection
  const addSubsection = (text: string, y: number) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    y = addText(text, margin, y, contentWidth, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    return y + 3;
  };

  // Helper function to add numbered item
  const addNumberedItem = (num: string, text: string, y: number) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const itemText = `${num}. ${text}`;
    y = addText(itemText, margin + 10, y, contentWidth - 10, 10);
    return y + 2;
  };

  // Helper function to add bullet point
  const addBulletPoint = (text: string, y: number) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const bulletText = `• ${text}`;
    y = addText(bulletText, margin + 15, y, contentWidth - 15, 10);
    return y + 2;
  };

  // Helper function to check if we need a new page
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPosition = 20;
      return true;
    }
    return false;
  };

  // Company Header (centered)
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text('GREEN BRIDGE REALTY SDN. BHD.', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Company No: 202301042822 (1536738-K)', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 5;
  doc.text(`Address: ${contractFields.companyAddress || 'Kuala Lumpur, Malaysia'}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 5;
  doc.text(`Phone: ${contractFields.companyPhone || '+60 3-1234 5678'}  |  Email: ${contractFields.companyEmail || 'info@greenbridgerealty.com'}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Main Title (centered)
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('TENANCY AGREEMENT', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Agreement Introduction
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const agreementDate = new Date(contractFields.dateOfAgreement).toLocaleDateString('en-GB');
  yPosition = addText(`This Tenancy Agreement is made on this ${agreementDate} between:`, margin, yPosition, contentWidth, 11);
  yPosition += 4;
  yPosition = addText('GREEN BRIDGE REALTY SDN. BHD. (hereinafter referred to as the "The Company")', margin + 6, yPosition, contentWidth - 6, 11);
  yPosition += 3;
  yPosition = addText(`AND ${tenant.fullName} (hereinafter referred to as the "Tenant").`, margin + 6, yPosition, contentWidth - 6, 11);
  yPosition += 10;

  // Property & Tenant Details Section
  yPosition = addSectionHeader('PROPERTY & TENANT DETAILS', yPosition);
  
  // Create a table-like structure for details
  const details = [
    ['Property Details', ''],
    ['Unit No.', contractFields.unitNumber || '[Unit Number]'],
    ['Address', contractFields.propertyAddress],
    ['Commencement Date', new Date(contractFields.moveInDate).toLocaleDateString('en-GB')],
    ['Expiry Date', new Date(contractFields.expiryDate).toLocaleDateString('en-GB')],
    ['', ''],
    ['Tenant Details', ''],
    ['Name', tenant.fullName],
    ['NRIC/Passport', tenant.idNumber || '[NRIC/Passport]'],
    ['Phone No.', tenant.phoneNumber || '[Phone Number]'],
    ['Email', tenant.email || '[Email]'],
    ['', ''],
    ['Payment Details', ''],
    ['Monthly Rent (RM)', `RM ${contractFields.rentalPerMonth.toLocaleString()}`],
    ['Security Deposit (RM)', `RM ${contractFields.securityDeposit.toLocaleString()}`],
    ['Utility Deposit (RM)', `RM ${contractFields.utilityDeposit.toLocaleString()}`],
    ['Card & Key Deposit (RM)', `RM ${contractFields.accessCardDeposit.toLocaleString()}`],
    ['Agreement & Admin Fees (RM)', `RM ${contractFields.agreementFee.toLocaleString()}`],
    ['Total Payable (RM)', `RM ${(contractFields.rentalPerMonth + contractFields.securityDeposit + contractFields.utilityDeposit + contractFields.accessCardDeposit + contractFields.agreementFee).toLocaleString()}`]
  ];

  // Two-column key/value rendering
  const labelX = margin;
  const valueX = margin + 80;
  details.forEach(([label, value]) => {
    if (label === '') { yPosition += 6; return; }
    if (value === '') {
      // subsection header inside table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.text(label, labelX, yPosition);
      yPosition += 7;
      return;
    }
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text(label, labelX, yPosition);
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(String(value), contentWidth - (valueX - margin));
    doc.text(wrapped, valueX, yPosition);
    // separator line
    doc.setDrawColor(245, 245, 245);
    doc.line(margin, yPosition + 2.5, margin + contentWidth, yPosition + 2.5);
    yPosition += Math.max(7, (wrapped.length * 4.2));
  });

  yPosition += 10;

  // Rental Terms & Conditions
  yPosition = addSectionHeader('RENTAL TERMS & CONDITIONS', yPosition);

  // 1. Tenant's Obligations
  yPosition = addSubsection('1. Tenant\'s Obligations', yPosition);
  yPosition = addNumberedItem('1', 'Rent must be paid in full and in advance on or before the due date.', yPosition);
  yPosition = addNumberedItem('2', 'Tenant must promptly pay all utility bills (electricity, water, and any other services).', yPosition);
  yPosition = addNumberedItem('3', 'Subletting, assigning, or sharing the property with others is strictly prohibited without The Company\'s written approval.', yPosition);
  yPosition = addNumberedItem('4', 'The property must not be used for any illegal, immoral, or nuisance-causing activities. Tenant is fully liable for any damages, complaints, or claims arising from misuse.', yPosition);

  // 2. Termination of Tenancy
  yPosition = addSubsection('2. Termination of Tenancy', yPosition);
  yPosition = addText('The Company has the right to immediately terminate the tenancy and forfeit the deposit if the tenant:', margin, yPosition, contentWidth, 10);
  yPosition += 5;
  yPosition = addBulletPoint('Fails to pay rent on time.', yPosition);
  yPosition = addBulletPoint('Vacates the property before the end of the agreed term without written consent from The Company.', yPosition);
  yPosition = addBulletPoint('Breaches any term of this agreement and fails to remedy it after written notice.', yPosition);
  yPosition += 5;
  yPosition = addText('Upon termination:', margin, yPosition, contentWidth, 10);
  yPosition += 5;
  yPosition = addBulletPoint('The deposit is forfeited absolutely.', yPosition);
  yPosition = addBulletPoint('Tenant is liable for all losses, damages, penalties, costs, and legal fees incurred by The Company.', yPosition);
  yPosition = addBulletPoint('The Company may re-enter and take possession of the property without further notice.', yPosition);

  // 3. Early Termination by Tenant
  yPosition = addSubsection('3. Early Termination by Tenant', yPosition);
  yPosition = addText('If the tenant ends the tenancy before the agreed expiry date:', margin, yPosition, contentWidth, 10);
  yPosition += 5;
  yPosition = addBulletPoint('The deposit is forfeited.', yPosition);
  yPosition = addBulletPoint('Tenant must pay The Company the full remaining rent for the unexpired term as liquidated damages.', yPosition);
  yPosition = addBulletPoint('The Company reserves the right to claim additional damages if applicable.', yPosition);

  // 4. Cleaning Charges
  yPosition = addSubsection('4. Cleaning Charges', yPosition);
  yPosition = addText('Upon check-out, cleaning fees will be charged as follows:', margin, yPosition, contentWidth, 10);
  yPosition += 5;
  yPosition = addBulletPoint('RM 50 for a room and RM 150 for a unit/apartment if the condition is normal.', yPosition);
  yPosition = addBulletPoint('RM 100 for a room and RM 370 for a unit/apartment if deep cleaning is required due to excessive dirt or poor condition.', yPosition);

  // 5. Female Tenants' Units
  yPosition = addSubsection('5. Female Tenants\' Units', yPosition);
  yPosition = addText('Male visitors are strictly prohibited from entering female-only units, even for short visits.', margin, yPosition, contentWidth, 10);
  yPosition += 5;
  yPosition = addText('If a violation is reported, a penalty of RM 500 shall be imposed on the Tenant immediately.', margin, yPosition, contentWidth, 10);

  yPosition += 15;

  // Check if we need a new page for signatures
  checkNewPage(50);

  // Signature Section
  yPosition = addSectionHeader('SIGNATURES', yPosition);
  yPosition += 10;
  
  // Signatures (two columns)
  const sigTop = yPosition + 4;
  const rightX = margin + contentWidth - 70;
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Tenant', margin, sigTop);
  doc.text('The Company', rightX, sigTop, { align: 'left' });
  doc.setFont('helvetica', 'normal');
  doc.text(`(NRIC/Passport No: ${tenant.idNumber || '[NRIC/Passport]'})`, margin, sigTop + 10);
  doc.text('(Company Stamp / Authorized Signatory)', rightX, sigTop + 10, { align: 'left' });
  // signature lines
  doc.line(margin, sigTop + 28, margin + 70, sigTop + 28);
  doc.line(rightX, sigTop + 28, rightX + 70, sigTop + 28);
  doc.text('Signature', margin, sigTop + 35);
  doc.text('Signature', rightX, sigTop + 35, { align: 'left' });
  yPosition = sigTop + 48;

  // Check if we need a new page for house rules
  checkNewPage(100);

  // General House Rules
  yPosition = addSectionHeader('GENERAL HOUSE RULES', yPosition);

  const houseRules = [
    'Smoking Policy – Smoking is strictly prohibited inside the Property and the Premises. Penalty: RM300 for the first offence + written warning. Repeated offence may lead to immediate termination and forfeiture of all deposits.',
    'Cleanliness and Safety – Tenant must keep the common areas and rooms clean. No fire hazards, health hazards, or unpleasant odors allowed.',
    'Alterations – No drilling, nailing, or structural alterations are permitted.',
    'Personal Belongings – Tenant is responsible for own belongings. Room and main door must be locked when leaving.',
    'Furniture & Equipment – Do not move, damage, or misuse any furniture or equipment. Damages will be borne by Tenant.',
    'Access Cards / Keys – Loss or damage is Tenant\'s responsibility. Replacement cost: RM200 per card.',
    'Quiet Hours – 11:00 p.m.–8:00 a.m. (weekdays), 11:00 p.m.–11:00 a.m. (weekends). No loud noise or disturbance.',
    'Guests – Tenant is responsible for guests\' conduct. Guests must leave by 12:00 a.m. Overnight stays only with prior approval.',
    'Pets – Pets are strictly prohibited.',
    'Violations – Any breach may result in warning. Repeated/severe violations may lead to termination and forfeiture of deposits.'
  ];

  houseRules.forEach((rule, index) => {
    yPosition = addNumberedItem((index + 1).toString(), rule, yPosition);
  });

  yPosition += 15;

  // Agreement acknowledgment
  yPosition = addText('I have read, understood, and agreed to comply with the above General House Rules.', margin, yPosition, contentWidth, 10.5);
  yPosition += 14;
  // inline lines for name/date/signature
  doc.text('Name:', margin, yPosition);
  doc.line(margin + 18, yPosition - 2, margin + 80, yPosition - 2);
  doc.text('Date:', margin + 90, yPosition);
  doc.line(margin + 108, yPosition - 2, margin + 160, yPosition - 2);
  doc.text('Signature:', margin + 170, yPosition);
  doc.line(margin + 200, yPosition - 2, margin + contentWidth, yPosition - 2);

  return doc;
};

export const generateAgreementText = (tenant: Tenant, f: ContractFields): string => {
  const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB') : '[Date]');
  const currency = (n?: number) => `RM ${Number(n || 0).toLocaleString()}`;
  const total = (f.rentalPerMonth + f.securityDeposit + f.utilityDeposit + f.accessCardDeposit + f.agreementFee);

  return `
  <div>
    <h2 style="font-size:20px;font-weight:700;margin-bottom:8px;">TENANCY AGREEMENT</h2>
    <p><strong>This Tenancy Agreement is made on this ${fmt(f.dateOfAgreement)}</strong> between:</p>
    <p><strong>GREEN BRIDGE REALTY SDN. BHD.</strong><br/>
    (hereinafter referred to as “The Company”)</p>
    <p><strong>AND</strong><br/>
    <strong>${tenant.fullName}</strong><br/>
    (hereinafter referred to as the “Tenant”).</p>
    <hr/>

    <h3 style="font-size:16px;font-weight:700;margin-top:16px;">PROPERTY & TENANT DETAILS</h3>
    <p><strong>Property Details</strong><br/>
    Unit No: ${f.unitNumber || '[Unit No]'}<br/>
    Address: ${f.propertyAddress}<br/>
    Commencement Date: ${fmt(f.moveInDate)}<br/>
    Expiry Date: ${fmt(f.expiryDate)}</p>

    <p><strong>Tenant Details</strong><br/>
    Name: ${tenant.fullName}<br/>
    NRIC/Passport: ${tenant.idNumber || '[NRIC/Passport]'}<br/>
    Phone No: ${tenant.phoneNumber || '[Phone Number]'}<br/>
    Email: ${tenant.email || '[Email]'}</p>

    <p><strong>Payment Details</strong><br/>
    Monthly Rent (RM): ${currency(f.rentalPerMonth)}<br/>
    Security Deposit (RM): ${currency(f.securityDeposit)}<br/>
    Utility Deposit (RM): ${currency(f.utilityDeposit)}<br/>
    Card & Key Deposit (RM): ${currency(f.accessCardDeposit)}<br/>
    Agreement & Admin Fees (RM): ${currency(f.agreementFee)}<br/>
    Total Payable (RM): ${currency(total)}</p>

    <hr/>
    <h3 style="font-size:16px;font-weight:700;margin-top:16px;">RENTAL TERMS & CONDITIONS</h3>
    <p><strong>1. Tenant’s Obligations</strong></p>
    <ul>
      <li>Rent must be paid in full and in advance on or before the due date.</li>
      <li>Tenant must promptly pay all utility bills (electricity, water, etc.).</li>
      <li>Subletting or sharing the property without written approval is prohibited.</li>
      <li>Property must not be used for illegal or nuisance activities.</li>
    </ul>

    <p><strong>2. Termination of Tenancy</strong><br/>
    The Company may terminate the tenancy and forfeit deposits if the tenant:</p>
    <ul>
      <li>Fails to pay rent on time.</li>
      <li>Vacates the property early without written consent.</li>
      <li>Breaches any term of this agreement and fails to remedy it after notice.</li>
    </ul>
    <p>Upon termination:</p>
    <ul>
      <li>Deposit is forfeited.</li>
      <li>Tenant is liable for damages and legal fees.</li>
      <li>The Company may re-enter and take possession.</li>
    </ul>

    <p><strong>3. Early Termination by Tenant</strong></p>
    <ul>
      <li>If the tenant ends tenancy early, deposit is forfeited.</li>
      <li>Tenant must pay the remaining rent for the unexpired term.</li>
    </ul>

    <p><strong>4. Cleaning Charges</strong></p>
    <ul>
      <li>RM50 (room) or RM150 (unit) for normal cleaning.</li>
      <li>RM100 (room) or RM370 (unit) for deep cleaning.</li>
    </ul>

    <p><strong>5. Female Tenants’ Units</strong></p>
    <ul>
      <li>Male visitors are prohibited.</li>
      <li>Violation penalty: RM500.</li>
    </ul>

    <p><strong>Tenant Signature:</strong> ___________________________<br/>
    (NRIC/Passport No: ${tenant.idNumber || '[NRIC/Passport]'})</p>
    <p><strong>The Company:</strong> ___________________________<br/>
    (Company Stamp / Authorized Signatory)</p>

    <hr/>
    <h3 style="font-size:16px;font-weight:700;margin-top:16px;">GENERAL HOUSE RULES</h3>
    <ol>
      <li>Smoking prohibited – penalty RM300.</li>
      <li>Maintain cleanliness and safety.</li>
      <li>No alterations to structure.</li>
      <li>Tenant responsible for belongings.</li>
      <li>Damages to furniture borne by tenant.</li>
      <li>Lost card/key replacement: RM200.</li>
      <li>Quiet hours: 11 p.m. – 8 a.m. weekdays; 11 p.m. – 11 a.m. weekends.</li>
      <li>Guests must leave by midnight.</li>
      <li>No pets allowed.</li>
      <li>Violations may result in termination and forfeiture of deposits.</li>
    </ol>

    <p><strong>I have read, understood, and agreed to comply with the above General House Rules.</strong></p>
    <p>Name: ${tenant.fullName}<br/>
    Date: ${fmt(f.moveInDate)}<br/>
    Signature: ___________________________</p>
  </div>
  `;
};

