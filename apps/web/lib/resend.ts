import { Resend } from 'resend';

let resendInstance: Resend | null = null;

function initializeResend(): Resend {
  if (resendInstance) return resendInstance;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  resendInstance = new Resend(apiKey);
  return resendInstance;
}

export default {
  emails: {
    send: async (params: any) => {
      const resend = initializeResend();
      return resend.emails.send(params);
    },
  },
};
