require('dotenv').config();
const webpush = require('web-push');

const sub = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/cgwwRW_6pr0:APA91bHDUNdPqKkb9qY45xEZ1Xxwqs8o90RWpaJ0RCFsu2T51PQmac6YAlEIBzXNeau6x6tVb4AkbD0EeGXatmDOYXhSk3eI1rEMts7z-EWOKIDV8lUUOZqLwGI_EIEAp7KDwq6Pqjgz",
    "keys": {
        "p256dh": "BF1DK6tKYZ84hS_dqzeT3PK1iY2koZ2Ce0U4G13_-3CZzLEoQO0hZWTCcLV9UbqcogUT2CDiCR8HZOw6M7wjbUE",
        "auth": "MF3to6xhOnQ5WMS3w8fKew"
    }
};

webpush.setVapidDetails(
    'mailto:test@example.com',
    process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

webpush.sendNotification(sub, JSON.stringify({title: "Test Error Code"}))
    .then(res => console.log("SUCCESS:", res.statusCode))
    .catch(err => {
        console.log("ERROR CODE:", err.statusCode);
        console.log("ERROR BODY:", err.body);
    });
