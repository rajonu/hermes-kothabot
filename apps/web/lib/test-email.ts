// Test script to verify Resend email integration
// Run: node --loader ts-node/esm lib/test-email.ts

import resend from './resend';
import { SENDERS } from '@/lib/email-senders';

async function testEmail() {
  try {
    console.log('🧪 Testing Resend email integration...\n');

    const response = await resend.emails.send({
      from: SENDERS.NOTIFY,
      to: 'rajsyful@gmail.com',
      subject: '✨ KothaBot Test Email',
      html: `
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #10b981; margin-bottom: 20px;">🎉 Resend Integration Works!</h1>

              <p>Hi there!</p>

              <p>This is a test email from KothaBot v2.0 to verify that the Resend email service is properly integrated.</p>

              <div style="background-color: #f3f4f6; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0;">
                <p style="margin: 0;">
                  <strong>API Key:</strong> ${process.env.RESEND_API_KEY?.slice(0, 15)}...<br>
                  <strong>Recipient:</strong> rajsyful@gmail.com<br>
                  <strong>Time:</strong> ${new Date().toISOString()}
                </p>
              </div>

              <p>If you're reading this, the email system is working! 🚀</p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="font-size: 12px; color: #6b7280;">
                © 2026 KothaBot. Test email sent successfully.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    console.log('✅ Email sent successfully!\n');
    console.log('Response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('❌ Error sending email:');
    console.error(error);
    throw error;
  }
}

// Run test
testEmail().catch(console.error);
