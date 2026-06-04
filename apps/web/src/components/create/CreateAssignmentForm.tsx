"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Calendar, Mic, Plus, Sparkles, Trash2 } from "lucide-react";
import { CreateAssignmentInput } from "@veda-ai/shared";
import { Button } from "@/src/components/ui/Button";
import { ErrorText, Label, Select, TextInput, Textarea } from "@/src/components/ui/Field";
import { NumberStepper } from "@/src/components/ui/NumberStepper";
import { FileUpload } from "@/src/components/create/FileUpload";
import { ApiError, createAssignment } from "@/src/lib/api";
import { QUESTION_TYPE_LABELS, QUESTION_TYPE_ORDER } from "@/src/lib/labels";
import { useGenerationStore } from "@/src/store/generation";
import { cn } from "@/src/lib/cn";

type FormValues = CreateAssignmentInput;

/** ISO (with offset) -> value for a <input type="datetime-local"> in local time. */
function isoToLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

const DEFAULT_VALUES: FormValues = {
  title: "",
  dueDate: "",
  questionConfigs: [{ type: "mcq", count: 5, marksPerQuestion: 1 }],
  additionalInstructions: "",
  sourceText: undefined,
};

export function CreateAssignmentForm(): React.ReactNode {
  const router = useRouter();
  const beginRun = useGenerationStore((s) => s.beginRun);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Move focus to the error summary when a server-side submit error appears, so
  // keyboard and screen-reader users are taken straight to it (field-level
  // validation errors are handled by react-hook-form's focus-on-error).
  useEffect(() => {
    if (submitError) errorRef.current?.focus();
  }, [submitError]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateAssignmentInput),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });

  const { fields, append, remove } = useFieldArray({ control, name: "questionConfigs" });

  const configs = useWatch({ control, name: "questionConfigs" });
  const instructions = useWatch({ control, name: "additionalInstructions" }) ?? "";
  const totalQuestions = configs?.reduce((sum, c) => sum + (Number(c.count) || 0), 0) ?? 0;
  const totalMarks =
    configs?.reduce((sum, c) => sum + (Number(c.count) || 0) * (Number(c.marksPerQuestion) || 0), 0) ?? 0;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const payload: FormValues = {
        ...values,
        additionalInstructions: values.additionalInstructions?.trim() || undefined,
        sourceText: values.sourceText || undefined,
      };
      const { assignmentId, jobId } = await createAssignment(payload);
      beginRun(assignmentId, jobId);
      router.push(`/assignments/${assignmentId}`);
    } catch (e) {
      setSubmitError(
        e instanceof ApiError ? e.message : "Something went wrong while creating the assignment.",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="rounded-panel bg-gradient-to-b from-white to-neutral-50/70 p-5 shadow-soft ring-1 ring-black/[0.04] sm:p-7 lg:p-8">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-ink">Assignment Details</h2>
          <p className="mt-0.5 text-sm text-muted">Basic information about your assignment</p>
        </div>

        {/* Title */}
        <div className="mb-6">
          <Label htmlFor="title">Assignment Title</Label>
          <TextInput
            id="title"
            className="mt-2"
            placeholder="e.g. Quiz on Electricity"
            invalid={!!errors.title}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "title-error" : undefined}
            {...register("title")}
          />
          <ErrorText id="title-error">{errors.title?.message}</ErrorText>
        </div>

        {/* Source upload */}
        <div className="mb-6">
          <FileUpload onChange={(text) => setValue("sourceText", text, { shouldDirty: true })} />
        </div>

        {/* Due date */}
        <div className="mb-6">
          <Label htmlFor="dueDate">Due Date</Label>
          <Controller
            control={control}
            name="dueDate"
            render={({ field }) => (
              <div className="relative mt-2">
                <input
                  id="dueDate"
                  ref={field.ref}
                  type="datetime-local"
                  aria-label="Due date"
                  value={isoToLocalInput(field.value)}
                  onChange={(e) => field.onChange(localInputToIso(e.target.value))}
                  onBlur={field.onBlur}
                  aria-invalid={!!errors.dueDate}
                  aria-describedby={errors.dueDate ? "dueDate-error" : undefined}
                  className={cn(
                    "h-12 w-full rounded-2xl bg-white px-4 pr-11 text-sm text-ink shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] outline-none transition focus:shadow-[inset_0_0_0_1.5px_var(--color-ink)]",
                    errors.dueDate && "shadow-[inset_0_0_0_1.5px_var(--color-hard-ring)]",
                  )}
                />
                <Calendar className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
              </div>
            )}
          />
          <ErrorText id="dueDate-error">{errors.dueDate?.message}</ErrorText>
        </div>

        {/* Question configs */}
        <fieldset className="mb-2">
          <legend className="sr-only">Question types</legend>

          {/* Column headers (desktop) */}
          <div className="mb-2 hidden items-center gap-3 px-1 sm:flex">
            <span className="flex-1 text-sm font-semibold text-ink">Question Type</span>
            <span className="w-28 text-center text-sm font-semibold text-ink">No. of Questions</span>
            <span className="w-28 text-center text-sm font-semibold text-ink">Marks</span>
            <span className="w-9" />
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => {
              const removable = fields.length > 1;
              const rowErr = errors.questionConfigs?.[index];
              return (
                <div
                  key={field.id}
                  className="rounded-2xl bg-neutral-50/70 p-3 ring-1 ring-black/[0.05] sm:bg-transparent sm:p-0 sm:ring-0"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="sm:flex-1">
                      <Select
                        aria-label={`Question type ${index + 1}`}
                        invalid={!!rowErr?.type}
                        {...register(`questionConfigs.${index}.type` as const)}
                      >
                        {QUESTION_TYPE_ORDER.map((t) => (
                          <option key={t} value={t}>
                            {QUESTION_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="flex flex-wrap items-end gap-3 sm:flex-nowrap">
                      <div className="flex flex-col items-center gap-1 sm:w-28">
                        <span className="text-xs font-medium text-faint sm:hidden">No. of Questions</span>
                        <Controller
                          control={control}
                          name={`questionConfigs.${index}.count` as const}
                          render={({ field: f }) => (
                            <NumberStepper
                              value={f.value}
                              onChange={f.onChange}
                              onBlur={f.onBlur}
                              inputRef={f.ref}
                              min={1}
                              max={50}
                              ariaLabel={`Number of questions for type ${index + 1}`}
                              invalid={!!rowErr?.count}
                            />
                          )}
                        />
                      </div>

                      <div className="flex flex-col items-center gap-1 sm:w-28">
                        <span className="text-xs font-medium text-faint sm:hidden">Marks</span>
                        <Controller
                          control={control}
                          name={`questionConfigs.${index}.marksPerQuestion` as const}
                          render={({ field: f }) => (
                            <NumberStepper
                              value={f.value}
                              onChange={f.onChange}
                              onBlur={f.onBlur}
                              inputRef={f.ref}
                              min={1}
                              max={100}
                              ariaLabel={`Marks per question for type ${index + 1}`}
                              invalid={!!rowErr?.marksPerQuestion}
                            />
                          )}
                        />
                      </div>

                      <div className="flex w-9 shrink-0 justify-center self-center">
                        {removable ? (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            aria-label={`Remove question type ${index + 1}`}
                            className="flex size-9 items-center justify-center rounded-full text-faint transition hover:bg-hard-bg hover:text-hard-fg"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {typeof errors.questionConfigs?.message === "string" ? (
            <ErrorText>{errors.questionConfigs.message}</ErrorText>
          ) : null}

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => append({ type: "mcq", count: 1, marksPerQuestion: 1 })}
              disabled={fields.length >= 20}
              className="flex items-center gap-2.5 text-sm font-semibold text-ink transition disabled:opacity-40"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-ink text-white">
                <Plus className="size-4" />
              </span>
              Add Question Type
            </button>

            <div className="text-sm text-muted sm:text-right">
              <p>
                Total Questions : <span className="font-bold text-ink">{totalQuestions}</span>
              </p>
              <p>
                Total Marks : <span className="font-bold text-ink">{totalMarks}</span>
              </p>
            </div>
          </div>
        </fieldset>

        {/* Additional instructions */}
        <div className="mt-6">
          <Label htmlFor="additionalInstructions">Additional Information <span className="font-normal text-faint">(for better output)</span></Label>
          <div className="relative mt-2">
            <Textarea
              id="additionalInstructions"
              placeholder="e.g. Generate a question paper for a 3-hour exam covering chapters 1–4…"
              maxLength={2000}
              invalid={!!errors.additionalInstructions}
              aria-invalid={!!errors.additionalInstructions}
              className="pr-12"
              {...register("additionalInstructions")}
            />
            <span className="pointer-events-none absolute bottom-3 right-3 text-faint" aria-hidden>
              <Mic className="size-5" />
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <ErrorText>{errors.additionalInstructions?.message}</ErrorText>
            <span className="ml-auto text-xs text-faint">{instructions.length}/2000</span>
          </div>
        </div>
      </div>

      {submitError ? (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="flex items-start gap-3 rounded-2xl bg-hard-bg px-4 py-3 text-sm text-hard-fg outline-none ring-1 ring-hard-ring focus-visible:ring-2 focus-visible:ring-hard-fg"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/")}
          disabled={isSubmitting}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
          <Sparkles className="size-[1.15rem]" />
          {isSubmitting ? "Generating…" : "Generate Question Paper"}
        </Button>
      </div>
    </form>
  );
}
