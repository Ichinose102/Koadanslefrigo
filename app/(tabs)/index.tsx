import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, Alert, FlatList, 
  ActivityIndicator, Modal, ScrollView, StatusBar, Button, Image, TextInput 
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Récupération sécurisée des clés
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY; 
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

export default function HomeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  // États de l'application
  const [frigo, setFrigo] = useState<any[]>([]);
  const [sauvegardes, setSauvegardes] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  
  const [manualInput, setManualInput] = useState("");
  const [hasCookeo, setHasCookeo] = useState(false);
  const [hasAirFryer, setHasAirFryer] = useState(false);

  const [viewMode, setViewMode] = useState<'frigo' | 'courses' | 'sauvegardes'>('frigo');
  const [modalSuggestionsVisible, setModalSuggestionsVisible] = useState(false);
  const [modalRecetteVisible, setModalRecetteVisible] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [recetteSelectionnee, setRecetteSelectionnee] = useState<any>(null);
  const [tempProduct, setTempProduct] = useState<any>(null);

  const theme = {
    bg: isDarkMode ? '#000000' : '#F2F2F7',
    card: isDarkMode ? '#1C1C1E' : '#FFFFFF',
    text: isDarkMode ? '#FFFFFF' : '#000000',
    subText: isDarkMode ? '#AEAEB2' : '#8E8E93',
    blue: '#007AFF',
    border: isDarkMode ? '#38383A' : '#E5E5EA',
    accent: '#FFD700'
  };

  // --- PERSISTENCE ---
  useEffect(() => {
    const load = async () => {
      try {
        const f = await AsyncStorage.getItem('@frigo');
        const s = await AsyncStorage.getItem('@sauvegardes');
        const c = await AsyncStorage.getItem('@courses_vfinal');
        const d = await AsyncStorage.getItem('@dark');
        if (f) setFrigo(JSON.parse(f));
        if (s) setSauvegardes(JSON.parse(s));
        if (c) setCourses(JSON.parse(c));
        if (d) setIsDarkMode(JSON.parse(d));
      } catch (e) { console.error("Erreur chargement", e); }
    };
    load();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('@frigo', JSON.stringify(frigo));
    AsyncStorage.setItem('@sauvegardes', JSON.stringify(sauvegardes));
    AsyncStorage.setItem('@courses_vfinal', JSON.stringify(courses));
    AsyncStorage.setItem('@dark', JSON.stringify(isDarkMode));
  }, [frigo, sauvegardes, courses, isDarkMode]);

  // --- LOGIQUE IA (STYLE MARMITON) ---
  const genererRecettes = async () => {
    if (frigo.length === 0) return;
    setLoading(true);
    const ingredientsStr = frigo.map(i => i.nom).join(', ');
    const modeApp = hasCookeo ? "COOKEO" : hasAirFryer ? "AIR FRYER" : "CLASSIQUE";
    
    const prompt = `Tu es le Chef Master de Marmiton. Ingrédients dispos : ${ingredientsStr}. Appareil : ${modeApp}. 
    Génère 3 recettes gourmandes avec des quantités précises (grammes, cl) et des étapes détaillées.
    RÉPONSE UNIQUEMENT EN JSON PUR :
    {"choix": [{"titre":"Nom Gourmand","note":4.8,"avis":1200,"temps":"30 min","ingredients":["200g de...","1 pincée de..."],"etapes":["Détail étape 1...","Détail étape 2..."]}]}`;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      if (data.error) throw new Error("Quota Gemini atteint");
      traiterReponseIA(data.candidates[0].content.parts[0].text);
    } catch (e) {
      console.log("Bascule sur Llama 3.3 (Fallback)...");
      await appelerGroq(ingredientsStr, modeApp);
    } finally {
      setLoading(false);
    }
  };

  const appelerGroq = async (ingredients: string, appareil: string) => {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "Tu es le Chef Marmiton. Tu génères des recettes précises avec quantités et instructions pro en JSON uniquement." },
            { role: "user", content: `Génère 3 recettes complètes pour : ${ingredients} avec ${appareil}. SCHEMA: {"choix": [{"titre":"","note":4.5,"avis":10,"temps":"","ingredients":[],"etapes":[]}]}` }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2
        })
      });
      const data = await res.json();
      traiterReponseIA(data.choices[0].message.content);
    } catch (err) {
      Alert.alert("Désolé", "Le service de recettes est saturé. Réessaie dans quelques secondes.");
    }
  };

  const traiterReponseIA = (text: string) => {
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      const parsed = JSON.parse(text.substring(start, end + 1));
      setSuggestions(parsed.choix || []);
      setModalSuggestionsVisible(true);
    } catch (e) {
      Alert.alert("Erreur", "L'IA a fait une erreur de dressage. Réessaie.");
    }
  };

  // --- ACTIONS PRODUITS ---
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanned(true); setLoading(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
      const json = await res.json();
      if (json.status === 1) {
        setTempProduct({ nom: json.product.product_name || "Produit inconnu", image: json.product.image_front_url || null });
        setScanModalVisible(true);
      } else { setScanned(false); }
    } catch (e) { setScanned(false); } finally { setLoading(false); }
  };

  if (!permission?.granted) return (
    <View style={styles.containerCenter}><Button onPress={requestPermission} title="Activer Caméra" /></View>
  );

  return (
    <SafeAreaProvider>
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]} edges={['top']}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      {/* SECTION CAMERA */}
      <View style={styles.headerCamera}>
        <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={flashOn} onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} />
        <View style={styles.viseur} pointerEvents="none" />
        <TouchableOpacity style={[styles.camBtn, {left: 15}]} onPress={() => setFlashOn(!flashOn)}>
            <Ionicons name={flashOn ? "flash" : "flash-off"} size={22} color={flashOn ? theme.accent : "white"} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.camBtn, {right: 15}]} onPress={() => setIsDarkMode(!isDarkMode)}>
            <Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color="white" />
        </TouchableOpacity>
        
        {/* INPUT MANUEL */}
        <View style={styles.manualInputRow}>
            <TextInput 
              style={[styles.input, {backgroundColor: theme.card, color: theme.text}]} 
              placeholder="Ajouter manuellement..." 
              placeholderTextColor={theme.subText} 
              value={manualInput} 
              onChangeText={setManualInput} 
            />
            <TouchableOpacity style={styles.btnAdd} onPress={() => { if(manualInput.trim()){setFrigo([{nom: manualInput, image: null}, ...frigo]); setManualInput("");} }}>
                <Ionicons name="add" size={28} color="white" />
            </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* SÉLECTEUR APPAREILS */}
        <View style={styles.applianceRow}>
            <TouchableOpacity onPress={() => setHasCookeo(!hasCookeo)} style={[styles.appBtn, hasCookeo && {borderColor: theme.blue, backgroundColor: isDarkMode ? '#1a2a3a' : '#e1f0ff'}]}>
                <MaterialCommunityIcons name="pot-steam" size={20} color={hasCookeo ? theme.blue : theme.subText} />
                <Text style={{fontSize: 12, color: hasCookeo ? theme.blue : theme.subText, fontWeight:'bold'}}>Cookeo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setHasAirFryer(!hasAirFryer)} style={[styles.appBtn, hasAirFryer && {borderColor: theme.blue, backgroundColor: isDarkMode ? '#1a2a3a' : '#e1f0ff'}]}>
                <MaterialCommunityIcons name="fan" size={20} color={hasAirFryer ? theme.blue : theme.subText} />
                <Text style={{fontSize: 12, color: hasAirFryer ? theme.blue : theme.subText, fontWeight:'bold'}}>Air Fryer</Text>
            </TouchableOpacity>
        </View>

        {/* NAVIGATION ONGLES */}
        <View style={[styles.tabNav, {backgroundColor: theme.border}]}>
            {['frigo', 'courses', 'sauvegardes'].map((m) => (
                <TouchableOpacity key={m} onPress={() => setViewMode(m as any)} style={[styles.tabBtn, viewMode === m && {backgroundColor: theme.card}]}>
                    <Text style={{color: viewMode === m ? theme.blue : theme.subText, fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase'}}>{m}</Text>
                </TouchableOpacity>
            ))}
        </View>

        {/* LISTE PRINCIPALE */}
        <FlatList
            data={viewMode === 'frigo' ? frigo : viewMode === 'courses' ? courses : sauvegardes}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item, index }) => (
                <View style={[styles.cardItem, {backgroundColor: theme.card}]}>
                    {viewMode === 'courses' ? (
                        <View style={{flex:1}}>
                            <View style={styles.courseHeader}>
                                <Text style={{color: theme.blue, fontWeight:'bold'}}>{item.titre}</Text>
                                <TouchableOpacity onPress={() => setCourses(courses.filter(c => c.id !== item.id))}><Ionicons name="trash-outline" size={18} color="red" /></TouchableOpacity>
                            </View>
                            {(item.items || []).map((ing: any, i: number) => (
                                <TouchableOpacity key={i} style={styles.courseItemRow} onPress={() => {
                                    const up = [...courses];
                                    const g = up.find(x => x.id === item.id);
                                    if(g) { g.items[i].checked = !ing.checked; setCourses(up); }
                                }}>
                                    <Ionicons name={ing.checked ? "checkbox" : "square-outline"} size={18} color={ing.checked ? theme.blue : theme.subText} />
                                    <Text style={{color: theme.text, textDecorationLine: ing.checked ? 'line-through' : 'none', marginLeft: 8}}>{ing.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <TouchableOpacity style={{flexDirection:'row', alignItems:'center', flex:1}} onPress={() => { if(viewMode === 'sauvegardes'){setRecetteSelectionnee(item); setModalRecetteVisible(true);} }}>
                            {item.image ? <Image source={{uri: item.image}} style={styles.miniImage} /> : <View style={[styles.miniImage, {backgroundColor: theme.border, justifyContent:'center', alignItems:'center'}]}><Ionicons name="nutrition" size={24} color={theme.subText}/></View>}
                            <Text style={{color: theme.text, fontWeight: '600'}}>{item.nom || item.titre}</Text>
                        </TouchableOpacity>
                    )}
                    {viewMode !== 'courses' && <TouchableOpacity onPress={() => {
                        if(viewMode === 'frigo') setFrigo(frigo.filter((_, i) => i !== index));
                        if(viewMode === 'sauvegardes') setSauvegardes(sauvegardes.filter((_, i) => i !== index));
                    }}><Ionicons name="trash-outline" size={18} color="red" /></TouchableOpacity>}
                </View>
            )}
            ListEmptyComponent={<Text style={{textAlign:'center', marginTop:30, color: theme.subText}}>Aucun élément ici.</Text>}
        />

        {viewMode === 'frigo' && frigo.length > 0 && (
          <TouchableOpacity style={styles.btnAction} onPress={genererRecettes}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>👨‍🍳 Proposer 3 Idées Marmiton</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* MODAL 1 : SUGGESTIONS */}
      <Modal visible={modalSuggestionsVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContent, {backgroundColor: theme.bg}]}>
            <Text style={[styles.recetteTitre, {color: theme.text, marginBottom: 20}]}>Choisis ton plat :</Text>
            {suggestions?.map((item, index) => (
                <TouchableOpacity key={index} style={[styles.cardItem, {backgroundColor: theme.card, padding: 20}]} 
                  onPress={() => {
                    setRecetteSelectionnee(item);
                    setModalSuggestionsVisible(false);
                    setTimeout(() => setModalRecetteVisible(true), 150);
                  }}>
                    <View style={{flex:1}}>
                        <Text style={{color: theme.text, fontWeight:'bold', fontSize: 18}}>{item.titre}</Text>
                        <Text style={{color: theme.subText, fontSize: 12}}>⭐ {item.note} ({item.avis} avis) • {item.temps}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color={theme.blue} />
                </TouchableOpacity>
            ))}
            <Button title="Retour" color="red" onPress={() => setModalSuggestionsVisible(false)} />
        </View>
      </Modal>

      {/* MODAL 2 : DÉTAIL RECETTE (SÉCURISÉ CONTRE LES CRASHS) */}
      <Modal animationType="slide" visible={modalRecetteVisible} presentationStyle="pageSheet">
        <View style={[styles.modalContent, {backgroundColor: theme.bg}]}>
            {recetteSelectionnee ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.recetteTitre, {color: theme.text}]}>{recetteSelectionnee.titre}</Text>
                
                <View style={styles.recipeActions}>
                    <TouchableOpacity style={[styles.miniBtn, {backgroundColor: '#FF2D55'}]} onPress={() => {setSauvegardes([recetteSelectionnee, ...sauvegardes]); Alert.alert("❤️", "Ajouté aux favoris !");}}>
                        <Text style={{color:'white', fontWeight:'bold'}}>Sauver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.miniBtn, {backgroundColor: theme.blue}]} onPress={() => {
                        const ings = (recetteSelectionnee.ingredients || []).map((n:any) => ({name: typeof n === 'string' ? n : (n.name || n.nom || "Ingrédient"), checked: false}));
                        setCourses([{ id: Date.now().toString(), titre: recetteSelectionnee.titre, items: ings }, ...courses]);
                        Alert.alert("🛒", "Liste de courses mise à jour !");
                    }}>
                        <Text style={{color:'white', fontWeight:'bold'}}>+ Courses</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitre}>Ingrédients Marmiton :</Text>
                {(recetteSelectionnee.ingredients || []).map((ing: any, i: number) => (
                    <Text key={i} style={{color: theme.text, marginTop: 5, fontSize: 15}}>• {typeof ing === 'string' ? ing : (ing.nom || "Ingrédient")}</Text>
                ))}

                <Text style={styles.sectionTitre}>Pas à Pas :</Text>
                {(recetteSelectionnee.etapes || []).map((e: any, i: number) => (
                    <Text key={i} style={{color: theme.text, marginBottom: 12, lineHeight: 22, fontSize: 16}}>
                        <Text style={{fontWeight:'bold', color: theme.blue}}>{i + 1}. </Text>
                        {typeof e === 'string' ? e : (e.description || e.etape || JSON.stringify(e))}
                    </Text>
                ))}
                
                <View style={{height: 30}} />
                <Button title="Autre suggestion" onPress={() => { setModalRecetteVisible(false); setTimeout(() => setModalSuggestionsVisible(true), 200); }} />
                <View style={{height: 10}} />
                <Button title="Fermer" color="red" onPress={() => setModalRecetteVisible(false)} />
              </ScrollView>
            ) : (
              <ActivityIndicator size="large" color={theme.blue} />
            )}
        </View>
      </Modal>

      {/* MODAL SCAN CONFIRM */}
      <Modal visible={scanModalVisible} transparent animationType="fade">
        <View style={styles.overlay}><View style={[styles.scanConfirmBox, {backgroundColor: theme.card}]}>
            {tempProduct && <><Image source={{uri: tempProduct.image}} style={styles.largeProductImage} /><Text style={{color: theme.text, marginBottom: 20, fontWeight:'bold', textAlign:'center'}}>{tempProduct.nom}</Text>
            <Button title="Ajouter au Frigo" color="#4CD964" onPress={() => {setFrigo([tempProduct, ...frigo]); setScanModalVisible(false); setScanned(false);}} /></>}
        </View></View>
      </Modal>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerCenter: { flex: 1, justifyContent:'center', alignItems:'center' },
  headerCamera: { height: '32%', backgroundColor: '#000', position: 'relative', overflow:'hidden' },
  viseur: { position: 'absolute', top: '30%', left: '30%', width: 140, height: 70, borderWidth: 1, borderColor: '#fff', borderRadius: 10, opacity: 0.3 },
  camBtn: { position: 'absolute', top: 15, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 },
  manualInputRow: { flexDirection: 'row', padding: 12, position: 'absolute', bottom: 0, width: '100%', gap: 10, backgroundColor: 'rgba(0,0,0,0.3)' },
  input: { flex: 1, height: 48, borderRadius: 12, paddingHorizontal: 15 },
  btnAdd: { backgroundColor: '#007AFF', width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 20 },
  applianceRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  appBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, borderRadius: 15, borderWidth: 1.5, borderColor: '#ddd' },
  tabNav: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  cardItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 10 },
  miniImage: { width: 45, height: 45, borderRadius: 10, marginRight: 12 },
  btnAction: { backgroundColor: '#007AFF', padding: 16, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  btnText: { color: 'white', fontWeight: 'bold' },
  courseHeader: { flexDirection:'row', justifyContent:'space-between', marginBottom: 10 },
  courseItemRow: { flexDirection:'row', alignItems:'center', marginBottom: 10, paddingVertical: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  scanConfirmBox: { width: '85%', borderRadius: 25, padding: 25, alignItems: 'center' },
  largeProductImage: { width: 140, height: 140, borderRadius: 15, marginBottom: 15, resizeMode: 'contain' },
  modalContent: { flex: 1, padding: 25 },
  recetteTitre: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  recipeActions: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10, marginBottom: 20 },
  miniBtn: { padding: 12, borderRadius: 12, flex: 1, alignItems: 'center' },
  sectionTitre: { color: '#007AFF', fontWeight:'bold', marginTop: 25, fontSize: 18, marginBottom: 10 }
});