import { useCallback, useRef, useState } from "react";
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

import type { Standard, SessionLog, TrainingState } from "../engine/types";
import { STANDARD_META } from "../engine/types";
import { ENGINES } from "../engine/registry";
import type { Session } from "../engine/shared";
import { StandardService } from "../services/StandardService";
import { TrainingService } from "../services/TrainingService";
import { SessionService } from "../services/SessionService";
import { CalisthenicsService } from "../services/CalisthenicsService";
import { isStalled, nextWorkoutDate, restDaysBetween } from "../engine/calisthenics";

const LAST_SELECTED_KEY = "plan:lastSelectedId";

type WeekNum = 1 | 2 | 3 | 4;
type SessionStatus = "done" | "today" | "upcoming";

interface CardData {
  session: Session;
  sessionIndex: number;
  status: SessionStatus;
  canSkip: boolean;
  skipped: boolean;
  opensOn?: Date; // calisthenics: date a later workout becomes available
}

function buildCards(
  standard: Standard,
  state: TrainingState,
  logs: SessionLog[],
  viewedWeek: WeekNum
): CardData[] {
  const sessions = ENGINES[standard.type].buildWeek(standard, {
    ...state,
    week: viewedWeek,
  });

  const logFor = (idx: number) =>
    logs.find(
      (l) =>
        l.cycle === state.cycle &&
        l.week === viewedWeek &&
        l.sessionIndex === idx
    );
  const isLogged = (idx: number) => !!logFor(idx);
  // Barbell optional work (BBB / FSL) can be skipped only once the week's required sessions are done.
  // Calisthenics optional blocks can be skipped at any time.
  const anytimeSkip = standard.category === "calisthenics";
  const requiredDone = sessions.every((sess, idx) => sess.optional || isLogged(idx));

  // Calisthenics: workout B (and C) opens only after the previous workout's cards are done/skipped
  // plus the rest days. Returns null when open, or the date it opens (undefined date = previous not done).
  function lockedUntil(session: Session): { date?: Date } | null {
    if (!state.cal || !session.sessionNo) return null;
    const prev = sessions
      .map((sess, i) => ({ sess, log: logFor(i) }))
      .filter(({ sess }) => sess.sessionNo === session.sessionNo! - 1);
    if (prev.some(({ log }) => !log)) return {};
    const opens = nextWorkoutDate(prev.map(({ log }) => log!.completedAt), restDaysBetween(state.cal));
    return new Date() < opens ? { date: opens } : null;
  }

  return sessions.map((session, idx) => {
    let status: SessionStatus;
    let opensOn: Date | undefined;
    if (viewedWeek < state.week) {
      status = "done";
    } else if (viewedWeek > state.week) {
      status = "upcoming";
    } else {
      if (isLogged(idx)) {
        status = "done";
      } else {
        const lock = lockedUntil(session);
        status = lock ? "upcoming" : "today";
        opensOn = lock?.date;
      }
    }
    const canSkip = !!session.optional && status === "today" && (anytimeSkip || requiredDone);
    const skipped = !!logFor(idx)?.skipped;
    return { session, sessionIndex: idx, status, canSkip, skipped, opensOn };
  });
}

