// ==========================================
// PDF FORM GENERATOR — Custom printable EMR form
// ==========================================

function generatePrintableForm() {
  const sites = getSites();
  const providers = getProviders();
  const complaints = getComplaints();
  const referralTypes = getReferralTypes().filter(t => t !== 'None');
  const procedures = getProcedures();
  const formulary = getFormulary();

  // Get top medications (most commonly used categories)
  const categories = [...new Set(formulary.map(f => f.category))];

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>DH Field EMR — Patient Encounter Form</title>
<style>
  @page { size: letter; margin: 0.4in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #111; line-height: 1.3; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: avoid; }
  h1 { font-size: 14px; text-align: center; margin-bottom: 2px; }
  .subtitle { text-align: center; font-size: 8px; color: #666; margin-bottom: 8px; }
  .section { margin-bottom: 6px; border: 1px solid #ccc; border-radius: 3px; padding: 4px 6px; }
  .section-title { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #E67300; margin-bottom: 3px; border-bottom: 1px solid #eee; padding-bottom: 2px; }
  .row { display: flex; gap: 6px; margin-bottom: 3px; align-items: flex-start; }
  .field { flex: 1; }
  .field-label { font-size: 7px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 1px; }
  .field-line { border-bottom: 1px solid #999; min-height: 14px; }
  .field-line-tall { border-bottom: 1px solid #999; min-height: 24px; }
  .checkbox-grid { display: flex; flex-wrap: wrap; gap: 1px 8px; }
  .cb { display: flex; align-items: center; gap: 2px; font-size: 8px; }
  .cb-box { width: 10px; height: 10px; border: 1.5px solid #333; border-radius: 2px; flex-shrink: 0; }
  .cb-circle { width: 10px; height: 10px; border: 1.5px solid #333; border-radius: 50%; flex-shrink: 0; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
  .lab-row { display: flex; align-items: center; gap: 4px; padding: 2px 0; border-bottom: 1px dotted #ddd; }
  .lab-name { font-weight: bold; min-width: 80px; font-size: 8px; }
  .lab-result { display: flex; gap: 6px; }
  .med-row { display: flex; gap: 4px; align-items: center; border-bottom: 1px dotted #ddd; padding: 2px 0; }
  .med-line { border-bottom: 1px solid #999; flex: 1; min-height: 12px; }
  .notes-box { border: 1px solid #999; min-height: 30px; border-radius: 2px; padding: 2px; }
  .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .mrn-box { border: 2px solid #333; padding: 2px 8px; font-size: 10px; font-weight: bold; min-width: 140px; text-align: center; }
  .footer { text-align: center; font-size: 7px; color: #999; margin-top: 4px; }
  table.ua-table { width: 100%; border-collapse: collapse; font-size: 8px; }
  table.ua-table td { padding: 1px 3px; border-bottom: 1px dotted #ddd; }
  table.ua-table td:first-child { font-weight: bold; width: 70px; }
</style>
</head>
<body>

<!-- PAGE 1: FRONT -->
<div class="page">
  <div class="header-row">
    <div><h1>DH Field EMR</h1><div class="subtitle">Patient Encounter Form</div></div>
    <div class="mrn-box">MRN: _______________</div>
  </div>

  <div class="section">
    <div class="section-title">Patient Information</div>
    <div class="row">
      <div class="field"><div class="field-label">Given Name</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Family Name</div><div class="field-line"></div></div>
    </div>
    <div class="row">
      <div class="field" style="max-width:80px;"><div class="field-label">Sex</div><div class="checkbox-grid"><span class="cb"><span class="cb-circle"></span> M</span><span class="cb"><span class="cb-circle"></span> F</span></div></div>
      <div class="field" style="max-width:120px;"><div class="field-label">Date of Birth</div><div class="field-line"></div></div>
      <div class="field" style="max-width:60px;"><div class="field-label">Age</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Phone</div><div class="field-line"></div></div>
    </div>
    <div class="row">
      <div class="field" style="max-width:70px;"><div class="field-label">Pregnant</div><div class="checkbox-grid"><span class="cb"><span class="cb-box"></span> Y</span><span class="cb"><span class="cb-box"></span> N</span><span class="cb"><span class="cb-box"></span> N/A</span></div></div>
      <div class="field" style="max-width:100px;"><div class="field-label">Breastfeeding</div><div class="checkbox-grid"><span class="cb"><span class="cb-box"></span> Y</span><span class="cb"><span class="cb-box"></span> N</span><span class="cb"><span class="cb-box"></span> N/A</span></div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Encounter</div>
    <div class="row">
      <div class="field"><div class="field-label">Date</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Site</div><div class="checkbox-grid">${sites.map(s => `<span class="cb"><span class="cb-box"></span> ${s}</span>`).join('')}${sites.length === 0 ? '<div class="field-line" style="flex:1;"></div>' : ''}</div></div>
    </div>
    <div class="row">
      <div class="field"><div class="field-label">Provider</div><div class="checkbox-grid">${providers.map(p => `<span class="cb"><span class="cb-box"></span> ${p}</span>`).join('')}${providers.length === 0 ? '<div class="field-line" style="flex:1;"></div>' : ''}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Vitals</div>
    <div class="row">
      <div class="field"><div class="field-label">Temp (&deg;C)</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">BP (mmHg)</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Weight (kg)</div><div class="field-line"></div></div>
      <div class="field"><div class="field-label">Blood Glucose (mg/dL)</div><div class="field-line"></div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Transport</div>
    <div class="row">
      <div class="field"><div class="field-label">How did you get here?</div><div class="checkbox-grid"><span class="cb"><span class="cb-box"></span> Walk</span><span class="cb"><span class="cb-box"></span> Boda</span><span class="cb"><span class="cb-box"></span> Private Auto</span><span class="cb"><span class="cb-box"></span> Public Taxi</span><span class="cb"><span class="cb-box"></span> Other</span></div></div>
      <div class="field" style="max-width:100px;"><div class="field-label">Travel Time (min)</div><div class="field-line"></div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">History</div>
    <div class="row"><div class="field"><div class="field-label">Allergies</div><div class="field-line"></div></div></div>
    <div class="row"><div class="field"><div class="field-label">Current Medications</div><div class="field-line"></div></div></div>
    <div class="row"><div class="field"><div class="field-label">Past Medical History</div><div class="field-line-tall"></div></div></div>
    <div class="row">
      <div class="field">
        <div class="field-label">Chief Concern</div>
        <div class="checkbox-grid">${complaints.map(c => `<span class="cb"><span class="cb-box"></span> ${c}</span>`).join('')}</div>
        <div class="field-line-tall" style="margin-top:3px;"></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Labs</div>
    <div class="three-col">
      <div class="lab-row"><span class="lab-name">Malaria RDT</span><div class="lab-result"><span class="cb"><span class="cb-box"></span> Order</span><span class="cb"><span class="cb-circle"></span> POS</span><span class="cb"><span class="cb-circle"></span> NEG</span></div></div>
      <div class="lab-row"><span class="lab-name">HIV</span><div class="lab-result"><span class="cb"><span class="cb-box"></span> Order</span><span class="cb"><span class="cb-circle"></span> POS</span><span class="cb"><span class="cb-circle"></span> NEG</span></div></div>
      <div class="lab-row"><span class="lab-name">HCG/Pregnancy</span><div class="lab-result"><span class="cb"><span class="cb-box"></span> Order</span><span class="cb"><span class="cb-circle"></span> POS</span><span class="cb"><span class="cb-circle"></span> NEG</span></div></div>
      <div class="lab-row"><span class="lab-name">Typhoid</span><div class="lab-result"><span class="cb"><span class="cb-box"></span> Order</span><span class="cb"><span class="cb-circle"></span> POS</span><span class="cb"><span class="cb-circle"></span> NEG</span></div></div>
      <div class="lab-row"><span class="lab-name">RPR/Syphilis</span><div class="lab-result"><span class="cb"><span class="cb-box"></span> Order</span><span class="cb"><span class="cb-circle"></span> POS</span><span class="cb"><span class="cb-circle"></span> NEG</span></div></div>
      <div class="lab-row"><span class="lab-name">H. pylori</span><div class="lab-result"><span class="cb"><span class="cb-box"></span> Order</span><span class="cb"><span class="cb-circle"></span> POS</span><span class="cb"><span class="cb-circle"></span> NEG</span></div></div>
      <div class="lab-row"><span class="lab-name">Hep B</span><div class="lab-result"><span class="cb"><span class="cb-box"></span> Order</span><span class="cb"><span class="cb-circle"></span> POS</span><span class="cb"><span class="cb-circle"></span> NEG</span></div></div>
    </div>
    <div class="row" style="margin-top:3px;"><div class="field"><div class="field-label">Lab Comments</div><div class="field-line"></div></div></div>
  </div>

  <div class="footer">DH Field EMR &mdash; Printed Form &mdash; Page 1 of 2</div>
</div>

<!-- PAGE 2: BACK -->
<div class="page">
  <div class="header-row">
    <div><h1>DH Field EMR</h1><div class="subtitle">Patient Encounter Form (continued)</div></div>
    <div class="mrn-box">MRN: _______________</div>
  </div>

  <div class="section">
    <div class="section-title">Diagnosis</div>
    <div class="checkbox-grid" style="margin-bottom:4px;">
      ${DX_PRESETS.map(d => `<span class="cb"><span class="cb-box"></span> ${d}</span>`).join('')}
    </div>
    <div class="field"><div class="field-label">Other / Details</div><div class="field-line-tall"></div></div>
  </div>

  <div class="section">
    <div class="section-title">Medications</div>
    <div style="font-size:7px;color:#666;margin-bottom:3px;">Drug — Dose — Frequency — Duration — Qty</div>
    ${[1,2,3,4,5,6].map(i => `<div class="med-row"><span style="font-size:8px;color:#999;width:12px;">${i}.</span><div class="med-line"></div></div>`).join('')}
  </div>

  <div class="section">
    <div class="section-title">Treatment Notes</div>
    <div class="notes-box" style="min-height:24px;"></div>
  </div>

  <div class="section">
    <div class="section-title">Procedures</div>
    <div class="checkbox-grid">
      ${procedures.map(p => `<span class="cb"><span class="cb-box"></span> ${p}</span>`).join('')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Imaging</div>
    <div class="row">
      <div class="field" style="max-width:100px;"><div class="checkbox-grid"><span class="cb"><span class="cb-box"></span> Ultrasound</span></div></div>
      <div class="field"><div class="field-label">Type</div><div class="checkbox-grid"><span class="cb"><span class="cb-box"></span> Abdominal</span><span class="cb"><span class="cb-box"></span> Pelvic</span><span class="cb"><span class="cb-box"></span> OB</span><span class="cb"><span class="cb-box"></span> Renal</span><span class="cb"><span class="cb-box"></span> Thyroid</span><span class="cb"><span class="cb-box"></span> MSK</span><span class="cb"><span class="cb-box"></span> FAST</span><span class="cb"><span class="cb-box"></span> Cardiac</span><span class="cb"><span class="cb-box"></span> Lung</span></div></div>
    </div>
    <div class="row"><div class="field"><div class="field-label">Findings</div><div class="field-line-tall"></div></div></div>
  </div>

  <div class="section">
    <div class="section-title">Surgical Encounter</div>
    <div class="row">
      <div class="field" style="max-width:80px;"><div class="checkbox-grid"><span class="cb"><span class="cb-box"></span> Surgery</span></div></div>
      <div class="field"><div class="field-label">Type of Surgery</div><div class="field-line"></div></div>
    </div>
    <div class="row"><div class="field"><div class="field-label">Surgical Notes</div><div class="field-line-tall"></div></div></div>
  </div>

  <div class="section">
    <div class="section-title">Referral</div>
    <div class="row">
      <div class="field"><div class="checkbox-grid">${referralTypes.map(t => `<span class="cb"><span class="cb-box"></span> ${t}</span>`).join('')}</div></div>
      <div class="field" style="max-width:120px;"><div class="field-label">Scheduled Date</div><div class="field-line"></div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Additional Notes</div>
    <div class="notes-box" style="min-height:40px;"></div>
  </div>

  <div class="row" style="margin-top:6px;">
    <div class="field"><div class="field-label">Provider Signature</div><div class="field-line"></div></div>
    <div class="field" style="max-width:120px;"><div class="field-label">Date</div><div class="field-line"></div></div>
  </div>

  <div class="footer">DH Field EMR &mdash; Printed Form &mdash; Page 2 of 2</div>
</div>

</body>
</html>`;

  // Open in new window for printing
  const printWindow = window.open('', '_blank', 'width=850,height=1100');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}
