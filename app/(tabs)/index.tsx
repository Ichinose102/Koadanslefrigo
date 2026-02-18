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

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY; 
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

export default function HomeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  const [frigo, setFrigo] = useState<any[]>([]);
  const [sauvegardes, setSauvegardes] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  
  const [regime, setRegime] = useState('CLASSIQUE');
  const [nbPersonnes, setNbPersonnes] = useState(4);
  const [hasCookeo, setHasCookeo] = useState(false);
  const [hasAirFryer, setHasAirFryer] = useState(false);

  const [viewMode, setViewMode] = useState<'frigo' | 'courses' | 'sauvegardes'>('frigo');
  const [modalSuggestionsVisible, setModalSuggestionsVisible] = useState(false);
  const [modalRecetteVisible, setModalRecetteVisible] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [recetteSelectionnee, setRecetteSelectionnee] = useState<any>(null);
  const [tempProduct, setTempProduct] = useState<any>(null);
  const [manualInput, setManualInput] = useState("");

  const regimes = ['CLASSIQUE', 'LEGER', 'VEGAN', 'SANS-GLUTEN', 'HALAL', 'KETO'];
  const theme = {
    bg: isDarkMode ? '#000000' : '#F2F2F7',
    card: isDarkMode ? '#1C1C1E' : '#FFFFFF',
    text: isDarkMode ? '#FFFFFF' : '#000000',
    subText: isDarkMode ? '#AEAEB2' : '#8E8E93',
    blue: '#007AFF',
    border: isDarkMode ? '#38383A' : '#E5E5EA',
    accent: '#FFD700',
    green: '#4CD964'
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync("hidden");
      NavigationBar.setBehaviorAsync("overlay-swipe");
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const f = await AsyncStorage.getItem('@frigo');
        const s = await AsyncStorage.getItem('@sauvegardes');
        const c = await AsyncStorage.getItem('@courses_vfinal');
        const d = await AsyncStorage.getItem('@dark');
        const r = await AsyncStorage.getItem('@regime');
        if (f) setFrigo(JSON.parse(f));
        if (s) setSauvegardes(JSON.parse(s));
        if (c) setCourses(JSON.parse(c));
        if (d) setIsDarkMode(JSON.parse(d));
        if (r) setRegime(r);
      } catch (e) { console.error(e); }
    };
    loadData();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('@frigo', JSON.stringify(frigo));
    AsyncStorage.setItem('@sauvegardes', JSON.stringify(sauvegardes));
    AsyncStorage.setItem('@courses_vfinal', JSON.stringify(courses));
    AsyncStorage.setItem('@dark', JSON.stringify(isDarkMode));
    AsyncStorage.setItem('@regime', regime);
  }, [frigo, sauvegardes, courses, isDarkMode, regime]);

  const toggleCourseItem = (listIndex: number, itemIndex: number) => {
    const newCourses = [...courses];
    newCourses[listIndex].items[itemIndex].checked = !newCourses[listIndex].items[itemIndex].checked;
    setCourses(newCourses);
  };

  // --- MOTEUR IA AVEC PLANIFICATEUR, ACCORDS ET PRIX ---
  const genererRecettes = async (isPlanificateur = false) => {
    if (frigo.length === 0) return Alert.alert("Frigo vide", "Ajoute des aliments !");
    setLoading(true);
    const ingredientsStr = frigo.map(i => i.nom).join(', ');
    const modeApp = hasCookeo ? "COOKEO" : hasAirFryer ? "AIR FRYER" : "CLASSIQUE";
    const nbRecettes = isPlanificateur ? 5 : 3;

    const PROMPT_GIGA = `Tu es le Chef Master de Marmiton et un expert en économie domestique. 
    Génère ${nbRecettes} recettes gastronomiques pour ${nbPersonnes} pers.
    CONTRAINTES : Régime ${regime}, Appareil ${modeApp}, Ingrédients : ${ingredientsStr}.

    POUR CHAQUE RECETTE :
    1. Étapes XXL (80 mots mini chacune).
    2. Estimations précises : Coût total du repas (€) et Coût par personne (€).
    3. Accord Boisson : Suggère un vin ou boisson précise.
    4. S'il s'agit du planificateur (5 recettes), organise-les par "Lundi, Mardi, etc.".

    RÉPONDS UNIQUEMENT EN JSON : 
    {"choix": [{
      "titre": "", "note": 4.9, "avis": 150, "temps": "45 min",
      "ingredients": [""], "etapes": [""], "conseilChef": "",
      "coutTotal": "12.50€", "coutParPers": "3.10€", "accordBoisson": "Un Chardonnay bien frais"
    }]}`;

    try {
      await appelerGroq(ingredientsStr, modeApp, PROMPT_GIGA);
    } catch (e) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT_GIGA }] }] })
        });
        const data = await res.json();
        traiterReponseIA(data.candidates[0].content.parts[0].text);
      } catch (err) { Alert.alert("Erreur", "IA indisponible"); }
    } finally { setLoading(false); }
  };

  const appelerGroq = async (ingredients: string, appareil: string, prompt: string) => {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: prompt }, { role: "user", content: `Cuisine avec : ${ingredients}` }],
        response_format: { type: "json_object" }
      })
    });
    const data = await response.json();
    traiterReponseIA(data.choices[0].message.content);
  };

  const traiterReponseIA = (text: string) => {
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      const jsonString = text.substring(start, end + 1);
      const parsed = JSON.parse(jsonString);
      const data = parsed.choix || parsed.recettes || Object.values(parsed).find(v => Array.isArray(v));
      if (data) { setSuggestions(data); setModalSuggestionsVisible(true); }
    } catch (e) { Alert.alert("Erreur IA", "Format invalide"); }
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

  if (!permission?.granted) return <View style={styles.containerCenter}><Button onPress={requestPermission} title="Activer caméra" /></View>;

  return (
    <SafeAreaProvider>
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]} edges={['top']}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      <View style={styles.headerCamera}>
        <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={flashOn} onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} />
        <TouchableOpacity style={[styles.camBtn, {left: 15}]} onPress={() => setFlashOn(!flashOn)}>
            <Ionicons name={flashOn ? "flash" : "flash-off"} size={22} color={flashOn ? theme.accent : "white"} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.camBtn, {right: 15}]} onPress={() => setIsDarkMode(!isDarkMode)}>
            <Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color="white" />
        </TouchableOpacity>
        <View style={styles.manualInputRow}>
            <TextInput style={[styles.input, {backgroundColor: theme.card, color: theme.text}]} placeholder="Produit..." placeholderTextColor={theme.subText} value={manualInput} onChangeText={setManualInput} />
            <TouchableOpacity style={styles.btnAdd} onPress={() => { if(manualInput.trim()){setFrigo([{nom: manualInput, image: null}, ...frigo]); setManualInput("");} }}>
                <Ionicons name="add" size={28} color="white" />
            </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.topConfigRow}>
            <View style={[styles.peopleSelector, {backgroundColor: theme.card}]}>
                <TouchableOpacity onPress={() => setNbPersonnes(Math.max(1, nbPersonnes - 1))}><Ionicons name="remove-circle-outline" size={24} color={theme.blue}/></TouchableOpacity>
                <Text style={{color: theme.text, fontWeight:'bold'}}>{nbPersonnes} PERS.</Text>
                <TouchableOpacity onPress={() => setNbPersonnes(nbPersonnes + 1)}><Ionicons name="add-circle-outline" size={24} color={theme.blue}/></TouchableOpacity>
            </View>
            <View style={styles.applianceSmallRow}>
                <TouchableOpacity onPress={() => setHasCookeo(!hasCookeo)} style={[styles.appIconBtn, hasCookeo && {backgroundColor: theme.blue}]}>
                    <MaterialCommunityIcons name="pot-steam" size={20} color={hasCookeo ? 'white' : theme.subText} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setHasAirFryer(!hasAirFryer)} style={[styles.appIconBtn, hasAirFryer && {backgroundColor: theme.blue}]}>
                    <MaterialCommunityIcons name="fan" size={20} color={hasAirFryer ? 'white' : theme.subText} />
                </TouchableOpacity>
            </View>
        </View>

        <View style={styles.dietContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {regimes.map((r) => (
                    <TouchableOpacity key={r} onPress={() => setRegime(r)} style={[styles.dietBtn, {backgroundColor: theme.card, borderColor: theme.border}, regime === r && {borderColor: theme.blue, backgroundColor: isDarkMode ? '#1a2a3a' : '#e1f0ff'}]}>
                        <Text style={[styles.dietText, {color: theme.subText}, regime === r && {color: theme.blue, fontWeight: '900'}]}>{r}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        <View style={[styles.tabNav, {backgroundColor: theme.border}]}>
            {['frigo', 'courses', 'sauvegardes'].map((m) => (
                <TouchableOpacity key={m} onPress={() => setViewMode(m as any)} style={[styles.tabBtn, viewMode === m && {backgroundColor: theme.card}]}>
                    <Text style={{color: viewMode === m ? theme.blue : theme.subText, fontWeight: 'bold', fontSize: 11}}>{m.toUpperCase()}</Text>
                </TouchableOpacity>
            ))}
        </View>

        <FlatList
            data={viewMode === 'frigo' ? frigo : viewMode === 'courses' ? courses : sauvegardes}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item, index: listIdx }) => (
                <View style={[styles.cardItem, {backgroundColor: theme.card}]}>
                    {viewMode === 'courses' ? (
                      <View style={{width: '100%'}}>
                        <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 5}}>
                          <Text style={{color: theme.blue, fontWeight: 'bold', fontSize: 16}}>{item.titre}</Text>
                          <TouchableOpacity onPress={() => setCourses(courses.filter((_, i) => i !== listIdx))}><Ionicons name="trash" size={18} color="red" /></TouchableOpacity>
                        </View>
                        {item.items.map((ing: any, ingIdx: number) => (
                          <TouchableOpacity key={ingIdx} onPress={() => toggleCourseItem(listIdx, ingIdx)} style={styles.courseRow}>
                            <Ionicons name={ing.checked ? "checkbox" : "square-outline"} size={22} color={ing.checked ? "#4CD964" : theme.subText} />
                            <Text style={[styles.courseText, {color: ing.checked ? theme.subText : theme.text, textDecorationLine: ing.checked ? 'line-through' : 'none'}]}>{ing.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', width: '100%'}}>
                        <TouchableOpacity style={{flexDirection:'row', alignItems:'center', flex:1}} onPress={() => { if(viewMode === 'sauvegardes'){setRecetteSelectionnee(item); setModalRecetteVisible(true);} }}>
                            {item.image ? <Image source={{uri: item.image}} style={styles.miniImage} /> : <View style={[styles.miniImage, {backgroundColor: theme.border, justifyContent:'center', alignItems:'center'}]}><Ionicons name="nutrition" size={20} color={theme.subText}/></View>}
                            <View style={{flex:1}}>
                              <Text style={{color: theme.text, fontWeight: '600'}}>{item.nom || item.titre}</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            if(viewMode === 'frigo') setFrigo(frigo.filter((_, i) => i !== listIdx));
                            if(viewMode === 'sauvegardes') setSauvegardes(sauvegardes.filter((_, i) => i !== listIdx));
                        }}><Ionicons name="trash-outline" size={18} color="red" /></TouchableOpacity>
                      </View>
                    )}
                </View>
            )}
        />

        {viewMode === 'frigo' && frigo.length > 0 && (
          <View style={{flexDirection: 'row', gap: 10}}>
             <TouchableOpacity style={[styles.btnAction, {flex:1}]} onPress={() => genererRecettes(false)}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>👨‍🍳 3 IDÉES</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnAction, {flex:1, backgroundColor: theme.green}]} onPress={() => genererRecettes(true)}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>📅 SEMAINE</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal visible={modalSuggestionsVisible} animationType="slide">
          <View style={[styles.modalContent, {backgroundColor: theme.bg}]}>
              <Text style={[styles.recetteTitre, {color: theme.text}]}>Vos Propositions :</Text>
              <ScrollView>
              {suggestions?.map((item, index) => (
                  <TouchableOpacity key={index} style={[styles.cardItem, {backgroundColor: theme.card, padding: 15, marginBottom: 15}]} 
                    onPress={() => { setRecetteSelectionnee(item); setModalSuggestionsVisible(false); setTimeout(() => setModalRecetteVisible(true), 200); }}>
                      <View style={{flex:1}}>
                          <Text style={{color: theme.text, fontWeight:'bold', fontSize: 17}}>{item.titre}</Text>
                          <View style={{flexDirection: 'row', gap: 10, marginTop: 5}}>
                             <Text style={{color: theme.green, fontWeight: 'bold'}}>💰 {item.coutParPers}/pers</Text>
                             <Text style={{color: theme.subText}}>🕒 {item.temps}</Text>
                          </View>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color={theme.blue} />
                  </TouchableOpacity>
              ))}
              </ScrollView>
              <Button title="Retour" color="red" onPress={() => setModalSuggestionsVisible(false)} />
          </View>
      </Modal>

      <Modal animationType="slide" visible={modalRecetteVisible}>
        <View style={[styles.modalContent, {backgroundColor: theme.bg}]}>
            {recetteSelectionnee && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.recetteTitre, {color: theme.text}]}>{recetteSelectionnee.titre}</Text>
                
                {/* BANDEAU BUDGET ET ACCORD */}
                <View style={[styles.infoBar, {backgroundColor: theme.card}]}>
                   <View style={styles.infoItem}>
                      <FontAwesome5 name="wallet" size={14} color={theme.green} />
                      <Text style={{color: theme.text, fontSize: 12, marginLeft: 5}}>{recetteSelectionnee.coutParPers}/pers</Text>
                   </View>
                   <View style={styles.infoItem}>
                      <Ionicons name="wine" size={16} color="#FF2D55" />
                      <Text style={{color: theme.text, fontSize: 12, marginLeft: 5}}>{recetteSelectionnee.accordBoisson}</Text>
                   </View>
                </View>

                <View style={{flexDirection: 'row', gap: 10, marginBottom: 20}}>
                    <TouchableOpacity style={[styles.btnAction, {flex: 1, backgroundColor: '#FF2D55'}]} onPress={() => {setSauvegardes([recetteSelectionnee, ...sauvegardes]); Alert.alert("❤️", "Sauvé !");}}>
                        <Text style={styles.btnText}>Sauver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnAction, {flex: 1}]} onPress={() => {
                        const ings = (recetteSelectionnee.ingredients || []).map((n:any) => ({name: n, checked: false}));
                        setCourses([{ id: Date.now().toString(), titre: recetteSelectionnee.titre, items: ings }, ...courses]);
                        Alert.alert("🛒", "Ajouté !");
                    }}>
                        <Text style={styles.btnText}>+ Courses</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitre}>Ingrédients :</Text>
                {recetteSelectionnee.ingredients?.map((ing: any, i: number) => <Text key={i} style={{color: theme.text, fontSize: 15, marginTop: 4}}>• {ing}</Text>)}
                
                <Text style={styles.sectionTitre}>Préparation détaillée :</Text>
                {recetteSelectionnee.etapes?.map((e: any, i: number) => (
                    <View key={i} style={styles.etapeContainer}>
                        <View style={styles.etapeBadge}><Text style={{color:'white', fontWeight:'bold'}}>{i+1}</Text></View>
                        <Text style={styles.etapeTexte}>{e}</Text>
                    </View>
                ))}
                
                <Button title="Fermer" color="red" onPress={() => setModalRecetteVisible(false)} />
              </ScrollView>
            )}
        </View>
      </Modal>

      <Modal visible={scanModalVisible} transparent animationType="fade">
        <View style={styles.overlay}><View style={[styles.scanConfirmBox, {backgroundColor: theme.card}]}>
            {tempProduct && <><Image source={{uri: tempProduct.image}} style={styles.largeProductImage} /><Text style={{color: theme.text, marginBottom: 20, fontWeight:'bold', textAlign:'center'}}>{tempProduct.nom}</Text>
            <Button title="Ajouter" color="#4CD964" onPress={() => {setFrigo([tempProduct, ...frigo]); setScanModalVisible(false); setScanned(false);}} /></>}
        </View></View>
      </Modal>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerCenter: { flex: 1, justifyContent:'center', alignItems:'center' },
  headerCamera: { height: '30%', backgroundColor: '#000', overflow:'hidden' },
  camBtn: { position: 'absolute', top: 15, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8, zIndex: 10 },
  manualInputRow: { flexDirection: 'row', padding: 10, position: 'absolute', bottom: 0, width: '100%', gap: 8, backgroundColor: 'rgba(0,0,0,0.4)' },
  input: { flex: 1, height: 40, borderRadius: 10, paddingHorizontal: 15, color: '#fff' },
  btnAdd: { backgroundColor: '#007AFF', width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 15 },
  topConfigRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  peopleSelector: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12 },
  applianceSmallRow: { flexDirection: 'row', gap: 8 },
  appIconBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#eee' },
  dietContainer: { marginBottom: 10, height: 50 },
  dietBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, marginRight: 8, borderWidth: 2, justifyContent: 'center' },
  dietText: { fontSize: 13, fontWeight: '700' },
  tabNav: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 10 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  cardItem: { padding: 15, borderRadius: 15, marginBottom: 10, width: '100%' },
  miniImage: { width: 45, height: 45, borderRadius: 8, marginRight: 12 },
  courseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: '#eee' },
  courseText: { marginLeft: 10, fontSize: 15 },
  btnAction: { backgroundColor: '#007AFF', padding: 14, borderRadius: 15, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  infoBar: { flexDirection: 'row', padding: 12, borderRadius: 12, marginBottom: 20, justifyContent: 'space-around' },
  infoItem: { flexDirection: 'row', alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  scanConfirmBox: { width: '85%', borderRadius: 25, padding: 25, alignItems: 'center' },
  largeProductImage: { width: 140, height: 140, borderRadius: 15, marginBottom: 15, resizeMode: 'contain' },
  modalContent: { flex: 1, padding: 25 },
  recetteTitre: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
  sectionTitre: { color: '#007AFF', fontWeight:'bold', marginTop: 25, fontSize: 18, marginBottom: 15 },
  etapeContainer: { flexDirection: 'row', marginBottom: 20, gap: 12 },
  etapeBadge: { backgroundColor: '#007AFF', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  etapeTexte: { flex: 1, fontSize: 15, lineHeight: 22 },
  conseilBox: { backgroundColor: '#FFF9C4', padding: 15, borderRadius: 12, borderLeftWidth: 5, borderLeftColor: '#FBC02D', marginBottom: 15 },
  conseilTitre: { fontWeight: 'bold', color: '#827717' },
  conseilTexte: { fontStyle: 'italic', color: '#333' }
});