export default function PlanScreen({ navigation, route }: any) {
  const [fontsLoaded] = useFonts({
    ArchivoBlack_400Regular,
    WorkSans_400Regular,
    WorkSans_600SemiBold,
    SpaceMono_400Regular,
  });

  const [standards, setStandards] = useState<Standard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trainingState, setTrainingState] = useState<TrainingState | null>(null);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [viewedWeek, setViewedWeek] = useState<WeekNum>(1);

  async function loadForId(id: string) {
    const state = await TrainingService.get(id);
    setTrainingState(state);
    if (state) {
      setViewedWeek(state.week);
      setLogs(await SessionService.getAll(id));
    }
  }

  async function load(preferredId?: string) {
    const active = (await StandardService.getAll()).filter(
      (s) => s.status === "active"
    );
    setStandards(active);
    if (active.length === 0) return;
    // A standard passed in (returning from Execute) wins; otherwise reopen the last one viewed.
    const remembered = await AsyncStorage.getItem(LAST_SELECTED_KEY).catch(() => null);
    const target = [preferredId, remembered].find((id) => id && active.some((s) => s.id === id)) ?? active[0].id;
    await handleSelectStandard(target);
  }

  useFocusEffect(
    useCallback(() => {
      const passed = route.params?.selectedId;
      if (passed) {
        // Remember it, then consume the param (this re-runs the effect, which loads the remembered one)
        // so later tab visits reopen whatever was viewed last, not this stale param.
        AsyncStorage.setItem(LAST_SELECTED_KEY, passed)
          .catch(() => {})
          .then(() => navigation.setParams({ selectedId: undefined }));
        return;
      }
      load();
    }, [route.params?.selectedId])
  );

  const navigateRef = useRef<(d: 1 | -1) => void>(() => {});

  function navigateStandard(direction: 1 | -1) {
    if (standards.length < 2) return;
    const currentIndex = standards.findIndex((s) => s.id === selectedId);
    const nextIndex = (currentIndex + direction + standards.length) % standards.length;
    handleSelectStandard(standards[nextIndex].id);
  }
  navigateRef.current = navigateStandard;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -50) navigateRef.current(1);
        else if (gs.dx > 50) navigateRef.current(-1);
      },
    })
  ).current;

  async function handleSelectStandard(id: string) {
    setSelectedId(id);
    AsyncStorage.setItem(LAST_SELECTED_KEY, id).catch(() => {});
    await loadForId(id);
  }

  // Skip optional work without logging it. Optional sessions are never in the deload week,
  // so finishing the week never rolls the cycle here — TM stays as is.
  async function handleSkip(card: CardData) {
    if (!selectedId || !trainingState) return;
    if (selected!.category === "calisthenics") {
      // Logged as skipped: counts toward finishing the week, no progression, streaks untouched.
      await CalisthenicsService.record(selected!, trainingState, card.sessionIndex, undefined, true);
      await loadForId(selectedId);
      return;
    }
    const sessionCount = ENGINES[selected!.type].buildWeek(selected!, trainingState).length;
    if (card.sessionIndex === sessionCount - 1) {
      await TrainingService.advanceWeek(selectedId, trainingState.trainingMax);
    }
    await loadForId(selectedId);
  }

  if (!fontsLoaded) return null;

  const selected = standards.find((s) => s.id === selectedId) ?? null;
  const cards =
    // Guard: right after switching standards, trainingState/logs still belong to the previous one
    selected && trainingState && trainingState.standardId === selected.id
      ? buildCards(selected, trainingState, logs, viewedWeek)
      : [];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Standard chips */}
      {standards.length > 0 && (
        <View style={s.chips}>
          {standards.map((std) => (
            <TouchableOpacity
              key={std.id}
              style={[s.chip, selectedId === std.id && s.chipActive]}
              onPress={() => handleSelectStandard(std.id)}
            >
              <Text
                style={[
                  s.chipText,
                  selectedId === std.id && s.chipTextActive,
                ]}
              >
                {(std.name ?? STANDARD_META[std.type].short).toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Week dots */}
      {trainingState && (
        <View style={s.weekRow}>
          <Text style={s.cycleLabel}>
            CYCLE {trainingState.cycle}
            {trainingState.cal && isStalled(trainingState.cal) ? " · STALLED" : ""}
          </Text>
          <View style={s.dots}>
            {([1, 2, 3, 4] as WeekNum[]).map((w) => {
              const isDone = w < trainingState.week;
              const isCurrent = w === trainingState.week;
              const isViewed = w === viewedWeek;
              return (
                <TouchableOpacity
                  key={w}
                  style={[
                    s.dot,
                    isDone && s.dotDone,
                    isCurrent && s.dotCurrent,
                    isViewed && !isCurrent && s.dotViewedHighlight,
                  ]}
                  onPress={() => setViewedWeek(w)}
                >
                  <Text
                    style={[
                      s.dotText,
                      (isDone || isCurrent) && s.dotTextLight,
                    ]}
                  >
                    W{w}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={s.list} {...panResponder.panHandlers}>
        {standards.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>NO STANDARDS YET</Text>
            <Text style={s.emptyHint}>Add one from the Home tab</Text>
          </View>
        ) : !trainingState ? (
          <View style={s.empty}>
            <Text style={s.emptyHint}>Loading…</Text>
          </View>
        ) : (
          cards.map((card, i) => (
            <SessionCard
              key={i}
              card={card}
              onSkip={() => handleSkip(card)}
              onGo={() =>
                navigation.navigate("Execute", {
                  standardId: selected!.id,
                  sessionIndex: card.sessionIndex,
                })
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SessionCard({
  card,
  onGo,
  onSkip,
}: {
  card: CardData;
  onGo: () => void;
  onSkip: () => void;
}) {
  const { session, status } = card;
  const isDone = status === "done";
  const isToday = status === "today";

  return (
    <View style={[cs.card, isDone && cs.cardDim]}>
      <View style={[cs.cardHead, isDone && cs.cardHeadDim]}>
        <Text style={[cs.cardTitle, isDone && cs.cardTitleDim]}>
          {session.title.toUpperCase()}
        </Text>
        <View
          style={[
            cs.badge,
            isToday && cs.badgeToday,
            isDone && cs.badgeDone,
          ]}
        >
          <Text
            style={[
              cs.badgeText,
              isToday && cs.badgeTextInv,
              isDone && cs.badgeTextInv,
            ]}
          >
            {isToday ? "TODAY" : card.skipped ? "SKIPPED" : isDone ? "✓ DONE" : "UPCOMING"}
          </Text>
        </View>
      </View>

      <View style={cs.sets}>
        {session.recommended !== undefined && (
          <Text style={[cs.tag, !session.recommended && cs.tagOptional]}>
            {session.recommended ? "RECOMMENDED" : "OPTIONAL"}
          </Text>
        )}
        {card.opensOn && (
          <Text style={[cs.tag, cs.tagOptional]}>
            OPENS {card.opensOn.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}
          </Text>
        )}
        {session.lines.map((line, i) => {
          // Calisthenics endurance sets are logged too, but get no tag or highlight.
          const isAmrap = session.sets?.[i]?.amrap === true && session.kind !== "endurance";
          // Capped rep-logged set (Olympic set 3): tagged on today and upcoming weeks.
          const isLogReps = isAmrap && !!session.sets?.[i]?.maxReps;
          return (
            <Text
              key={i}
              style={[
                cs.setLine,
                (isDone || status === "upcoming") && cs.setLineDim,
                isAmrap && isToday && cs.setLineAmrap,
              ]}
            >
              {line}
              {isLogReps && !isDone ? "  ← LOG REPS" : isAmrap && isToday ? "  ← AMRAP" : ""}
            </Text>
          );
        })}
      </View>

      {isToday && (
        <View style={cs.btnRow}>
          {card.canSkip && (
            <TouchableOpacity style={cs.skipBtn} onPress={onSkip}>
              <Text style={cs.skipBtnText}>SKIP</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={cs.goBtn} onPress={onGo}>
            <Text style={cs.goBtnText}>GO →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  chips: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#000",
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  chipActive: { borderBottomColor: "#0000FF" },
  chipText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#888",
  },
  chipTextActive: { color: "#000" },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#000",
  },
  cycleLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: "#000",
  },

  dots: { flexDirection: "row", gap: 6 },
  dot: {
    width: 34,
    height: 24,
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  dotDone: { backgroundColor: "#000", borderColor: "#000" },
  dotCurrent: { backgroundColor: "#0000FF", borderColor: "#0000FF" },
  dotViewedHighlight: { borderColor: "#0000FF", borderWidth: 3 },
  dotText: {
    fontFamily: "SpaceMono_400Regular",
    fontSize: 9,
    color: "#000",
  },
  dotTextLight: { color: "#fff" },
  list: { padding: 14, gap: 10 },
  empty: { marginTop: 60, alignItems: "center" },
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
});

const cs = StyleSheet.create({
  card: { borderWidth: 2, borderColor: "#000", backgroundColor: "#fff" },
  cardDim: { borderColor: "#bbb" },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
  },
  cardHeadDim: { borderBottomColor: "#bbb" },
  cardTitle: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 12,
    letterSpacing: 0.8,
    color: "#000",
  },
  cardTitleDim: { color: "#999" },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: "#bbb",
  },
  badgeToday: { backgroundColor: "#0000FF", borderColor: "#0000FF" },
  badgeDone: { backgroundColor: "#000", borderColor: "#000" },
  badgeText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 8,
    letterSpacing: 1,
    color: "#bbb",
  },
  badgeTextInv: { color: "#fff" },
  sets: { paddingHorizontal: 10, paddingVertical: 8 },
  setLine: {
    fontFamily: "SpaceMono_400Regular",
    fontSize: 12,
    color: "#333",
    paddingVertical: 2,
  },
  setLineDim: { color: "#bbb" },
  setLineAmrap: { color: "#0000FF" },
  tag: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: "#000",
    marginBottom: 4,
  },
  tagOptional: { color: "#888" },
  btnRow: {
    flexDirection: "row",
    marginHorizontal: 10,
    marginBottom: 10,
    gap: 10,
  },
  goBtn: {
    flex: 2,
    padding: 10,
    backgroundColor: "#000",
    alignItems: "center",
  },
  skipBtn: {
    flex: 1,
    padding: 10,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
  },
  skipBtnText: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 13,
    letterSpacing: 1.5,
    color: "#000",
  },
  goBtnText: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 13,
    letterSpacing: 1.5,
    color: "#fff",
  },
});
