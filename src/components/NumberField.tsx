import { useState } from "react";
import { TextInput, type StyleProp, type TextStyle } from "react-native";
import { cleanEntry, editText, parseEntry, type EntryKind } from "./numberEntry";

// F31: the number between − and +. Tap it to type; every keystroke that makes a valid number is
// saved at once (clamped to the same limits as the buttons), so MARK COMPLETE never misses it.
export default function NumberField({
  value,
  display,
  kind = "int",
  clamp = (n) => n,
  allowEmpty = false,
  onChange,
  style,
}: {
  value: number | null;
  display: string;               // shown when not typing (e.g. "135 lb", "7:30", "—")
  kind?: EntryKind;
  clamp?: (n: number) => number;
  allowEmpty?: boolean;          // clearing the field sets null (AMRAP reps, optional pace)
  onChange: (n: number | null) => void;
  style?: StyleProp<TextStyle>;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function handleText(t: string) {
    const text = cleanEntry(kind, t);
    const n = parseEntry(kind, text);
    if (n == null) {
      setDraft(text);
      if (text === "" && allowEmpty) onChange(null);
      return;
    }
    const c = clamp(n);
    setDraft(c === n ? text : editText(kind, c));
    onChange(c);
  }

  return (
    <TextInput
      style={[style, { paddingVertical: 0, paddingHorizontal: 0 }]}
      value={draft ?? display}
      keyboardType="number-pad"
      selectTextOnFocus
      onFocus={() => setDraft(editText(kind, value))}
      onBlur={() => setDraft(null)}
      onChangeText={handleText}
    />
  );
}
