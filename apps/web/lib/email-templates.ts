const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kothabot.ai.bd';
const COMPANY = 'KothaBot';

export const emailTemplates = {
  supportTicketReply: (props: {
    customerName: string;
    ticketId: string;
    subject: string;
    replyMessage: string;
    shopName: string;
  }) => ({
    subject: `Re: ${props.subject}`,
    html: `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981; margin-bottom: 20px;">Support Reply from ${props.shopName}</h2>

            <p>Hi ${props.customerName},</p>

            <p>Thank you for contacting us. Here's the reply to your support ticket:</p>

            <div style="background-color: #f3f4f6; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0;">
              <p style="margin: 0; white-space: pre-wrap;">${props.replyMessage}</p>
            </div>

            <p style="margin-top: 20px;">
              <a href="${APP_URL}/support/${props.ticketId}"
                 style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Full Conversation
              </a>
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="font-size: 12px; color: #6b7280;">
              © 2026 ${COMPANY}. All rights reserved.<br>
              This is an automated email. Please do not reply directly to this message.
            </p>
          </div>
        </body>
      </html>
    `,
  }),

  welcomeEmail: (props: { customerName: string; shopName: string; loginUrl: string }) => ({
    subject: `Welcome to ${COMPANY} - Your AI Voice Assistant Awaits!`,
    html: `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #10b981; text-align: center; margin-bottom: 30px;">🎙️ Welcome to ${COMPANY}!</h1>

            <p>Hi ${props.customerName},</p>

            <p>Your account for <strong>${props.shopName}</strong> is now active! You can now:</p>

            <ul style="font-size: 16px; line-height: 1.8;">
              <li>Add an AI voice assistant to your website</li>
              <li>Manage customer support tickets</li>
              <li>Train the AI with your business data</li>
              <li>Track orders and customer conversations</li>
              <li>Configure advanced AI settings</li>
            </ul>

            <p style="margin-top: 30px;">
              <a href="${props.loginUrl}"
                 style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Login to Your Dashboard
              </a>
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <h3 style="color: #111827;">Getting Started:</h3>
            <ol style="font-size: 14px;">
              <li>Complete your shop profile in Settings</li>
              <li>Add your business information and AI personality</li>
              <li>Get your unique embed code from Integrations</li>
              <li>Add the widget to your website</li>
              <li>Test your voice assistant</li>
            </ol>

            <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">
              © 2026 ${COMPANY}. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `,
  }),

  ticketCreatedConfirmation: (props: { customerName: string; ticketId: string; subject: string }) => ({
    subject: `Support Ticket Created: ${props.subject}`,
    html: `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981; margin-bottom: 20px;">Support Ticket Created</h2>

            <p>Hi ${props.customerName},</p>

            <p>We've received your support request. Here are your ticket details:</p>

            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Ticket ID:</strong> ${props.ticketId}</p>
              <p><strong>Subject:</strong> ${props.subject}</p>
              <p><strong>Status:</strong> Open</p>
            </div>

            <p>Our team will review your ticket and respond shortly. You'll receive an email notification when we reply.</p>

            <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">
              © 2026 ${COMPANY}. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `,
  }),

  paymentConfirmation: (props: { customerName: string; amount: number; currency: string; planName: string; invoiceId?: string }) => ({
    subject: `Payment Confirmation - ${props.planName}`,
    html: `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981; margin-bottom: 20px;">✅ Payment Confirmed</h2>

            <p>Hi ${props.customerName},</p>

            <p>Thank you for your payment! Here are the details:</p>

            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Plan:</strong> ${props.planName}</p>
              <p><strong>Amount:</strong> ${props.currency} ${props.amount}</p>
              <p><strong>Invoice ID:</strong> ${props.invoiceId ?? '—'}</p>
              <p><strong>Status:</strong> Paid</p>
            </div>

            <p>Your subscription is now active. You can manage your billing from your dashboard.</p>

            <p style="margin-top: 20px;">
              <a href="${APP_URL}/billing" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Billing Details
              </a>
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #6b7280;">© 2026 ${COMPANY}. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
  }),

  subscriptionCreated: (props: { customerName: string; planName: string; billingCycle: string; amount: number; currency: string }) => ({
    subject: `Welcome to ${props.planName} - Subscription Active`,
    html: `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981; margin-bottom: 20px;">🎉 Subscription Activated</h2>

            <p>Hi ${props.customerName},</p>

            <p>Your subscription is now active! Here are your subscription details:</p>

            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Plan:</strong> ${props.planName}</p>
              <p><strong>Billing Cycle:</strong> ${props.billingCycle}</p>
              <p><strong>Amount:</strong> ${props.currency} ${props.amount}</p>
            </div>

            <p>You now have access to all premium features. Enjoy using ${COMPANY}!</p>

            <p style="margin-top: 20px;">
              <a href="${APP_URL}/dashboard"
                 style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Go to Dashboard
              </a>
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #6b7280;">
              © 2026 ${COMPANY}. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `,
  }),

  subscriptionRenewed: (props: { customerName: string; planName: string; amount: number; currency: string; nextRenewalDate: string }) => ({
    subject: `Subscription Renewed - ${props.planName}`,
    html: `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981; margin-bottom: 20px;">✅ Subscription Renewed</h2>

            <p>Hi ${props.customerName},</p>

            <p>Your ${props.planName} subscription has been automatically renewed:</p>

            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Plan:</strong> ${props.planName}</p>
              <p><strong>Amount Charged:</strong> ${props.currency} ${props.amount}</p>
              <p><strong>Next Renewal:</strong> ${props.nextRenewalDate}</p>
            </div>

            <p>Thank you for continuing with ${COMPANY}!</p>

            <p style="margin-top: 20px;">
              <a href="${APP_URL}/billing"
                 style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Subscription
              </a>
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #6b7280;">
              © 2026 ${COMPANY}. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `,
  }),

  subscriptionCancelled: (props: { customerName: string; planName: string; cancellationDate: string }) => ({
    subject: `Subscription Cancelled - ${props.planName}`,
    html: `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #ef4444; margin-bottom: 20px;">Subscription Cancelled</h2>

            <p>Hi ${props.customerName},</p>

            <p>Your ${props.planName} subscription has been cancelled.</p>

            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Plan:</strong> ${props.planName}</p>
              <p><strong>Cancellation Date:</strong> ${props.cancellationDate}</p>
              <p><strong>Status:</strong> Cancelled</p>
            </div>

            <p>Your access to premium features will end on the cancellation date above. You can reactivate your subscription anytime from your billing settings.</p>

            <p style="margin-top: 20px;">
              <a href="${APP_URL}/billing"
                 style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Billing
              </a>
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #6b7280;">
              © 2026 ${COMPANY}. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `,
  }),

  invoiceSent: (props: { customerName: string; invoiceId: string; amount: number; currency: string; dueDate: string }) => ({
    subject: `Invoice #${props.invoiceId}`,
    html: `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981; margin-bottom: 20px;">Invoice #${props.invoiceId}</h2>

            <p>Hi ${props.customerName},</p>

            <p>Please find your invoice details below:</p>

            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Invoice ID:</strong> ${props.invoiceId}</p>
              <p><strong>Amount:</strong> ${props.currency} ${props.amount}</p>
              <p><strong>Due Date:</strong> ${props.dueDate}</p>
            </div>

            <p>Please ensure payment is made by the due date. If you have any questions, feel free to contact support.</p>

            <p style="margin-top: 20px;">
              <a href="${APP_URL}/billing"
                 style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Invoice
              </a>
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #6b7280;">
              © 2026 ${COMPANY}. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `,
  }),
};
