"use client";

import { KeyRound } from "lucide-react";
import type { Question, QuestionPaper, Section } from "@veda-ai/shared";
import { DifficultyBadge } from "@/src/components/output/DifficultyBadge";
import { QUESTION_TYPE_LABELS } from "@/src/lib/labels";

function optionLetter(i: number): string {
  return String.fromCharCode(65 + i);
}

function marksLabel(marks: number): string {
  return `${marks} ${marks === 1 ? "Mark" : "Marks"}`;
}

function PaperHeader({ paper }: { paper: QuestionPaper }): React.ReactNode {
  const totalQuestions = paper.sections.reduce((n, s) => n + s.questions.length, 0);
  return (
    <header>
      <h1 className="text-center text-2xl font-bold tracking-tight text-ink sm:text-[1.7rem]">
        {paper.title}
      </h1>

      <div className="mt-6 flex items-center justify-between border-t border-hairline pt-4 text-sm font-semibold text-ink">
        <span>Total Questions: {totalQuestions}</span>
        <span>Maximum Marks: {paper.totalMarks}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">
        All questions are compulsory unless stated otherwise.
      </p>
    </header>
  );
}

function StudentField({ label, className }: { label: string; className?: string }): React.ReactNode {
  return (
    <div className={`flex items-baseline gap-2 ${className ?? ""}`}>
      <span className="whitespace-nowrap text-sm font-semibold text-ink">{label}:</span>
      <input
        type="text"
        aria-label={label}
        className="answer-line min-w-0 flex-1 bg-transparent px-1 pb-0.5 text-sm text-ink outline-none focus:border-brand-500"
      />
    </div>
  );
}

function StudentInfo(): React.ReactNode {
  return (
    <div className="mt-5 space-y-3">
      <StudentField label="Name" />
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
        <StudentField label="Roll Number" className="sm:flex-1" />
        <StudentField label="Section" className="sm:w-52" />
      </div>
    </div>
  );
}

function QuestionItem({ question, number }: { question: Question; number: number }): React.ReactNode {
  const hasOptions = question.options && question.options.length > 0;
  return (
    <li className="flex items-start gap-3">
      <span className="w-6 shrink-0 text-right text-[0.95rem] font-semibold text-muted">{number}.</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.95rem] leading-relaxed text-ink">
            <DifficultyBadge difficulty={question.difficulty} className="mr-2 translate-y-[-1px]" />
            {question.text}
          </p>
          <span className="mt-0.5 shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-ink">
            {marksLabel(question.marks)}
          </span>
        </div>

        {hasOptions ? (
          <ol className="mt-2.5 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {question.options!.map((opt, i) => (
              <li key={`${question.id}::${opt}`} className="flex items-start gap-2 text-sm text-ink-soft">
                <span className="font-semibold text-muted">{optionLetter(i)}.</span>
                <span>{opt}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </li>
  );
}

function SectionBlock({ section }: { section: Section }): React.ReactNode {
  const typeLabel = section.questions[0]
    ? QUESTION_TYPE_LABELS[section.questions[0].type]
    : "Questions";
  return (
    <section className="mt-9">
      <h2 className="text-center text-lg font-bold text-ink">{section.title}</h2>
      <p className="mt-4 font-bold text-ink">{typeLabel}</p>
      {section.instruction ? (
        <p className="mt-0.5 text-sm italic text-muted">{section.instruction}</p>
      ) : null}
      <ol className="mt-4 list-none space-y-5">
        {section.questions.map((q, i) => (
          <QuestionItem key={q.id} question={q} number={i + 1} />
        ))}
      </ol>
    </section>
  );
}

function AnswerKey({ sections }: { sections: Section[] }): React.ReactNode {
  return (
    <div className="rounded-2xl bg-neutral-50 p-5 ring-1 ring-black/[0.05]">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-white">
          <KeyRound className="size-4" />
        </span>
        <div>
          <h3 className="font-bold leading-tight text-ink">Answer Key</h3>
          <p className="text-xs text-muted">Reference answers for each question.</p>
        </div>
      </div>
      {sections.map((s) => (
        <div key={s.id} className="mt-3">
          <p className="text-sm font-semibold text-ink">{s.title}</p>
          <ol className="mt-1.5 list-none space-y-1.5">
            {s.questions.map((q, i) => (
              <li key={q.id} className="flex gap-2 text-sm text-ink-soft">
                <span className="font-semibold text-muted">{i + 1}.</span>
                <span>{q.answer ?? "Not provided"}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/** Renders the exam paper purely from the validated QuestionPaper. */
export function QuestionPaperView({ paper }: { paper: QuestionPaper }): React.ReactNode {
  return (
    <article
      data-print="paper"
      className="rounded-panel bg-white p-6 shadow-soft ring-1 ring-black/[0.04] sm:p-9 lg:p-11"
    >
      <PaperHeader paper={paper} />
      <StudentInfo />

      {paper.sections.map((section) => (
        <SectionBlock key={section.id} section={section} />
      ))}

      <p className="mt-9 text-center text-sm font-bold text-ink">End of Question Paper</p>

      <div className="mt-8 border-t border-hairline pt-7">
        <AnswerKey sections={paper.sections} />
      </div>
    </article>
  );
}
