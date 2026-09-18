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
                'mailto:lifecyle06@gmail.com', // Replace with your email
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
