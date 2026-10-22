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

type WeekNum = 1 | 2 | 3 | 4;
type SessionStatus = "done" | "today" | "upcoming";

interface CardData {
  session: Session;
  sessionIndex: number;
  status: SessionStatus;
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

  return sessions.map((session, idx) => {
    let status: SessionStatus;
    if (viewedWeek < state.week) {
      status = "done";
    } else if (viewedWeek > state.week) {
      status = "upcoming";
    } else {
      const isLogged = logs.some(
        (l) =>
          l.cycle === state.cycle &&
          l.week === viewedWeek &&
          l.sessionIndex === idx
      );
      if (isLogged) {
        status = "done";
      } else {
        status = "today";
      }
    }
    return { session, sessionIndex: idx, status };
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
    const target =
      preferredId && active.find((s) => s.id === preferredId)
        ? preferredId
        : active[0].id;
    setSelectedId(target);
    await loadForId(target);
  }

  useFocusEffect(
    useCallback(() => {
      load(route.params?.selectedId);
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
    await loadForId(id);
  }

  if (!fontsLoaded) return null;

  const selected = standards.find((s) => s.id === selectedId) ?? null;
  const cards =
    selected && trainingState
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
          <Text style={s.cycleLabel}>CYCLE {trainingState.cycle}</Text>
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
}: {
  card: CardData;
  onGo: () => void;
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
            {isToday ? "TODAY" : isDone ? "✓ DONE" : "UPCOMING"}
          </Text>
        </View>
      </View>

      <View style={cs.sets}>
        {session.lines.map((line, i) => {
          const isAmrap = session.sets?.[i]?.amrap === true;
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
              {isAmrap && isToday ? "  ← AMRAP" : ""}
            </Text>
          );
        })}
      </View>

      {isToday && (
        <TouchableOpacity style={cs.goBtn} onPress={onGo}>
          <Text style={cs.goBtnText}>GO →</Text>
        </TouchableOpacity>
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
  goBtn: {
    marginHorizontal: 10,
    marginBottom: 10,
    padding: 10,
    backgroundColor: "#000",
    alignItems: "center",
  },
  goBtnText: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 13,
    letterSpacing: 1.5,
    color: "#fff",
  },
});
