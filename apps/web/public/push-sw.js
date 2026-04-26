self.addEventListener('push', (event) => {
  event.waitUntil(handlePush());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate('/notifications');
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow('/notifications');
      }

      return undefined;
    }),
  );
});

async function handlePush() {
  const payload = await getLatestNotificationPayload();

  return self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: {
      url: '/notifications',
    },
  });
}

async function getLatestNotificationPayload() {
  try {
    const refreshResponse = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    if (!refreshResponse.ok) {
      return {
        title: 'Zentry update',
        body: 'Open the app to view your latest notification.',
      };
    }

    const refreshData = await refreshResponse.json();
    const accessToken = refreshData?.data?.accessToken;

    if (!accessToken) {
      return {
        title: 'Zentry update',
        body: 'Open the app to view your latest notification.',
      };
    }

    const notificationsResponse = await fetch(
      '/api/v1/notifications?unreadOnly=true&limit=1',
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!notificationsResponse.ok) {
      return {
        title: 'Zentry update',
        body: 'Open the app to view your latest notification.',
      };
    }

    const notificationsData = await notificationsResponse.json();
    const latest = notificationsData?.data?.notifications?.[0];

    if (!latest) {
      return {
        title: 'Zentry update',
        body: 'There is a new update waiting in your account.',
      };
    }

    return {
      title: latest.title ?? 'Zentry update',
      body: latest.message ?? 'Open the app to view your latest notification.',
    };
  } catch {
    return {
      title: 'Zentry update',
      body: 'Open the app to view your latest notification.',
    };
  }
}
