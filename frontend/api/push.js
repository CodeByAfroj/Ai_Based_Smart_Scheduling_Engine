import webpush from 'web-push';
import { Receiver } from "@upstash/qstash";

export const config = {
  api: {
    bodyParser: false,
  },
};

const getRawBody = async (req) => {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
};

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Verify QStash Signature (Security)
    const signature = req.headers['upstash-signature'];
    if (!signature) {
      console.error("Missing upstash-signature");
      return res.status(401).json({ error: 'Missing signature' });
    }

    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
    
    if (!currentSigningKey || !nextSigningKey) {
        console.error("Missing QStash signing keys in env");
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const receiver = new Receiver({
      currentSigningKey,
      nextSigningKey,
    });
    
    const bodyStr = await getRawBody(req);
    
    // const isValid = await receiver.verify({
    //   signature: signature,
    //   body: bodyStr,
    // }).catch(err => {
    //     console.error("Signature verification failed:", err);
    //     return false;
    // });
    
    // if (!isValid) {
    //     return res.status(401).json({ error: 'Invalid signature' });
    // }

    // 2. Parse the payload from QStash
    const reqBody = JSON.parse(bodyStr);
    const { title, pushSubscription } = reqBody;

    if (!pushSubscription) {
      return res.status(400).json({ error: 'Missing pushSubscription' });
    }

    // 3. Configure Web Push with your VAPID Keys
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    
    if (!vapidPublic || !vapidPrivate) {
        console.error("Missing VAPID keys in env");
        return res.status(500).json({ error: 'Server configuration error' });
    }

    webpush.setVapidDetails(
      'mailto:lifecyle06@gmail.com', // Replace with your email
      vapidPublic,
      vapidPrivate
    );

    // 4. Send the Push Notification
    const payload = JSON.stringify({
      title: title || 'Task Reminder',
      body: 'It is time for your scheduled task!',
      url: '/'
    });

    await webpush.sendNotification(pushSubscription, payload);
    console.log("Push notification sent successfully");
    
    return res.status(200).json({ message: 'Push sent successfully' });

  } catch (error) {
    console.error('Error sending push:', error);
    return res.status(500).json({ error: error.message });
  }
}
