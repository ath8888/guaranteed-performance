import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { RunService } from "../services/RunService";
import { LiftService } from "../services/LiftService";
import { fmtDistance, fmtLength, fmtPace, fmtTime, fmtTimeDigits, parseTime, speedRepText } from "../engine/run";
import type { Session } from "../engine/shared";
import { StandardService } from "../services/StandardService";
import { TrainingService } from "../services/TrainingService";
import { SessionService } from "../services/SessionService";
import NumberField from "../components/NumberField";
import { clampMin, clampReps, type EntryKind } from "../components/numberEntry";

// F31: what a typeable counter needs (display comes from the counter)
type Entry = {
  value: number | null;
  kind?: EntryKind;
  clamp?: (n: number) => number;
  allowEmpty?: boolean;
  onChange: (n: number | null) => void;
};

// F32: what one run rep logs (split, interval length, pace, rest, minutes) — null = not entered
type RunKey = "time" | "length" | "pace" | "rest" | "minutes";
type RunVals = Partial<Record<RunKey, number | null>>;
const REST_START = 120;      // rests start at 2:00 (the most that still meets a rung)
const Z2_PACE_START = 600;   // Zone 2 pace −/+ starts from 10:00/mi (no target pace is shown)

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
  // Run: per-rep values (F32), typed trial time
  const [runVals, setRunVals] = useState<RunVals[]>([]);
  const [trialText, setTrialText] = useState("");
  // F30: per-set weight, completed date (days before today), notes
  const [setWeights, setSetWeights] = useState<(number | null)[]>([]);
  const [dayOffset, setDayOffset] = useState(0);
  const [notes, setNotes] = useState("");

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
    // Every set starts at the planned reps; + sets / AMRAPs must be entered (back-off sets start at the target).
    setSetReps((sess.sets ?? []).map((set) => (set.amrap && sess.kind !== "backoff" ? null : set.reps)));
    setSetWeights((sess.sets ?? []).map((set) => set.weight ?? null));
    setDayOffset(0);
    setNotes("");
    setLoad(sess.kind === "strength" ? sess.sets?.[0]?.weight ?? 0 : null);
    // Run reps start at the target (one thumb between reps); the time trial must be typed.
    // Zone 2 pace starts empty (optional, no target shown).
    setRunVals((sess.sets ?? []).map((set): RunVals => {
      if (set.part === "speed") return { time: set.time ?? null, rest: REST_START };
      if (set.part === "interval") return { length: set.length ?? null, pace: set.pace ?? null, rest: REST_START };
      if (set.part === "threshold") return { minutes: set.minutes ?? null };
      if (set.part === "zone2") return { minutes: set.minutes ?? null, pace: null };
      return {};
    }));
    setTrialText("");
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
  const isRun = standard.category === "run";
  const isStrengthBlock = session.kind === "strength";
  const trialTime = session.kind === "trial" ? parseTime(trialText) : null;
  const amrapSetIndex = session.sets?.findIndex((set) => set.amrap) ?? -1;
  const hasAmrap = amrapSetIndex !== -1;
  const amrapReps = hasAmrap ? setReps[amrapSetIndex] : null;
  const allChecked = checked.length > 0 && checked.every(Boolean);
  const amrapReady = (session.sets ?? []).every((set, i) => !set.amrap || setReps[i] !== null);
  // Run: unfinished reps can stay unchecked (logged as not done — a ladder miss)
  const runReady = checked.some(Boolean) && (session.kind !== "trial" || trialTime !== null);
  const canComplete = isRun ? runReady : allChecked && amrapReady;
  const isLastSession = sessionIndex >= totalSessions - 1;

  function toggleSet(i: number) {
    const isAmrap = session!.sets?.[i]?.amrap === true;
    if (isAmrap && setReps[i] === null) return; // must enter reps first
    if (session!.sets?.[i]?.part === "trial" && trialTime === null) return; // must enter the time first
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

  // Completed date: today (now), or the chosen earlier day at the same time of day
  function completedDate(): Date {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d;
  }

  async function handleComplete() {
    if (!canComplete) return;
    const extras = { completedAt: completedDate().toISOString(), notes };

    if (isRun) {
      const sets = session!.sets!.map((set, i) => {
        if (!checked[i]) return {};
        const v = runVals[i] ?? {};
        const n = (k: RunKey) => v[k] ?? undefined;
        if (set.part === "speed") return { part: "speed" as const, distance: set.distance, time: n("time"), rest: n("rest") };
        if (set.part === "interval") return { part: "interval" as const, length: n("length"), pace: n("pace"), rest: n("rest") };
        if (set.part === "threshold") return { part: "threshold" as const, minutes: n("minutes") ?? set.minutes };
        if (set.part === "zone2") return { part: "zone2" as const, minutes: n("minutes") ?? set.minutes, ...(v.pace != null ? { pace: v.pace } : {}) };
        return { part: "trial" as const, distance: set.distance, time: trialTime! };
      });
      await RunService.record(standard!, trainingState!, sessionIndex, sets, false, extras);
      navigation.navigate("Plan", { selectedId: standard!.id });
      return;
    }

    const sets = session!.sets?.map((set, i) => ({
      weight: isStrengthBlock && load !== null ? load : setWeights[i] ?? set.weight,
      reps: setReps[i] ?? set.reps,
    }));

    if (standard!.category === "lifts" || standard!.category === "olympic") {
      await LiftService.record(standard!, trainingState!, sessionIndex, sets, false, extras);
      navigation.navigate("Plan", { selectedId: standard!.id });
      return;
    }

    if (isCal) {
      await CalisthenicsService.record(standard!, trainingState!, sessionIndex, sets, false, extras);
      navigation.navigate("Plan", { selectedId: standard!.id });
      return;
    }

    await SessionService.log(
      standard!.id,
      trainingState!.cycle,
      trainingState!.week,
      sessionIndex,
      sets,
      false,
      extras
    );

    if (isLastSession) {
      const nextTM = await computeNextTM();
      await TrainingService.advanceWeek(standard!.id, nextTM);
    }

    navigation.navigate("Plan", { selectedId: standard!.id });
  }

  const meta = STANDARD_META[standard.type];

  function changeWeight(i: number, delta: number) {
    const next = [...setWeights];
    next[i] = Math.max(0, (next[i] ?? 0) + delta);
    setSetWeights(next);
  }

  // F31: typed entry — every keystroke that makes a valid number is saved (same limits as −/+)
  function setRepsAt(i: number, n: number | null) {
    const next = [...setReps];
    next[i] = n;
    setSetReps(next);
  }
  function setWeightAt(i: number, n: number | null) {
    if (n == null) return;
    const next = [...setWeights];
    next[i] = n;
    setSetWeights(next);
  }
  function setRunValAt(i: number, k: RunKey, n: number | null, allowEmpty = false) {
    if (n == null && !allowEmpty) return;
    const next = [...runVals];
    next[i] = { ...next[i], [k]: n };
    setRunVals(next);
  }

  // F30: black −/+ counter for plain edits (blue stays on + set / AMRAP reps). F31: `entry` makes the number typeable.
  function editCounter(label: string, display: string, onDelta: (d: number) => void, canUp = true, entry?: Entry) {
    return (
      <View style={s.amrapRow}>
        <Text style={s.editLabel}>{label}</Text>
        <View style={s.editCounter}>
          <TouchableOpacity style={s.editBtn} onPress={() => onDelta(-1)}>
            <Text style={s.amrapBtnText}>−</Text>
          </TouchableOpacity>
          {entry ? <NumberField {...entry} display={display} style={s.editNum} /> : <Text style={s.editNum}>{display}</Text>}
          <TouchableOpacity style={[s.editBtn, !canUp && s.editBtnOff]} onPress={() => canUp && onDelta(1)} disabled={!canUp}>
            <Text style={s.amrapBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function changeRunVal(i: number, k: RunKey, delta: number, from = 0) {
    const next = [...runVals];
    next[i] = { ...next[i], [k]: Math.max(1, (next[i]?.[k] ?? from) + delta) };
    setRunVals(next);
  }

  // One run value: −/+ and typeable (F31 NumberField). Times show as M:SS, minutes as a number.
  function runField(i: number, k: RunKey, label: string, opts: { time?: boolean; optional?: boolean; from?: number } = {}) {
    const v = runVals[i]?.[k] ?? null;
    const display = v == null ? "—" : opts.time ? fmtTime(v) : String(v);
    return counter(label, display, (d) => changeRunVal(i, k, d, opts.from), {
      value: v,
      ...(opts.time ? { kind: "time" as const } : {}),
      clamp: clampMin(1),
      allowEmpty: !!opts.optional,
      onChange: (n) => setRunValAt(i, k, n, !!opts.optional),
    });
  }

  function counter(label: string, display: string, onDelta: (d: number) => void, entry: Entry) {
    return (
      <View style={s.amrapRow}>
        <Text style={s.amrapLabel}>{label}</Text>
        <View style={s.amrapCounter}>
          <TouchableOpacity style={s.amrapBtn} onPress={() => onDelta(-1)}>
            <Text style={s.amrapBtnText}>−</Text>
          </TouchableOpacity>
          <NumberField {...entry} display={display} style={[s.amrapNum, s.runNum]} />
          <TouchableOpacity style={s.amrapBtn} onPress={() => onDelta(1)}>
            <Text style={s.amrapBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Run rep: checkbox + prescription, then a −/+ counter prefilled with the target (typed time for the trial)
  function renderRunSet(set: NonNullable<Session["sets"]>[number], i: number) {
    const sets = session!.sets!;
    const repNo = sets.slice(0, i).filter((x) => x.part === set.part).length + 1;
    let main = "";
    let label = "";
    if (set.part === "speed") { main = speedRepText(set.distance!, set.time!); label = `REP ${repNo} · SPEED`; }
    else if (set.part === "interval") { main = `${fmtLength(set.length!)} @ ${fmtPace(set.pace!)}`; label = `INTERVAL ${repNo} · RACE PACE`; }
    else if (set.part === "threshold") { main = `${set.minutes} min threshold`; label = "ANY CARDIO · OPTIONAL"; }
    else if (set.part === "zone2") { main = `${set.minutes} min`; label = "ZONE 2 · CONVERSATIONAL"; }
    else { main = `${fmtDistance(set.distance!)} all-out`; label = `TIME TRIAL · OPTIONAL · CURRENT ${fmtTime(trainingState!.run?.current ?? standard!.start)}`; }
    const isChecked = checked[i] ?? false;

    return (
      <View key={i} style={s.setCard}>
        <TouchableOpacity style={s.setRow} onPress={() => toggleSet(i)} activeOpacity={0.7}>
          <View style={[s.checkbox, isChecked && s.checkboxChecked]}>
            {isChecked && <Text style={s.checkmark}>✓</Text>}
          </View>
          <View style={s.setInfo}>
            <Text style={s.setWeight}>{main}</Text>
            <Text style={s.setLabel}>{label}</Text>
          </View>
        </TouchableOpacity>
        {set.part === "speed" && runField(i, "time", "SPLIT:", { time: true })}
        {set.part === "interval" && runField(i, "length", "LENGTH:", { time: true })}
        {set.part === "interval" && runField(i, "pace", "PACE /MI:", { time: true })}
        {(set.part === "speed" || set.part === "interval") && runField(i, "rest", "REST:", { time: true })}
        {set.part === "threshold" && runField(i, "minutes", "MINUTES:")}
        {set.part === "zone2" && runField(i, "minutes", "MINUTES:")}
        {set.part === "zone2" && runField(i, "pace", "PACE /MI (OPTIONAL):", { time: true, optional: true, from: Z2_PACE_START })}
        {set.part === "trial" && (
          <View style={s.amrapRow}>
            <Text style={s.amrapLabel}>TIME:</Text>
            <TextInput
              style={s.trialInput}
              keyboardType="number-pad"
              value={trialText}
              onChangeText={(t) => setTrialText(fmtTimeDigits(t))}
              placeholder="MM:SS"
              placeholderTextColor="#999"
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Plan")}>
          <Text style={s.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{(standard.name ?? meta.label).toUpperCase()}</Text>
      </View>

      {/* Session subtitle */}
      <View style={s.subtitleRow}>
        <Text style={s.subtitle}>
          {session.title.toUpperCase()} · W{trainingState.week} · C{trainingState.cycle}
        </Text>
        {isCal && <Text style={s.subtitleNote}>{session.lines[0]}</Text>}
        {isRun && <Text style={s.subtitleNote}>{session.lines[session.lines.length - 1]}</Text>}
      </View>

      <KeyboardAvoidingView behavior="padding" style={s.flex}>
      <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
        {/* F30: completed date — today or earlier */}
        <View style={s.dateRow}>
          {editCounter(
            "DATE:",
            completedDate().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }).toUpperCase(),
            (d) => setDayOffset(Math.min(0, dayOffset + d)),
            dayOffset < 0
          )}
        </View>
        {isStrengthBlock && load !== null && (
          <View style={s.loadRow}>
            <Text style={s.amrapLabel}>VEST LOAD:</Text>
            <View style={s.amrapCounter}>
              <TouchableOpacity style={s.amrapBtn} onPress={() => setLoad(Math.max(0, load - 5))}>
                <Text style={s.amrapBtnText}>−</Text>
              </TouchableOpacity>
              <NumberField value={load} display={`${load} lb`} clamp={clampMin(0)} onChange={(n) => n != null && setLoad(n)} style={s.amrapNum} />
              <TouchableOpacity style={s.amrapBtn} onPress={() => setLoad(load + 5)}>
                <Text style={s.amrapBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {session.sets?.map((set, i) => {
          if (isRun) return renderRunSet(set, i);
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
                    {isCal ? (isStrengthBlock ? `${load} lb vest` : "Bodyweight") : `${setWeights[i] ?? set.weight} lb`}
                  </Text>
                  <Text style={[s.setLabel, isAmrap && s.setLabelAmrap]}>
                    SET {i + 1} · {isAmrap && !set.maxReps ? "AMRAP" : `${set.reps} REPS`}
                  </Text>
                </View>
              </TouchableOpacity>

              {!isCal && set.weight != null &&
                editCounter("WEIGHT LB:", String(setWeights[i] ?? set.weight), (d) => changeWeight(i, d * 5), true,
                  { value: setWeights[i] ?? set.weight, clamp: clampMin(0), onChange: (n) => setWeightAt(i, n) })}
              {!isAmrap &&
                editCounter("REPS:", String(setReps[i] ?? set.reps), (d) => changeReps(i, d), true,
                  { value: setReps[i] ?? set.reps, clamp: clampReps(set.maxReps), onChange: (n) => n != null && setRepsAt(i, n) })}
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
                    <NumberField
                      value={setReps[i] ?? null}
                      display={setReps[i] !== null && setReps[i] !== undefined ? String(setReps[i]) : "—"}
                      clamp={clampReps(set.maxReps)}
                      allowEmpty
                      onChange={(n) => setRepsAt(i, n)}
                      style={s.amrapNum}
                    />
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

        {/* F30: notes — shown on the done card and in History */}
        <View style={s.notesBox}>
          <Text style={s.editLabel}>NOTES</Text>
          <TextInput
            style={s.notesInput}
            multiline
            value={notes}
            onChangeText={setNotes}
            placeholder="How did it go?"
            placeholderTextColor="#999"
          />
        </View>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  dateRow: { borderWidth: 2, borderColor: "#000", paddingTop: 14 },
  editLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.2,
    color: "#000",
    textTransform: "uppercase",
  },
  editCounter: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderColor: "#000" },
  editBtn: { width: 32, height: 32, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  editBtnOff: { backgroundColor: "#ccc" },
  editNum: {
    minWidth: 56,
    paddingHorizontal: 6,
    textAlign: "center",
    fontFamily: "SpaceMono_400Regular",
    fontSize: 14,
    color: "#000",
    lineHeight: 32,
  },
  notesBox: { borderWidth: 2, borderColor: "#000", padding: 14, gap: 8 },
  notesInput: {
    borderWidth: 2,
    borderColor: "#000",
    minHeight: 80,
    padding: 10,
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#000",
    textAlignVertical: "top",
  },
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
  runNum: { width: 64 },
  trialInput: {
    borderWidth: 2,
    borderColor: "#0000FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 96,
    fontFamily: "SpaceMono_400Regular",
    fontSize: 16,
    color: "#0000FF",
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
