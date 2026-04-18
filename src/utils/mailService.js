// File: src/utils/mailService.js
import { Platform } from 'react-native';

const API_BASE_URL = 'https://safelockers.sheikhtaj3010.workers.dev';

export const sendPremiumTestMail = async (targetEmail) => {
  try {
    // Premium Smart Payload based on your Blueprint
    const payload = {
      email: targetEmail,
      templateData: {
        subject: "SafeLocker Recovery Email Test Successful",
        heading: "Recovery channel verified",
        body: "This is a test message from SafeLocker to confirm that your recovery email is active and able to receive security alerts, verification codes, and recovery instructions.\n\nIf you received this email, your recovery identity is working correctly.\n\nFuture critical actions such as Master PIN reset, emergency wipe authorization, passkey fallback OTP, and secure backup recovery will use this email.",
        statusBadge: "Status: Recovery mail operational",
        footer: "No action is required. This was a manual test initiated from your Settings screen.",
        context: `Triggered from Settings → Test Recovery Mail\nDevice: ${Platform.OS === 'ios' ? 'Apple iOS' : 'Android'} Trusted Device\nTime: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      }
    };

    // Replace '/send-test-mail' with your actual Cloudflare worker route for custom templates
    const response = await fetch(`${API_BASE_URL}/send-test-mail`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    return { success: data.success, message: data.message };
    
  } catch (error) {
    // Failsafe error mapping
    return { success: false, message: 'Network error or backend unreachable.' };
  }
};
