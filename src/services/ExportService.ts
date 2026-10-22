import type { Standard, TrainingState, SessionLog } from "../engine/types";
import { STANDARD_META } from "../engine/types";

export interface ExportData {
  standards: Standard[];
  training: TrainingState[];
  sessions: SessionLog[];
}

export const ExportService = {
  toMarkdown(data: ExportData): string {
    const lines: string[] = ["# Guaranteed Standards Export", ""];

    lines.push("## Standards", "");
    lines.push("| Lift | Baseline | Target | Goal Date | Status |");
    lines.push("|------|----------|--------|-----------|--------|");
    for (const s of data.standards) {
      const meta = STANDARD_META[s.type];
      lines.push(
        `| ${meta.label} | ${s.start} ${meta.unit} | ${s.target} ${meta.unit} | ${s.desiredCompletionDate} | ${s.status} |`
      );
    }
    lines.push("");

    lines.push("## Training State", "");
    lines.push("| Lift | Training Max | Cycle | Week |");
    lines.push("|------|-------------|-------|------|");
    for (const t of data.training) {
      const std = data.standards.find((s) => s.id === t.standardId);
      const label = std ? STANDARD_META[std.type].label : t.standardId;
      lines.push(`| ${label} | ${t.trainingMax} lb | ${t.cycle} | ${t.week} |`);
    }
    lines.push("");

    lines.push("## Session Log", "");
    lines.push("| Lift | Cycle | Week | Session | Completed |");
    lines.push("|------|-------|------|---------|-----------|");
    for (const log of data.sessions) {
      const std = data.standards.find((s) => s.id === log.standardId);
      const label = std ? STANDARD_META[std.type].label : log.standardId;
      lines.push(
        `| ${label} | ${log.cycle} | ${log.week} | ${log.sessionIndex} | ${log.completedAt.slice(0, 10)} |`
      );
    }

    return lines.join("\n");
  },

  toCSV(data: ExportData): string {
    const lines: string[] = [];

    lines.push("STANDARDS");
    lines.push("Lift,Baseline (lb),Target (lb),Goal Date,Status");
    for (const s of data.standards) {
      const meta = STANDARD_META[s.type];
      lines.push(`${meta.label},${s.start},${s.target},${s.desiredCompletionDate},${s.status}`);
    }
    lines.push("");

    lines.push("TRAINING STATE");
    lines.push("Lift,Training Max (lb),Cycle,Week");
    for (const t of data.training) {
      const std = data.standards.find((s) => s.id === t.standardId);
      const label = std ? STANDARD_META[std.type].label : t.standardId;
      lines.push(`${label},${t.trainingMax},${t.cycle},${t.week}`);
    }
    lines.push("");

    lines.push("SESSION LOG");
    lines.push("Lift,Cycle,Week,Session,Completed At");
    for (const log of data.sessions) {
      const std = data.standards.find((s) => s.id === log.standardId);
      const label = std ? STANDARD_META[std.type].label : log.standardId;
      lines.push(`${label},${log.cycle},${log.week},${log.sessionIndex},${log.completedAt.slice(0, 10)}`);
    }

    return lines.join("\n");
  },
};
