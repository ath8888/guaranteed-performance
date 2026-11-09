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

import { HistoryService, dayKey, type HistoryEntry } from "../services/HistoryService";
import { loggedLine } from "./PlanScreen";

type View_ = "list" | "calendar";
const VIEWS: View_[] = ["list", "calendar"];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// Day-of-month cells for a month grid starting on Sunday; null = blank padding.
export function monthGrid(year: number, month: number): (number | null)[] {
  const lead = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Entries grouped by day, keeping newest-first order.
export function groupByDay(entries: HistoryEntry[]): { day: string; entries: HistoryEntry[] }[] {
  const groups: { day: string; entries: HistoryEntry[] }[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.day === e.day) last.entries.push(e);
    else groups.push({ day: e.day, entries: [e] });
  }
  return groups;
}

function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

export default function HistoryScreen() {
  const [fontsLoaded] = useFonts({
    ArchivoBlack_400Regular,
    WorkSans_400Regular,
    WorkSans_600SemiBold,
    SpaceMono_400Regular,
  });

  const today = new Date();
  const todayKey = dayKey(today);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [view, setView] = useState<View_>("list");
  const [month, setMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState(todayKey);

  useFocusEffect(
    useCallback(() => {
      HistoryService.getAll().then(setEntries);
    }, [])
  );

  // Swipe left → next view, right → previous, wrapping around (same as EXECUTE's standards).
  // Claimed in the capture phase so the vertical ScrollView (and day cells) below can't take
  // horizontal swipes first.
  const panResponder = useRef(
    (() => {
      const isHorizontal = (gs: { dx: number; dy: number }) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy);
      const step = (direction: 1 | -1) =>
        setView((v) => VIEWS[(VIEWS.indexOf(v) + direction + VIEWS.length) % VIEWS.length]);
      const finish = (gs: { dx: number }) => {
        if (gs.dx < -50) step(1);
        else if (gs.dx > 50) step(-1);
      };
      return PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gs) => isHorizontal(gs),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, gs) => finish(gs),
        onPanResponderTerminate: (_, gs) => finish(gs),
      });
    })()
  ).current;

  if (!fontsLoaded) return null;

  function shiftMonth(delta: 1 | -1) {
    const d = new Date(month.year, month.month + delta, 1);
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
  }

  const workoutDays = new Set(entries.map((e) => e.day));
  const selectedEntries = entries.filter((e) => e.day === selectedDay);
  const monthTitle = new Date(month.year, month.month, 1)
    .toLocaleDateString(undefined, { month: "long", year: "numeric" })
    .toUpperCase();

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* LIST | CALENDAR toggle */}
      <View style={s.toggle}>
        {VIEWS.map((v) => (
          <TouchableOpacity
            key={v}
            style={[s.toggleBtn, v === "calendar" && s.toggleBtnRight, view === v && s.toggleBtnActive]}
            onPress={() => setView(v)}
          >
            <Text style={[s.toggleText, view === v && s.toggleTextActive]}>{v.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.swipeArea} {...panResponder.panHandlers}>
      {view === "list" ? (
        <ScrollView contentContainerStyle={s.list}>
          {entries.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>NO WORKOUTS YET</Text>
              <Text style={s.emptyHint}>Completed sessions show up here</Text>
            </View>
          ) : (
            groupByDay(entries).map((g) => (
              <View key={g.day} style={s.group}>
                <Text style={s.dayHeader}>{dayLabel(g.day)}</Text>
                {g.entries.map((e) => (
                  <EntryCard key={e.log.id} entry={e} />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          <View style={s.monthRow}>
            <TouchableOpacity style={s.monthBtn} onPress={() => shiftMonth(-1)}>
              <Text style={s.monthBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={s.monthTitle}>{monthTitle}</Text>
            <TouchableOpacity style={s.monthBtn} onPress={() => shiftMonth(1)}>
              <Text style={s.monthBtnText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={s.grid}>
            {WEEKDAYS.map((w, i) => (
              <View key={`h${i}`} style={s.cell}>
                <Text style={s.weekday}>{w}</Text>
              </View>
            ))}
            {monthGrid(month.year, month.month).map((d, i) => {
              if (d === null) return <View key={i} style={s.cell} />;
              const key = dayKey(new Date(month.year, month.month, d));
              const hasWorkout = workoutDays.has(key);
              const isToday = key === todayKey;
              const isSelected = key === selectedDay;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.cell,
                    s.day,
                    hasWorkout && s.dayWorkout,
                    isSelected && s.daySelected,
                    isSelected && hasWorkout && s.dayWorkoutSelected,
                    isToday && s.dayToday,
                  ]}
                  onPress={() => setSelectedDay(key)}
                >
                  <Text
                    style={[
                      s.dayText,
                      hasWorkout && !isSelected && s.dayTextLight,
                      isToday && !hasWorkout && s.dayTextToday,
                    ]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.dayHeader}>{dayLabel(selectedDay)}</Text>
          {selectedEntries.length === 0 ? (
            <Text style={s.emptyHint}>No workouts this day</Text>
          ) : (
            selectedEntries.map((e) => <EntryCard key={e.log.id} entry={e} />)
          )}
        </ScrollView>
      )}
      </View>
    </SafeAreaView>
  );
}

function EntryCard({ entry }: { entry: HistoryEntry }) {
  const { log } = entry;
  return (
    <View style={cs.card}>
      <View style={cs.cardHead}>
        <Text style={cs.cardTitle}>{entry.name.toUpperCase()}</Text>
        <Text style={cs.cardMeta}>C{log.cycle} · W{log.week}</Text>
      </View>
      <View style={cs.sets}>
        <Text style={cs.sessionTitle}>{entry.title.toUpperCase()}</Text>
        {(log.sets ?? []).map((set, i) => (
          <Text key={i} style={cs.setLine}>
            {loggedLine(set)}
          </Text>
        ))}
        {log.notes && <Text style={cs.noteLine}>NOTE: {log.notes}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  toggle: {
    flexDirection: "row",
    margin: 14,
    marginBottom: 0,
    borderWidth: 2,
    borderColor: "#000",
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: "#fff" },
  toggleBtnRight: { borderLeftWidth: 2, borderLeftColor: "#000" },
  toggleBtnActive: { backgroundColor: "#000" },
  toggleText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: "#000",
  },
  toggleTextActive: { color: "#fff" },
  swipeArea: { flex: 1 },
  list: { padding: 14, gap: 10 },
  group: { gap: 10 },
  dayHeader: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: "#000",
    marginTop: 4,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthBtn: {
    width: 36,
    height: 32,
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  monthBtnText: { fontFamily: "ArchivoBlack_400Regular", fontSize: 16, color: "#000" },
  monthTitle: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 14,
    letterSpacing: 1.5,
    color: "#000",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 2,
    borderColor: "#000",
  },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  weekday: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 1,
    color: "#888",
  },
  day: { borderWidth: 2, borderColor: "transparent" },
  dayWorkout: { backgroundColor: "#000" },
  daySelected: { borderColor: "#000" },
  dayWorkoutSelected: { backgroundColor: "#fff" },
  dayToday: { borderColor: "#0000FF" },
  dayText: { fontFamily: "SpaceMono_400Regular", fontSize: 12, color: "#000" },
  dayTextLight: { color: "#fff" },
  dayTextToday: { color: "#0000FF" },
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
  noteLine: { fontFamily: "WorkSans_400Regular", fontSize: 12, color: "#333", marginTop: 4 },
  card: { borderWidth: 2, borderColor: "#000", backgroundColor: "#fff" },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
  },
  cardTitle: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 12,
    letterSpacing: 0.8,
    color: "#000",
  },
  cardMeta: { fontFamily: "SpaceMono_400Regular", fontSize: 10, color: "#666" },
  sets: { paddingHorizontal: 10, paddingVertical: 8 },
  sessionTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: "#000",
    marginBottom: 4,
  },
  setLine: {
    fontFamily: "SpaceMono_400Regular",
    fontSize: 12,
    color: "#333",
    paddingVertical: 2,
  },
});
