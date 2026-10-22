import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useState } from "react";
import type { StandardCategory, StandardType } from "../engine/types";
import { CATEGORY_LABEL, STANDARD_META } from "../engine/types";
import { StandardService } from "../services/StandardService";
import { TrainingService } from "../services/TrainingService";
import { initTrainingMax } from "../engine/progression";

const TYPES: StandardType[] = ["bench", "ohp", "squat", "deadlift", "olympic"];
const CATEGORIES: StandardCategory[] = ["lifts", "olympic"];

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddStandardSheet({ visible, onClose, onAdded }: Props) {
  const [type, setType] = useState<StandardType>("bench");
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const nameRequired = type === "olympic";

  function reset() {
    setType("bench");
    setName("");
    setStart("");
    setTarget("");
    setError("");
  }

  async function handleAdd() {
    const b = parseInt(start, 10);
    const t = parseInt(target, 10);
    if (nameRequired && !name.trim()) {
      setError("Name your Olympic lift (e.g. Clean & Press).");
      return;
    }
    if (!b || !t || b <= 0 || t <= b) {
      setError("Target must be greater than start.");
      return;
    }
    const trimmedName = name.trim() || undefined;
    const standard = await StandardService.create(type, b, t, trimmedName);
    const tm = initTrainingMax(standard);
    await TrainingService.init(standard.id, tm);
    reset();
    onAdded();
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
      <KeyboardAvoidingView behavior="padding" style={styles.sheetWrapper}>
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>ADD STANDARD</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Type chips, grouped by category */}
          {CATEGORIES.map((c) => (
            <View key={c}>
              <Text style={styles.label}>{CATEGORY_LABEL[c].toUpperCase()}</Text>
              <View style={styles.chips}>
                {TYPES.filter((t) => STANDARD_META[t].category === c).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, type === t && styles.chipActive]}
                    onPress={() => setType(t)}
                  >
                    <Text style={[styles.chipText, type === t && styles.chipTextActive]}>
                      {STANDARD_META[t].short.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Name — required for Olympic Lift (generic type) */}
          <Text style={styles.label}>{nameRequired ? "NAME" : "NAME (OPTIONAL)"}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={nameRequired ? "e.g. Clean & Press" : `e.g. ${STANDARD_META[type].label} 2`}
            placeholderTextColor="#999"
          />

          {/* Inputs */}
          <Text style={styles.label}>START (LB)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={start}
            onChangeText={setStart}
            placeholder="e.g. 200"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>TARGET (LB)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={target}
            onChangeText={setTarget}
            placeholder="e.g. 300"
            placeholderTextColor="#999"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
            <Text style={styles.addBtnText}>ADD</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "100%",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopWidth: 3,
    borderTopColor: "#000",
  },
  sheetContent: {
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 18,
    color: "#000",
    letterSpacing: 1,
  },
  closeBtn: {
    fontSize: 18,
    color: "#000",
  },
  label: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: "#000",
    marginBottom: 6,
    marginTop: 12,
  },
  chips: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#000",
    paddingVertical: 8,
    alignItems: "center",
  },
  chipActive: {
    backgroundColor: "#000",
  },
  chipText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    color: "#000",
    letterSpacing: 1,
  },
  chipTextActive: {
    color: "#fff",
  },
  input: {
    borderWidth: 2,
    borderColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "SpaceMono_400Regular",
    fontSize: 16,
    color: "#000",
  },
  error: {
    marginTop: 8,
    color: "red",
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
  },
  addBtn: {
    marginTop: 20,
    backgroundColor: "#000",
    paddingVertical: 14,
    alignItems: "center",
  },
  addBtnText: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 16,
    color: "#fff",
    letterSpacing: 2,
  },
});
