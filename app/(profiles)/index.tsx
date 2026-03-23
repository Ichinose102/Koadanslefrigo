import { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const theme = {
  bg: '#000000',
  card: '#1C1C1E',
  text: '#FFFFFF',
  subText: '#9CA3AF',
  blue: '#007AFF',
  border: '#2C2C2E',
  accent: '#FFD700',
  red: '#FF3B30',
};

interface Profile {
  id: string;
  nom: string;
  avatar: string;
  exclusions: string;
}

export default function ProfileScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const p = await AsyncStorage.getItem('@profiles');
      if (p) {
        setProfiles(JSON.parse(p));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveProfiles = async (updatedProfiles: Profile[]) => {
    try {
      await AsyncStorage.setItem('@profiles', JSON.stringify(updatedProfiles));
      setProfiles(updatedProfiles);
    } catch (e) {
      console.error(e);
    }
  };

  const addProfile = () => {
    if (!newProfileName.trim()) return;
    const newProfile: Profile = {
      id: Date.now().toString(),
      nom: newProfileName,
      avatar: "👨‍🍳",
      exclusions: "",
    };
    saveProfiles([...profiles, newProfile]);
    setNewProfileName("");
  };

  const updateExclusions = (id: string, exclusions: string) => {
    const updatedProfiles = profiles.map(p =>
      p.id === id ? { ...p, exclusions } : p
    );
    saveProfiles(updatedProfiles);
  };

  const deleteProfile = (id: string) => {
    Alert.alert(
      "Supprimer le profil",
      "Êtes-vous sûr de vouloir supprimer ce profil ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => {
            const updatedProfiles = profiles.filter(p => p.id !== id);
            saveProfiles(updatedProfiles);
          } 
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.blue} />
        </TouchableOpacity>
        <Text style={styles.title}>Gestion des Profils</Text>
        <View style={{width: 24}}/>
      </View>

      <View style={styles.addProfileContainer}>
        <TextInput
          style={styles.input}
          placeholder="Nom du nouveau profil"
          placeholderTextColor={theme.subText}
          value={newProfileName}
          onChangeText={setNewProfileName}
        />
        <Button title="Ajouter" onPress={addProfile} color={theme.blue} />
      </View>

      <FlatList
        data={profiles}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.profileItem}>
            <View style={styles.profileHeader}>
                <Text style={styles.profileName}>{item.nom}</Text>
                <TouchableOpacity onPress={() => deleteProfile(item.id)}>
                    <Ionicons name="trash-bin" size={20} color={theme.red} />
                </TouchableOpacity>
            </View>
            <TextInput
              style={styles.exclusionsInput}
              placeholder="Aliments à exclure (ex: ail, oignon)"
              placeholderTextColor={theme.subText}
              value={item.exclusions}
              onChangeText={text => updateExclusions(item.id, text)}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    padding: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
  },
  addProfileContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: theme.card,
    color: theme.text,
    padding: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  profileItem: {
    backgroundColor: theme.card,
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  exclusionsInput: {
    backgroundColor: '#000',
    color: theme.text,
    padding: 10,
    borderRadius: 8,
    marginTop: 5,
  },
});
