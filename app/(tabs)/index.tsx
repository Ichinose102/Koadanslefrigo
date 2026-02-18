import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, Alert, FlatList, 
  ActivityIndicator, Modal, ScrollView, StatusBar, Button, Image, TextInput, Platform 
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as NavigationBar from 'expo-navigation-bar';

// --- CONFIGURATION ---
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
    accent: '#FFD700'
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      const initNav = async () => {
        try {
          await NavigationBar.setVisibilityAsync("hidden");
          await NavigationBar.setBehaviorAsync("overlay-swipe"); 
        } catch (e) { console.log(e); }
      };
      initNav();
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

  const genererRecettes = async () => {
    if (frigo.length === 0) return Alert.alert("Frigo vide", "Ajoute des aliments !");
    setLoading(true);
    const ingredientsStr = frigo.map(i => i.nom).join(', ');
    const modeApp = hasCookeo ? "COOKEO" : hasAirFryer ? "AIR FRYER" : "CLASSIQUE";

    const PROMPT_ULTIME = `Tu es le Chef Master de Marmiton. Génère 3 recettes gastronomiques pour ${nbPersonnes} personnes.
    CONTRAINTES OBLIGATOIRES :
    - Régime alimentaire : ${regime}
    - Appareil de cuisson imposé : ${modeApp}
    - Ingrédients disponibles : ${ingredientsStr}

    CONSIGNES DE RÉDACTION :
    1. CHAQUE ÉTAPE doit être très détaillée (minimum 80 mots). Explique la technique (ex: réaction de Maillard, nacrer, réduction).
    2. Utilise un ton professionnel et gourmand.
    3. RÉPONDS UNIQUEMENT EN JSON : 
    {"choix": [{"titre":"Nom Gourmet","note":4.9,"avis":150,"temps":"45 min","ingredients":[""],"etapes":["Description technique longue..."],"conseilChef":""}]}`;

    try {
      await appelerGroq(ingredientsStr, modeApp, PROMPT_ULTIME);
    } catch (e) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT_ULTIME }] }] })
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
        messages: [{ role: "system", content: prompt }, { role: "user", content: `Crée 3 recettes avec : ${ingredients}` }],
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
      if (data) { 
        setSuggestions(data); 
        setModalSuggestionsVisible(true); 
      }
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

  const getNutriColor = (grade: string) => {
    switch(grade?.toLowerCase()) {
      case 'a': return '#008b4c'; case 'b': return '#85bb2f';
      case 'c': return '#fcc00c'; case 'd': return '#ee8100';
      case 'e': return '#e63e11'; default: return '#ccc';
    }
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
                    <TouchableOpacity 
                        key={r} 
                        onPress={() => setRegime(r)} 
                        style={[
                            styles.dietBtn, 
                            { backgroundColor: theme.card, borderColor: theme.border }, 
                            regime === r && { borderColor: theme.blue, backgroundColor: isDarkMode ? '#1a2a3a' : '#e1f0ff' }
                        ]}
                    >
                        <Text style={[
                            styles.dietText, 
                            { color: theme.subText }, 
                            regime === r && { color: theme.blue, fontWeight: '900' }
                        ]}>
                            {r}
                        </Text>
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
                              {item.nutriscore && <View style={[styles.nutriBadge, {backgroundColor: getNutriColor(item.nutriscore)}]}><Text style={styles.nutriText}>{item.nutriscore.toUpperCase()}</Text></View>}
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
          <TouchableOpacity style={styles.btnAction} onPress={genererRecettes}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>👨‍🍳 CUISINER ({nbPersonnes} PERS.)</Text>}
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={modalSuggestionsVisible} animationType="slide">
          <View style={[styles.modalContent, {backgroundColor: theme.bg}]}>
              <Text style={[styles.recetteTitre, {color: theme.text}]}>👨‍🍳 3 Idées pour vous :</Text>
              <ScrollView>
              {suggestions?.map((item, index) => (
                  <TouchableOpacity key={index} style={[styles.cardItem, {backgroundColor: theme.card, padding: 20, marginBottom: 15}]} 
                    onPress={() => { setRecetteSelectionnee(item); setModalSuggestionsVisible(false); setTimeout(() => setModalRecetteVisible(true), 300); }}>
                      <View style={{flex:1}}>
                          <Text style={{color: theme.text, fontWeight:'bold', fontSize: 18}}>{item.titre}</Text>
                          <Text style={{color: theme.subText, marginTop: 5}}>⭐ <Text style={{color: '#FF9500'}}>{item.note || '4.8'}</Text> ({item.avis || '120'} avis)  •  🕒 {item.temps || '25 min'}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color={theme.blue} />
                  </TouchableOpacity>
              ))}
              </ScrollView>
              <Button title="Annuler" color="red" onPress={() => setModalSuggestionsVisible(false)} />
          </View>
      </Modal>

      <Modal animationType="slide" visible={modalRecetteVisible}>
        <View style={[styles.modalContent, {backgroundColor: theme.bg}]}>
            {recetteSelectionnee && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.recetteTitre, {color: theme.text}]}>{recetteSelectionnee.titre}</Text>
                
                <View style={{flexDirection: 'row', gap: 10, marginBottom: 20}}>
                    <TouchableOpacity style={[styles.miniBtn, {backgroundColor: '#FF2D55'}]} onPress={() => {setSauvegardes([recetteSelectionnee, ...sauvegardes]); Alert.alert("❤️", "Sauvé !");}}>
                        <Text style={styles.btnText}>Favoris</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.miniBtn, {backgroundColor: theme.blue}]} onPress={() => {
                        const ings = (recetteSelectionnee.ingredients || []).map((n:any) => ({name: n, checked: false}));
                        setCourses([{ id: Date.now().toString(), titre: recetteSelectionnee.titre, items: ings }, ...courses]);
                        Alert.alert("🛒", "Ajouté aux courses !");
                    }}>
                        <Text style={styles.btnText}>+ Courses</Text>
                    </TouchableOpacity>
                </View>

                {recetteSelectionnee.conseilChef && (
                  <View style={styles.conseilBox}>
                    <Text style={styles.conseilTitre}>💡 Conseil du Chef</Text>
                    <Text style={styles.conseilTexte}>{recetteSelectionnee.conseilChef}</Text>
                  </View>
                )}

                <Text style={styles.sectionTitre}>Ingrédients :</Text>
                {recetteSelectionnee.ingredients?.map((ing: any, i: number) => <Text key={i} style={{color: theme.text, fontSize: 16, marginTop: 4}}>• {ing}</Text>)}
                
                <Text style={styles.sectionTitre}>Préparation pas à pas :</Text>
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
            <Button title="Ajouter au Frigo" color="#4CD964" onPress={() => {setFrigo([tempProduct, ...frigo]); setScanModalVisible(false); setScanned(false);}} />
            <Button title="Annuler" color="red" onPress={() => {setScanModalVisible(false); setScanned(false);}} /></>}
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
  nutriBadge: { width: 22, height: 22, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  nutriText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  courseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: '#eee' },
  courseText: { marginLeft: 10, fontSize: 15 },
  btnAction: { backgroundColor: '#007AFF', padding: 16, borderRadius: 15, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold' },
  miniBtn: { padding: 12, borderRadius: 12, flex: 1, alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  scanConfirmBox: { width: '85%', borderRadius: 25, padding: 25, alignItems: 'center' },
  largeProductImage: { width: 140, height: 140, borderRadius: 15, marginBottom: 15, resizeMode: 'contain' },
  modalContent: { flex: 1, padding: 25 },
  recetteTitre: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
  sectionTitre: { color: '#007AFF', fontWeight:'bold', marginTop: 25, fontSize: 18, marginBottom: 15 },
  etapeContainer: { flexDirection: 'row', marginBottom: 20, gap: 12 },
  etapeBadge: { backgroundColor: '#007AFF', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  etapeTexte: { flex: 1, fontSize: 15, lineHeight: 22 },
  conseilBox: { backgroundColor: '#FFF9C4', padding: 15, borderRadius: 12, borderLeftWidth: 5, borderLeftColor: '#FBC02D', marginBottom: 15 },
  conseilTitre: { fontWeight: 'bold', color: '#827717' },
  conseilTexte: { fontStyle: 'italic', color: '#333' }
});