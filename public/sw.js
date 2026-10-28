// public/sw.js
self.addEventListener('push', function(event) {
    let data = { title: 'Nouvelle notification', body: 'Vous avez un message !' };
    
    if (event.data) {
      try {
        data = event.data.json();
      } catch (e) {
        data.body = event.data.text();
      }
    }
  
    const options = {
      body: data.body,
      icon: '/vite.svg', // Remplacez par votre logo
      badge: '/vite.svg'
    };
  
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  });
  
  self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(clients.openWindow('/'));
  });