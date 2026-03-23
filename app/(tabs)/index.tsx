import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, Alert, FlatList, 
  ActivityIndicator, Modal, ScrollView, StatusBar, Button, Image, TextInput, Platform 
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as NavigationBar from 'expo-navigation-bar';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

// Clés API
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY; 
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

const theme = {
  bg: '#000000', card: '#1C1C1E', text: '#FFFFFF', subText: '#9CA3AF', 
  blue: '#007AFF', border: '#2C2C2E', accent: '#FFD700', green: '#4CD964', red: '#FF3B30'
};

interface Profile {
  id: string;
  nom: string;
  avatar: string;
  exclusions: string;
}

export default function HomeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  // --- DONNÉES ---
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [frigo, setFrigo] = useState<any[]>([]);
  const [sauvegardes, setSauvegardes] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // --- PARAMÈTRES CUISINE ---
  const [regime, setRegime] = useState('CLASSIQUE');
  const [nbPersonnes, setNbPersonnes] = useState(4);
  const [hasCookeo, setHasCookeo] = useState(false);
  const [hasAirFryer, setHasAirFryer] = useState(false);

  // --- UI ---
  const [viewMode, setViewMode] = useState<'frigo' | 'courses' | 'sauvegardes'>('frigo');
  const [modalSuggestionsVisible, setModalSuggestionsVisible] = useState(false);
  const [modalRecetteVisible, setModalRecetteVisible] = useState(false);
  const [modalTicketVisible, setModalTicketVisible] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);

  
  const [produitsTicket, setProduitsTicket] = useState<any[]>([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [recetteSelectionnee, setRecetteSelectionnee] = useState<any>(null);
  const [tempProduct, setTempProduct] = useState<any>(null);
  const [manualInput, setManualInput] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const router = useRouter();

  const regimes = ['CLASSIQUE', 'LEGER', 'VEGAN', 'SANS-GLUTEN', 'HALAL', 'KETO'];

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync("hidden");
      NavigationBar.setBehaviorAsync("overlay-swipe");
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const p = await AsyncStorage.getItem('@profiles');
      const f = await AsyncStorage.getItem('@frigo');
      const s = await AsyncStorage.getItem('@sauvegardes');
      const c = await AsyncStorage.getItem('@courses_vfinal');
      if (p) setProfiles(JSON.parse(p));
      if (f) setFrigo(JSON.parse(f));
      if (s) setSauvegardes(JSON.parse(s));
      if (c) setCourses(JSON.parse(c));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    AsyncStorage.setItem('@profiles', JSON.stringify(profiles));
    AsyncStorage.setItem('@frigo', JSON.stringify(frigo));
    AsyncStorage.setItem('@sauvegardes', JSON.stringify(sauvegardes));
    AsyncStorage.setItem('@courses_vfinal', JSON.stringify(courses));
  }, [profiles, frigo, sauvegardes, courses]);

  // --- LOGIQUE PROFILS ---
  const ajouterProfil = () => {
    if (!newProfileName.trim()) return;
    const nouveau: Profile = { id: Date.now().toString(), nom: newProfileName, avatar: "👨‍🍳", exclusions: "" };
    setProfiles([...profiles, nouveau]);
    setNewProfileName("");
    setIsAddingProfile(false);
  };

  const modifierExclusions = (id: string, texte: string) => {
    const updated = profiles.map(p => p.id === id ? { ...p, exclusions: texte } : p);
    setProfiles(updated);
    if (activeProfile?.id === id) setActiveProfile({ ...activeProfile, exclusions: texte });
  };

  // --- SCAN TICKET & PRODUITS ---
  const handleScanTicket = async () => {
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
    if (!result.canceled && result.assets) {
      setTicketLoading(true);
      const prompt = "Analyse ce ticket. Liste UNIQUEMENT les aliments en JSON : {\"items\": [\"Nom\"]}";
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: result.assets[0].base64 } }] }] })
        });
        const data = await res.json();
        const jsonText = data.candidates[0].content.parts[0].text.match(/\{[\s\S]*\}/)[0];
        const parsed = JSON.parse(jsonText);
        setProduitsTicket(parsed.items.map((nom: string) => ({ id: Math.random().toString(), nom })));
        setModalTicketVisible(true);
      } catch (e) { Alert.alert("Erreur", "Lecture impossible."); }
      finally { setTicketLoading(false); }
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanned(true); setLoading(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
      const json = await res.json();
      if (json.status === 1) {
        setTempProduct({ nom: json.product.product_name, image: json.product.image_front_url, nutriscore: json.product.nutriscore_grade });
        setScanModalVisible(true);
      } else { setScanned(false); }
    } catch (e) { setScanned(false); } finally { setLoading(false); }
  };

  // --- MOTEUR DE RECETTES GIGA (Groq -> Gemini Fallback) ---
  const genererRecettes = async (isPlanificateur = false) => {
    if (frigo.length === 0) return Alert.alert("Frigo vide", "Ajoutez des aliments !");
    setLoading(true);

    const ingredientsStr = frigo.map(i => i.nom).join(', ');
    const modeApp = hasCookeo ? "COOKEO" : hasAirFryer ? "AIR FRYER" : "CLASSIQUE";
    const nbRecettes = isPlanificateur ? 5 : 3;

    const PROMPT_GIGA = `Tu es le Chef Master Anti-Gaspi. 
    Génère ${nbRecettes} recettes gastronomiques pour ${nbPersonnes} pers. avec le mode ${modeApp}.
    STOCK STRICT : ${ingredientsStr}.
    EXCLUSIONS CRITIQUES (Ne jamais utiliser) : ${activeProfile?.exclusions || "Aucune"}.
    REGIME : ${regime}.

    POUR CHAQUE RECETTE :
    1. 4 étapes détaillées (80 mots par étape).
    2. Coût par personne (€).
    3. Accord Boisson précis.
    
    RÉPONDS UNIQUEMENT EN JSON : 
    {"choix": [{
      "titre": "", "note": 4.9, "temps": "45 min",
      "ingredients": [""], "etapes": [""],
      "coutParPers": "3.10€", "accordBoisson": ""
    }]}`;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: PROMPT_GIGA }],
          response_format: { type: "json_object" }
        })
      });
      const dataG = await response.json();
      traiterReponseIA(dataG.choices[0].message.content);
    } catch (e) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT_GIGA }] }], generationConfig: { response_mime_type: "application/json" } })
        });
        const data = await res.json();
        traiterReponseIA(data.candidates[0].content.parts[0].text);
      } catch (err) { Alert.alert("Erreur", "Service IA indisponible."); }
    } finally { setLoading(false); }
  };

  const traiterReponseIA = (text: string) => {
    try {
      const clean = text.replace(/```json/gi, '').replace(/```/g, '');
      const parsed = JSON.parse(clean);
      const data = parsed.choix || parsed.recettes || Object.values(parsed).find(v => Array.isArray(v));
      if (data) { setSuggestions(data); setModalSuggestionsVisible(true); }
    } catch (e) { Alert.alert("Erreur Format", "L'IA a envoyé un message illisible."); }
  };

  // --- UI : SÉLECTION PROFIL ---
  if (!activeProfile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center' }]}>
        <Text style={styles.profileTitle}>Chef du jour ?</Text>
        <View style={styles.profileGrid}>
          {profiles.map(p => (
            <TouchableOpacity key={p.id} style={styles.profileItem} onPress={() => setActiveProfile(p)}>
              <View style={styles.avatarCircle}><Text style={{ fontSize: 40 }}>{p.avatar}</Text></View>
              <Text style={styles.profileName}>{p.nom}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.profileItem} onPress={() => router.push('/(profiles)')}>
            <View style={[styles.avatarCircle, { borderStyle: 'dashed', borderWidth: 2 }]}><Ionicons name="add" size={40} color={theme.subText} /></View>
            <Text style={styles.profileName}>Nouveau</Text>
          </TouchableOpacity>
        </View>


      </SafeAreaView>
    );
  }

  // --- UI : APPLICATION ---
  return (
    <SafeAreaProvider>
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      {/* Header avec Switch et Exclusions */}
      <View style={styles.appHeader}>
        <TouchableOpacity onPress={() => router.push('/(profiles)')}><Ionicons name="people" size={26} color={theme.blue} /></TouchableOpacity>
        <Text style={styles.appName}>{activeProfile.nom}</Text>
        <TouchableOpacity onPress={() => {
            Alert.prompt("Exclusions pour " + activeProfile.nom, "Aliments à ne jamais utiliser (ex: ail, crevettes) :", 
            (t) => modifierExclusions(activeProfile.id, t), "plain-text", activeProfile.exclusions);
        }}><Ionicons name="options" size={26} color={theme.accent} /></TouchableOpacity>
      </View>

      {viewMode === 'frigo' && (
        <View style={styles.headerCamera}>
          <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={flashOn} onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} />
          <TouchableOpacity style={[styles.camBtn, {left: 15}]} onPress={handleScanTicket}>
            {ticketLoading ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="receipt" size={24} color="white" />}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.camBtn, {right: 15}]} onPress={() => setFlashOn(!flashOn)}>
            <Ionicons name={flashOn ? "flash" : "flash-off"} size={22} color={flashOn ? theme.accent : "white"} />
          </TouchableOpacity>
          <View style={styles.manualInputRow}>
            <TextInput style={styles.input} placeholder="Produits (ex: Tomate, Oeuf, Fromage)..." placeholderTextColor={theme.subText} value={manualInput} onChangeText={setManualInput} />
            <TouchableOpacity style={styles.btnAdd} onPress={() => {
              if (manualInput.trim()) {
                const newItems = manualInput.split(',').map(item => ({ nom: item.trim() })).filter(item => item.nom);
                setFrigo([...newItems, ...frigo]);
                setManualInput("");
              }
            }}>
              <Ionicons name="add" size={28} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.content}>
        {viewMode === 'frigo' && (
          <View style={styles.topConfigRow}>
            <View style={styles.peopleSelector}>
              <TouchableOpacity onPress={() => setNbPersonnes(Math.max(1, nbPersonnes - 1))}><Ionicons name="remove-circle-outline" size={24} color={theme.blue}/></TouchableOpacity>
              <Text style={{color: theme.text, fontWeight:'bold'}}>{nbPersonnes} PERS.</Text>
              <TouchableOpacity onPress={() => setNbPersonnes(nbPersonnes + 1)}><Ionicons name="add-circle-outline" size={24} color={theme.blue}/></TouchableOpacity>
            </View>
            <View style={styles.applianceSmallRow}>
              <TouchableOpacity onPress={() => setHasCookeo(!hasCookeo)} style={[styles.appIconBtn, hasCookeo && {backgroundColor: theme.blue}]}><MaterialCommunityIcons name="pot-steam" size={20} color="white" /></TouchableOpacity>
              <TouchableOpacity onPress={() => setHasAirFryer(!hasAirFryer)} style={[styles.appIconBtn, hasAirFryer && {backgroundColor: theme.blue}]}><MaterialCommunityIcons name="fan" size={20} color="white" /></TouchableOpacity>
            </View>
          </View>
        )}

        <FlatList
          data={viewMode === 'frigo' ? frigo : viewMode === 'courses' ? courses : sauvegardes}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item, index }) => (
            <View style={styles.cardItem}>
              <TouchableOpacity style={{flex:1}} onPress={() => { if(viewMode === 'sauvegardes'){setRecetteSelectionnee(item); setModalRecetteVisible(true);} }}>
                <Text style={{color: 'white', fontWeight: 'bold'}}>{item.nom || item.titre}</Text>
                {viewMode === 'courses' && item.items?.map((ing: any, i: number) => <Text key={i} style={{color: theme.subText, fontSize: 12}}>• {ing}</Text>)}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                if(viewMode === 'frigo') setFrigo(frigo.filter((_, i) => i !== index));
                if(viewMode === 'sauvegardes') setSauvegardes(sauvegardes.filter((_, i) => i !== index));
                if(viewMode === 'courses') setCourses(courses.filter((_, i) => i !== index));
              }}><Ionicons name="trash" size={20} color={theme.red} /></TouchableOpacity>
            </View>
          )}
        />

        {viewMode === 'frigo' && frigo.length > 0 && (
          <TouchableOpacity style={styles.btnAction} onPress={() => genererRecettes(false)}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>👨‍🍳 GÉNÉRER POUR {activeProfile.nom.toUpperCase()}</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom Bar Navigation */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setViewMode('frigo')}><Ionicons name="cube" size={26} color={viewMode === 'frigo' ? theme.blue : theme.subText} /></TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setViewMode('courses')}><Ionicons name="cart" size={26} color={viewMode === 'courses' ? theme.blue : theme.subText} /></TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setViewMode('sauvegardes')}><Ionicons name="heart" size={26} color={viewMode === 'sauvegardes' ? theme.blue : theme.subText} /></TouchableOpacity>
      </View>

      {/* MODAL SUGGESTIONS IA */}
      <Modal visible={modalSuggestionsVisible} animationType="slide">
          <View style={[styles.modalContent, {backgroundColor: theme.bg}]}>
              <Text style={styles.recetteTitre}>Propositions IA</Text>
              <ScrollView>
              {suggestions?.map((item, index) => (
                  <TouchableOpacity key={index} style={styles.cardItem} onPress={() => { setRecetteSelectionnee(item); setModalSuggestionsVisible(false); setTimeout(() => setModalRecetteVisible(true), 200); }}>
                      <View style={{flex:1}}>
                          <Text style={{color: 'white', fontWeight:'bold', fontSize: 18}}>{item.titre}</Text>
                          <Text style={{color: theme.green}}>{item.coutParPers} • {item.temps}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color={theme.blue} />
                  </TouchableOpacity>
              ))}
              </ScrollView>
              <Button title="Fermer" color={theme.red} onPress={() => setModalSuggestionsVisible(false)} />
          </View>
      </Modal>

      {/* MODAL RECETTE DÉTAILLÉE */}
      <Modal visible={modalRecetteVisible} animationType="slide">
        <View style={[styles.modalContent, {backgroundColor: theme.bg}]}>
            {recetteSelectionnee && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.recetteTitre}>{recetteSelectionnee.titre}</Text>
                <View style={styles.infoBar}>
                  <Text style={{color: theme.green}}>{recetteSelectionnee.coutParPers}/pers</Text>
                  <Text style={{color: theme.accent}}>{recetteSelectionnee.accordBoisson}</Text>
                </View>

                <View style={{flexDirection: 'row', gap: 10, marginBottom: 20}}>
                  <TouchableOpacity style={[styles.btnAction, {flex: 1, backgroundColor: theme.red}]} onPress={() => {setSauvegardes([recetteSelectionnee, ...sauvegardes]); Alert.alert("❤️", "Sauvegardé !");}}>
                    <Text style={styles.btnText}>Favori</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnAction, {flex: 1}]} onPress={() => {
                    setCourses([{ titre: recetteSelectionnee.titre, items: recetteSelectionnee.ingredients }, ...courses]);
                    Alert.alert("🛒", "Ingrédients ajoutés !");
                  }}>
                    <Text style={styles.btnText}>+ Courses</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitre}>Ingrédients :</Text>
                {recetteSelectionnee.ingredients?.map((ing: any, i: number) => <Text key={i} style={{color: 'white', marginBottom: 5}}>• {ing}</Text>)}
                
                <Text style={styles.sectionTitre}>Préparation :</Text>
                {recetteSelectionnee.etapes?.map((e: any, i: number) => (
                  <View key={i} style={styles.etapeContainer}>
                    <View style={styles.etapeBadge}><Text style={{color:'white'}}>{i+1}</Text></View>
                    <Text style={{color: theme.subText, flex:1, fontSize: 15}}>{e}</Text>
                  </View>
                ))}
                <Button title="Fermer" color={theme.red} onPress={() => setModalRecetteVisible(false)} />
              </ScrollView>
            )}
        </View>
      </Modal>

      {/* MODAL CONFIRMATION SCAN */}
      <Modal visible={scanModalVisible} transparent animationType="fade">
        <View style={styles.overlay}><View style={styles.modalCard}>
            {tempProduct && <><Image source={{uri: tempProduct.image}} style={{width:100, height:100}} /><Text style={{color: 'white', marginVertical:15}}>{tempProduct.nom}</Text>
            <View style={{flexDirection:'row', gap: 15}}>
              <Button title="Annuler" color={theme.red} onPress={() => {setScanModalVisible(false); setScanned(false);}} />
              <Button title="Ajouter" color={theme.green} onPress={() => {setFrigo([tempProduct, ...frigo]); setScanModalVisible(false); setScanned(false);}} />
            </View></>}
        </View></View>
      </Modal>

    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  appName: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  appHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  profileTitle: { color: 'white', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 40 },
  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 30 },
  profileItem: { alignItems: 'center', width: 100 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', borderWeight: 1, borderColor: theme.border },
  profileName: { color: 'white', marginTop: 10, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: theme.card, width: '80%', padding: 25, borderRadius: 20, alignItems: 'center' },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  inputModal: { width: '100%', backgroundColor: '#000', color: 'white', padding: 12, borderRadius: 10, marginBottom: 15 },
  headerCamera: { height: '25%', backgroundColor: '#000' },
  camBtn: { position: 'absolute', top: 15, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 },
  manualInputRow: { flexDirection: 'row', padding: 10, position: 'absolute', bottom: 0, width: '100%', gap: 8, backgroundColor: 'rgba(0,0,0,0.4)' },
  input: { flex: 1, height: 40, backgroundColor: theme.card, borderRadius: 10, paddingHorizontal: 15, color: 'white' },
  btnAdd: { backgroundColor: theme.blue, width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 15 },
  topConfigRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  peopleSelector: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.card, padding: 8, borderRadius: 12 },
  applianceSmallRow: { flexDirection: 'row', gap: 8 },
  appIconBtn: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.card },
  dietContainer: { marginBottom: 15 },
  dietBtn: { padding: 10, borderRadius: 15, marginRight: 8, borderWidth: 1, borderColor: theme.border },
  dietText: { color: theme.subText, fontWeight: 'bold' },
  cardItem: { backgroundColor: theme.card, padding: 15, borderRadius: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  btnAction: { backgroundColor: theme.blue, padding: 14, borderRadius: 15, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold' },
  bottomBar: { flexDirection: 'row', height: 70, borderTopWidth: 1, borderTopColor: theme.border, paddingBottom: 10 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContent: { flex: 1, padding: 20 },
  recetteTitre: { fontSize: 24, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 20 },
  infoBar: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  sectionTitre: { color: theme.blue, fontSize: 18, fontWeight: 'bold', marginVertical: 15 },
  etapeContainer: { flexDirection: 'row', marginBottom: 20, gap: 15 },
  etapeBadge: { backgroundColor: theme.blue, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' }
});