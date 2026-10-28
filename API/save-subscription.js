// api/save-subscription.js
export default function handler(req, res) {
    if (req.method === 'POST') {
      const subscription = req.body;
      
      // Pour l'instant, on affiche l'abonnement dans les logs Vercel
      console.log("Nouvel abonnement :", JSON.stringify(subscription));
      
      res.status(201).json({ message: "Abonnement sauvegardé" });
    } else {
      res.status(405).json({ message: "Méthode non autorisée" });
    }
  }