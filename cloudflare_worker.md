# Web Push Cloudflare Worker Setup

Here is everything you need to set up your Cloudflare Worker.

## The Worker Script (`index.js`)

When you create your Cloudflare Worker, paste this code into the editor:

```javascript
import webpush from 'web-push';

export default {
  async fetch(request, env, ctx) {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      // 1. Verify QStash Signature (Security)
      const signature = request.headers.get('upstash-signature');
      if (!signature) {
        return new Response('Missing signature', { status: 401 });
      }
      
      // A full production app should use the @upstash/qstash library to verify the signature here
      // using your QSTASH_CURRENT_SIGNING_KEY from the environment.
      // For testing, we will just parse the body.

      // 2. Parse the payload from QStash
      const body = await request.json();
      const { title, pushSubscription } = body;

      if (!pushSubscription) {
        return new Response('Missing pushSubscription', { status: 400 });
      }

      // 3. Configure Web Push with your VAPID Keys
      webpush.setVapidDetails(
        'mailto:admin@yourdomain.com', // Replace with your email
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
      );

      // 4. Send the Push Notification
      const payload = JSON.stringify({ 
        title: title || 'Task Reminder', 
        body: 'It is time for your scheduled task!',
        url: '/'
      });

      await webpush.sendNotification(pushSubscription, payload);
      
      return new Response('Push sent successfully', { status: 200 });
      
    } catch (error) {
      console.error('Error sending push:', error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },
};
```

*Note: You will need to ensure `web-push` is installed in your worker environment or use a bundled setup like Wrangler if you do it locally.*

## Your Environment Variables (Add these in Cloudflare Settings)

You must add these to your Cloudflare Worker's **Settings -> Variables -> Environment Variables**:

- `VAPID_PUBLIC_KEY`: `BPuBbm5aor_zhOFE77Rd5_iCYJkil_FfkrK2FF8uPq8wskT8zGbhMtw1KujzLkbdDBsLTgSLVNxPz7i2Wf9pddk`
- `VAPID_PRIVATE_KEY`: `T8wkbi_JWBskpD05YdFVakpmP867rNxN42X_yaACLxo`

*(I just generated these specifically for your app!)*

## Your Action Items

1. **Upstash**: Go to [console.upstash.com](https://console.upstash.com/), create a free account, go to **QStash**, and copy your `QSTASH_TOKEN`.
2. **Cloudflare**: Go to your Cloudflare dashboard, create a new Worker, paste the code above (you might need to deploy it locally using `wrangler` to bundle the `web-push` npm package). Add the two `VAPID` environment variables.
3. **Reply to me**: Once you are done, reply with your `QSTASH_TOKEN` and the **Cloudflare Worker URL** (e.g., `https://my-worker.username.workers.dev`).

Once you give me those two things, I will immediately update your backend and frontend code to wire it all together!
