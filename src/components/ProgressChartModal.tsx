import { useEffect, useState } from "react";
import {
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from "react-native-svg";
import type { SessionLog, Standard } from "../engine/types";
import { STANDARD_META } from "../engine/types";
import { estimate1RM } from "../engine/shared";
import { SessionService } from "../services/SessionService";

interface DataPoint {
  date: string;
  rm: number;
  label: string;
}

function buildDataPoints(logs: SessionLog[]): DataPoint[] {
  return logs
    .filter((l) => l.sessionIndex === 0 && l.week !== 4)
    .map((l) => {
      const lastSet = l.sets?.[l.sets.length - 1];
      if (!lastSet?.weight || !lastSet?.reps) return null;
      const rm = Math.round(estimate1RM(lastSet.weight, lastSet.reps));
      const d = new Date(l.completedAt);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      return { date: l.completedAt, rm, label };
    })
    .filter((x): x is DataPoint => x !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface Props {
  visible: boolean;
  onClose: () => void;
  standard: Standard | null;
}

const SCREEN_W = Dimensions.get("window").width;
const C_W = SCREEN_W - 32;
const C_H = 200;
const PAD_L = 46;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 28;
const IW = C_W - PAD_L - PAD_R;
const IH = C_H - PAD_T - PAD_B;

export default function ProgressChartModal({ visible, onClose, standard }: Props) {
  const [points, setPoints] = useState<DataPoint[]>([]);

  useEffect(() => {
    if (visible && standard) {
      SessionService.getAll(standard.id).then((logs) => {
        setPoints(buildDataPoints(logs));
      });
    }
  }, [visible, standard?.id]);

  if (!standard) return null;

  const meta = STANDARD_META[standard.type];
  const displayName = standard.name ?? meta.label;
  const hasData = points.length >= 2;
  const latestRM = points.length > 0 ? points[points.length - 1].rm : null;

  const rmValues = points.map((p) => p.rm);
  const rawMin = hasData ? Math.min(...rmValues, standard.start) : standard.start;
  const rawMax = hasData ? Math.max(...rmValues, standard.target) : standard.target;
  const yMin = Math.max(0, Math.floor(rawMin / 10) * 10 - 20);
  const yMax = Math.ceil(rawMax / 10) * 10 + 20;
  const yRange = yMax - yMin || 1;

  function cx(i: number): number {
    return PAD_L + (points.length <= 1 ? IW / 2 : (i / (points.length - 1)) * IW);
  }
  function cy(v: number): number {
    return PAD_T + IH - ((v - yMin) / yRange) * IH;
  }

  const polyPoints = points
    .map((p, i) => `${cx(i).toFixed(1)},${cy(p.rm).toFixed(1)}`)
    .join(" ");

  const yTicks = [
    yMin,
    Math.round(yMin + yRange / 3),
    Math.round(yMin + (2 * yRange) / 3),
    yMax,
  ];

  const xLabelIndices =
    points.length <= 5
      ? points.map((_, i) => i)
      : [
          0,
          Math.round(points.length / 4),
          Math.round(points.length / 2),
          Math.round((3 * points.length) / 4),
          points.length - 1,
        ];

  const targetY = cy(standard.target);
  const targetInView = targetY >= PAD_T && targetY <= PAD_T + IH;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>{displayName.toUpperCase()}</Text>
            <Text style={s.subtitle}>1RM PROGRESS</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={s.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        {!hasData ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>NO DATA YET</Text>
            <Text style={s.emptyHint}>
              Complete main lift sessions to see your progress
            </Text>
          </View>
        ) : (
          <>
            <View style={s.chartWrap}>
              <Svg width={C_W} height={C_H}>
                {/* Y axis */}
                <Line
                  x1={PAD_L} y1={PAD_T}
                  x2={PAD_L} y2={PAD_T + IH}
                  stroke="#000" strokeWidth={2}
                />
                {/* X axis */}
                <Line
                  x1={PAD_L} y1={PAD_T + IH}
                  x2={PAD_L + IW} y2={PAD_T + IH}
                  stroke="#000" strokeWidth={2}
                />
                {/* Y ticks + labels */}
                {yTicks.map((v, i) => (
                  <G key={i}>
                    <Line
                      x1={PAD_L - 4} y1={cy(v)}
                      x2={PAD_L} y2={cy(v)}
                      stroke="#000" strokeWidth={1.5}
                    />
                    <SvgText
                      x={PAD_L - 7} y={cy(v) + 4}
                      textAnchor="end"
                      fontSize={9} fill="#555"
                    >
                      {v}
                    </SvgText>
                  </G>
                ))}
                {/* Target reference line */}
                {targetInView && (
                  <G>
                    <Line
                      x1={PAD_L} y1={targetY}
                      x2={PAD_L + IW} y2={targetY}
                      stroke="#000" strokeWidth={1}
                      strokeDasharray="5,4"
                    />
                    <SvgText
                      x={PAD_L + IW - 2} y={targetY - 4}
                      textAnchor="end"
                      fontSize={8} fill="#555"
                    >
                      TARGET
                    </SvgText>
                  </G>
                )}
                {/* Data line */}
                <Polyline
                  points={polyPoints}
                  fill="none"
                  stroke="#0000FF"
                  strokeWidth={2.5}
                />
                {/* Data dots */}
                {points.map((p, i) => (
                  <Circle
                    key={i}
                    cx={cx(i)} cy={cy(p.rm)}
                    r={3.5}
                    fill="#0000FF"
                  />
                ))}
                {/* X axis date labels */}
                {xLabelIndices.map((i) => (
                  <SvgText
                    key={i}
                    x={cx(i)} y={PAD_T + IH + 16}
                    textAnchor="middle"
                    fontSize={8} fill="#555"
                  >
                    {points[i].label}
                  </SvgText>
                ))}
              </Svg>
            </View>

            {/* Summary row */}
            <View style={s.statRow}>
              <View style={s.stat}>
                <Text style={s.statLabel}>LATEST EST. 1RM</Text>
                <Text style={s.statValue}>
                  {latestRM}
                  <Text style={s.statUnit}> LB</Text>
                </Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.stat}>
                <Text style={s.statLabel}>TARGET</Text>
                <Text style={s.statValue}>
                  {standard.target}
                  <Text style={s.statUnit}> LB</Text>
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopWidth: 3,
    borderTopColor: "#000",
    paddingTop: 20,
    paddingBottom: 36,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 16,
    letterSpacing: 1,
    color: "#000",
  },
  subtitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.5,
    color: "#555",
    marginTop: 2,
  },
  closeBtn: { fontSize: 18, color: "#000" },
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyTitle: {
    fontFamily: "ArchivoBlack_400Regular",
    fontSize: 13,
    letterSpacing: 2,
    color: "#000",
  },
  emptyHint: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  chartWrap: { marginBottom: 16 },
  statRow: {
    flexDirection: "row",
    borderTopWidth: 2,
    borderTopColor: "#000",
    paddingTop: 12,
  },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { width: 2, backgroundColor: "#000", marginVertical: 2 },
  statLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: "#666",
    marginBottom: 4,
  },
  statValue: {
    fontFamily: "SpaceMono_400Regular",
    fontSize: 20,
    color: "#0000FF",
  },
  statUnit: { fontSize: 11, color: "#0000FF" },
});
