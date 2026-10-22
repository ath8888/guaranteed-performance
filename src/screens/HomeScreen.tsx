import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
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
import { roundLb } from "../engine/shared";
import { estCompletionLabel } from "../engine/progression";
import { StandardService } from "../services/StandardService";
import { TrainingService } from "../services/TrainingService";
import { SessionService } from "../services/SessionService";
import AddStandardSheet from "../components/AddStandardSheet";
import ProgressChartModal from "../components/ProgressChartModal";

interface Row {
  standard: Standard;
  training: TrainingState | null;
}

export default function HomeScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chartStandard, setChartStandard] = useState<Standard | null>(null);

  const [fontsLoaded] = useFonts({
    ArchivoBlack_400Regular,
    WorkSans_400Regular,
    WorkSans_600SemiBold,
    SpaceMono_400Regular,
  });

  async function loadData() {
    const standards = await StandardService.getAll();
    const active = standards.filter((s) => s.status === "active");
    const rowData = await Promise.all(
      active.map(async (s) => ({
        standard: s,
        training: await TrainingService.get(s.id),
      }))
    );
    setRows(rowData);
  }

  async function handleArchive(id: string) {
    const std = await StandardService.getById(id);
    if (std) await StandardService.save({ ...std, status: "archived" });
    await loadData();
  }

  async function handleDelete(id: string) {
    await StandardService.remove(id);
    await TrainingService.remove(id);
    await SessionService.removeAll(id);
    await loadData();
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>STANDARDS</Text>
        </View>

        {/* List */}
        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>NO STANDARDS YET</Text>
            <Text style={styles.emptyHint}>Tap + to add your first lift</Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.standard.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <StandardCard
                row={item}
                onArchive={() => handleArchive(item.standard.id)}
                onDelete={() => handleDelete(item.standard.id)}
                onOpenChart={() => setChartStandard(item.standard)}
              />
            )}
          />
        )}

        {/* + button */}
        <View style={styles.fabRow}>
          <TouchableOpacity style={styles.fab} onPress={() => setSheetOpen(true)}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AddStandardSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdded={() => {
          setSheetOpen(false);
          loadData();
        }}
      />
      <ProgressChartModal
        visible={chartStandard !== null}
        onClose={() => setChartStandard(null)}
        standard={chartStandard}
      />
    </SafeAreaView>
  );
}

function StandardCard({
  row,
  onArchive,
  onDelete,
  onOpenChart,
}: {
  row: Row;
  onArchive: () => void;
  onDelete: () => void;
  onOpenChart: () => void;
}) {
  const { standard, training } = row;
  const meta = STANDARD_META[standard.type];
  const [actionOpen, setActionOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function closeAction() {
    setActionOpen(false);
    setConfirmDelete(false);
  }

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={1}
      onLongPress={() => setActionOpen(true)}
      delayLongPress={400}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardLabel}>{(standard.name ?? meta.label).toUpperCase()}</Text>
        <View style={styles.cardTopRight}>
          <TouchableOpacity
            onPress={onOpenChart}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.chartBtn}
          >
            <Text style={styles.chartBtnText}>↗</Text>
          </TouchableOpacity>
          {training && (
            <Text style={styles.cardCycle}>
              C{training.cycle} W{training.week}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.cardNumbers}>
        <View style={styles.numCol}>
          <Text style={styles.numLabel}>START</Text>
          <Text style={styles.numValueMono}>
            {standard.start}<Text style={styles.numUnit}> LB</Text>
          </Text>
        </View>
        <View style={styles.numDivider} />
        <View style={styles.numCol}>
          <Text style={styles.numLabel}>CURRENT</Text>
          <Text style={[styles.numValueMono, styles.numAccent]}>
            {training ? roundLb(training.trainingMax / 0.9) : standard.start}
            <Text style={styles.numUnit}> LB</Text>
          </Text>
        </View>
        <View style={styles.numDivider} />
        <View style={styles.numCol}>
          <Text style={styles.numLabel}>TARGET</Text>
          <Text style={styles.numValueMono}>
            {standard.target}<Text style={styles.numUnit}> LB</Text>
          </Text>
        </View>
      </View>
      <View style={styles.etaRow}>
        <Text style={styles.etaLabel}>ESTIMATED COMPLETION DATE</Text>
        <Text style={styles.etaValue}>{estCompletionLabel(standard, training)}</Text>
      </View>

      {actionOpen && (
        <View style={styles.actionRow}>
          {!confirmDelete ? (
            <>
              <TouchableOpacity
                style={styles.actionArchive}
                onPress={() => { onArchive(); closeAction(); }}
              >
                <Text style={styles.actionArchiveText}>ARCHIVE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionDelete}
                onPress={() => setConfirmDelete(true)}
              >
                <Text style={styles.actionDeleteText}>DELETE</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={closeAction}>
                <Text style={styles.actionCancel}>CANCEL</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.confirmLabel}>DELETE FOREVER?</Text>
              <TouchableOpacity
                style={styles.actionDelete}
                onPress={() => { onDelete(); closeAction(); }}
              >
                <Text style={styles.actionDeleteText}>YES</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setConfirmDelete(false)}>
                <Text style={styles.actionCancel}>NO</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    borderBottomWidth: 3,
    borderBottomColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerText: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 22,
    color: "#000",
    letterSpacing: 2,
  },
  list: { padding: 16, gap: 12 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 16,
    letterSpacing: 2,
    color: "#000",
  },
  emptyHint: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#666",
    marginTop: 8,
  },
  fabRow: {
    alignItems: "center",
    paddingBottom: 16,
    paddingTop: 8,
  },
  fab: {
    width: 56,
    height: 56,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#000",
  },
  fabText: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "ArchivoBlack_400Regular",
  },
  card: {
    borderWidth: 2,
    borderColor: "#000",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  cardLabel: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 14,
    letterSpacing: 1.5,
    color: "#000",
  },
  cardTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chartBtn: {
    borderWidth: 2,
    borderColor: "#000",
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  chartBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 13,
    color: "#000",
    lineHeight: 16,
  },
  cardCycle: {
    fontFamily: "SpaceMono_400Regular",
    fontSize: 12,
    color: "#666",
  },
  cardNumbers: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  numCol: {
    flex: 1,
    alignItems: "center",
  },
  numDivider: {
    width: 2,
    backgroundColor: "#000",
    marginVertical: 2,
  },
  numLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: "#666",
    marginBottom: 4,
  },
  numValueMono: {
    fontFamily: "SpaceMono_400Regular",
    fontSize: 18,
    color: "#000",
  },
  numAccent: {
    color: "#0000FF",
  },
  numUnit: {
    fontSize: 11,
  },
  etaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 2,
    borderTopColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  etaLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: "#666",
  },
  etaValue: {
    fontFamily: "SpaceMono_400Regular",
    fontSize: 13,
    color: "#000",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 2,
    borderTopColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  actionArchive: {
    borderWidth: 2,
    borderColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionArchiveText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#000",
  },
  actionDelete: {
    backgroundColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionDeleteText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#fff",
  },
  actionCancel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#888",
  },
  confirmLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 1,
    color: "#000",
    flex: 1,
  },
});
