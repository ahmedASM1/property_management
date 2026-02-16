import { jsPDF } from 'jspdf';
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

export const generateComprehensiveContractPDF = async (tenant: Tenant, contractFields: ContractFields): Promise<jsPDF> => {
  const doc = new jsPDF();
  let yPosition = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  const maxY = pageHeight - 25; // Safe bottom margin
  
  // Add logo at the top
  try {
    // Try to load logo as image (PNG/JPG) or convert SVG
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    
    await new Promise<void>((resolve) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = async () => {
        // Try SVG conversion if PNG doesn't exist
        try {
          const svgResponse = await fetch('/Green Bridge.svg');
          if (svgResponse.ok) {
            const svgText = await svgResponse.text();
            const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
            const svgUrl = URL.createObjectURL(svgBlob);
            logoImg.src = svgUrl;
            await new Promise<void>((resolveSvg) => {
              logoImg.onload = () => {
                URL.revokeObjectURL(svgUrl);
                resolveSvg();
              };
              logoImg.onerror = () => {
                URL.revokeObjectURL(svgUrl);
                console.warn('Could not load logo, continuing without it');
                resolveSvg();
              };
            });
          }
        } catch (svgError) {
          console.warn('Logo not found, continuing without logo');
        }
        resolve();
      };
      // Try PNG first
      logoImg.src = '/Green Bridge.png';
    });
    
    if (logoImg.complete && logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0) {
      const logoWidth = 40;
      const logoHeight = 40;
      const logoX = pageWidth / 2 - logoWidth / 2;
      doc.addImage(logoImg, 'PNG', logoX, yPosition, logoWidth, logoHeight);
      yPosition += logoHeight + 8;
    }
  } catch (error) {
    console.warn('Could not load logo:', error);
    // Continue without logo
  }
  
  // Helper function to check if we need a new page and add it if necessary
  const checkPageBreak = (spaceNeeded: number = 15): void => {
    if (yPosition + spaceNeeded > maxY) {
      doc.addPage();
      yPosition = 20;
    }
  };

  // Helper function to add text with word wrapping and proper spacing
  const addText = (text: string, x: number, fontSize: number = 10, maxWidth?: number, style: 'normal' | 'bold' = 'normal'): void => {
    doc.setFont('helvetica', style);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth || contentWidth);
    const lineHeight = fontSize * 0.35;
    
    // Check if all lines fit, if not add new page
    if (yPosition + (lines.length * lineHeight) > maxY) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.text(lines, x, yPosition);
    yPosition += lines.length * lineHeight;
  };

  // Helper function for section headers
  const addSectionHeader = (text: string): void => {
    checkPageBreak(20);
    yPosition += 8;
    doc.setFillColor(245, 245, 245);
    doc.rect(margin - 2, yPosition - 6, contentWidth + 4, 10, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(text, margin + 2, yPosition);
    yPosition += 10;
    doc.setFont('helvetica', 'normal');
  };

  // Helper function for subsection headers
  const addSubsectionHeader = (text: string): void => {
    checkPageBreak(15);
    yPosition += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text(text, margin, yPosition);
    yPosition += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  };

  // Helper function for bullet points
  const addBulletPoint = (text: string, indent: number = 15): void => {
    checkPageBreak(12);
    const bulletX = margin + indent;
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    
    const lines = doc.splitTextToSize(`• ${text}`, contentWidth - indent - 5);
    const lineHeight = 9.5 * 0.35;
    
    if (yPosition + (lines.length * lineHeight) > maxY) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.text(lines, bulletX, yPosition);
    yPosition += lines.length * lineHeight + 2;
  };

  // Helper function for numbered items
  const addNumberedItem = (number: number, text: string, indent: number = 10): void => {
    checkPageBreak(12);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    
    const itemX = margin + indent;
    const lines = doc.splitTextToSize(`${number}. ${text}`, contentWidth - indent - 5);
    const lineHeight = 9.5 * 0.35;
    
    if (yPosition + (lines.length * lineHeight) > maxY) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.text(lines, itemX, yPosition);
    yPosition += lines.length * lineHeight + 2;
  };

  // Helper function to add a detail row (label: value)
  const addDetailRow = (label: string, value: string, isHeader: boolean = false): void => {
    checkPageBreak(10);
    
    const labelX = margin + 5;
    const valueX = margin + 90;
    
    if (isHeader) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(label, labelX, yPosition);
      yPosition += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(label, labelX, yPosition);
      
      doc.setFont('helvetica', 'normal');
      const valueLines = doc.splitTextToSize(value, contentWidth - 95);
      doc.text(valueLines, valueX, yPosition);
      
      // Light separator line
      doc.setDrawColor(240, 240, 240);
      const lineY = yPosition + 2;
      doc.line(margin, lineY, margin + contentWidth, lineY);
      
      yPosition += Math.max(6, valueLines.length * 3.5);
    }
  };

  // ========== DOCUMENT START ==========

  // Company Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('GREEN BRIDGE REALTY SDN. BHD.', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Company No: 202301042822 (1536738-K)', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 4;
  doc.text(`Address: ${contractFields.companyAddress || 'Kuala Lumpur, Malaysia'}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 4;
  doc.text(`Phone: ${contractFields.companyPhone || '+60 3-1234 5678'}  |  Email: ${contractFields.companyEmail || 'info@greenbridge-my.com'}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Main Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('TENANCY AGREEMENT', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Agreement Introduction
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const agreementDate = new Date(contractFields.dateOfAgreement).toLocaleDateString('en-GB');
  addText(`This Tenancy Agreement is made on this ${agreementDate} between:`, margin, 10);
  yPosition += 2;
  addText('GREEN BRIDGE REALTY SDN. BHD. (hereinafter referred to as the "The Company")', margin + 5, 10);
  yPosition += 2;
  addText(`AND ${tenant.fullName} (hereinafter referred to as the "Tenant").`, margin + 5, 10);
  yPosition += 3;

  // PROPERTY & TENANT DETAILS Section
  addSectionHeader('PROPERTY & TENANT DETAILS');

  // Property Details
  addDetailRow('Property Details', '', true);
  addDetailRow('Unit No.', contractFields.unitNumber || '[Unit Number]');
  addDetailRow('Address', contractFields.propertyAddress);
  addDetailRow('Commencement Date', new Date(contractFields.moveInDate).toLocaleDateString('en-GB'));
  addDetailRow('Expiry Date', new Date(contractFields.expiryDate).toLocaleDateString('en-GB'));
  yPosition += 3;

  // Tenant Details
  addDetailRow('Tenant Details', '', true);
  addDetailRow('Name', tenant.fullName);
  addDetailRow('NRIC/Passport', tenant.idNumber || '[NRIC/Passport]');
  addDetailRow('Phone No.', tenant.phoneNumber || '[Phone Number]');
  addDetailRow('Email', tenant.email || '[Email]');
  yPosition += 3;

  // Payment Details
  addDetailRow('Payment Details', '', true);
  addDetailRow('Monthly Rent (RM)', `RM ${contractFields.rentalPerMonth.toLocaleString()}`);
  addDetailRow('Security Deposit (RM)', `RM ${contractFields.securityDeposit.toLocaleString()}`);
  addDetailRow('Utility Deposit (RM)', `RM ${contractFields.utilityDeposit.toLocaleString()}`);
  addDetailRow('Card & Key Deposit (RM)', `RM ${contractFields.accessCardDeposit.toLocaleString()}`);
  addDetailRow('Agreement & Admin Fees (RM)', `RM ${contractFields.agreementFee.toLocaleString()}`);
  
  const totalPayable = contractFields.rentalPerMonth + contractFields.securityDeposit + 
                       contractFields.utilityDeposit + contractFields.accessCardDeposit + 
                       contractFields.agreementFee;
  doc.setFont('helvetica', 'bold');
  addDetailRow('Total Payable (RM)', `RM ${totalPayable.toLocaleString()}`);
  yPosition += 2;

  // RENTAL TERMS & CONDITIONS Section
  addSectionHeader('RENTAL TERMS & CONDITIONS');

  // 1. Rental Payment
  addSubsectionHeader('1. Rental Payment');
  addBulletPoint('Rent must be paid in full and in advance on or before the due date.');
  addBulletPoint('Tenant must promptly pay all utility bills (electricity, water, and any other services).');
  addBulletPoint('Late payment may result in penalties and potential termination of tenancy.');

  // 2. Use of Property
  addSubsectionHeader('2. Use of Property');
  addBulletPoint('Subletting, assigning, or sharing the property with others is strictly prohibited without The Company\'s written approval.');
  addBulletPoint('The property must not be used for any illegal, immoral, or nuisance-causing activities. Tenant is fully liable for any damages, complaints, or claims arising from misuse.');
  addBulletPoint('The property is for residential use only and must not be used for business purposes without prior written consent.');

  // 3. Termination of Tenancy
  addSubsectionHeader('3. Termination of Tenancy');
  addText('The Company has the right to immediately terminate the tenancy and forfeit the deposit if the tenant:', margin, 9.5);
  yPosition += 2;
  addBulletPoint('Fails to pay rent on time.');
  addBulletPoint('Vacates the property before the end of the agreed term without written consent from The Company.');
  addBulletPoint('Breaches any term of this agreement and fails to remedy it after written notice.');
  yPosition += 2;
  addText('Upon termination:', margin, 9.5);
  yPosition += 2;
  addBulletPoint('The deposit is forfeited absolutely.');
  addBulletPoint('Tenant is liable for all losses, damages, penalties, costs, and legal fees incurred by The Company.');
  addBulletPoint('The Company may re-enter and take possession of the property without further notice.');

  // 4. Early Termination by Tenant
  addSubsectionHeader('4. Early Termination by Tenant');
  addText('If the tenant ends the tenancy before the agreed expiry date:', margin, 9.5);
  yPosition += 2;
  addBulletPoint('The deposit is forfeited.');
  addBulletPoint('Tenant must pay The Company the full remaining rent for the unexpired term as liquidated damages.');
  addBulletPoint('The Company reserves the right to claim additional damages if applicable.');

  // 5. Maintenance and Repairs
  addSubsectionHeader('5. Maintenance and Repairs');
  addBulletPoint('Tenant must keep the property in good condition and report any damages or defects immediately.');
  addBulletPoint('Any damage caused by the Tenant or their guests must be repaired at Tenant\'s expense.');
  addBulletPoint('The Company is responsible for structural repairs and maintenance of common areas.');

  // 6. Cleaning Charges
  addSubsectionHeader('6. Cleaning Charges');
  addText('Upon check-out, cleaning fees will be charged as follows:', margin, 9.5);
  yPosition += 2;
  addBulletPoint('RM 50 for a room and RM 150 for a unit/apartment if the condition is normal.');
  addBulletPoint('RM 100 for a room and RM 370 for a unit/apartment if deep cleaning is required due to excessive dirt or poor condition.');

  // 7. Female Tenants' Units
  addSubsectionHeader('7. Female Tenants\' Units');
  addBulletPoint('Male visitors are strictly prohibited from entering female-only units, even for short visits.');
  addBulletPoint('If a violation is reported, a penalty of RM 500 shall be imposed on the Tenant immediately.');

  // Page break before signatures if needed
  checkPageBreak(60);

  // SIGNATURES Section
  addSectionHeader('SIGNATURES');
  yPosition += 5;

  const sigStartY = yPosition;
  const leftColX = margin + 10;
  const rightColX = pageWidth / 2 + 10;

  // Left Column - Tenant
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Tenant', leftColX, sigStartY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`(NRIC/Passport No: ${tenant.idNumber || '[NRIC/Passport]'})`, leftColX, sigStartY + 5);
  
  // Signature line
  doc.setDrawColor(0, 0, 0);
  doc.line(leftColX, sigStartY + 22, leftColX + 60, sigStartY + 22);
  doc.setFontSize(8.5);
  doc.text('Signature', leftColX, sigStartY + 28);

  // Right Column - Company
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('The Company', rightColX, sigStartY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('(Company Stamp / Authorized Signatory)', rightColX, sigStartY + 5);
  
  // Signature line
  doc.line(rightColX, sigStartY + 22, rightColX + 60, sigStartY + 22);
  doc.setFontSize(8.5);
  doc.text('Signature', rightColX, sigStartY + 28);

  yPosition = sigStartY + 38;

  // Page break before house rules
  checkPageBreak(80);

  // GENERAL HOUSE RULES Section
  addSectionHeader('GENERAL HOUSE RULES');

  const houseRules = [
    'Smoking Policy – Smoking is strictly prohibited inside the Property and the Premises. Penalty: RM300 for the first offence + written warning. Repeated offence may lead to immediate termination and forfeiture of all deposits.',
    'Cleanliness and Safety – Tenant must keep the common areas and rooms clean. No fire hazards, health hazards, or unpleasant odors allowed.',
    'Alterations – No drilling, nailing, or structural alterations are permitted without prior written approval from The Company.',
    'Personal Belongings – Tenant is responsible for own belongings. Room and main door must be locked when leaving. The Company is not liable for any loss or theft.',
    'Furniture & Equipment – Do not move, damage, or misuse any furniture or equipment. Damages will be borne by Tenant. Any missing items will be charged at replacement cost.',
    'Access Cards / Keys – Loss or damage is Tenant\'s responsibility. Replacement cost: RM200 per card/key. Report lost cards immediately.',
    'Quiet Hours – 11:00 p.m.–8:00 a.m. (weekdays), 11:00 p.m.–11:00 a.m. (weekends). No loud noise or disturbance during quiet hours.',
    'Guests – Tenant is responsible for guests\' conduct. Guests must leave by 12:00 a.m. Overnight stays only with prior approval from The Company.',
    'Pets – Pets are strictly prohibited in all units and common areas.',
    'Violations – Any breach may result in warning. Repeated/severe violations may lead to termination and forfeiture of deposits.'
  ];

  houseRules.forEach((rule, index) => {
    addNumberedItem(index + 1, rule, 10);
  });

  yPosition += 8;
  checkPageBreak(25);

  // Acknowledgment Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  addText('I have read, understood, and agreed to comply with the above General House Rules.', margin, 10, contentWidth, 'bold');
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  // Name, Date, Signature fields in a row
  const fieldY = yPosition;
  doc.text('Name:', margin, fieldY);
  doc.line(margin + 15, fieldY, margin + 70, fieldY);
  
  doc.text('Date:', margin + 80, fieldY);
  doc.line(margin + 95, fieldY, margin + 130, fieldY);
  
  doc.text('Signature:', margin + 140, fieldY);
  doc.line(margin + 160, fieldY, margin + contentWidth, fieldY);

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

