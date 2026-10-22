import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  useFonts,
  ArchivoBlack_400Regular,
} from "@expo-google-fonts/archivo-black";
import {
  WorkSans_400Regular,
  WorkSans_600SemiBold,
} from "@expo-google-fonts/work-sans";
import { SpaceMono_400Regular } from "@expo-google-fonts/space-mono";

import type { Standard, TrainingState } from "../engine/types";
import { STANDARD_META } from "../engine/types";
import { ENGINES } from "../engine/registry";
import { cycleEndTM } from "../engine/progression";
import { CalisthenicsService } from "../services/CalisthenicsService";
import type { Session } from "../engine/shared";
import { StandardService } from "../services/StandardService";
import { TrainingService } from "../services/TrainingService";
import { SessionService } from "../services/SessionService";

export default function ExecuteScreen({ navigation, route }: any) {
  const [fontsLoaded] = useFonts({
    ArchivoBlack_400Regular,
    WorkSans_400Regular,
    WorkSans_600SemiBold,
    SpaceMono_400Regular,
  });

  const standardId: string | undefined = route.params?.standardId;
  const sessionIndex: number = route.params?.sessionIndex ?? 0;

  const [standard, setStandard] = useState<Standard | null>(null);
  const [trainingState, setTrainingState] = useState<TrainingState | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [checked, setChecked] = useState<boolean[]>([]);
  // Logged reps per set (only used for rep-logged sets); null = not entered yet
  const [setReps, setSetReps] = useState<(number | null)[]>([]);
  // Calisthenics strength block: vest load, editable each session
  const [load, setLoad] = useState<number | null>(null);

  async function loadSession() {
    if (!standardId) return;
    const std = await StandardService.getById(standardId);
    if (!std) return;
    const state = await TrainingService.get(standardId);
    if (!state) return;
    const sessions = ENGINES[std.type].buildWeek(std, state);
    const idx = Math.min(sessionIndex, sessions.length - 1);
    const sess = sessions[idx];
    setStandard(std);
    setTrainingState(state);
    setSession(sess);
    setTotalSessions(sessions.length);
    setChecked(Array(sess.sets?.length ?? 0).fill(false));
    // Endurance sets start at the target reps (lower it on a failed set); others must be entered.
    setSetReps((sess.sets ?? []).map((set) => (sess.kind === "endurance" ? set.reps : null)));
    setLoad(sess.kind === "strength" ? sess.sets?.[0]?.weight ?? 0 : null);
  }

  // Reload when params change (new GO → from Plan)
  useEffect(() => {
    loadSession();
  }, [standardId, sessionIndex]);

  // Reload on refocus so state is fresh after completing a session
  useFocusEffect(
    useCallback(() => {
      loadSession();
    }, [standardId, sessionIndex])
  );

  if (!fontsLoaded) return null;

  // No session selected: user tapped Execute tab directly
  if (!standardId || !session || !standard || !trainingState) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.empty}>
          <Text style={s.emptyTitle}>NO ACTIVE SESSION</Text>
          <Text style={s.emptyHint}>Tap GO → on the Plan screen to start</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isCal = standard.category === "calisthenics";
  const isStrengthBlock = session.kind === "strength";
  const amrapSetIndex = session.sets?.findIndex((set) => set.amrap) ?? -1;
  const hasAmrap = amrapSetIndex !== -1;
  const amrapReps = hasAmrap ? setReps[amrapSetIndex] : null;
  const allChecked = checked.length > 0 && checked.every(Boolean);
  const amrapReady = (session.sets ?? []).every((set, i) => !set.amrap || setReps[i] !== null);
  const canComplete = allChecked && amrapReady;
  const isLastSession = sessionIndex >= totalSessions - 1;

  function toggleSet(i: number) {
    const isAmrap = session!.sets?.[i]?.amrap === true;
    if (isAmrap && setReps[i] === null) return; // must enter reps first
    const next = [...checked];
    next[i] = !next[i];
    setChecked(next);
  }

  function changeReps(i: number, delta: number) {
    const cap = session!.sets?.[i]?.maxReps ?? Infinity;
    const next = [...setReps];
    next[i] = Math.min(cap, Math.max(0, (next[i] ?? 0) + delta));
    setSetReps(next);
  }

  async function computeNextTM(): Promise<number> {
    if (hasAmrap && amrapReps !== null) {
      return ENGINES[standard!.type].nextTM(standard!, trainingState!.trainingMax, amrapReps);
    }
    // Week 4 deload completing (cycle rollover): apply week 3 top-set progression
    if (trainingState!.week === 4) {
      const logs = await SessionService.getAll(standard!.id);
      return cycleEndTM(standard!, trainingState!, logs);
    }
    return trainingState!.trainingMax;
  }

  async function handleComplete() {
    if (!canComplete) return;

    const sets = session!.sets?.map((set, i) => ({
      weight: isStrengthBlock && load !== null ? load : set.weight,
      reps: set.amrap ? (setReps[i] ?? set.reps) : set.reps,
    }));

    if (isCal) {
      await CalisthenicsService.record(standard!, trainingState!, sessionIndex, sets);
      navigation.navigate("Plan", { selectedId: standard!.id });
      return;
    }

    await SessionService.log(
      standard!.id,
      trainingState!.cycle,
      trainingState!.week,
      sessionIndex,
      sets
    );

    if (isLastSession) {
      const nextTM = await computeNextTM();
      await TrainingService.advanceWeek(standard!.id, nextTM);
    }

    navigation.navigate("Plan", { selectedId: standard!.id });
  }

  const meta = STANDARD_META[standard.type];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Plan")}>
          <Text style={s.backText}>← PLAN</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{(standard.name ?? meta.label).toUpperCase()}</Text>
      </View>

      {/* Session subtitle */}
      <View style={s.subtitleRow}>
        <Text style={s.subtitle}>
          {session.title.toUpperCase()} · W{trainingState.week} · C{trainingState.cycle}
        </Text>
        {isCal && <Text style={s.subtitleNote}>{session.lines[0]}</Text>}
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {isStrengthBlock && load !== null && (
          <View style={s.loadRow}>
            <Text style={s.amrapLabel}>VEST LOAD:</Text>
            <View style={s.amrapCounter}>
              <TouchableOpacity style={s.amrapBtn} onPress={() => setLoad(Math.max(0, load - 5))}>
                <Text style={s.amrapBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={s.amrapNum}>{load} lb</Text>
              <TouchableOpacity style={s.amrapBtn} onPress={() => setLoad(load + 5)}>
                <Text style={s.amrapBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {session.sets?.map((set, i) => {
          const isAmrap = set.amrap === true;
          const isChecked = checked[i] ?? false;

          return (
            <View key={i} style={s.setCard}>
              <TouchableOpacity
                style={s.setRow}
                onPress={() => toggleSet(i)}
                activeOpacity={0.7}
              >
                <View style={[s.checkbox, isChecked && s.checkboxChecked]}>
                  {isChecked && <Text style={s.checkmark}>✓</Text>}
                </View>
                <View style={s.setInfo}>
                  <Text style={[s.setWeight, isAmrap && s.setWeightAmrap]}>
                    {isCal ? (isStrengthBlock ? `${load} lb vest` : "Bodyweight") : `${set.weight} lb`}
                  </Text>
                  <Text style={[s.setLabel, isAmrap && s.setLabelAmrap]}>
                    SET {i + 1} · {isAmrap && !set.maxReps ? "AMRAP" : `${set.reps} REPS`}
                  </Text>
                </View>
              </TouchableOpacity>

              {isAmrap && (
                <View style={s.amrapRow}>
                  <Text style={s.amrapLabel}>REPS DONE:</Text>
                  <View style={s.amrapCounter}>
                    <TouchableOpacity
                      style={s.amrapBtn}
                      onPress={() => changeReps(i, -1)}
                    >
                      <Text style={s.amrapBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={s.amrapNum}>
                      {setReps[i] !== null && setReps[i] !== undefined ? setReps[i] : "—"}
                    </Text>
                    <TouchableOpacity
                      style={s.amrapBtn}
                      onPress={() => changeReps(i, 1)}
                    >
                      <Text style={s.amrapBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[s.completeBtn, !canComplete && s.completeBtnDisabled]}
        onPress={handleComplete}
        disabled={!canComplete}
      >
        <Text
          style={[
            s.completeBtnText,
            !canComplete && s.completeBtnTextDisabled,
          ]}
        >
          MARK COMPLETE
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 14,
    letterSpacing: 2,
    color: "#000",
  },
  emptyHint: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#666",
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    gap: 16,
  },
  backText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 1,
    color: "#555",
    textTransform: "uppercase",
  },
  headerTitle: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 16,
    letterSpacing: 1.5,
    color: "#000",
  },
  subtitleRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#000",
  },
  subtitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.2,
    color: "#333",
    textTransform: "uppercase",
  },
  subtitleNote: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#555",
    marginTop: 4,
  },
  loadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 2,
    borderColor: "#000",
    padding: 14,
  },
  list: { padding: 14, gap: 10 },
  setCard: {
    borderWidth: 2,
    borderColor: "#000",
    backgroundColor: "#fff",
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: "#000" },
  checkmark: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "WorkSans_600SemiBold",
    lineHeight: 15,
  },
  setInfo: { flex: 1 },
  setWeight: {
    fontFamily: "SpaceMono_400Regular",
    fontSize: 20,
    color: "#000",
    lineHeight: 24,
  },
  setWeightAmrap: { color: "#0000FF" },
  setLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.2,
    color: "#888",
    textTransform: "uppercase",
    marginTop: 2,
  },
  setLabelAmrap: { color: "#0000FF" },
  amrapRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  amrapLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.2,
    color: "#0000FF",
    textTransform: "uppercase",
  },
  amrapCounter: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#0000FF",
  },
  amrapBtn: {
    width: 32,
    height: 32,
    backgroundColor: "#0000FF",
    alignItems: "center",
    justifyContent: "center",
  },
  amrapBtnText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "ArchivoBlack_400Regular",
    lineHeight: 20,
  },
  amrapNum: {
    width: 40,
    textAlign: "center",
    fontFamily: "SpaceMono_400Regular",
    fontSize: 16,
    color: "#0000FF",
    lineHeight: 32,
  },
  completeBtn: {
    margin: 14,
    padding: 16,
    backgroundColor: "#000",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#000",
  },
  completeBtnDisabled: {
    backgroundColor: "#e0e0e0",
    borderColor: "#e0e0e0",
  },
  completeBtnText: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 14,
    letterSpacing: 2,
    color: "#fff",
  },
  completeBtnTextDisabled: { color: "#aaa" },
});
