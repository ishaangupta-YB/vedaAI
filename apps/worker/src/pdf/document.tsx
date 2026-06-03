import * as ReactPDF from "@react-pdf/renderer";
import type { Difficulty, QuestionPaper } from "@veda-ai/shared";

/**
 * The exam-paper PDF, rendered server-side with `@react-pdf/renderer` (no
 * headless browser). It renders ONLY from a validated, stored `QuestionPaper`
 * — never raw model output. Answer keys are intentionally omitted (answers are
 * "not rendered to students by default", per the contract).
 *
 * `@react-pdf/renderer` ships ESM at runtime but CJS-style (`export =`) types,
 * so we reference its members through a namespace import (works for both).
 */
const { Document, Page, Text, View, StyleSheet } = ReactPDF;

/** Difficulty tags are presented title-cased in output (see CLAUDE.md). */
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
};

const styles = StyleSheet.create({
  page: {
    paddingVertical: 40,
    paddingHorizontal: 48,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
    lineHeight: 1.4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
  },
  metaText: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  note: {
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
  },
  studentBlock: {
    marginTop: 14,
    marginBottom: 6,
  },
  studentLine: {
    marginBottom: 6,
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 6,
  },
  sectionInstruction: {
    fontFamily: "Helvetica-Oblique",
    marginBottom: 8,
  },
  question: {
    marginBottom: 8,
  },
  questionText: {
    flexDirection: "row",
  },
  options: {
    marginTop: 4,
    marginLeft: 18,
  },
  option: {
    marginBottom: 2,
  },
  endNote: {
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 22,
  },
});

function marksLabel(marks: number): string {
  return `${marks} ${marks === 1 ? "Mark" : "Marks"}`;
}

function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export interface PaperDocumentProps {
  paper: QuestionPaper;
}

export function PaperDocument({ paper }: PaperDocumentProps): React.JSX.Element {
  return (
    <Document title={paper.title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{paper.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Total Marks: {paper.totalMarks}</Text>
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

        {paper.sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.instruction ? (
              <Text style={styles.sectionInstruction}>{section.instruction}</Text>
            ) : null}
            {section.questions.map((question, index) => (
              <View key={question.id} style={styles.question} wrap={false}>
                <Text>
                  {index + 1}. [{DIFFICULTY_LABELS[question.difficulty]}]{" "}
                  {question.text} [{marksLabel(question.marks)}]
                </Text>
                {question.type === "mcq" && question.options ? (
                  <View style={styles.options}>
                    {question.options.map((option, optionIndex) => (
                      <Text key={optionIndex} style={styles.option}>
                        {optionLetter(optionIndex)}) {option}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.endNote}>End of Question Paper</Text>
      </Page>
    </Document>
  );
}
