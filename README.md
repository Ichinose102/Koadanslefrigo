# 👋 BIENVENUE SUR KOADANSLEFRIGO

**Koadanslefrigo** est une application mobile intelligente conçue pour lutter contre le gaspillage alimentaire.  
Grâce à l'IA, elle transforme les restes de ton frigo en véritables recettes de chef au format **"Marmiton"**.

> 🚀 Projet basé sur le framework **Expo (SDK 54)**.

---

## 🚀 GET STARTED

### 1️⃣ Installer les dépendances

```bash
npm install
```

---

### 2️⃣ Configurer les clés API (sécurité)

Pour que l'IA puisse cuisiner, tu dois configurer tes clés d'accès.  
Le projet utilise notamment **@google/generative-ai**.

Crée un fichier `.env` à la racine du projet  
*(ce fichier est configuré pour être ignoré par Git)* :

```env
EXPO_PUBLIC_GEMINI_API_KEY=votre_cle_gemini_ici
EXPO_PUBLIC_GROQ_API_KEY=votre_cle_groq_ici
```

---

### 3️⃣ Lancer l'application

```bash
npx expo start
```

Dans le terminal, tu trouveras les options pour ouvrir l'application :

- 📱 Scanner le **QR Code** avec **Expo Go** sur ton téléphone  
- 🤖 Appuyer sur `a` pour un émulateur **Android**  
- 🍎 Appuyer sur `i` pour un simulateur **iOS**

---

## ✨ FONCTIONNALITÉS CLÉS

- 📸 **Scan code-barres**  
  Intégration de la caméra pour ajouter tes produits instantanément  
  *(permission CAMERA activée)*  

- 👨‍🍳 **Recettes "Marmiton"**  
  Prompting IA optimisé pour obtenir des quantités précises  
  *(grammes, cl)* et des étapes techniques détaillées via Google Generative AI  

- 🤖 **IA hybride (fallback)**  
  Système conçu pour utiliser **Gemini 2.5 Flash** afin de garantir une réponse stable  

- 🛒 **Gestion intelligente**  
  Inventaire du frigo et sauvegarde des données gérés localement via **AsyncStorage**  

- 🌙 **Design adaptatif**  
  Support complet du **mode sombre** pour cuisiner confortablement  

---

## 📦 Créer l'application installable (APK)

Le projet est configuré avec l'identifiant EAS :

```
b0160488-13ef-4e19-aebb-8f5552256634
```

Pour installer l'application sur Android :

```bash
eas build --platform android --profile preview
```

Une fois le build terminé, télécharge l'APK via le lien ou le QR code fourni par Expo.

---

## 📚 Learn More

- 🔗 Expo documentation : https://docs.expo.dev/  
- 💬 Join the community : https://chat.expo.dev  

---

Développé avec pour sauver ton frigo et faire des recettes nouvelles. 
