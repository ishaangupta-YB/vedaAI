import * as ReactPDF from "@react-pdf/renderer";
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  type QuestionPaper,
} from "@veda-ai/shared";

/**
 * The exam-paper PDF, rendered server-side with `@react-pdf/renderer` (no
 * headless browser). It renders ONLY from a validated, stored `QuestionPaper`
 * — never raw model output. Answer keys are intentionally omitted (answers are
 * "not rendered to students by default", per the contract).
 *
 * Difficulty labels and the badge colour-coding come from `@veda-ai/shared`
 * (`DIFFICULTY_LABELS` / `DIFFICULTY_COLORS`) — the same source the web UI badge
 * reads from — so the on-screen and printed papers can never drift.
 *
 * `@react-pdf/renderer` ships ESM at runtime but CJS-style (`export =`) types,
 * so we reference its members through a namespace import (works for both).
 */
const { Document, Page, Text, View, StyleSheet } = ReactPDF;

/* ink ramp mirrors the web's `--color-ink` / `--color-muted` tokens. */
const INK = "#1c1c1e";
const INK_SOFT = "#3a3a3e";
const MUTED = "#6c6c72";
const HAIRLINE = "#d9d9de";

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 52,
    fontSize: 10.5,
    fontFamily: "Helvetica",
    color: INK,
    lineHeight: 1.45,
  },
  title: {
    fontSize: 19,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  metaText: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
  },
  note: {
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
  },
  studentBlock: {
    marginTop: 14,
    marginBottom: 4,
  },
  studentLine: {
    marginBottom: 7,
    color: INK_SOFT,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  sectionType: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
  },
  sectionInstruction: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 9.5,
    color: MUTED,
    marginTop: 2,
  },
  question: {
    flexDirection: "row",
    marginTop: 9,
  },
  qNum: {
    width: 20,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
  },
  qBody: {
    flex: 1,
  },
  qText: {
    color: INK,
  },
  badge: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.3,
  },
  marks: {
    fontFamily: "Helvetica-Bold",
    color: INK,
  },
  options: {
    marginTop: 5,
    marginLeft: 4,
  },
  option: {
    flexDirection: "row",
    marginBottom: 2.5,
    color: INK_SOFT,
  },
  optionLetter: {
    width: 16,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
  },
  endNote: {
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 26,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 52,
    right: 52,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: MUTED,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingTop: 6,
  },
});

function marksLabel(marks: number): string {
  return `${marks} ${marks === 1 ? "Mark" : "Marks"}`;
}

function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/**
 * Inline colour-coded difficulty pill, rendered as a nested `<Text>` so it flows
 * with the question text (mirroring the web badge). Colours come from the shared
 * `DIFFICULTY_COLORS` palette; the surrounding spaces give the fill some breathing
 * room since `@react-pdf/renderer` ignores padding on inline text.
 */
function DifficultyBadge({ difficulty }: { difficulty: QuestionPaper["sections"][number]["questions"][number]["difficulty"] }): React.JSX.Element {
  const c = DIFFICULTY_COLORS[difficulty];
  return (
    <Text style={{ ...styles.badge, color: c.fg, backgroundColor: c.bg }}>
      {" "}
      {DIFFICULTY_LABELS[difficulty].toUpperCase()}
      {" "}
    </Text>
  );
}

export interface PaperDocumentProps {
  paper: QuestionPaper;
}

export function PaperDocument({ paper }: PaperDocumentProps): React.JSX.Element {
  const totalQuestions = paper.sections.reduce(
    (n, section) => n + section.questions.length,
    0,
  );

  return (
    <Document title={paper.title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{paper.title}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Total Questions: {totalQuestions}</Text>
          <Text style={styles.metaText}>Maximum Marks: {paper.totalMarks}</Text>
        </View>
        <Text style={styles.note}>
          All questions are compulsory unless stated otherwise.
        </Text>

        <View style={styles.studentBlock}>
          <Text style={styles.studentLine}>
            Name: ______________________________
          </Text>
          <Text style={styles.studentLine}>
            Roll Number: ______________________
          </Text>
          <Text style={styles.studentLine}>
            Section: ______________________
          </Text>
        </View>

        {paper.sections.map((section) => {
          const typeLabel = section.questions[0]
            ? QUESTION_TYPE_LABELS[section.questions[0].type]
            : "Questions";
          return (
            <View key={section.id} style={styles.section}>
              {/* Keep the section heading with its first question: it pulls to
                  the next page rather than being stranded at a page bottom. */}
              <View style={styles.sectionHeader} wrap={false} minPresenceAhead={48}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionType}>{typeLabel}</Text>
                {section.instruction ? (
                  <Text style={styles.sectionInstruction}>{section.instruction}</Text>
                ) : null}
              </View>

              {section.questions.map((question, index) => (
                <View key={question.id} style={styles.question} wrap={false}>
                  <Text style={styles.qNum}>{index + 1}.</Text>
                  <View style={styles.qBody}>
                    <Text style={styles.qText}>
                      <DifficultyBadge difficulty={question.difficulty} />{" "}
                      {question.text}{" "}
                      <Text style={styles.marks}>[{marksLabel(question.marks)}]</Text>
                    </Text>
                    {question.type === "mcq" && question.options ? (
                      <View style={styles.options}>
                        {question.options.map((option, optionIndex) => (
                          <View key={optionIndex} style={styles.option}>
                            <Text style={styles.optionLetter}>
                              {optionLetter(optionIndex)})
                            </Text>
                            <Text style={{ flex: 1 }}>{option}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          );
        })}

        <Text style={styles.endNote}>— End of Question Paper —</Text>

        <View style={styles.footer} fixed>
          <Text>{paper.title}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
