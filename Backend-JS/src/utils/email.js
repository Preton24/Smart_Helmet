const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const sendEmail = async (reportData) => {
  const {
    type,
    subject,
    title,
    description,
    location,
    timestamp,
    photoUrl,
    reporterDetails,
    metadata
  } = reportData;

  // Create transporter using environment variables
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Format metadata as nice table rows
  const metadataHtml = Object.entries(metadata || {})
    .map(([key, value]) => `
      <tr>
        <td style="padding: 6px 0; color: #15803d; font-size: 14px; font-weight: 600; width: 50%;">${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}</td>
        <td style="padding: 6px 0; color: #166534; font-size: 14px; text-align: right;">${value}</td>
      </tr>
    `).join('');

  // Add Number Plate to subject if available for Traffic reports
  const displaySubject = metadata?.['Vehicle Number Plate'] 
    ? `${subject} - ${metadata['Vehicle Number Plate']}` 
    : subject;

  // Construct incredibly premium HTML body
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 40px 20px;">
      
      <div style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 32px 24px; text-align: center;">
          <div style="display: inline-block; background-color: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; color: #ffffff; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px;">
            Official Report
          </div>
          <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; line-height: 1.3;">${subject}</h2>
        </div>

        <!-- Content -->
        <div style="padding: 32px 24px;">
          
          <!-- Vital Info Block -->
          <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; width: 40%;">
                  <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Time Detected</span>
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                  <span style="color: #0f172a; font-size: 14px; font-weight: 500;">${new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</span>
                </td>
              </tr>
              ${metadata?.['Vehicle Number Plate'] ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">License Plate</span>
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                  <div style="display: inline-block; background-color: #fef2f2; border: 1px solid #fca5a5; color: #ef4444; font-weight: 700; font-size: 15px; padding: 4px 10px; border-radius: 6px; letter-spacing: 1px;">
                    ${metadata['Vehicle Number Plate']}
                  </div>
                </td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; padding-top: 12px;">
                  <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Location</span>
                </td>
                <td style="padding: 8px 0; padding-top: 12px; text-align: right;">
                  <span style="color: #0f172a; font-size: 14px; font-weight: 500;">${location}</span>
                </td>
              </tr>
            </table>
          </div>

          <!-- Report Details -->
          <div style="margin-bottom: 28px;">
            <h3 style="color: #0f172a; font-size: 16px; margin: 0 0 16px 0; font-weight: 700;">Event Breakdown</h3>
            
            <div style="border-left: 3px solid #cbd5e1; padding-left: 16px;">
              <div style="margin-bottom: 12px;">
                <div style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Detection Type</div>
                <div style="color: #334155; font-size: 15px; font-weight: 500; margin-top: 2px;">${type}</div>
              </div>
              
              ${title ? `
              <div style="margin-bottom: 12px;">
                <div style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Observation</div>
                <div style="color: #334155; font-size: 15px; margin-top: 2px;">${title}</div>
              </div>` : ''}
              
              ${description ? `
              <div style="margin-bottom: 12px;">
                <div style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Context</div>
                <div style="color: #334155; font-size: 15px; margin-top: 2px;">${description}</div>
              </div>` : ''}
              
              ${reporterDetails ? `
              <div>
                <div style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Reported By</div>
                <div style="color: #334155; font-size: 15px; font-weight: 500; margin-top: 2px;">${reporterDetails}</div>
              </div>` : ''}
            </div>
          </div>

          <!-- AI Metadata -->
          ${metadataHtml ? `
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
              <h3 style="color: #166534; font-size: 16px; margin: 0; font-weight: 700;">🤖 AI Extracted Data</h3>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              ${metadataHtml}
            </table>
          </div>
          ` : ''}
          
          <!-- Footer Note on Attachments -->
          <div style="background-color: #eff6ff; border-radius: 8px; padding: 16px; text-align: center;">
            <p style="color: #1e40af; margin: 0; font-size: 14px; font-weight: 500;">📎 Evidence files are securely attached to this email.</p>
          </div>

        </div>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">Secured & Analyzed by</p>
        <p style="color: #64748b; font-size: 14px; font-weight: 700; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Smart Helmet Safety Network</p>
      </div>
    </div>
  `;

  // Helper to resolve local paths for attachments from URLs
  const getAttachmentSource = (url) => {
    if (!url) return null;
    
    // If it's a local backend resource (contains /outputs/ or /results/)
    // Try to find it on the local filesystem to avoid network issues/timeouts
    if (url.includes('/outputs/') || url.includes('/results/')) {
      const isOutput = url.includes('/outputs/');
      const folder = isOutput ? 'outputs' : 'processed';
      const delimiter = isOutput ? '/outputs/' : '/results/';
      
      const parts = url.split(delimiter);
      if (parts.length > 1) {
        const relativePath = parts[1];
        const localPath = path.join(__dirname, '../..', folder, relativePath);
        
        if (fs.existsSync(localPath)) {
          console.log(`[Email] Resolving URL to local file: ${localPath}`);
          return { path: localPath };
        }
      }
    }
    
    // Fallback to remote URL
    return url.startsWith('http') ? { href: url } : null;
  };

  const attachments = [];

  // Safely attach the photo
  const photoSource = getAttachmentSource(photoUrl);
  if (photoSource) {
    attachments.push({
      filename: 'evidence_snapshot.jpg',
      ...photoSource
    });
  }

  // Safely attach the video
  const videoSource = getAttachmentSource(reportData.videoUrl);
  if (videoSource) {
    attachments.push({
      filename: 'violation_video.mp4',
      ...videoSource
    });
  }

  // Email options
  const mailOptions = {
    from: `"Smart Helmet Security" <${process.env.SMTP_USER}>`,
    to: process.env.RECIPIENT_EMAIL,
    subject: displaySubject,
    html: htmlBody,
    attachments
  };

  // Send email
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = { sendEmail };
